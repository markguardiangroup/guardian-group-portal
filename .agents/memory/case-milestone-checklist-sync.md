---
name: EL case Response Deadline sync
description: Response Deadline milestone and ET3 checklist submission date must stay in sync from every write path (case-level, milestone-level).
---

The EL "Response Deadline" milestone (`isResponseDeadline: true`) and its linked
"ET3 Response Form" essential-document checklist item (`checklistItemId`) are
supposed to share one logical due date. The milestone-update route already
synced both directions (milestone → case.responseDeadline, milestone →
checklist.submissionDate).

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
