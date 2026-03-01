# Guardian Group H&S Web Portal

## Overview

The Guardian Group H&S Web Portal is a B2B compliance platform designed for Health & Safety and HR/Employment Law management. It serves as a consultancy-led portal where Guardian Group manages and provides compliance content to its clients, rather than being a self-service SaaS platform. The portal centralizes compliance documentation, facilitates digital review and approval workflows, maintains comprehensive audit trails, and supports multi-site client organizations through robust role-based access control. Its primary management unit is based on sites, with companies serving as a grouping mechanism for related sites. The project aims to provide a centralized, efficient, and auditable solution for compliance management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing and TanStack React Query for server state management. UI components are sourced from shadcn/ui, built on Radix UI primitives, with styling managed by Tailwind CSS, incorporating CSS variables for theme support (light/dark mode). Form handling is done with React Hook Form and Zod for validation, all bundled with Vite. The design adheres to enterprise design system principles, emphasizing data density and clarity across key pages such as Dashboard, Documents, Sites, Assessments, Reports, Support, and Settings. A breadcrumb navigation component (`client/src/components/breadcrumb-nav.tsx`) is integrated into the header bar, automatically generating path-based breadcrumbs from the current URL to improve navigation across nested pages.

### Backend
The backend is an Express.js application written in TypeScript, exposing a RESTful JSON API. It uses Drizzle ORM with PostgreSQL for data persistence and Zod for schema validation, integrated with drizzle-zod. Session management is handled by Express sessions with `connect-pg-simple` for PostgreSQL storage. The server uses a single entry point to manage API routes and serve the static frontend or proxy to Vite in development.

### Data Model
Core entities include Users (with role-based access), Companies (grouping sites), Sites (physical locations), Document Templates (with compliance properties), Documents (with status and approval workflows), Document Versions, Consultant Assignments, Site Module Access, Audit Logs, Support Requests, Training Folders, Training Courses, Training Bookings, and Roadmap Items. The system implements a hierarchical Company → Site → User structure.

### Reference Numbers
All core entities have unique reference numbers with prefixes for easy identification:
- **Companies**: CMP-XXXXX (e.g., CMP-00001)
- **Sites**: STE-XXXXX (e.g., STE-00001)
- **Users**: Role-based prefixes:
  - Admins: ADM-XXXXX
  - Consultants: CON-XXXXX
  - Clients: CLI-XXXXX
Reference numbers are auto-generated on entity creation and displayed as badges throughout the UI.

### Authorization
A role-based access control model with tenant isolation is enforced:
- **Admin**: Full access across all companies and data.
- **Consultant**: Access limited to explicitly assigned sites.
- **Client**: Access limited to explicitly assigned sites only. Clients with no site assignments have NO site access (no fallback to all company sites).
The `canUserAccessSite` helper function is critical for enforcing these rules.

### Primary Company Contact Auto-Assignment
When an admin sets a primary contact on a company, that client user is automatically assigned to all existing company sites. When a new site is created, the company's primary contact (stored as `contactUserId` on the company) is automatically assigned to the new site. These auto-assignments can be manually removed later by an admin.

### User Site Assignment Management
Admins can assign consultants and clients to sites directly from User Management:
- **Consultants**: Can be assigned to any site across all companies
- **Clients**: Can only be assigned to sites within their company
- Confirmation dialogs are required before adding or removing site assignments
- All assignment changes are logged in the audit trail

### Client User Status Workflow
Client users follow a four-stage status progression:
- **site_required**: Initial state when a client user is created. They have no site assignments yet.
- **invite_required**: Client has at least one site assignment (via direct assignment or primary contact auto-assignment). Ready to receive an invitation.
- **invited**: An invitation email has been sent to the client. They can now set their password and activate their account.
- **active**: Client has logged in and is fully active.
Status transitions are automatic: creating a client sets `site_required`, assigning them to a site (or making them primary contact) transitions to `invite_required`, sending an invitation transitions to `invited`, and first login transitions to `active`. The UI shows color-coded status badges and context-appropriate invitation buttons (Send/Resend).

### Admin Reports
A separate Admin Reports section provides controlled access to sensitive reports for administrators and consultants only:
- **Access Control**: Server-side role checks ensure clients cannot access sensitive user data (emails, roles, site assignments)
- **Users Report**: Complete list of all users with reference numbers, roles, companies, status, and site assignments
- **CSV Export**: Download capability for offline analysis
- Reports are clearly marked as confidential with warning banners
- The general Reports page remains accessible to all users for compliance-related reports

### Document Approval Workflow
The platform supports two document approval workflows:
- **Consultant-uploaded**: A three-stage process (Pending → Client Signed Off → Approved) with final consultant approval setting the renewal date.
- **Client-uploaded**: A two-stage process (Pending → Approved) with consultant/admin approval setting the renewal date.
Renewal dates are calculated based on approval date and template renewal period, with a 30-day buffer.

Document templates have a `requiresApproval` setting (default: true) that controls whether documents created from them need client approval:
- **Requires Approval (true)**: Documents start with status "review_required" and approvalStatus "pending", requiring the standard approval workflow.
- **No Approval Required (false)**: Documents are automatically marked as "compliant" upon creation/upload, bypassing the approval workflow.

### Training Library
The training library features a separate folder structure per module, containing Training Courses with detailed information (summary, overview, FAQs, method: online/in_person). Consultants can create Training Bookings for sites, including access credentials. Clients can view their booked and completed training, with functionality to view access credentials.

### H&S Incidents
A full incident management system under the Health & Safety module:
- **Incidents Table**: `incidents` with auto-generated `INC-XXXXX` references, siteId, entityId, severity (minor/moderate/major/critical), status (reported/under_review/resolved/closed), incidentType, incidentDate, injuriesReported, riddorReportable, and rich details fields (immediateActions, rootCause, correctiveActions, witnesses, locationDetails, injuryDetails).
- **Incident Milestones**: `incidentMilestones` table for action items per incident, with completion tracking.
- **Document Linkage**: `documents.incidentId` links documents to specific incidents. Each incident auto-creates a document folder.
- **Report Form**: All users can report incidents; admins/consultants can select any company/site; clients see only their assigned sites.
- **Detail View**: Full incident details dialog with status management (admin/consultant only), action items CRUD, and linked documents.
- **API Routes**: `GET/POST /api/incidents`, `GET/PATCH /api/incidents/:id`, `GET/POST /api/incidents/:id/milestones`, `PATCH/DELETE /api/milestones/incident/:id`, `GET /api/incidents/:id/documents`, `GET /api/incidents/:id/audit`, `POST /api/incidents/:id/regenerate-report`.
- **Activity Log**: `audit_logs` table has an `incident_id` column (varchar) for incident-scoped filtering. Audit events are logged for: `incident_created`, `incident_updated`, `incident_status_changed`, `document_uploaded`, `milestone_added`, `milestone_completed`. The Activity Log card appears in the incident detail sidebar with colored icon badges, entry descriptions, and a "Show N more" toggle (initial display: 3).
- **Auto-generated Incident Report**: When an incident is first reported, the system automatically generates a professional HTML "Original Incident Report" document and attaches it to the incident. This document captures all submitted details (description, severity, injuries, actions taken, witnesses, etc.) in a print-ready branded format. Admins/consultants can click "Regenerate Report" in the Documents card header to refresh the document with the latest incident details.
- **Role Filtering**: Clients see only incidents from their assigned sites; standard consultants see only their assigned sites; admins and pro consultants see all.

### Storage Pattern
A database-first storage model is used:
- **Database-backed (PostgreSQL)**: Stores Users, Companies, Sites, Documents, Document Versions, Document Folders, Audit Logs, Sessions, Template data, Support Requests, Support Messages, Support Request Reads, Cases, Case Milestones, Site Module Access, Consultant Assignments, and User Invitations. All core entities persist across server restarts.
- **In-memory caching**: Some lookup maps are used for performance optimization, but source of truth is always the database.

### Build Process
Development uses Vite for the frontend with HMR and `tsx` for the Express API. Production builds compile the static frontend with Vite and bundle the server with esbuild. Drizzle Kit manages database migrations.

## External Dependencies

### Database
- **PostgreSQL**: Primary relational database.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **connect-pg-simple**: PostgreSQL session store.

### UI Component Libraries
- **Radix UI**: Provides unstyled, accessible UI primitives.
- **shadcn/ui**: Component library built on Radix UI and Tailwind CSS.
- **Lucide React**: Icon library.

### Form and Validation
- **React Hook Form**: Manages form state.
- **Zod**: Schema validation library.
- **@hookform/resolvers**: Integrates Zod with React Hook Form.

### Date Handling
- **date-fns**: Library for date manipulation and formatting.

### Legal Documents
The system supports admin-managed legal documents (Terms & Conditions and Privacy Policy) stored separately in `/legal` directory within object storage:
- **API Endpoints**: POST `/api/legal-documents/:type` (admin-only upload), GET `/api/legal-documents/:type/info` (public, returns existence/metadata), GET `/api/legal-documents/:type/view` (public, streams document)
- **Settings Tab**: Admin-only "Legal Documents" tab in Settings page for uploading/replacing documents
- **Invitation Flow**: New user invitations require acceptance of available legal documents before account activation; enforced both client-side (checkboxes) and server-side (acceptance flags validated in `/api/invitations/accept`)
- **Audit Trail**: Legal acceptance is recorded in audit logs during user activation
- **Revision Tracking**: Each legal document upload stores a `revisionDate` in metadata. Users have a `legalAcceptedAt` timestamp on their profile.
- **Re-acceptance Flow**: When a legal document is re-uploaded (new revision), the `/api/auth/me` endpoint returns `legalAcceptanceRequired: true` for users whose `legalAcceptedAt` is before the latest revision date. The app blocks access with a `LegalAcceptanceScreen` until the user reviews and accepts the updated documents via `POST /api/legal-documents/accept`.

### Development Tools
- **Vite**: Frontend build tool and dev server.
- **tsx**: TypeScript execution for Node.js.
- **esbuild**: Fast JavaScript bundler.
- **Drizzle Kit**: Database migration and schema management.