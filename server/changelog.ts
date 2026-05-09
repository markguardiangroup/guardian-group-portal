import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

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
 * Called automatically on production server startup.
 *
 * Bumps the patch only when there are entries not covered by patchedEntryIds
 * (i.e. new changes have been deployed since the last recorded publish).
 * Safe to call on every restart — idempotent if nothing has changed.
 */
export async function autoIncrementPatchIfChanged(): Promise<void> {
  // Never auto-bump on the production server — patch management is owned by dev.
  if (process.env.NODE_ENV === "production") return;

  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;

  const patchedSet = new Set(active.patchedEntryIds ?? []);
  const hasNewEntries = active.entries.some((e) => !patchedSet.has(e.id));
  if (!hasNewEntries) return;

  await bumpDevPatchAfterPublish();
}

export function generateChangelogId(): string {
  return crypto.randomUUID();
}
