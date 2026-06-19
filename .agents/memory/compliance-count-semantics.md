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

## Scoped doc visibility — EXPLICIT-SHARE-ONLY rule (current, overrides old owner-bypass)
A scoped doc (`siteId === null`, scope company/group) is visible/counted for a
site **only** when it has an explicit share record:
`sharedWithSiteIds.includes(siteId)` OR
`sharedWithCompanyIds.includes(site.companyId)`.
There is **NO** `entityId === companyId` owner bypass anymore. Zero-share scoped
docs — and docs shared only to unrelated sites/companies — must NOT appear or be
counted in ANY view (All-Sites card, site cards, Documents folder view,
Documents table view). Folder and table must match exactly.

**Why:** the old owner-bypass (`entityId === companyId`) made company/group docs
with no shares (or shares to other companies) show up on their owner's sites,
inflating counts. The user's hard rule: an explicit share is required everywhere.

**How to apply — the rule lives in THREE mirrored places; change all together:**
1. Server `computeSharedDocsForSiteH` (server/routes.ts): every scope branch
   (company-own, group-own, inherited group-owner) gates on
   `hasSiteShare || hasCompanyShare` (site-target share to siteId OR company-target
   share to companyId). This feeds BOTH the hierarchy `sharedDocuments` array AND
   folder `stats.totalDocuments` (`folderDocuments + childDocs + sharedForThisFolder`).
2. Client `filteredDocuments` universal gate (module-documents.tsx): drop any
   `siteId===null` doc with empty sharedWithSiteIds AND empty sharedWithCompanyIds;
   plus `matchesSite` requires the share to target the selected site/its company.
3. Client `isVisibleSharedDoc` in `sharedByFolderTemplate`: same site/company gate
   for folder view.
4. Client per-site EXPANSION `coveredSites` filters (3 copies: expandedTableDocuments,
   expandedUnmatchedShared, expandedSharedByFolderTemplate). At all-sites a scoped doc
   is expanded to one virtual row per covered site, and the header
   (`adjustedHeaderStats = statusCounts(expandedTableDocuments)`) counts those rows.
   `coveredSites` must match ONLY explicitly-shared sites/companies
   (`sharedWithSiteIds.includes(s.id) || sharedWithCompanyIds.includes(s.companyId)`).
   A removed owner-bypass (`scope==='group' && entityId===s.companyId`) was expanding
   group docs to their owner company's sites with no share, over-counting the
   All-Companies/All-Sites totals (e.g. compliant showed 40, should be 38).

**Server-restart gotcha:** routes.ts changes do NOT hot-reload — the client
hot-reloads but the Express server keeps old code until restarted. Symptom of a
forgotten restart: docs correctly hidden (new client) but folder header count
still inflated (old server). At ALL-SITES the client `sharedExpansionDeltas`
masks the server overcount; at a SPECIFIC site there is no delta, so the stale
server count shows through. Always restart the workflow after editing routes.ts.

**Latent (not yet fixed):** client URL-scope `ownedAtScope` bypass
(urlScope company/group, no specific site) can still include owned-but-shared-
elsewhere docs at the company-AGGREGATE view — doesn't manifest with current data;
align with the server rule if it ever does.
