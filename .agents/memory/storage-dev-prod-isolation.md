---
name: Shared dev/prod object storage bucket
description: Dev and prod share the same GCS bucket by default; dev-only cleanup must use isolated path prefixes or it can delete real production files.
---

## Rule
Replit's object storage integration provisions a single GCS bucket per app, and by default **both the dev and production environments read/write the same bucket** via `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS`. There is no automatic dev/prod separation.

**Why:** An "orphan file cleanup" script run in dev (deleting files with no matching DB row) can delete files that are actually referenced by production DB rows, since dev and prod share the same storage namespace. This happened once and destroyed 73 production files (fully recovered via GCS soft-delete/undelete, but only because soft-delete was enabled — it isn't guaranteed).

## How to apply
- Before running any destructive storage cleanup/audit script, check whether `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS` differ between dev and prod. If they're identical, dev and prod are sharing the same bucket paths.
- To isolate them: set environment-scoped env vars so prod keeps its original path prefix untouched, and dev uses a distinct prefix (e.g. `.private-dev` / `public-dev`). Migrate dev's active files to the new prefix and verify via live download before deleting anything from the old shared prefix.
- When deleting "orphaned" files from a shared prefix, always explicitly cross-check the candidate deletion list against the *other* environment's live DB file references first — don't rely solely on the current environment's DB.
