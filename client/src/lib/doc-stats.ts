// Canonical document-count helpers.
//
// These functions are the SINGLE SOURCE OF TRUTH for how the count tiles
// (site cards, all-sites card, group/company cards, dashboard tiles) and the
// document-list folder header agree with each other.
//
// Rules (confirmed with the client):
//  - A document is "countable" when it is NOT archived, has no caseId / incidentId,
//    and is not an external (non-template) upload.
//  - Each document is counted exactly ONCE (no per-site expansion of shared docs).
//  - Status buckets use the document's own `status` field — NOT date math
//    (expiry/renewal) and NOT the workflow `approvalStatus`.
//  - Group/company-scoped documents that belong to the scope ARE included.
//  - The compliance % is computed elsewhere (server slot-based) and is unchanged.

export interface CountableLike {
  status?: string | null;
  isArchived?: boolean | null;
  caseId?: string | null;
  incidentId?: string | null;
  source?: string | null;
}

// A document counts towards the tiles when it is a live, non-special upload.
export function isCountableDoc(d: CountableLike): boolean {
  return !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external";
}

export interface StatusCounts {
  total: number;
  compliant: number;
  approved: number;
  approvalRequired: number;
  overdue: number;
}

// Bucket an already-scoped list of documents by their `status` field, counting
// each document once. Callers are responsible for applying their own scope
// filter (which sites / companies are in view) and `isCountableDoc` first, or
// they can pass `applyCountableFilter` to have it done here.
export function statusCounts(
  docs: (CountableLike & { status?: string | null })[],
  applyCountableFilter = false,
): StatusCounts {
  let total = 0;
  let compliant = 0;
  let approved = 0;
  let approvalRequired = 0;
  let overdue = 0;
  for (const d of docs) {
    if (applyCountableFilter && !isCountableDoc(d)) continue;
    total++;
    switch (d.status) {
      case "compliant":
        compliant++;
        break;
      case "approved":
        approved++;
        break;
      case "approval_required":
        approvalRequired++;
        break;
      case "overdue":
        overdue++;
        break;
    }
  }
  return { total, compliant, approved, approvalRequired, overdue };
}

// "Non compliant" = anything needing attention: awaiting approval + overdue +
// missing required slots. Missing is slot-based and supplied by the caller.
export function nonCompliantCount(counts: StatusCounts, missing: number): number {
  return counts.approvalRequired + counts.overdue + missing;
}
