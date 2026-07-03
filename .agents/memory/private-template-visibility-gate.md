---
name: Private document template visibility gate
description: Why "private" document templates were invisible to non-developer staff, and the fix pattern for staff-vs-client template visibility.
---

`storage.getDocumentTemplates` filters templates for any non-`developer` caller by testing `userSources !== undefined`. It used to hide **all** `visibility === "private"` templates whenever that branch ran — i.e. for every role except literally `developer`, including `administrator` and `consultant` (including Pro Consultants).

This broke any staff feature built on top of `/api/document-templates` that legitimately needs private templates, e.g. the "Manage Mandatory Documents" (company required-templates) picker — non-developer staff would see "No templates available" even when matching private templates existed with an overlapping `sources` tag.

**Why:** private templates are meant to be staff-only (hidden from clients), not developer-only. The original filter conflated "staff-only" with "developer-only," which is a stricter and wrong boundary — `canUserAccessTemplateFile` (a sibling check for raw template files) already correctly treats developer/administrator/consultant as full access, so the two checks had drifted out of sync.

**How to apply:** when gating template (or similar) lists by role, add an explicit `includePrivate` boolean derived from `role in {developer, administrator, consultant}` rather than reusing the developer/non-developer source-scoping branch to also imply private-vs-public visibility. Keep the two independent: private-vs-public is a staff-vs-client boundary; source-scoping (`sources` array overlap) is a separate brand/tenant boundary that still applies to private templates too.
