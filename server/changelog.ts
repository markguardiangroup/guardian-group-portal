import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { pool } from "./db";

const CHANGELOG_PATH = path.resolve(process.cwd(), "changelog.json");

export type ChangelogCategory = "bug" | "enhancement" | "feature" | "other";

export interface ChangelogEntry {
  id: string;
  patch: number;
  message: string;
  category: ChangelogCategory;
  createdAt: string;
  createdBy: string;
}

export interface ChangelogVersion {
  id: string;
  major: number;
  minor: number;
  patch: number;
  /**
   * The patch number that was live on production at the last publish.
   * Dev patch is always >= publishedPatch.
   * After a publish, bumpDevPatchAfterPublish() sets publishedPatch = patch
   * and increments patch by 1, ready for the next dev cycle.
   */
  publishedPatch?: number;
  label: string;
  isActive: boolean;
  createdAt: string;
  entries: ChangelogEntry[];
  /**
   * IDs of all entries that existed when patchedEntryIds was last written.
   * Kept in sync whenever entries are added via the API.
   * No longer used for auto-increment on startup — patch management is now
   * explicit (see bumpDevPatchAfterPublish).
   */
  patchedEntryIds?: string[];
}

export interface Changelog {
  activeVersionId: string;
  versions: ChangelogVersion[];
}

const DEFAULT_CHANGELOG: Changelog = {
  activeVersionId: "init-v1-0",
  versions: [
    {
      id: "init-v1-0",
      major: 1,
      minor: 0,
      patch: 0,
      publishedPatch: 0,
      label: "Initial Release",
      isActive: true,
      createdAt: new Date().toISOString(),
      entries: [],
      patchedEntryIds: [],
    },
  ],
};

export async function readChangelog(): Promise<Changelog> {
  let raw: string;
  try {
    raw = await fs.readFile(CHANGELOG_PATH, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      await writeChangelog(DEFAULT_CHANGELOG);
      return DEFAULT_CHANGELOG;
    }
    throw new Error(`Failed to read changelog.json: ${err.message}`);
  }
  const parsed = JSON.parse(raw) as Changelog;
  return parsed;
}

export async function writeChangelog(data: Changelog): Promise<void> {
  const tmp = `${CHANGELOG_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  try {
    await fs.rename(tmp, CHANGELOG_PATH);
  } catch (err: any) {
    if (err?.code === "EXDEV") {
      await fs.copyFile(tmp, CHANGELOG_PATH);
      await fs.unlink(tmp).catch(() => undefined);
    } else {
      throw err;
    }
  }
}

/**
 * Called explicitly after a confirmed publish to production.
 *
 * Sets publishedPatch = current patch (recording what prod now has),
 * then increments patch by 1 so the next dev cycle has its own number.
 * Also snaps patchedEntryIds to the full current entry list.
 *
 * This is the ONLY place the patch number is incremented — it must never
 * happen automatically on server restart (which also fires during deploys).
 */
export async function bumpDevPatchAfterPublish(): Promise<void> {
  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;

  active.publishedPatch = active.patch;
  active.patch += 1;
  active.patchedEntryIds = active.entries.map((e) => e.id);
  await writeChangelog(cl);
}

/**
 * Called automatically on dev server startup.
 *
 * First checks the shared database for a deploy breadcrumb left by the
 * production server. If production shipped a patch >= the current dev patch,
 * it means a Replit deploy happened without going through the changelog UI,
 * so the patch is bumped now automatically.
 *
 * Falls back to the legacy patchedEntryIds check for any remaining cases
 * (e.g. manual edits to changelog.json between restarts).
 *
 * Safe to call on every restart — idempotent if nothing has changed.
 */
export async function autoIncrementPatchIfChanged(): Promise<void> {
  // Never auto-bump on the production server — patch management is owned by dev.
  if (process.env.NODE_ENV === "production") return;

  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;

  // Only trigger: did production deploy a patch that dev hasn't advanced past yet?
  // Both environments share the same DB, so this catches Replit-button deploys.
  // The patchedEntryIds fallback has been intentionally removed — it fired on every
  // dev restart whenever new changelog entries existed, causing spurious patch bumps.
  const dbPublishedPatch = await getPublishedPatchFromDB();
  if (dbPublishedPatch === null) return;

  // Guard: if the DB value is somehow higher than active.patch, the DB is stale
  // (e.g. patch counter was manually corrected after spurious bumps). Reset the
  // DB to the file's publishedPatch so future restarts don't trigger false bumps.
  if (dbPublishedPatch > active.patch) {
    await setPublishedPatchInDB(active.publishedPatch ?? 0).catch(() => {});
    console.log(`[changelog] DB patch (${dbPublishedPatch}) was stale — reset to ${active.publishedPatch ?? 0}`);
    return;
  }

  if (dbPublishedPatch >= active.patch) {
    await bumpDevPatchAfterPublish();
    console.log(`[changelog] Auto-bumped patch: detected production deploy of patch ${dbPublishedPatch}`);
  }
}

/**
 * Called on production server startup.
 *
 * Records publishedPatch = current patch so the /api/changelog/published-patch
 * endpoint can return what was actually shipped, without changing the patch
 * counter itself. Also writes the deployed patch to the shared PostgreSQL
 * database so the dev server can detect the deploy on next restart and
 * auto-bump without any manual action.
 * Safe to call on every restart — idempotent if nothing changed.
 */
export async function autoRecordPublishedPatch(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;

  // Write to shared DB so dev can detect this deploy on next startup
  await setPublishedPatchInDB(active.patch).catch((e) =>
    console.error("[changelog] Failed to write published patch to DB:", e)
  );

  if (active.publishedPatch === active.patch) return; // already recorded in file, nothing more to do
  active.publishedPatch = active.patch;
  await writeChangelog(cl);
}

export function generateChangelogId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Shared-DB helpers — used to bridge the prod→dev deploy detection gap.
// Both environments connect to the same PostgreSQL instance, so production
// can leave a breadcrumb that dev picks up on next startup.
// ---------------------------------------------------------------------------

async function getPublishedPatchFromDB(): Promise<number | null> {
  try {
    const result = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'changelog_published_patch'`
    );
    if (result.rows.length === 0) return null;
    const val = parseInt(result.rows[0].value, 10);
    return isNaN(val) ? null : val;
  } catch {
    return null; // table may not exist yet on first startup
  }
}

async function setPublishedPatchInDB(patch: number): Promise<void> {
  await pool.query(
    `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('changelog_published_patch', $1, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now()`,
    [String(patch)]
  );
}
