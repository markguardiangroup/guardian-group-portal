---
name: Filter clear-X pattern
description: Where and how the "clear all filters" X button must appear across list/filter pages
---
Every filter bar offers ONE clear-X button that resets ALL the page's filters. It is ALWAYS rendered but disabled (greyed) when no filter is active — never conditionally rendered. Companies/Sites/Users use this same X in place of a Refresh button (Refresh was removed).

**Why:** user requirements — (1) "any filters require an x to clear selections", and (2) "make the cross show at all times, greyed out if no filters are active." A clear button that only resets some filters, only shows for privileged roles, or disappears when idle fails these.

**How to apply:**
- The "active" predicate inside `disabled={!(...)}` must compare each dimension to its real per-context default, NOT just to `"all"`. Pitfall: defaults are role/tab-aware — e.g. user mgmt `clientStaffFilter` defaults to `"my"` for non-admins, the staff-tab role filter auto-defaults to `"my_staff"` for pro consultants; treat those as inactive baselines or the X never greys on load. Guard tab-specific filters with the active tab.
- The clear handler must reset to those SAME baselines (not to `"all"`), or clicking clear leaves the X enabled.
- Coverage/pro-staff scope selectors reset to `"my"`; company/site/group go through scope-aware `resetFilters()` from `useSiteFilter(scope)`; coverage/pro-staff from `useCoverageFilter()`.
- Keep the X visible to ALL roles — hoist outside `isPrivileged`/`isPrivilegedUser` branches when the bar is shared.
