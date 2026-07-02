---
name: Staff user-management scoping coverage
description: Pattern for keeping consultant/administrator user-management routes aligned with tenant/source scope, and where presence/online endpoints fit in
---

# Coverage pattern for staff/tenant scoping

`server/routes.ts` has two shared scope helpers near the top of `registerRoutes`:
- `canStaffManageUser(currentUser, targetUser)` — is the caller allowed to act on this specific user (source/company/site aware, staff-to-staff vs staff-to-client rules differ).
- `canStaffAccessCompany(currentUser, companyId)` — is the caller allowed to touch this company at all (source overlap, incl. Group Owner expansion). Extracted so routes that only have a companyId (create user, reassign company) don't need a full target-user object.

**Why:** these routes historically only gated on coarse role checks like `hasProPrivileges(currentUser)`, which let pro consultants/administrators manage users, companies, and sites completely outside their source scope even though the same file already had the precise helper for other routes (password reset, MFA reset, activity log).

**How to apply:** any new or modified staff route that creates/edits/deletes a user, changes a user's company, or manages site assignments must call one of these helpers for every non-developer caller — do not rely solely on `hasProPrivileges`/`isProConsultant` role checks. Presence/online-status endpoints that expose user IDs (e.g. `GET /api/users/online`) are also part of this boundary: filter the raw id list through `canStaffManageUser` before returning it, since stable user IDs feed directly into the other management endpoints.
