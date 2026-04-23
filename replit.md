# Guardian Group H&S Web Portal

## Overview

The Guardian Group H&S Web Portal is a B2B compliance platform designed for Health & Safety and HR/Employment Law management. It serves as a consultancy-led portal where Guardian Group provides and manages compliance content for its clients, centralizing documentation, enabling digital review and approval workflows, maintaining audit trails, and supporting multi-site organizations with robust role-based access control. The project aims to deliver an efficient, auditable solution for compliance management, enhance business vision, and capture market potential by offering a streamlined compliance experience.

## User Preferences

Preferred communication style: Simple, everyday language.

### Changelog policy (HARD REQUIREMENT — do not skip)

After EVERY user-requested change (bug fix, enhancement, or new feature), the agent MUST append a short entry to the active version in `changelog.json` before ending the turn. This is automatic, mandatory, and applies to every change no matter how small. Never batch entries up across turns and never wait to be reminded.

How to add an entry:
- Append a new object to `versions[active].entries` in `changelog.json` with: `id` (uuid), `patch` (current `patch` of the active version), `message`, `category` (`bug` | `enhancement` | `feature` | `other`), `createdAt` (ISO timestamp), `createdBy` (`"agent"`).
- Do NOT bump the `patch` number — that happens automatically on publish.

Message style — concise, user-facing impact, under ~80 chars. No technical detail, no file lists. Examples:
- "Fixed: login could hang due to slow background data requests"
- "Improved: sites list now loads significantly faster"
- "Admins can grant Case Advocate permission to consultants"
- "Fixed: non-active users are greyed out in the Case Access dialog"

## System Architecture

The system utilizes a modern web stack:
- **Frontend**: React 18, TypeScript, Vite, Wouter (routing), TanStack React Query (state management), shadcn/ui (components), Tailwind CSS (styling).
- **Backend**: Express.js, RESTful JSON API, Drizzle ORM, PostgreSQL, Zod (schema validation), Express sessions with `connect-pg-simple`.

**Core Entities**: Users (role-based), Companies, Sites, Document Templates, Documents (with approval workflows), Document Versions, Consultant Assignments, Site Module Access, Audit Logs, Support Requests, Training (Folders, Courses, Bookings), Roadmap Items, and Client Upload Folders. All core entities use unique, auto-generated prefixed reference numbers.

**Access Control**: A robust role-based access control model with tenant isolation (`Admin`, `Consultant`, `Client` roles) is enforced by a `canUserAccessSite` helper. This includes primary company contact auto-assignment to sites and detailed user site assignment management. Client user status progresses through `site_required`, `invite_required`, `invited`, and `active` stages.

**Key Features**:
- **Admin Reports**: Controlled access to sensitive data for administrators and consultants, including a Users Report with CSV export.
- **Document Approval Workflows**: Two distinct workflows (Consultant-uploaded and Client-uploaded) with renewal date calculations and `requiresApproval` setting.
- **Training Library**: Consultants can create Training Bookings for sites, visible to clients.
- **H&S Incidents Module**: Comprehensive incident tracking (`INC-XXXXX` references), severity, status, milestones, document linkage, auto-generated reports, and integrated audit logs.
- **Secure Client Uploads**: Share files via expiring folders (30-day expiry), granular access control, and audit logging.
- **Toolkit**: A browsable, module-organized library of document templates. Features a dashboard with download statistics and a browse page. Folders are displayed as responsive card grids with contextual icons and module-specific color themes.
- **Guided Document Finder (Pathways)**: Admins create decision-tree pathways (`document_pathways` table) to guide users to templates via a question/answer wizard. The `PathwayNode` structure defines questions and answers leading to templates.
- **Toolkit ↔ Template Library Sync**: Automatic mirroring of Toolkit folders to `FolderTemplate` subfolders within the Template Library, ensuring consistency and simplifying public document template assignment.
- **Company Required Templates**: Admins designate private document templates required for compliance at a company level (`company_required_templates` join table). Missing required templates are tracked separately and impact compliance scores.
- **Per-Site Required Document Overrides**: Customization of required documents per site via `site_template_overrides` table (`include`|`exclude` actions). This influences effective required sets and compliance summaries.
- **Group Owner Companies**: A company can be designated as a Group Owner by linking other companies to it via the `group_owner_id` column on `companies`. Group Owners are derived (no explicit flag) — a company is a GO if at least one company references it. GO client users can view all member companies. Admin-only writes via `PATCH /api/companies/:id/group-owner`. Company list shows indigo "Group Owner" and violet "Member of" badges. Company detail shows a Linked Companies panel and an admin picker.
- **Case Document Bundle Builder**: For the Employment Law module, consultants/admins can create named document bundles per case and generate merged PDFs. Bundles are stored in `case_bundles`, with PDF generation handling various file types (images, Office files, PDFs) using pdfkit, LibreOffice, and Ghostscript, with GCS caching.

**Data Storage**: PostgreSQL is the primary data store for persistent entities, with in-memory caching. Drizzle Kit manages database migrations. Admin-managed legal documents (T&C, Privacy Policy) are stored in object storage, requiring user acceptance workflows.

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Session Management**: `connect-pg-simple`
-   **UI Components**: Radix UI, shadcn/ui, Lucide React
-   **Form Handling**: React Hook Form, @hookform/resolvers
-   **Validation**: Zod
-   **Date Manipulation**: date-fns
-   **Frontend Tooling**: Vite, tsx, esbuild
-   **PDF Generation**: pdfkit, LibreOffice (for document conversion), Ghostscript (for merging and page numbering)
-   **Object Storage**: Google Cloud Storage (for cached bundles and legal documents)