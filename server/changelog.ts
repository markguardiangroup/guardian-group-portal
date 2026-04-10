import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import os from "os";

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
    },
  ],
};

export async function readChangelog(): Promise<Changelog> {
  let raw: string;
  try {
    raw = await fs.readFile(CHANGELOG_PATH, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      // File doesn't exist yet — initialise with defaults
      await writeChangelog(DEFAULT_CHANGELOG);
      return DEFAULT_CHANGELOG;
    }
    // Any other IO error (permissions, disk, etc.) — fail loudly to avoid data loss
    throw new Error(`Failed to read changelog.json: ${err.message}`);
  }

  // Parse errors should throw, not silently overwrite history
  const parsed = JSON.parse(raw) as Changelog;
  return parsed;
}

export async function writeChangelog(data: Changelog): Promise<void> {
  // Atomic write: write to a temp file then rename to avoid partial writes
  const tmp = path.join(os.tmpdir(), `changelog-${Date.now()}.json`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, CHANGELOG_PATH);
}

export async function incrementPatchVersion(): Promise<void> {
  const cl = await readChangelog();
  const active = cl.versions.find((v) => v.id === cl.activeVersionId);
  if (!active) return;
  active.patch += 1;
  await writeChangelog(cl);
}

export function generateChangelogId(): string {
  return crypto.randomUUID();
}
