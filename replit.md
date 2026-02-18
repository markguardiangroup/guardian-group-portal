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

### Development Tools
- **Vite**: Frontend build tool and dev server.
- **tsx**: TypeScript execution for Node.js.
- **esbuild**: Fast JavaScript bundler.
- **Drizzle Kit**: Database migration and schema management.