---
name: Auth rate limiter must be derived from lockout thresholds
description: A per-identifier login rate limiter with a looser budget than the account-lockout thresholds it's meant to protect is not a real mitigation
---

If a login endpoint has both (a) an account-lockout policy (soft/temporary and
hard/permanent thresholds counted on a rolling window) and (b) a separate
express-rate-limit-style limiter keyed by the submitted identifier, the
limiter's `max` over its `windowMs` must be *derived from* the lockout
thresholds, not chosen independently.

**Why:** if the limiter allows more total requests per identifier than the
permanent-lock threshold within (or across) its window, an anonymous caller
can still pace requests to accumulate enough consecutive failures to trip the
permanent lock — the limiter looks like a mitigation but doesn't actually
bound the attack. E.g. `20 requests/15min` (~80/hour) does nothing to stop a
`10 failures/60min` permanent-lock policy.

**How to apply:** set the limiter's `windowMs` equal to the permanent-lock
window and `max` to one less than the permanent-lock attempt threshold (e.g.
`max: SECURITY_CONFIG.permanentLockAttempts - 1`), so no identifier can ever
accumulate enough attempts through that endpoint to trip the hard lock,
regardless of pacing. Import the shared threshold constants rather than
hardcoding a second, disconnected number.
