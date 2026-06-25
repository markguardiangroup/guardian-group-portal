---
name: Company activation trigger
description: When/why a company moves from "pending" to "active" status
---

# Company pending → active

A company auto-activates the moment its **first client user becomes active**, NOT when a primary contact is assigned.

**Why:** Product owner wants company status to reflect real client engagement (a client actually going live / logging in), not an internal admin action like setting a contact. The old behaviour (auto-activate on primary-contact assignment) was explicitly removed.

**How to apply:**
- A single helper `activateCompanyOnFirstActiveClient(companyId, actorUserId, actorName)` in `server/routes.ts` owns this transition.
- It is **idempotent and race-safe**: it does a conditional SQL `UPDATE companies SET status='active' WHERE id=$1 AND status='pending' RETURNING name` and only writes the `company_activated` audit log if a row was returned. Only fires once.
- Called from every path where a client ends up `active`: the accept-invitation route (client sets password) and `PATCH /api/users/:id` when an admin sets a client to `active`. If you add a new way for a client to become active, call this helper there too.
- Do NOT re-add company auto-activation to the primary-contact assignment logic in `PATCH /api/companies/:id`.
