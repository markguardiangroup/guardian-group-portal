---
name: Admin→Developer role rename conventions
description: Scope rules for the "Developer" user role (formerly "Admin") — what to rename vs preserve.
---

# Developer role (formerly "Admin")

The top-level user role `admin` was renamed to `developer` (UserRole in `shared/schema.ts`).

## Rename (role-name displays + functional role usage)
- Role literal comparisons in code, `/api/admin`→`/api/developer`, `/admin-reports`→`/developer-reports`.
- Role helpers: `isAdmin`→`isDeveloper`, `isConsultantOrAdmin`→`isConsultantOrDeveloper`, `isAdminOrConsultant`→`isDeveloperOrConsultant`.
- Role badge/label/dropdown text and `roleLabels`/`roleColors` map keys → `developer` / "Developer".

## Preserve (do NOT rename)
- Seed user identity: username `admin`, email, password `admin123`, id `user-admin`.
- `ADM` reference-number prefix (`getUserReferencePrefix`).
- `/admin/*` page routes (pathways/sources/services/portal-messages/integrations) and component/identifier names (AdminReports, AdminSources, `ADMIN_ONLY`, `adminOnly`, `adminNavItems`, `adminUsers`).
- `ADMIN` roadmap module KEY in `development-roadmap.tsx` (content category, not the role).
- Breadcrumb `"admin"` route-segment key (its label is "Developer", key stays).

**Why:** Generic client-facing prose like "contact your administrator" was intentionally left as "administrator" — telling a client to "contact your developer" is confusing. "Developer" is an internal role label only.

**How to apply:** For any future role-naming work, change role-name *displays* and *role logic*, but keep generic "administrator" English prose and the preserved identifiers/routes above.

## Data migration gotcha
Role values live in `users.role` and `portal_messages.target_roles` (text[]). A code-level role rename must be paired with a DB data migration (`UPDATE users SET role='developer' WHERE role='admin'`; `array_replace` on target_roles). The dev DB migration does NOT touch production — prod must be migrated separately at publish time or existing admin users lose access.
