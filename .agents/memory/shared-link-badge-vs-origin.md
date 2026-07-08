---
name: isSharedLink is a badge flag, not an origin/action gate
description: Why isSharedLink can be true even for the owning/origin company, and how to correctly gate Move/Archive/Delete on shared documents.
---

For company/group-scoped documents, the backend computes `isSharedLink: true` for the destination sites/companies a doc was shared to — but it also uses the same field to indicate "this document currently has active outbound shares" when returned to the **origin** user, purely so the UI can render a "Shared" badge in the origin's list view too.

**Why:** early UI logic (`!doc.isSharedLink`) treated this flag as "hide privileged actions" — which incorrectly hid Move/Archive/Delete from the origin/owning company as well as genuine recipients, even though the backend already restricted those actions to origin users server-side via `isDocumentOriginUser`.

**How to apply:**
- Never gate action visibility (Move/Archive/Delete edit rights) on `isSharedLink`. Use a dedicated `isOrigin` boolean instead (added to list/detail document API responses, computed from the existing `isDocumentOriginUser` check already used server-side for authorization).
- `isSharedLink` remains correct and useful for read-only purposes: showing "Shared" badges, and (from the origin's perspective) as a signal that warnings about removing sharing should be shown before a destructive action.
- When adding a new document action that should be origin-only, always check `isOrigin` (or the server's `isDocumentOriginUser`) — never infer origin-ness from the absence of `isSharedLink`.
- Any action that detaches/moves/deletes a company- or group-scoped document must also delete its `document_shares` rows (see `deleteDocument`, `POST /api/documents/:id/archive`, `transferDocumentScope` for the reference pattern), and the UI should warn the user beforehand using a `hasActiveShares`/`isSharedLink` check scoped to the origin's own document.
