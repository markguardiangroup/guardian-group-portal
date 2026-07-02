---
name: Zip Slip in archive builders
description: Why archive entry names must be sanitized before being written into a ZIP, and how the fix was applied
---

Any endpoint that builds a ZIP (or similar archive) from stored files must never
use a user- or client-controlled filename field verbatim as the archive entry
name. Stored filename fields (e.g. `documents.fileName`, upload metadata) are
often set at upload time from the original client-supplied filename and are not
re-validated later. If that raw string contains path separators or `../`
traversal, most zip libraries (e.g. `archiver`) will happily write outside the
intended extraction directory when someone later unzips the file — the classic
Zip Slip vulnerability.

**Why:** found in `/api/client-upload-folders/:folderId/download` and
`/api/ishare-folders/:folderId/download`, which passed `{ name: file.fileName }`
straight into the archiver's `append()` call.

**How to apply:** before adding an entry, run the name through a sanitizer that:
1. normalizes backslashes to forward slashes, then takes `path.basename()` to
   strip any directory components (this alone defeats `../../etc/passwd` and
   Windows drive-prefixed paths like `C:\Windows\...`);
2. strips control characters and leading dots;
3. falls back to a fixed placeholder (e.g. `"file"`) if the result is empty;
4. dedupes against a per-archive `Set` of already-used names (append `_1`,
   `_2`, ... before the extension) so two different unsafe inputs that
   sanitize to the same basename don't silently overwrite each other in the
   zip.
