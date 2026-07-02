---
name: Identifier-only rate limiters are a DoS tool, not just a login concern
description: Any endpoint keyed purely on a user-supplied identifier (email, username) is weaponizable by anyone who knows that identifier, not just login
---

The "shared bucket keyed by victim identifier" problem is not unique to
login rate limiting — it applies to any public/unauthenticated endpoint
whose rate-limit key is derived solely from attacker-controlled input that
happens to also identify a specific victim (e.g. `email` on a
forgot-password route, `username` on a resend-verification route).

**Why:** if the key is `identifier` alone, anyone who knows the victim's
identifier can send just enough requests to exhaust the shared quota,
denying the real owner service on that endpoint — and if the handler also
performs a side effect that invalidates prior state (e.g. revoking earlier
password-reset tokens before issuing a new one), a single attacker request
does immediate damage before the bucket is even exhausted.

**How to apply:** key these limiters by `identifier + source IP` (see
`ipKeyGenerator` usage in `server/index.ts`) so an attacker can only ever
burn through the slice of quota tied to their own IP, and add a separate
IP-only backstop limiter for general anti-scraping/anti-automation
coverage. This is the same shape used for login's
`authSoftLimiter`/`authIpLimiter` — see
`.agents/memory/auth-rate-limit-lockout-alignment.md` for that specific
case; treat any new body-keyed limiter the same way by default.
