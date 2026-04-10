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
  try {
    const data = await fs.readFile(CHANGELOG_PATH, "utf-8");
    return JSON.parse(data) as Changelog;
  } catch {
    await writeChangelog(DEFAULT_CHANGELOG);
    return DEFAULT_CHANGELOG;
  }
}

export async function writeChangelog(data: Changelog): Promise<void> {
  await fs.writeFile(CHANGELOG_PATH, JSON.stringify(data, null, 2), "utf-8");
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
