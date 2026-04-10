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

A database-first storage model uses PostgreSQL as the primary data store for all persistent entities, with in-memory caching for performance. Development uses Vite and `tsx`, while production builds are bundled with Vite and esbuild. Drizzle Kit manages database migrations.

Admin-managed legal documents (Terms & Conditions, Privacy Policy) are stored in object storage, with API endpoints for upload and retrieval. User acceptance is required during invitation flow and upon revision, triggering a re-acceptance workflow to block access until updated documents are reviewed.

## Changelog Convention

After completing any user-requested change (bug fix, enhancement, or new feature), the agent **must** write a new entry to `changelog.json` at the project root. Do this by directly editing the file using the write/edit tools — no HTTP request needed.

### File location
`changelog.json` (project root)

### How to add an entry
1. Read `changelog.json`
2. Find the active version (`versions.find(v => v.id === activeVersionId)`)
3. Append to `version.entries`:
```json
{
  "id": "<new UUID>",
  "patch": <version.patch>,
  "message": "<concise 1-line summary of the change>",
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
Keep to one line, written in plain English. Examples:
- `"Fixed: Folder pre-population useEffect now fires when folderTemplates loads late"`
- `"Enhancement: Support link always locked in production environment"`
- `"Feature: Changelog / Release Notes section added to admin reports"`

## External Dependencies

-   **Database**: PostgreSQL, Drizzle ORM, connect-pg-simple
-   **UI Component Libraries**: Radix UI, shadcn/ui, Lucide React
-   **Form and Validation**: React Hook Form, Zod, @hookform/resolvers
-   **Date Handling**: date-fns
-   **Development Tools**: Vite, tsx, esbuild, Drizzle Kit