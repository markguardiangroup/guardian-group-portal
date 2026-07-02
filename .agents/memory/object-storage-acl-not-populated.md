---
name: Object storage /objects/ route needs entity-level ACL resolution, not policy metadata
description: No upload flow ever calls trySetObjectEntityAclPolicy, so canAccessObjectEntity()/getObjectAclPolicy() are dead weight; the generic /objects/:objectPath(*) route must resolve paths back to their owning business entity instead.
---

The generic `/objects/:objectPath(*)` route and `objectAcl.ts` helpers
(`canAccessObjectEntity`, `getObjectAclPolicy`) exist from the storage
integration template, but no document/template/incident/case/training
upload path in this app ever calls `trySetObjectEntityAclPolicy` to attach
ACL metadata to an object. Every object has zero ACL policy, so that
mechanism can never provide real authorization here.

Client pages read `fileUrl` values straight from document/template API
responses and use them directly as `<img src>`, `<a href>`, and `fetch()`
targets pointing at `/objects/...` — they do not go through a business API
proxy for the actual byte-serving step. That means the raw object route
itself must enforce business-level access control.

**Why:** Two earlier attempts were rejected by code review:
1. Hard-enforcing `canAccessObjectEntity()` returns false when no policy
   exists, which 403s every real file since no policy is ever set.
2. Falling back to "any authenticated user" when no policy exists closes
   the unauthenticated bug but leaves a real cross-tenant bypass — any
   logged-in user could read any other tenant's documents.

**How to apply:** The only correct fix is to resolve the raw object path
back to the specific entity that owns it (document, document version,
document template, template version, client upload, iShare, case bundle)
via exact `file_url`/`cached_file_url` string lookups, then re-run that
entity's existing access-check helper (`canUserAccessDocument`,
`canUserAccessFolder`, `canUserAccessSite`, `canUserAccessIshareFolder`,
or a template-specific check). Default-deny any path matching no known
entity. `file_url` values are stored as exact strings like
`/objects/uploads/<uuid>` (documents/templates/versions/uploads/ishares)
or `/objects/bundles/<uuid>.pdf` (case bundles) — `req.path` matches them
directly with no normalization needed.
