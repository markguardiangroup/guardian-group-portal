---
name: Portal-wide MFA toggle is the sole gate (overrides per-user TOTP enrollment)
description: Product decision — when the global MFA toggle is off, MFA is fully off for everyone, even users with TOTP enrolled
---

This project previously self-enforced per-user TOTP (`mfaRequired = portalMfaRequired ||
userHasOwnMfaEnabled`), but the product owner explicitly reversed that: when the
portal-wide MFA toggle (`email_settings.mfa_required`) is off, MFA must be fully
off for everyone, including users who have personally enrolled an authenticator.
Login now computes `mfaRequired = portalMfaRequired` only.

**Why:** explicit user/product decision (overriding the earlier security-hardening
default) — the global toggle is meant to be a hard kill switch for MFA across the
whole portal, not something individual enrollment can override.

**How to apply:** do not reintroduce an OR with per-user TOTP enrollment when
touching this login logic unless the product owner asks for it again. If asked to
"harden" MFA in the future, confirm with the user whether they want per-user
enrollment to survive the global toggle being off, since this has flipped once
already.
