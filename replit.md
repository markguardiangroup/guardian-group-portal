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

A database-first storage model uses PostgreSQL as the primary data store for all persistent entities, with in-memory caching for performance. Development uses Vite and `tsx`, while production builds are bundled with Vite and esbuild. Drizzle Kit manages database migrations.

Admin-managed legal documents (Terms & Conditions, Privacy Policy) are stored in object storage, with API endpoints for upload and retrieval. User acceptance is required during invitation flow and upon revision, triggering a re-acceptance workflow to block access until updated documents are reviewed.

## External Dependencies

-   **Database**: PostgreSQL, Drizzle ORM, connect-pg-simple
-   **UI Component Libraries**: Radix UI, shadcn/ui, Lucide React
-   **Form and Validation**: React Hook Form, Zod, @hookform/resolvers
-   **Date Handling**: date-fns
-   **Development Tools**: Vite, tsx, esbuild, Drizzle Kit