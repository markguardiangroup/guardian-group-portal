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
- **Document Types**: Admin-managed master list defining required/optional document types per module with renewal periods
- **Documents**: Compliance documents with status tracking (compliant, review_required, overdue), linked to document types and sites
- **Document Versions**: Version history for document changes
- **Consultant Assignments**: Links consultants to sites with primary flag
- **Site Module Access**: Three-state access control (active/visible/hidden) per module per site
- **Module Access Requests**: Workflow for clients to request module access
- **Audit Logs**: Activity tracking with timestamps and user attribution
- **Support Requests**: Client support ticket system

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