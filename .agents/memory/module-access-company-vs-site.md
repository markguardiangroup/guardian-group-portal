---
name: Module access is company-level, not site-level
description: How health_safety/human_resources/employment_law module visibility is actually gated — avoid misdiagnosing missing site_module_access rows as a bug.
---

# Rule
Module visibility (health_safety, human_resources, employment_law) is gated primarily by the **company-level** boolean flags on `companies` (e.g. `healthSafetyAccess`). A site's baseline `moduleAccess` status defaults to `"active"` whenever the company flag is true — an *empty* `site_module_access` table for a site is normal and does NOT hide it.

Per-site rows in `site_module_access` only apply as a **refinement** on top of an already-enabled company flag (e.g. to hide/limit one specific site). They can never override a company-level "hidden" to "active", and their absence never causes a site to be hidden when the company flag is true.

**Why:** Misdiagnosed a client's "No sites found" issue as a per-site module-access gap (empty `site_module_access` rows) when the real causes were unrelated: the company flag was already true, and the client simply had no site assignment yet (normal onboarding state, not a bug).

**How to apply:** Before treating "site not visible to client" as a module-access bug, check in this order: (1) does the client have a `client_site_assignments` row for the site, (2) is the relevant `companies.*Access` flag true, (3) only then consider `site_module_access` overrides. See `server/storage.ts` `getSitesWithDetails` for the exact precedence logic.
