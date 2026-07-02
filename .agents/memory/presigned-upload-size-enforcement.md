---
name: Presigned upload size enforcement
description: Why declared size/contentType on a presigned-URL upload request cannot be trusted, and where real enforcement has to live.
---

The Replit object-storage sidecar's signed-URL API only accepts
bucket/object/method/expiry — no `content-length-range` or content-type
condition support (no signed POST policy option). This means a presigned PUT
URL cannot have its byte size or MIME type enforced by GCS itself at signing
time, no matter what the client declares in the `/api/uploads/request-url`
request body.

**Why:** the `external_account` credential type used by `objectStorageClient`
avoids SDK-native `signBlob`-based signing (which is what `generateSignedPostPolicyV4`
needs), so there's no path to a GCS-enforced ceiling at the signing layer.

**How to apply:** treat any declared `size`/`contentType` at request-url time
as an advisory bound only (reject obviously-invalid values early, but don't
rely on it). Do the real enforcement at the point where an uploaded object is
about to be bound to a business record — re-check the object's *actual* size
via `file.getMetadata()` there, and reject/delete anything over the cap. Also
add a time-bounded sweep to delete objects that are uploaded but never claimed,
since a malicious/abandoned presigned upload can otherwise sit in storage
indefinitely with no code path ever inspecting it.

**Cumulative/daily quota gotcha:** if a per-user daily byte budget sums a
`fileSize` column that was populated from the client-declared value at
request-url time, the budget is trivially bypassable — declare a tiny size on
every request, then actually upload up to the per-object cap each time. Fix by
(1) overwriting that column with the *actual* verified size once a claim's
real-size check passes, and (2) for rows still unclaimed (and not yet swept),
counting them at the worst case (the per-object cap) rather than their
declared value when computing the running total, since their real size is
unverified until claimed.

**Reused-URL orphan gotcha after move-on-claim:** if claiming also moves the
object to an immutable finalized path (to stop the original presigned PUT URL
from being able to overwrite live content post-claim), don't just rename the
tracking DB row in place — the original object path becomes fully untracked,
and the original signed PUT URL is still valid for the rest of its TTL, so it
can recreate a fresh untracked blob at the vacated name that no sweep will
ever find. Fix: keep a row for the old path (marked e.g. "superseded") instead
of renaming it away, insert a *new* row for the finalized path, have the sweep
actively check/delete anything reappearing at superseded paths on every pass,
and only drop the superseded tracking row once the original URL's TTL has
definitely elapsed. Also make sure budget-accounting "trustworthy" checks
exclude the superseded marker specifically (not just "claimedAt is set"),
since a superseded row's stored fileSize was never re-verified.
