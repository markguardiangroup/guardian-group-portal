---
name: Stale server after merge
description: Merged server code may keep running the old process until the workflow is restarted
---

After task-agent merges (and sometimes cross-turn changes), the long-running
`Start application` (`npm run dev`) process can keep serving the OLD server code
even though the files on disk are already updated.

**Symptom:** A server-side fix looks like it "didn't work" — the user reports the
behaviour is unchanged, and DB rows / responses match the pre-fix code path (e.g.
audit_logs written with the old `details`/`metadata` shape) despite the source
file clearly containing the fix.

**Why:** The watcher does not always reload after a merge/reconciliation, so the
in-memory server is stale.

**How to apply:** When a confirmed-correct server fix appears ineffective, first
verify the file on disk is correct, then `restart_workflow("Start application")`
before assuming the code is wrong. Note: historical rows written by the stale
process cannot be retrofitted — only new requests get the corrected behaviour.
