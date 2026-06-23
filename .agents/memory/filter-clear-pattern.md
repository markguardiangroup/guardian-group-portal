---
name: Filter clear-X pattern
description: Where and how the "clear all filters" X button must appear across list/filter pages
---
Every filter bar must offer a single ghost icon Button (`<X className="h-4 w-4"/>`, variant ghost, size icon) that resets ALL the page's active filters and is shown only when ANY filter is active. Site Documents (`module-documents.tsx`) is the canonical reference (`clearAllFilters` + `hasActiveFilters`).

**Why:** user requirement — "any filters require an x next to the filter to clear any selections." A clear button that only resets some filters (or only shows for company/site) fails this.

**How to apply:**
- Reset every user-selectable filter dimension in the bar, including coverage/pro-staff scope selectors (reset them to `"my"`, their default), search, status, type, module, company/site.
- Place the clear-X so it is visible to ALL roles, not only privileged ones — hoist it outside `isPrivileged`/`isPrivilegedUser` branches when a filter bar is shared.
- company/site/group resets go through the scope-aware `resetFilters()` from `useSiteFilter(scope)`; coverage/pro-staff come from `useCoverageFilter()`.
