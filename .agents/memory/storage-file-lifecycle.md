---
name: Storage file lifecycle audit
description: Every DB delete path for a file-bearing entity must independently clean up its object storage file(s), or files orphan silently.
---

## Rule
When an entity's DB row references an object-storage file (`fileUrl` or similar), every code path that deletes that row — single-entity delete, folder/parent delete, and cascade deletes from deleting a higher-level entity (e.g. company/site) — must independently call the object storage delete (e.g. `deleteObjectEntityFile`) before/alongside the DB delete. There is no DB-level trigger that does this for you.

**Why:** Scheduled/expiry cleanup jobs are often implemented correctly (they're the "obvious" path), but manual single-item deletes and cascade deletes (company/site deletion cascading to documents, uploads, etc.) are frequently missed because they're implemented as raw SQL in a transaction, far from the storage-aware code. This causes files to accumulate forever in the bucket with no DB reference, silently costing storage and making bucket audits misleading.

## How to apply
- When adding or reviewing any `deleteX`/cascade-delete function touching a table with a `file_url` (or per-version file URLs), grep for all DELETE paths for that table across the codebase (manual storage.ts methods AND raw-SQL cascades in routes.ts), not just one.
- Pattern: SELECT the file_url(s) first (own row + any child version rows), loop with try/catch calling the storage delete (swallow errors, log, never block the DB delete on a storage failure), THEN delete the DB rows.
- For cascade deletes inside a pg transaction: collect file URLs into an array via SELECT queries *before* the DELETE statements in the same transaction, then run the actual object-storage deletions *after* the transaction commits (storage deletion isn't itself transactional, and shouldn't block/rollback the DB transaction).
- Entities linked by `userId` only (no site/company FK) are correctly untouched by company/site cascade deletes — don't force-add cleanup there unless the entity actually has a site/company relationship.
- A single "top-level" entity (e.g. a document) commonly has MULTIPLE independent delete paths that each need their own fix: a direct single-row delete, a parent/folder-cascade delete, an unrelated-parent cascade (e.g. deleting a case/incident that owns documents), AND partial-row deletes that aren't a full entity delete (e.g. clearing only draft versions on rejection). When auditing, explicitly search for every table that has a `references(() => otherTable.id, { onDelete: "cascade" })` FK relationship too — Postgres will silently cascade-delete those rows for you, but it will NOT clean up any object-storage file referenced by them, so the app code must gather those file URLs before the parent delete fires.
- Don't assume "cascade delete for feature X" is a single function — grep by table name (not by feature name) across the whole codebase to find every DELETE/cascade site touching it.
