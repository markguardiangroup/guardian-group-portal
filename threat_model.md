# Threat Model

## Project Overview

This project is a public-facing compliance portal for Guardian Group clients, consultants, administrators, and developers. It is a React/Vite frontend backed by an Express API, PostgreSQL, session-based authentication, object storage for uploaded files and generated documents, and Accelo integration for company synchronization.

The scan scope is production only. Mockup/sandbox-only code should be ignored unless it is shown to be reachable from the deployed app. The deployment is public, so any unauthenticated route must be treated as internet-reachable.

## Assets

- **User accounts and active sessions** — authenticated browser sessions for client, consultant, administrator, and developer users. Compromise would allow access to tenant data and privileged workflows.
- **Compliance documents and uploads** — uploaded documents, incident files, secure client uploads, case bundles, and generated previews. These can contain sensitive business records, HR/employment-law material, and audit evidence.
- **Tenant-scoped business data** — companies, sites, incidents, cases, approvals, consultant assignments, and reports. Cross-tenant exposure would break core isolation guarantees.
- **Secrets and integration credentials** — session secret, Turnstile secret, Accelo OAuth/webhook secrets, database credentials, and object-storage access. Leakage would let attackers impersonate users or connected services.
- **Audit and approval records** — actions proving who uploaded, approved, changed, or downloaded compliance materials. Tampering would undermine the portal’s compliance value.

## Trust Boundaries

- **Browser to API** — all request bodies, query strings, headers, cookies, and uploaded files are untrusted until validated server-side.
- **Authenticated to unauthenticated** — invitation validation, password-reset, OAuth callback, public downloads, and any helper/upload endpoints are high-risk because the deployment is public.
- **Role boundary inside the app** — developer, administrator, consultant, and client users have materially different privileges; tenant isolation and site scoping must be enforced server-side.
- **API to PostgreSQL** — the server has broad database access; any injection or broken authorization at the API layer becomes full data compromise.
- **API to object storage** — application code stores private documents and generated files outside the database; object paths and ACLs must not become an authorization bypass.
- **API to external services** — Accelo, Turnstile, email delivery, LibreOffice/Ghostscript/Python helpers, and Google Cloud Storage all cross into separate trust domains.

## Scan Anchors

- **Production entry points**: `server/index.ts`, `server/routes.ts`, `server/replit_integrations/object_storage/routes.ts`, `server/accelo.ts`.
- **Highest-risk code areas**: authentication/MFA flows in `server/routes.ts`; object storage helpers; document preview/download/upload flows; case bundle and DOCX/PDF conversion code; public integration callbacks/webhooks; staff-only `/api/users/**` helper routes that must enforce the same source/company/site scoping as the main user-directory endpoints.
- **Public surfaces**: login, forgot-password, invitation validation/acceptance, OAuth callback, public download/object routes, any webhook-like endpoints.
- **Authenticated/admin surfaces**: most `/api/**` business routes in `server/routes.ts`; role checks rely heavily on `requireAuth`, `canUserAccessSite`, and document/case access helpers.
- **Usually ignore unless proven reachable**: local scripts, static assets, and mock/sandbox-only paths outside the production server/client flow.

## Threat Categories

### Spoofing

The portal relies on session cookies plus optional MFA. All protected routes must require a valid server-side session, and public callback/webhook endpoints must verify origin or shared-secret authenticity. Trusted-device, password-reset, and invitation flows must resist token theft, replay, and session fixation.

### Tampering

Clients and lower-privilege staff can submit document metadata, uploads, approvals, and integration-triggered changes. The server must treat all file metadata, MIME types, IDs, and workflow state transitions as untrusted, and must not let attackers alter records or generated outputs outside the rules enforced by role/site checks.

### Information Disclosure

This app stores sensitive documents and tenant-scoped records. File URLs, previews, downloads, report exports, logs, and API responses must be authorization-checked server-side. Private object-storage paths must never become a backdoor around normal document access checks.

### Denial of Service

The public deployment includes login, reset, upload, preview, and document-conversion paths. Public or low-friction endpoints must be rate-limited and bounded so attackers cannot exhaust storage, CPU, or external conversion tools with oversized or repeated requests.

### Elevation of Privilege

The biggest risks are broken access control across companies/sites, public endpoints that write or expose private data, and active content rendered on the application origin. A lower-privilege user or unauthenticated attacker must not be able to turn file handling, previews, uploads, or integration endpoints into same-origin script execution or cross-tenant data access.

Staff convenience endpoints are part of the same privilege boundary. A consultant or source-scoped administrator must not be able to manage, weaken authentication for, or inspect activity for users outside the companies/sites/sources they are allowed to administer.
