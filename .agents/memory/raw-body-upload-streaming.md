---
name: Raw-body upload streaming
description: Why raw-body file upload endpoints must stream into object storage instead of buffering the whole file in memory
---

Any Express route that accepts a file as a raw request body (not multipart, not a
presigned-URL flow) must NOT do `for await (chunk of req) { chunks.push(chunk) }`
followed by `Buffer.concat` before calling `file.save(buffer)`. That pattern holds
the entire declared upload size in process memory for the life of the request.
Since request-count rate limiters only bound how many requests land in a window
(not how many are simultaneously in flight), a handful of concurrent large
uploads from one or a few authenticated accounts can exhaust server RAM and
crash the whole Node process for every tenant — not just the attacker's own data.

**Why:** discovered while hardening `/api/uploads/file` and
`/api/incidents/:id/upload`, which both buffered up to 50MB per request before
writing to GCS. The per-request byte cap alone doesn't stop concurrent-request
memory exhaustion; only streaming does.

**How to apply:** stream the request body directly into a GCS `file.createWriteStream()`,
counting bytes as they arrive and `destroy()`-ing the write stream (then deleting
the partial object) the moment the running total crosses the byte ceiling. This
keeps per-request memory bounded to the streaming chunk size regardless of
declared/actual file size, and rejects oversized uploads without ever holding
the full payload in RAM. Also make sure every raw-body upload route — including
one-off/business-specific ones like an incident or legal-document upload
endpoint, not just the generic `/api/uploads/file` — is covered by the same
per-account rate limiter as the primary upload routes; it's easy to add a new
raw-body upload endpoint later and forget to mount it under the existing limiter.
