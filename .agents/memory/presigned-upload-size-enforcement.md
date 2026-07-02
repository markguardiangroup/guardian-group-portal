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
