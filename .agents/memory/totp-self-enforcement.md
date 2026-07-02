---
name: Per-user TOTP enrollment must self-enforce at login
description: A user's own MFA setup must gate login independent of any portal-wide MFA toggle
---

If a product lets individual users opt into TOTP/2FA for their own account,
the login flow must require that factor for that user regardless of any
separate portal-wide/global "MFA required" setting. Compute
`mfaRequired = portalMfaRequired || userHasOwnMfaEnabled` and gate the MFA
challenge on that combined value, not just the global flag.

**Why:** if login only checks the global toggle, a user who set up an
authenticator app (and is told in the UI it protects their account) can still
be logged into with password alone whenever an administrator has left the
global flag off — the enrollment becomes purely cosmetic and a phished/reused
password fully bypasses the second factor the user believes is active.

**How to apply:** whenever auditing or adding an MFA/2FA gate, check both the
global config lookup and the authenticated user's own enrollment fields are
OR'd together before deciding whether to pause login for a second factor.
