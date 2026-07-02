---
name: Global (non-tenant-scoped) settings must be developer-only
description: Any singleton/portal-wide setting endpoint must reject source-scoped "administrator" role, not just require auth
---

Singleton settings rows that apply to the whole portal (e.g. `email_settings`
controlling catch-all email routing AND the portal-wide `mfa_required` flag)
must be gated to `role === "developer"` only.

**Why:** `administrator` is source/tenant-scoped exactly like a pro consultant
(see role-model.md). A gate like `role === "developer" || role === "administrator"`
on a *global* control lets any tenant-scoped admin silently redirect other
tenants' password-reset/invitation emails to an address they control, or weaken
login policy for the whole portal — a cross-tenant privilege escalation even
though each individual admin's other endpoints are properly source-scoped.

**How to apply:** when adding or auditing a new global/singleton config
endpoint, ask "does this affect users/companies outside what this role can
already manage?" If yes, gate to `developer` only — do not reuse the standard
"consultant-like" `administrator` gate. Also remember to update client-side tab/UI
gating to match, so a scoped admin doesn't see a control that just 403s.
