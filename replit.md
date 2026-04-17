# Guardian Group H&S Web Portal

## Overview

The Guardian Group H&S Web Portal is a B2B compliance platform designed for Health & Safety and HR/Employment Law management. It functions as a consultancy-led portal where Guardian Group provides and manages compliance content for its clients, rather than being a self-service SaaS platform. The portal centralizes compliance documentation, enables digital review and approval workflows, maintains comprehensive audit trails, and supports multi-site client organizations through robust role-based access control. The project aims to deliver a centralized, efficient, and auditable solution for compliance management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The system uses a React 18, TypeScript, and Vite-based frontend with Wouter for routing, TanStack React Query for state management, and shadcn/ui components styled with Tailwind CSS. The backend is an Express.js application with a RESTful JSON API, Drizzle ORM, PostgreSQL, and Zod for schema validation. Session management uses Express sessions with `connect-pg-simple`.

Core entities include Users (with role-based access), Companies, Sites, Document Templates, Documents (with approval workflows), Document Versions, Consultant Assignments, Site Module Access, Audit Logs, Support Requests, Training (Folders, Courses, Bookings), Roadmap Items, and Client Upload Folders. All core entities have unique, auto-generated reference numbers with specific prefixes.

A role-based access control model with tenant isolation defines permissions for Admin, Consultant, and Client roles. The `canUserAccessSite` helper enforces these rules. The system includes features for primary company contact auto-assignment to sites, and detailed user site assignment management.

Client user status progresses through `site_required`, `invite_required`, `invited`, and `active` stages, with automatic transitions.

Admin Reports provide controlled access to sensitive data for administrators and consultants, including a Users Report with CSV export capability.

The platform supports two document approval workflows (Consultant-uploaded and Client-uploaded) with renewal date calculations and a `requiresApproval` setting on templates.

A Training Library allows consultants to create Training Bookings for sites, which clients can view.

A comprehensive H&S Incidents module provides incident tracking (with `INC-XXXXX` references), severity, status, milestones, document linkage, and an auto-generated, regeneratable incident report. Audit logs are integrated for incident-related actions.

A secure Client Uploads feature allows sharing files with clients through folders with a 30-day expiry model, granular access control, and audit logging.

A **Toolkit** feature provides consultants and clients with a browsable, module-organized library of document templates. Folders are displayed as responsive card grids with contextual icons (matched via keyword lookup), module-specific color themes, and open via centered dialogs. Files within folders are downloadable with version and metadata information visible. The Toolkit is a collapsible sidebar module with two sub-pages: a Dashboard (overview with total downloads, last-30-day downloads, and recently downloaded list backed by `toolkit_downloads` DB table) and a Browse Templates page for browsing and downloading templates.

**Guided Document Finder (Pathways)**: Admins can create decision-tree "pathways" that guide users to the right template via a question/answer wizard. Pathways are stored in the `document_pathways` table (`id`, `title`, `description`, `module`, `tree` (JSONB PathwayNode), `isActive`, `createdBy`, `createdAt`, `updatedAt`). The `PathwayNode` structure: `{ question: string, answers: [{ label, description?, next?: PathwayNode | null, templateIds?: string[] }] }`. When active pathways exist for the selected module, a "Find a Document" banner appears on the Browse Templates page; clicking it launches a step-by-step wizard dialog. Leaf nodes with `templateIds` show matching template download rows. Admin management is at `/admin/pathways` (sidebar: "Manage Pathways"). API routes: `GET/POST /api/toolkit/pathways`, `GET/PATCH/DELETE /api/toolkit/pathways/:id` (POST/PATCH/DELETE require admin role).

**Toolkit ↔ Template Library sync**: Each module (health_safety, human_resources, employment_law) has a locked "Toolkit" root `FolderTemplate` in the Template Library. Every `ToolkitFolder` has a corresponding mirrored `FolderTemplate` subfolder under that module's Toolkit root (linked via `toolkitFolderId` FK on `folder_templates`). When a ToolkitFolder is created/deleted via the API, the mirrored FolderTemplate is automatically created/deleted. Public document templates are auto-assigned their `folderTemplateId` server-side based on the selected `toolkitFolderId` — no manual library folder selection is required for public templates. Locked folders (`is_locked = true`) and Toolkit-mirrored subfolders (`toolkit_folder_id IS NOT NULL`) hide edit/delete buttons in the UI.

A **Company Required Templates** feature allows admins to designate which private document templates are required for compliance at a company level. This is managed via a `company_required_templates` join table (companyId ↔ templateId). The company detail page includes a "Required Documents" card with per-module tabs showing checkboxes for private templates. Missing required templates at a site increase the total document count (depressing the compliance score) but are tracked separately via `missingRequiredDocuments` in the `ComplianceSummary` interface — they are NOT counted as overdue. The dashboard and module dashboards show a clickable "Missing Required" indicator (orange) when missing count > 0; clicking it opens a dialog listing missing templates grouped by module, with site/company context. The `GET /api/missing-required-templates` endpoint returns detailed missing template information filtered by site/company.

A **Per-Site Required Document Overrides** feature allows per-site customization of required documents. A `site_template_overrides` table (siteId, templateId, action: 'include'|'exclude', uniqueIndex on siteId+templateId) stores overrides. The effective required set for a site = (company required templates) − (exclude overrides) + (include overrides). Storage methods: `getSiteTemplateOverrides`, `setSiteTemplateOverride` (upsert), `removeSiteTemplateOverride`. Both `getSiteComplianceSummary` and `getComplianceSummary` apply these overrides. API routes: `GET/POST /api/sites/:siteId/template-overrides`, `DELETE /api/sites/:siteId/template-overrides/:templateId`. The site detail Compliance tab (redesigned) shows a list of effective required templates with source badges ("Company" or "Site Only"), module color coding, and per-row remove buttons. An "Add Requirement" dialog with live search allows adding extra templates or restoring excluded company templates. Removing a company-required template creates an `exclude` override; removing a site-only inclusion deletes the override row.

A **Case Document Bundle Builder** feature (Employment Law module) lets consultants and admins save named document bundles per case and generate merged PDFs for download. Bundles are stored in `case_bundles` (fields: `id`, `caseId`, `name`, `checklistItemIds` text array, `cachedFileUrl`, `cachedAt`, `createdBy`, `createdAt`, `updatedAt`). The PDF generation pipeline: images → pdfkit (A4, scale-down only if larger), Office files → LibreOffice (`soffice --headless`), existing PDFs → pass-through, all merged via Ghostscript (`gs`), page numbers added via a Ghostscript PostScript `BeginPage` hook. Generated PDFs are cached in GCS (`/objects/bundles/{bundleId}.pdf` → private dir). LibreOffice conversions are serialised via a module-level Promise mutex. Bundles are displayed in a "Document Bundles" card in the CaseDetailView right column (below Audit Trail). API routes: `GET/POST /api/cases/:id/bundles`, `PATCH/DELETE /api/cases/:caseId/bundles/:bundleId`, `POST /api/cases/:caseId/bundles/:bundleId/download`. Clients have read/download access; only admins and consultants can create/edit/delete. Bundle cache is invalidated when items change.

A database-first storage model uses PostgreSQL as the primary data store for all persistent entities, with in-memory caching for performance. Development uses Vite and `tsx`, while production builds are bundled with Vite and esbuild. Drizzle Kit manages database migrations.

Admin-managed legal documents (Terms & Conditions, Privacy Policy) are stored in object storage, with API endpoints for upload and retrieval. User acceptance is required during invitation flow and upon revision, triggering a re-acceptance workflow to block access until updated documents are reviewed.

## Changelog Convention

> **MANDATORY — no exceptions.** Every change delivered to the user — no matter how small — requires a changelog entry before the work is considered done. This includes minor UI tweaks, copy fixes, and one-line changes. Forgetting to add an entry is a process failure. Task agents must also include changelog entries as part of their work. The entry must be added using one of the two methods below.

After completing any user-requested change (bug fix, enhancement, or new feature), the agent **must** add a changelog entry. This is a hard requirement, not optional.

### Standard method: HTTP endpoint

```
POST /api/changelog/entries
Content-Type: application/json
Cookie: <admin session>

{
  "message": "string (required) — concise 1-line summary",
  "category": "bug" | "enhancement" | "feature" | "other" (required),
  "versionId": "string (optional — defaults to active version)"
}
```

The request must be authenticated with an admin or consultant session. If no active session is available, use the fallback method below.

### Full API surface (all endpoints require admin or consultant role)

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| GET | `/api/changelog/versions` | — | Returns full changelog with all versions and entries |
| POST | `/api/changelog/versions` | `{ bump: "minor"\|"major", label?: string }` | Creates a new version |
| PATCH | `/api/changelog/versions/:id` | `{ label: string }` | Updates a version label |
| DELETE | `/api/changelog/versions/:id` | — | Deletes a version (not active) |
| GET | `/api/changelog/entries` | `?versionId=<id>` (optional) | Returns flat list of entries |
| POST | `/api/changelog/entries` | `{ message, category, versionId? }` | Creates an entry |
| PATCH | `/api/changelog/entries/:id` | `{ message?, category? }` | Updates an entry |
| DELETE | `/api/changelog/entries/:id` | — | Deletes an entry |
| POST | `/api/changelog/bump-after-publish` | — | Records current patch as live on prod, increments dev patch by 1 |

### Publish model (explicit bump, never auto-increment on startup)

The `patch` field on the active version is the **dev patch** (current working number). `publishedPatch` tracks what is live on production.

**After every production deploy** the user (or agent) should call `POST /api/changelog/bump-after-publish` (or press the **"Published" button** in the changelog admin UI). This:
1. Sets `publishedPatch = patch` (recording what prod now has).
2. Increments `patch` by 1 (ready for the next dev cycle).
3. Snaps `patchedEntryIds` so future entries never trigger a spurious bump.

The patch is **never** incremented automatically on server startup — this prevented silent version collisions during Replit deploy restarts.

### Fallback method: direct file edit (when no session is available)

When the agent cannot make an authenticated HTTP request, append an entry directly to `changelog.json` at the project root:

1. Read `changelog.json`
2. Find `versions.find(v => v.id === activeVersionId)`
3. Append to `version.entries`:
```json
{
  "id": "<new UUID v4>",
  "patch": <version.patch>,
  "message": "<1-line summary>",
  "category": "<bug|enhancement|feature|other>",
  "createdAt": "<ISO timestamp>",
  "createdBy": "agent"
}
```
4. Write the updated JSON back

### Category values
| Value | Use for |
|-------|---------|
| `bug` | Bug fixes |
| `enhancement` | Improvements to existing features |
| `feature` | Brand new features |
| `other` | Refactors, docs, config changes |

### Message format
One short line, plain English written for **non-technical users**. Keep it punchy — state only what changed, not how or why. No em-dashes with extra explanation, no parenthetical lists of details. Never include code terms (function names, hook names, array names, etc.).

Good examples:
- `"Fixed folder template selection when creating documents from a template"`
- `"Support link in sidebar always shows as locked in production"`
- `"Added Release Notes section to admin reports"`
- `"Fixed: pro consultants' assigned sources not showing in company creation form"`
- `"Admins can now permanently delete cases and incidents, with confirmation dialog and full audit trail"`

Bad examples (too long or too technical — avoid):
- `"Folder template selection now populates correctly when creating documents from a template"` — too wordy
- `"New Release Notes section added to admin reports — view, manage, and export a full history of platform updates"` — drop everything after the em-dash
- `"Fix: incrementPatchVersion() now uses atomic rename to avoid partial writes"` — technical, user-facing terms only

## External Dependencies

-   **Database**: PostgreSQL, Drizzle ORM, connect-pg-simple
-   **UI Component Libraries**: Radix UI, shadcn/ui, Lucide React
-   **Form and Validation**: React Hook Form, Zod, @hookform/resolvers
-   **Date Handling**: date-fns
-   **Development Tools**: Vite, tsx, esbuild, Drizzle Kit