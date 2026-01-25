# Guardian Group H&S Web Portal

## Overview

Guardian Group H&S Web Portal is a B2B compliance platform for Health & Safety and HR/Employment Law management. This is a consultancy-led portal where Guardian Group creates and controls compliance content for their clients - it is not a self-serve SaaS platform.

The platform centralizes compliance documentation, enables digital review and approval workflows, creates audit trails, and supports multi-site client organizations with role-based access control. Sites are the primary management unit, with companies being a grouping mechanism for related sites.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend follows a page-based structure with shared components. Key pages include Dashboard, Documents, Sites, Assessments, Reports, Support, and Settings. The design follows enterprise design system principles (Carbon/Fluent Design) prioritizing data density and clarity.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod integration
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage

The server uses a single entry point that registers API routes and serves the static frontend build in production, or proxies through Vite in development.

### Data Model
Core entities include:
- **Users**: Role-based (admin, consultant, client) with company association (companyId)
- **Companies**: Stored as "entities" table for backward compatibility - parent organizations that group sites
- **Sites**: Physical locations linked to companies via `entity_id`/`companyId` foreign key
- **Document Templates**: Master templates (the "Document Bible") with Module → Folder → Template hierarchy. Compliance properties (isRequired, renewalPeriodMonths) are directly on templates
- **Folder Templates**: Template folders that define the organizational structure for each module
- **Documents**: Compliance documents with status tracking (compliant, review_required, overdue) and approval workflow tracking (pending, client_signed_off, approved, rejected, changes_requested), linked to sites
- **Document Versions**: Version history for document changes
- **Consultant Assignments**: Links consultants to sites with primary flag
- **Site Module Access**: Three-state access control (active/visible/hidden) per module per site
- **Module Access Requests**: Workflow for clients to request module access
- **Audit Logs**: Activity tracking with timestamps and user attribution
- **Support Requests**: Client support ticket system
- **Training Folders**: Organizational structure for training content per module (separate from document folders)
- **Training Courses**: Training content with enhanced fields (summary, course overview list, FAQs, training method: online/in_person)
- **Training Requests**: Client requests for training info or booking

### Authorization Model
Role-based access control with tenant isolation:
- **Admin**: Unrestricted access to all companies, sites, and data
- **Consultant**: Access only to sites they are explicitly assigned to via consultant_assignments table
- **Client**: Access depends on site assignments:
  - If client has site assignments in `client_site_assignments` table: Access only to assigned sites
  - If client has NO site assignments: Access all sites within their company (backward compatible)

The `canUserAccessSite` helper function enforces these rules across all API endpoints. Client company filtering is derived server-side from session to prevent tenant isolation bypass.

### Client Site Assignments
Clients can be restricted to specific sites within their company:
- **Default**: Clients access all sites in their company
- **Restricted**: When assigned to specific sites via client_site_assignments, they only access those sites
- API Routes:
  - `GET /api/sites/:siteId/client-assignments` - Get clients assigned to this site
  - `POST /api/sites/:siteId/client-assignments` - Assign client to site
  - `DELETE /api/sites/:siteId/client-assignments/:clientId` - Remove assignment
  - `GET /api/users/:clientId/site-assignments` - Get sites assigned to a client
- UI: Site Detail page → Users tab shows "Site Access" vs "All Sites" badges and menu options to manage

### Document Approval Workflow
Three-stage approval workflow for consultant-uploaded documents:
1. **Consultant uploads** → Status: "pending" (awaiting client sign-off)
2. **Client signs off** → Status: "client_signed_off" (awaiting consultant final approval)
3. **Consultant final approves** → Status: "approved" (triggers renewal date calculation)

Two-stage workflow for client-uploaded documents:
1. **Client uploads** → Status: "pending"
2. **Consultant/admin approves** → Status: "approved" (triggers renewal date)

Key principles:
- Only consultant/admin final approval sets the renewal date
- Renewal date = approval date + template renewal period - 30 days buffer
- Dashboard shows split approval metrics: "awaiting your review" vs "your docs pending approval"
- Audit trail logs both "document_signed_off" and "document_approved" actions

### Company-Site-User Hierarchy
The platform uses a hierarchical model: Companies → Sites → Users
- **Companies (entities table)**: Parent organizations with business details
- **Sites**: Physical locations belonging to a company via entity_id/companyId
- **User Access**: Users have companyId granting access to all sites within their company
- **Consultant Management**: Assign multiple consultants to specific sites with primary designation
- **Module Access**: Control which modules (H&S, HR, Employment Law, Support) each site can access
- **Compliance Tracking**: Track document compliance per site with aggregation by company

### Companies and Sites Navigation
Designed for scalability with thousands of companies and sites:
- **Companies page** (`/companies`): Paginated list with server-side search, shows site counts per company
- **Company Detail page** (`/companies/:companyId`): Shows company info, compliance overview, and lists sites
- **Site Detail page** (`/sites/:siteId`): Full site management with tabs for Documents, Folders, Users, etc.
- **Sites page** (`/sites`): Global view of all sites grouped by company (secondary navigation)

Key API Routes for Site Management:
- `GET /api/sites` - Get all sites with details
- `GET /api/sites/:siteId` - Get single site
- `GET /api/sites/:siteId/users` - Get site users
- `GET /api/sites/:siteId/consultants` - Get assigned consultants
- `POST /api/sites/:siteId/consultants` - Assign consultant
- `DELETE /api/sites/:siteId/consultants/:consultantId` - Remove assignment
- `GET /api/sites/:siteId/module-access` - Get module access settings
- `POST /api/sites/:siteId/module-access` - Set module access

### Training Library
The Training Library has its own dedicated folder structure separate from document template folders:
- **Training Folders**: Organizational containers per module (health_safety, human_resources, employment_law, support)
- **Training Courses**: Individual courses with enhanced details (summary, course overview list with up to 5 items, 5 FAQs, training method: online/in_person, featured flag for homepage highlighting)
- **Training Requests**: Client requests for more info or booking training

Module Training Page Features:
- **Filters**: Required status (all/required/recommended), Training Method (all/online/in_person), Provider (dynamic list)
- **Search**: Search by title, summary, or provider
- **Badges**: Training method displayed as badges on course cards (Monitor icon for Online, Users icon for In Person)

Key API Routes:
- `GET /api/training-folders` - Get all training folders (filter by ?module=)
- `POST /api/training-folders` - Create training folder (admin only)
- `PATCH /api/training-folders/:id` - Update training folder (admin only)
- `DELETE /api/training-folders/:id` - Delete training folder (admin only)
- `GET /api/training-courses` - Get all training courses (filter by ?module=)
- `POST /api/training-courses` - Create training course (admin only)
- `PATCH /api/training-courses/:id` - Update training course (admin only)
- `DELETE /api/training-courses/:id` - Delete training course (admin only)
- `GET /api/training-requests` - Get training requests for user's sites
- `POST /api/training-requests` - Submit training request (any authenticated user)

### Storage Pattern
The application uses an in-memory storage implementation (`MemStorage` class) that implements the `IStorage` interface. This allows for easy swapping to a database-backed implementation when PostgreSQL is provisioned.

### Build Process
- Development: Vite dev server with HMR, Express API server with tsx
- Production: Vite builds static frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Database migrations: Drizzle Kit with `db:push` command

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database toolkit for TypeScript with type-safe queries
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### UI Component Libraries
- **Radix UI**: Unstyled, accessible component primitives (dialogs, menus, forms, etc.)
- **shadcn/ui**: Pre-built component library using Radix + Tailwind
- **Lucide React**: Icon library

### Form and Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation for forms and API requests
- **@hookform/resolvers**: Zod resolver for React Hook Form

### Date Handling
- **date-fns**: Date formatting and manipulation

### Development Tools
- **Vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production server build
- **Drizzle Kit**: Database migration and schema management CLI