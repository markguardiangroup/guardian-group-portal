---
name: Upload ownership claim pattern
description: How to prevent unbound object-storage paths from being rebound/reused by other users or across records
---

Any endpoint that accepts a client-supplied file path/URL (from a prior upload step) and persists it onto a record must verify the uploader owns it and that it hasn't already been consumed, before writing it to the record.

**Why:** object storage upload endpoints (e.g. presigned/direct upload) return a path but do not themselves enforce who may later attach that path to a document/case/incident/etc. Without a claim step, any authenticated user can guess or observe another user's uploaded object path and bind it to their own record (cross-tenant data exposure), or the same upload could be reused across multiple records.

**How to apply:**
- Record every upload (`objectPath`, `uploadedByUserId`, `claimedAt`, `claimedByType`) at upload time in a dedicated table.
- At each write site that accepts a `fileUrl`/`objectPath` field from the client, look up the record: 400 if untracked (never uploaded through the tracked endpoint), 403 if `uploadedByUserId` doesn't match the current user, 409 if already claimed. Only on success, mark it claimed and proceed.
- Internal/server-generated copies (e.g. re-issuing an existing document's file, template-replace archival, bundle merge output) should NOT go through the claim check — they don't originate from a fresh client upload.
- Verified via live curl smoke test (upload → claim → reuse-rejected 409 → fabricated-path-rejected 400 → cross-user-theft-rejected 403) rather than relying on code review alone.
