import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Shared page setup ────────────────────────────────────────────────────────

const BRAND = {
  name: "Guardian Group",
  primary: [30, 64, 175] as [number, number, number],   // deep blue
  accent: [239, 246, 255] as [number, number, number],  // light blue tint
  muted: [107, 114, 128] as [number, number, number],
  danger: [185, 28, 28] as [number, number, number],
  warning: [180, 83, 9] as [number, number, number],
  success: [21, 128, 61] as [number, number, number],
};

function buildHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, 22, "F");

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(BRAND.name, 14, 10);

  // Report title in header
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 16.5);

  // Date top-right
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(8);
  doc.text(`Generated: ${today}`, pageW - 14, 10, { align: "right" });
  doc.text("Confidential", pageW - 14, 16.5, { align: "right" });

  // Subtitle row below header bar
  if (subtitle) {
    doc.setFillColor(...BRAND.accent);
    doc.rect(0, 22, pageW, 10, "F");
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.text(subtitle, 14, 28.5);
  }

  doc.setTextColor(0, 0, 0);
  return subtitle ? 36 : 28;
}

function addPageNumbers(doc: jsPDF) {
  const total = (doc as any).internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 8, { align: "right" });
    doc.text(BRAND.name + " — Compliance Portal", 14, pageH - 8);
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.primary);
  doc.text(text, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 6;
}

// ─── Report: Compliance Gaps ──────────────────────────────────────────────────

interface GapSite {
  siteName: string;
  gaps: { module: string; missingTemplates: { templateName: string }[] }[];
}

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
};

export function exportComplianceGaps(data: GapSite[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totalMissing = data.reduce((s, site) => s + site.gaps.reduce((g, gap) => g + gap.missingTemplates.length, 0), 0);
  let y = buildHeader(doc, "Compliance Gap Report", `${totalMissing} missing required documents across ${data.length} sites`);

  const rows: (string | number)[][] = [];
  for (const site of data) {
    for (const gap of site.gaps) {
      for (const tmpl of gap.missingTemplates) {
        rows.push([site.siteName, MODULE_LABELS[gap.module] || gap.module, tmpl.templateName]);
      }
    }
  }

  autoTable(doc, {
    startY: y,
    head: [["Site", "Module", "Missing Document"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 45 }, 2: { cellWidth: "auto" } },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => { if (data.pageNumber > 1) buildHeader(doc, "Compliance Gap Report"); },
  });

  addPageNumbers(doc);
  doc.save(`compliance-gaps-${dateStamp()}.pdf`);
}

// ─── Report: Expiry Risk ──────────────────────────────────────────────────────

interface ExpiryRiskItem {
  title: string; module: string; siteName: string;
  dateType: string; date: string; daysUntil: number; urgency: string;
}

export function exportExpiryRisk(data: ExpiryRiskItem[], windowLabel: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const overdue = data.filter((d) => d.urgency === "overdue").length;
  let y = buildHeader(doc, "Expiry & Renewal Risk Report", `${data.length} items at risk · ${overdue} overdue · Window: ${windowLabel}`);

  const rows = data.map((item) => {
    const dateLabel = { expiry: "Expiry", renewal: "Renewal", review: "Review" }[item.dateType] || "Due";
    const daysLabel = item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}d overdue` : item.daysUntil === 0 ? "Today" : `${item.daysUntil}d remaining`;
    return [
      item.title,
      MODULE_LABELS[item.module] || item.module,
      item.siteName,
      dateLabel,
      new Date(item.date).toLocaleDateString("en-GB"),
      daysLabel,
      item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Document", "Module", "Site", "Date Type", "Date", "Remaining", "Urgency"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 },
      3: { cellWidth: 20 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.column.index === 6 && data.section === "body") {
        const val = String(data.cell.raw).toLowerCase();
        if (val === "overdue") data.cell.styles.textColor = BRAND.danger;
        else if (val === "critical") data.cell.styles.textColor = BRAND.warning;
        else if (val === "good") data.cell.styles.textColor = BRAND.success;
      }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => { if (data.pageNumber > 1) buildHeader(doc, "Expiry & Renewal Risk Report"); },
  });

  addPageNumbers(doc);
  doc.save(`expiry-risk-${dateStamp()}.pdf`);
}

// ─── Report: Site Comparison ──────────────────────────────────────────────────

interface SiteComparisonItem {
  siteName: string; overallScore: number; totalDocs: number;
  scores: Record<string, { score: number; compliant: number; total: number }>;
}

export function exportSiteComparison(data: SiteComparisonItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = buildHeader(doc, "Site Compliance Comparison", `${data.length} sites compared`);

  const complianceMods = ["health_safety", "human_resources", "employment_law"];

  const rows = data.map((site) => {
    const scores = complianceMods.map((mod) => {
      const s = site.scores[mod] || { score: 0, total: 0, compliant: 0 };
      return s.total > 0 ? `${s.score}% (${s.compliant}/${s.total})` : "—";
    });
    return [site.siteName, ...scores, `${site.overallScore}%`, String(site.totalDocs)];
  });

  autoTable(doc, {
    startY: y,
    head: [["Site", "Health & Safety", "Human Resources", "Employment Law", "Overall", "Docs"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 },
      3: { cellWidth: 30 }, 4: { cellWidth: 20 }, 5: { cellWidth: 15 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const pct = parseInt(String(data.cell.raw));
        if (!isNaN(pct)) {
          data.cell.styles.textColor = pct >= 90 ? BRAND.success : pct >= 70 ? BRAND.warning : BRAND.danger;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addPageNumbers(doc);
  doc.save(`site-comparison-${dateStamp()}.pdf`);
}

// ─── Report: Approval Pipeline ────────────────────────────────────────────────

interface ApprovalPipelineItem {
  title: string; module: string; siteName: string;
  approvalStatus: string; uploaderName: string; daysWaiting: number;
}

export function exportApprovalPipeline(data: ApprovalPipelineItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const stale = data.filter((d) => d.daysWaiting >= 7).length;
  let y = buildHeader(doc, "Approval Pipeline Report", `${data.length} documents awaiting approval · ${stale} waiting 7+ days`);

  const rows = data.map((item) => [
    item.title,
    MODULE_LABELS[item.module] || item.module,
    item.siteName,
    item.uploaderName,
    item.approvalStatus === "client_signed_off" ? "Client Signed Off" : "Pending",
    item.daysWaiting === 0 ? "Today" : `${item.daysWaiting} days`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Document", "Module", "Site", "Uploaded By", "Status", "Waiting"]],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 55 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 },
      3: { cellWidth: 30 }, 4: { cellWidth: 25 }, 5: { cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const days = parseInt(String(data.cell.raw));
        if (!isNaN(days)) {
          data.cell.styles.textColor = days >= 14 ? BRAND.danger : days >= 7 ? BRAND.warning : [0, 0, 0];
          if (days >= 7) data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => { if (data.pageNumber > 1) buildHeader(doc, "Approval Pipeline Report"); },
  });

  addPageNumbers(doc);
  doc.save(`approval-pipeline-${dateStamp()}.pdf`);
}

// ─── Report: Deadline Risk ────────────────────────────────────────────────────

interface MilestoneRisk {
  caseReference: string; milestoneTitle: string; employeeName: string;
  siteName: string; dueDate: string; daysUntil: number; urgency: string;
}
interface IncidentRisk {
  reference: string; title: string; siteName: string;
  severity: string; status: string; daysSinceReported: number;
}

export function exportDeadlineRisk(milestones: MilestoneRisk[], incidents: IncidentRisk[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = buildHeader(
    doc,
    "Deadline & Milestone Risk Report",
    `${milestones.length} milestone risks · ${incidents.length} unresolved incidents`
  );

  if (milestones.length > 0) {
    y = sectionTitle(doc, "Case Milestones", y);
    const rows = milestones.map((item) => {
      const daysLabel = item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}d overdue` : item.daysUntil === 0 ? "Today" : `${item.daysUntil}d`;
      return [item.caseReference, item.milestoneTitle, item.employeeName, item.siteName, new Date(item.dueDate).toLocaleDateString("en-GB"), daysLabel];
    });
    autoTable(doc, {
      startY: y,
      head: [["Case Ref", "Milestone", "Employee", "Site", "Due Date", "Status"]],
      body: rows,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 } },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const v = String(data.cell.raw);
          if (v.includes("overdue")) { data.cell.styles.textColor = BRAND.danger; data.cell.styles.fontStyle = "bold"; }
          else if (v === "Today") { data.cell.styles.textColor = BRAND.warning; }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (incidents.length > 0) {
    if (y > 240) { doc.addPage(); y = buildHeader(doc, "Deadline & Milestone Risk Report"); }
    y = sectionTitle(doc, "Unresolved Incidents", y);
    const rows = incidents.map((item) => [
      item.reference, item.title, item.siteName,
      item.severity.charAt(0).toUpperCase() + item.severity.slice(1),
      item.status.replace(/_/g, " "),
      `${item.daysSinceReported} days`,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Reference", "Title", "Site", "Severity", "Status", "Open For"]],
      body: rows,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 50 }, 2: { cellWidth: 30 }, 3: { cellWidth: 22 }, 4: { cellWidth: 28 }, 5: { cellWidth: 22 } },
      margin: { left: 14, right: 14 },
    });
  }

  addPageNumbers(doc);
  doc.save(`deadline-risk-${dateStamp()}.pdf`);
}

// ─── Summary export (landing page) ───────────────────────────────────────────

interface SummaryPayload {
  gapCount: number; gapSiteCount: number;
  expiryCount: number; expiryOverdue: number;
  pipelineCount: number;
  deadlineCount: number;
  comparisonCount: number; lowestScore: number | null;
}

export function exportSummary(payload: SummaryPayload) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = buildHeader(doc, "Compliance Reports Summary", "Overview of all compliance metrics");

  const rows = [
    ["Compliance Gaps", `${payload.gapCount} missing documents across ${payload.gapSiteCount} sites`, payload.gapCount > 0 ? "Action Required" : "Clear"],
    ["Expiry & Renewal Risk", `${payload.expiryCount} at risk in next 90 days · ${payload.expiryOverdue} overdue`, payload.expiryOverdue > 0 ? "Action Required" : payload.expiryCount > 0 ? "Review" : "Clear"],
    ["Site Comparison", `${payload.comparisonCount} sites tracked${payload.lowestScore !== null ? ` · lowest score ${payload.lowestScore}%` : ""}`, payload.lowestScore !== null && payload.lowestScore < 70 ? "Action Required" : "OK"],
    ["Approval Pipeline", `${payload.pipelineCount} documents awaiting approval`, payload.pipelineCount > 0 ? "Review" : "Clear"],
    ["Deadline & Milestone Risk", `${payload.deadlineCount} active risks`, payload.deadlineCount > 0 ? "Action Required" : "Clear"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Report", "Summary", "Status"]],
    body: rows,
    styles: { fontSize: 9.5, cellPadding: 4 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 50, fontStyle: "bold" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 35, halign: "center" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const v = String(data.cell.raw);
        if (v === "Action Required") { data.cell.styles.textColor = BRAND.danger; data.cell.styles.fontStyle = "bold"; }
        else if (v === "Review") { data.cell.styles.textColor = BRAND.warning; }
        else { data.cell.styles.textColor = BRAND.success; }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addPageNumbers(doc);
  doc.save(`compliance-summary-${dateStamp()}.pdf`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
