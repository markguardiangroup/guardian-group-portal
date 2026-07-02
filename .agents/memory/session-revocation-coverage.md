---
name: Session revocation coverage
description: Auditing "does account disable/lock take effect immediately" requires checking every session-read call site, not just requireAuth.
---
In this codebase, most routes are protected by a `requireAuth` middleware, but a large fraction (~150-300) of routes independently reload the user via `storage.getUser((req.session as any).userId)` inline in the handler *without* going through `requireAuth` at all. Hardening only the shared middleware misses all of these.

**Why:** A security review found that hardening `requireAuth` alone (to reject `inactive`/`locked` accounts) still left dozens of endpoints (e.g. document listing, legal-document acceptance, object-storage session resolution) reachable by a disabled/locked user's still-valid cookie, because those routes never call `requireAuth`.

**How to apply:** When asked to enforce "disabled/locked accounts lose access immediately", grep the whole routes file for every place a user is derived from `req.session` (`req.session.userId`, `req.session?.userId`, `(req.session as any).userId`, `sessionUserId`, callback-based session resolvers like `getUserForSession`) — not just where `requireAuth` is attached — and route them all through one shared helper that checks `status !== 'inactive' && status !== 'locked'`. A global find/replace onto a single helper (e.g. `getSessionUser(req)`) is the safe way to patch this consistently across many call sites at once.
