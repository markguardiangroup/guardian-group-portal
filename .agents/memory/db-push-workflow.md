---
name: DB schema sync uses db:push, not migrations
description: How schema changes reach dev and prod in this repo; why the migrations/ folder and journal are not authoritative.
---

The repo applies schema changes with `drizzle-kit push` (`npm run db:push`), NOT generate+migrate.

**Why:** The `migrations/` folder has numbered SQL files up to 0013, but `migrations/meta/_journal.json` only lists up to idx 7 (0007). There is no `migrate()` call anywhere in `server/` or `script/`. Deploy `build` = `npm run build` (tsx script/build.ts) and `run` = node dist — neither runs db:push. So the journal/migration files are stale and inert.

**How to apply:**
- The source of truth for schema is `shared/schema.ts`. Sync dev with `npm run db:push`.
- Do NOT add new numbered migration files or trust `_journal.json` — they are not applied.
- Production schema is synced separately at publish time via db:push-to-prod (see the `database` skill "push dev to prod"), same as every prior schema change.
- If `db:push` shows an ambiguous interactive rename prompt (e.g. adding a table next to a similarly-named one), you can create the table/index directly via `psql "$DATABASE_URL"` to avoid the prompt — but the column/index shape must exactly match the Drizzle definition.
