---
name: PG session-store revocation
description: connect-pg-simple stores sessions as JSON in a `session` table; sessions can be force-revoked by deleting rows matching a userId inside the JSON blob.
---
When using `connect-pg-simple` (Express session store backed by Postgres), sessions live in a `session` table with columns `sid varchar`, `sess json`, `expire timestamp`. The `sess` column contains the serialized session payload (e.g. `{ userId: ... }`).

**Why:** Password changes, password resets, and admin-initiated account disable/lock must invalidate any other active sessions for that user immediately — otherwise a stolen/old session cookie keeps working after the credential or status change, defeating the point of the change.

**How to apply:** Delete matching rows directly via the underlying pool: `DELETE FROM session WHERE sess::jsonb->>'userId' = $1 [AND sid != $2]`. Use the optional `sid != $2` exclusion when the acting user's own current session should survive (e.g. self-service password change), and omit it when everything should be killed (e.g. invitation/reset accept, admin lock/disable). Wire this into every mutation path that changes a password or flips status to inactive/locked, not just the "main" one.
