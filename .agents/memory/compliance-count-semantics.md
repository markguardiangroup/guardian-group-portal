---
name: Document compliance count semantics
description: Canonical rules for computing/displaying document compliance counts across site cards, dashboard, and documents list.
---

# Document compliance count semantics

All compliance counts shown to users (site cards, module dashboard headline +
modals, documents list) must agree. The canonical source of truth is the
**client-side, document-based** computation, NOT the server slot-based numbers.

## The rules
- A document's own `status` field is authoritative — do NOT recompute via date
  math (`expiryDate`/`renewalDate`) or `approvalStatus`. For a **mandatory** doc
  the approved/good state is exactly `status === "compliant"`; non-mandatory
  approved docs get `status === "approved"`. (See server
  `correctMisclassifiedDocuments`.) Statuses: compliant | approval_required |
  overdue | approved.
- **Compliant** = mandatory docs with `status === "compliant"`.
- **Non-Compliant** = mandatory docs not approved (`status` overdue or
  approval_required) **plus** missing required (from missing-required-templates).
- Always exclude non-counting docs via `isCountableDoc` from
  `client/src/lib/doc-stats.ts`: `!isArchived && !caseId && !incidentId &&
  source !== "external"`. `statusCounts()` buckets by the `status` field.
- A headline count MUST equal the row count of the modal it opens — drive both
  from the same filtered array + filters.

## Scoped doc visibility (counting a scoped doc for a site/company)
A doc with `siteId === null` counts for a site when:
`sharedWithSiteIds.includes(siteId)` OR
`sharedWithCompanyIds.includes(site.companyId)` OR
`entityId === site.companyId` (owned by the site's company; origin docs have no
share record).

**Why:** company/group-owned docs often have no share record, so omitting the
`entityId === companyId` clause made the site card show fewer docs than the
documents page.

**How to apply (multi-company scopes):** when scope spans multiple companies
(e.g. a Group Owner viewing all members), match `entityId` /
`sharedWithCompanyIds` against the **set of all in-scope company IDs**, not a
single picked companyId — otherwise owned-but-unshared docs for the other
in-scope companies get dropped.
