---
name: Template file access predicate must match listing filter exactly
description: canUserAccessTemplateFile (server/routes.ts) and storage.getDocumentTemplates() must enforce identical policy, or guessed/leaked IDs bypass the list-level filter.
---

Any per-entity authorization predicate that gates a direct-by-ID route (preview/detail/versions) must independently enforce every rule the corresponding list endpoint applies — visibility, active status, and source overlap — not just a subset.

**Why:** `canUserAccessTemplateFile` originally allowed non-staff access whenever a template had no `sources` set (treating that as "public"), while `storage.getDocumentTemplates()` treated no-sources as developer/staff-only. It also never checked `visibility === "private"` at all. Routes guarded only by the predicate (preview, detail, versions) were therefore bypassable by a leaked/guessed template ID even though the same template was correctly hidden from listings.

**How to apply:** When adding/hardening an ID-based access check that is meant to "mirror" a list filter, diff the two rule sets line-by-line (active/visibility/source logic) rather than assuming a docstring comment guarantees parity. Prefer extracting one shared predicate function used by both the list filter and the by-ID routes so they cannot drift again.

**Client "effective sources" gotcha:** for non-staff, `user.sources` is normally empty on client accounts — the real source scope for a client is their *company's* `sources` field, resolved via `storage.getCompany(user.companyId)`. Any source-overlap check (folder listing, toolkit listing, or a by-ID predicate like `canUserAccessTemplateFile`) must resolve this "effective sources" value the same way everywhere, or a client sees a public sourced file listed in the Toolkit UI but gets "Access denied" when actually opening/downloading it (the raw-file route checked `user.sources` only, while the listing endpoints already used the company fallback).
