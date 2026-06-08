---
name: Role model & naming constraints
description: Internal role values, the forbidden "admin" value, and how staff capability gates are structured in the portal
---

# Roles in this portal

Internal `UserRole` values (shared/schema.ts) — display names differ from stored values:
- `developer` = unrestricted super-admin staff role. `canUserAccessSite` returns true unconditionally.
- `consultant` (+ `consultantTier: "standard" | "pro"`) = consultants. "Pro Consultant" = `role==="consultant" && consultantTier==="pro"`.
- `client` = end customer users.
- `administrator` = staff role displayed as **"Admin"**. Behaves like a Pro Consultant for visibility/create/manage, but is NOT an eligible document approver, cannot personally sign off, has no manager allocation, and no client-list assignment.

## "admin" is a FORBIDDEN stored role value
**Why:** a boot migration runs on every server startup that rewrites `role='admin'` → `role='developer'`. Any user stored as `admin` is silently converted on the next restart.
**How to apply:** never introduce a stored role value of `admin`. The "Admin" display label maps to internal value `administrator`; the legacy super-admin is `developer`.

## Staff capability gating
**Why:** "administrator" must mirror a base consultant's access on general visibility/create/manage endpoints, while specific exclusions (approver eligibility, sign-off, manager allocation) are enforced by separate dedicated logic — NOT by the blanket role gates.
**How to apply:**
- When adding a role to general staff gates, widen BOTH the positive (`role==="consultant"`) and the negative (`role!=="consultant"`) forms — they are separate and easy to miss one.
- Keep eligible-approver / approval-notification filters as the inline `role==="consultant" && consultantTier==="pro"` check so they naturally exclude `administrator` without touching the shared pro-consultant helper.
- Admin uploads that require approval must carry an "approval on behalf of" consultant who owns sign-off; the backend rejects admin uploads with approval but no on-behalf consultant, so the frontend must surface (and require) that selection — which in turn needs admin to be able to read the staff user list.

## isProConsultant helper architecture
The canonical `isProConsultant` is a non-hoisted `const` arrow defined late inside `registerRoutes`, yet called from route-handler closures defined earlier. This works only because those closures run at request time, after all `const`s are assigned. Do not convert these into eagerly-invoked code. A few handlers locally shadow it with the boolean form.
