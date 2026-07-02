---
name: Sibling subroute authorization parity
description: When a parent resource route enforces tenant/site authorization, every sibling CRUD subroute for its child entities (documents, notes, milestones, checklist items, audit) must independently enforce the same check.
---

A feature's "main" GET route (e.g. case detail, document detail) often correctly
calls a site/tenant access helper (e.g. `canUserAccessSite`) plus any
confidentiality check. It's easy for sibling routes added later for the same
parent's child entities (upload/delete document, create/update/delete
milestone, checklist item, note, audit log) to skip that check entirely, or to
substitute a weaker check (e.g. "creator or admin" ownership, or a
confidentiality-only check) that doesn't verify tenant/site scope at all.

**Why:** IDs for child entities are typically UUIDs exposed in legitimate
URLs/links, so "hard to guess" is not a defense — once a user has any valid ID
they can hit the sibling route directly, bypassing the list/parent endpoint's
filtering.

**How to apply:** For every route keyed by a child-entity id (`:milestoneId`,
`:noteId`, `:checklistItemId`, etc.), fetch the row first, resolve its parent
(case/document/etc.), then call the same site/tenant access helper the parent
GET route uses — before any read or mutation. Ownership checks
("creator === user.id") are a separate, additive concern and never a
substitute for tenant scoping. When auditing a feature for this class of bug,
grep for every route under the same URL prefix family and diff which ones call
the access helper vs which don't, rather than trusting that "the main route is
fixed so siblings are fine."
