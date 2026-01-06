# Guardian Group H&S Web Portal

## Overview

Guardian Group H&S Web Portal is a B2B compliance platform for Health & Safety and HR/Employment Law management. This is a consultancy-led portal where Guardian Group creates and controls compliance content for their clients - it is not a self-serve SaaS platform.

The platform centralizes compliance documentation, enables digital review and approval workflows, creates audit trails, and supports multi-entity/multi-site client organizations with role-based access control.

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

The frontend follows a page-based structure with shared components. Key pages include Dashboard, Documents, Entities, Assessments, Reports, Support, and Settings. The design follows enterprise design system principles (Carbon/Fluent Design) prioritizing data density and clarity.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod integration
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage

The server uses a single entry point that registers API routes and serves the static frontend build in production, or proxies through Vite in development.

### Data Model
Core entities include:
- **Users**: Role-based (admin, consultant, client) with entity association
- **Entities**: Client organizations with company details
- **Sites**: Physical locations belonging to entities
- **Documents**: Compliance documents with status tracking (compliant, review_required, overdue)
- **Document Versions**: Version history for document changes
- **Audit Logs**: Activity tracking with timestamps and user attribution
- **Support Requests**: Client support ticket system

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