---
name: Document comments are staff-only internal notes
description: The documents.comments column is internal/staff-only; every client-facing document endpoint must redact it.
---

The `documents.comments` text column is repurposed as **Internal Comments** — staff-only (Admin/Consultant/Developer), never shown to or editable by `client` role.

**Why:** Consultancy needs private notes on client documents; leaking them breaks the trust boundary.

**How to apply:** A document object reaches clients through MANY endpoints, not just the obvious three. When adding/changing any endpoint that returns document-shaped JSON, run it through `stripInternalDocFields(doc, role)` (defined in server/routes.ts) for client roles. Known surfaces that all return documents: GET `/api/documents/:id`, GET `/api/documents`, GET `/api/documents/module/:module`, GET `/api/folders/:id/documents`, GET `/api/cases/:id/documents`, GET `/api/incidents/:id/documents`, and POST `/api/documents/:id/approval` (clients can sign off, so its response is client-reachable). Also enforce staff-only WRITES: the incident document POST/PATCH routes (`/api/incidents/:id/documents`, `/api/incidents/:incidentId/documents/:docId`) allow any site-accessing role, so drop `comments` from the body when role==='client'. The main PATCH `/api/documents/:id` is already gated to staff.
