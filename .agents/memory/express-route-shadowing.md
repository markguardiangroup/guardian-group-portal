---
name: Express static-vs-param route shadowing
description: Registering a param route (e.g. "/:id") before a sibling static-path route on the same method causes the static route to be silently shadowed.
---

Express matches routes in registration order. If `app.delete("/api/foo/:id", ...)` is registered before `app.delete("/api/foo/bar", ...)`, a request to `/api/foo/bar` matches the `:id` route first with `id = "bar"`. The static route never runs.

**Why:** this bug is easy to introduce when adding a new "special" static-path action (bulk operations, `/restore`, `/archive-all`, etc.) alongside existing per-resource CRUD routes, especially in a large routes file where handlers for the same resource are spread out. The failure mode is confusing: the shadowing param route's own "not found" logic fires (since no resource has that literal string as its ID), producing an error message that names the wrong entity/action and gives no hint that a routing collision is the real cause.

**How to apply:** whenever adding a new static-path route under a prefix that already has a `:param` route on the same HTTP method, register the static route *before* the param route (or grep for `app.<method>("/api/<prefix>` to check existing ordering first). When debugging a mysterious "X not found" error for what should be a distinct action, check for this shadowing pattern before assuming the handler logic itself is wrong.
