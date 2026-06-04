---
name: SSE real-time invalidation gotchas
description: Non-obvious traps when wiring server SSE emits to TanStack Query cache invalidation
---

# SSE real-time gotchas

Two traps that cost real debugging time when making changes "update live" via SSE
(server emits in `server/routes.ts`, client handlers in `client/src/hooks/use-server-events.ts`).

## TanStack prefix matching is exact on the first key element
`invalidateQueries({ queryKey: ["/api/users"] })` prefix-matches `["/api/users", id, ...]`
but does **NOT** match `["/api/users/online"]` — that is a *different first element*, not a
child of `/api/users`. Any sibling endpoint with a slash in the first string segment needs
its own explicit `invalidateQueries`.
**How to apply:** when broadening a handler, list every distinct first-element key; don't
assume one prefix covers `/foo` and `/foo/bar` both.

## Company-scoped emits must run BEFORE the row is deleted (or capture the FK)
`emitCompanyScoped`/`emitSiteScoped` re-fetch the company to resolve `groupOwnerId` for
group-owner client fan-out. If you emit *after* `DELETE FROM companies`, the lookup returns
null and group-owner clients never get notified.
**Why:** the helper does its own `storage.getCompany(companyId)` at emit time.
**How to apply:** in delete routes, capture the company object before deletion and emit to
`company.groupOwnerId` explicitly, or emit before the delete.

## Emit AFTER all downstream mutations in a route
If a route does a primary mutation then a conditional follow-up (e.g. incident milestone
completion that auto-closes the incident), emit the SSE event once at the very end. Emitting
right after the first mutation makes listeners refetch a stale intermediate state with no
second event to correct it.
