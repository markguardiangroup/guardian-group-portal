# Guardian Group H&S Web Portal

## Overview

The Guardian Group H&S Web Portal is a B2B compliance platform designed for Health & Safety and HR/Employment Law management. It serves as a consultancy-led portal where Guardian Group manages and provides compliance content to its clients, rather than being a self-service SaaS platform. The portal centralizes compliance documentation, facilitates digital review and approval workflows, maintains comprehensive audit trails, and supports multi-site client organizations through robust role-based access control. Its primary management unit is based on sites, with companies serving as a grouping mechanism for related sites. The project aims to provide a centralized, efficient, and auditable solution for compliance management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, utilizing Wouter for routing and TanStack React Query for server state management. UI components are sourced from shadcn/ui, built on Radix UI primitives, with styling managed by Tailwind CSS, incorporating CSS variables for theme support (light/dark mode). Form handling is done with React Hook Form and Zod for validation, all bundled with Vite. The design adheres to enterprise design system principles, emphasizing data density and clarity across key pages such as Dashboard, Documents, Sites, Assessments, Reports, Support, and Settings.

### Backend
The backend is an Express.js application written in TypeScript, exposing a RESTful JSON API. It uses Drizzle ORM with PostgreSQL for data persistence and Zod for schema validation, integrated with drizzle-zod. Session management is handled by Express sessions with `connect-pg-simple` for PostgreSQL storage. The server uses a single entry point to manage API routes and serve the static frontend or proxy to Vite in development.

### Data Model
Core entities include Users (with role-based access), Companies (grouping sites), Sites (physical locations), Document Templates (with compliance properties), Documents (with status and approval workflows), Document Versions, Consultant Assignments, Site Module Access, Audit Logs, Support Requests, Training Folders, Training Courses, Training Bookings, and Roadmap Items. The system implements a hierarchical Company → Site → User structure.

### Authorization
A role-based access control model with tenant isolation is enforced:
- **Admin**: Full access across all companies and data.
- **Consultant**: Access limited to explicitly assigned sites.
- **Client**: Access depends on site assignments, either all sites within their company or specific assigned sites.
The `canUserAccessSite` helper function is critical for enforcing these rules.

### Document Approval Workflow
The platform supports two document approval workflows:
- **Consultant-uploaded**: A three-stage process (Pending → Client Signed Off → Approved) with final consultant approval setting the renewal date.
- **Client-uploaded**: A two-stage process (Pending → Approved) with consultant/admin approval setting the renewal date.
Renewal dates are calculated based on approval date and template renewal period, with a 30-day buffer.

### Training Library
The training library features a separate folder structure per module, containing Training Courses with detailed information (summary, overview, FAQs, method: online/in_person). Consultants can create Training Bookings for sites, including access credentials. Clients can view their booked and completed training, with functionality to view access credentials.

### Storage Pattern
A hybrid storage model is used:
- **Database-backed (PostgreSQL)**: Stores Documents, Document Versions, Document Folders, Audit Logs, Sessions, Template data, Support Requests, Support Messages, Support Request Reads, Cases, Case Milestones, Site Module Access, and Consultant Assignments.
- **In-memory storage**: Used for Users, Companies, and Sites entities loaded at startup, with lookups referencing these in-memory maps for performance.

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

### Development Tools
- **Vite**: Frontend build tool and dev server.
- **tsx**: TypeScript execution for Node.js.
- **esbuild**: Fast JavaScript bundler.
- **Drizzle Kit**: Database migration and schema management.