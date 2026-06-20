---
name: Document compliance count semantics
description: Canonical rules for keeping document compliance counts/% consistent across every surface (site cards, module dashboard, documents list).
---

# Document compliance count semantics

Every surface that shows compliance (individual site cards, the module-sites
"All Sites" aggregate card, the module dashboard headline + click-through
modals, and the Documents list) MUST agree. Treat the **module-sites "All Sites"
card** as the canonical aggregate — it already matches the Documents page — and
align other surfaces to it.

## Core rules
- A doc's own `status` field is authoritative; do NOT recompute from
  `expiryDate`/`renewalDate`/`approvalStatus`. Mandatory good state = `status
  === "compliant"`. **Compliant** = mandatory docs with status compliant.
  **Non-Compliant** = mandatory docs not approved (overdue/approval_required)
  PLUS missing-required slots.
- Always exclude non-counting docs with `isCountableDoc` (`client/src/lib/doc-stats.ts`).
- A headline count MUST equal the row count of the modal it opens — drive both
  from the same filtered array.

## Explicit-share-only rule (overrides any old owner-bypass)
A scoped doc (`siteId === null`) counts for a site **only** with an explicit
share: `sharedWithSiteIds.includes(siteId)` OR
`sharedWithCompanyIds.includes(site.companyId)`. There is NO `entityId ===
companyId` owner bypass. Zero-share scoped docs, and docs shared only to
unrelated sites/companies, never appear or count anywhere.
**Why:** the user's hard rule — an explicit share is required everywhere;
owner-bypass inflated owner-site counts.

## Aggregate parity (how surfaces drift, and how to stop it)
- **Same site set.** The card aggregates only sites where the module is
  active/visible (`moduleAccess[module]` is "active"/"visible"). Any aggregate
  surface must filter to the SAME module-active set, or sites with the module
  disabled silently inflate the dashboard's counts/%/missing.
- **Same doc construction.** Build the aggregate doc set by iterating the
  in-scope sites and, per site, taking its own docs plus scoped docs explicitly
  shared to it/its company (cloning scoped docs per covering site). No
  owner-bypass, no "keep a has-share doc once even if uncovered" fallback —
  those reintroduce drift. Mirror the card's construction exactly.
- **Same %.** Per-site compliance % comes from server slot-based raw counts
  (`site.moduleRawCounts[module]`: compliant/denom). An aggregate % must sum
  those raw counts across the in-scope sites, not derive from a doc-based ratio.
- **Why a shared helper is worth it:** these three (site set + doc expansion +
  raw %) have repeatedly drifted because each surface re-implements them; a
  single shared helper used by both pages prevents recurrence.

## Gotchas
- The share/visibility rule is mirrored in BOTH the client surfaces and the
  server doc-sharing + folder-stats computations. Change all mirrors together or
  a header count will disagree with its list.
- Server code does NOT hot-reload — restart the workflow after server edits. At
  all-sites a client-side expansion delta can mask a stale server overcount; at a
  specific site there is no delta, so the stale count shows through.
- The module DASHBOARD must build its doc set with the SAME explicit-share,
  per-in-scope-site loop at EVERY scope (single site, company, all sites) — a
  single-site special-case that reused the old owner-bypass filter silently
  inflated site-level totals/%. One construction, all scopes.
