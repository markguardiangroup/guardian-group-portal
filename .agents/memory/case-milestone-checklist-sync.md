---
name: EL case Response Deadline sync
description: Response Deadline milestone and ET3 checklist submission date must stay in sync from every write path (case-level, milestone-level).
---

The EL "Response Deadline" milestone (`isResponseDeadline: true`) and its linked
"ET3 Response Form" essential-document checklist item (`checklistItemId`/
`linkedMilestoneId`) and the case's `responseDeadline` field are all supposed
to share one logical date. Three write paths can change it: the milestone PATCH
route, the checklist-item PATCH route (`/api/checklist/:id`), and the case PATCH
route (`/api/cases/:id`) — all three now push the date to the other two.

**Why:** when a new write path is added that can also change this date (e.g. a
case-level "Edit Case" endpoint that lets staff edit `responseDeadline`
directly), it's easy to update only the `cases` row and silently leave the
milestone/checklist out of sync — the fix has to be applied at every entry
point that can change the date, not just the original one.

**How to apply:** whenever you add/modify a route that writes
`cases.responseDeadline` (or any other field mirrored across `case_milestones`
and `case_document_checklist`), look up the case's `isResponseDeadline`
milestone and its `checklistItemId` and push the same value through, guarding
for older cases where `checklistItemId` may be null (pre-dates the ET3
checklist auto-creation feature).

A fourth entry point exists client-side: the "essential document" upload
dialog lets staff set the deadline at upload time via a `submissionDate` field
sent in the same PATCH `/api/checklist/:id` call that marks the item complete
— it reuses the same server-side sync, so no separate backend path was needed.
The dialog only enables that date field once an essential-document checklist
item is selected, and warns (via confirm dialog) that the entered date is
discarded if the user instead uploads as a standalone case document.
