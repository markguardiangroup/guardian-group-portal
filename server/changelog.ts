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
  label: string;
  isActive: boolean;
  createdAt: string;
  entries: ChangelogEntry[];
  // IDs of entries that existed when the patch was last incremented.
  // Used by dev startup to detect new entries and auto-bump patch.
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
 * Called on dev server startup only.
 * If the active version has entries whose IDs are not in patchedEntryIds,
 * the patch number is incremented and patchedEntryIds is updated to the
 * current full set of entry IDs.
 * Production never calls this — its changelog.json is frozen at deploy time.
 */
export async function autoIncrementPatchIfChanged(): Promise<void> {
  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;

  const currentIds = new Set(active.entries.map((e) => e.id));
  const patchedIds = new Set(active.patchedEntryIds ?? []);

  const hasNewEntries = [...currentIds].some((id) => !patchedIds.has(id));
  if (!hasNewEntries) return;

  active.patch += 1;
  active.patchedEntryIds = [...currentIds];
  await writeChangelog(cl);
}

export function generateChangelogId(): string {
  return crypto.randomUUID();
}
