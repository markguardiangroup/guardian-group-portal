---
name: Retry predicate must check status, not message string
description: TanStack Query retry callbacks should check a structured error.status field, not parse status codes out of error.message text.
---

`throwIfResNotOk` in `client/src/lib/queryClient.ts` threw a plain `Error` whose message was just the server's error text (e.g. "Not authenticated"), never prefixed with the HTTP status code. A `retry: (count, error) => error.message.startsWith("401") ...` check therefore never matched, silently falling through to the default retry-3-times behavior on every 401/403.

**Why:** this caused unnecessary extra round-trips (up to ~4s) after every failed auth check, worsening perceived loading time. It was a real but partial contributor — it does not by itself explain a permanently-stuck spinner.

**How to apply:** define a custom `ApiError extends Error` class carrying a `status: number` field, throw that from the shared fetch wrapper, and have retry predicates check `error.status` directly instead of string-matching `error.message`.
