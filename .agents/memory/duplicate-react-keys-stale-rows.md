---
name: Duplicate React keys leave stale rows on filter change
description: Why a correctly-gated conditional list render can still show "impossible" stale rows, and how to spot it.
---

When list/table rows render with **non-unique React keys**, React cannot reconcile them on re-render: changing a filter (or any state that should remove rows) can leave **stale DOM rows on screen** even though the gating condition correctly evaluated to false. Static reading of the render branch looks 100% correct (the rows "can't" show), so the bug appears impossible until you check the live browser.

**Why:** In module-documents.tsx the synthetic "missing required document" rows used `key={slot.templateId}`, but the same required template can be missing at multiple sites, so `tableMissingSlots` legitimately holds several rows sharing one `templateId` → duplicate keys. Switching the Status filter from "All" to "Approved" turned the gate off, but React kept the stale missing rows. Fix: `key={`missing-${slot.templateId}-${slot.siteId ?? "all"}`}` — unique among slots AND prefixed so it can never collide with real doc row keys (`doc.id`).

**How to apply:** If a user reports rows that "shouldn't be there per the code" especially after a filter/sort/tab change, check the browser console for `Encountered two children with the same key` (it names the offending key + parent element). Make list keys globally unique and namespaced per row-type; never key synthetic rows by an id that repeats or that a real row could also use.
