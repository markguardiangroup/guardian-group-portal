import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Brand constants ──────────────────────────────────────────────────────────

const BRAND = {
  name: "Guardian Group",
  primary: [30, 64, 175] as [number, number, number],
  primaryLight: [59, 92, 205] as [number, number, number],
  accent: [239, 246, 255] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  border: [219, 234, 254] as [number, number, number],
  danger: [185, 28, 28] as [number, number, number],
  warning: [180, 83, 9] as [number, number, number],
  success: [21, 128, 61] as [number, number, number],
};

// ─── Logo loader ──────────────────────────────────────────────────────────────

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/email-assets/logo.jpg");
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Shared page setup ────────────────────────────────────────────────────────

interface HeaderOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  logoDataUrl?: string | null;
}

function buildHeader(doc: jsPDF, opts: HeaderOptions): number {
  const { title, subtitle, companyName } = opts;
  const pageW = doc.internal.pageSize.getWidth();
  const headerH = 22;

  // Solid blue bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, headerH, "F");

  // Company name (or brand name if no company selected)
  const headerName = companyName || BRAND.name;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(headerName, 14, 10);

  // Report title
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 215, 255);
  doc.text(title, 14, 17);

  // Date + Confidential (right)
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Generated: ${today}`, pageW - 14, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 215, 255);
  doc.text("Confidential", pageW - 14, 17, { align: "right" });

  // Sub-bar — subtitle only (company name already in main header)
  const subH = subtitle ? 10 : 0;

  if (subtitle) {
    doc.setFillColor(...BRAND.accent);
    doc.rect(0, headerH, pageW, subH, "F");
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, headerH, 3, subH, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, 8, headerH + 7);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return headerH + subH + 4;
}

function addPageNumbers(doc: jsPDF) {
  const total = (doc as any).internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${total}`, pageW - 14, pageH - 7, { align: "right" });
    doc.text(`${BRAND.name} — Compliance Portal`, 14, pageH - 7);
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...BRAND.accent);
  doc.rect(14, y - 1, doc.internal.pageSize.getWidth() - 28, 7, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(14, y - 1, 2, 7, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.primary);
  doc.text(text, 18, y + 4);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

// ─── Report: Compliance Gaps ──────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
};

interface GapSite {
  siteName: string;
  gaps: { module: string; missingTemplates: { templateName: string }[] }[];
}

export async function exportComplianceGaps(data: GapSite[], companyName?: string) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const totalMissing = data.reduce((s, site) => s + site.gaps.reduce((g, gap) => g + gap.missingTemplates.length, 0), 0);

  let y = buildHeader(doc, {
    title: "Compliance Gap Report",
    subtitle: `${totalMissing} missing required documents across ${data.length} sites`,
    companyName,
    logoDataUrl,
  });

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
    didDrawPage: (data) => {
      if (data.pageNumber > 1) buildHeader(doc, { title: "Compliance Gap Report", companyName, logoDataUrl });
    },
  });

  addPageNumbers(doc);
  doc.save(`compliance-gaps-${dateStamp()}.pdf`);
}

// ─── Report: Expiry Risk ──────────────────────────────────────────────────────

interface ExpiryRiskItem {
  title: string; module: string; siteName: string;
  dateType: string; date: string; daysUntil: number; urgency: string;
}

export async function exportExpiryRisk(data: ExpiryRiskItem[], windowLabel: string, companyName?: string) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const overdue = data.filter((d) => d.urgency === "overdue").length;

  let y = buildHeader(doc, {
    title: "Expiry & Renewal Risk Report",
    subtitle: `${data.length} items at risk · ${overdue} overdue · ${windowLabel}`,
    companyName,
    logoDataUrl,
  });

  const rows = data.map((item) => {
    const dateLabel = { expiry: "Expiry", renewal: "Renewal", review: "Review" }[item.dateType] || "Due";
    const daysLabel = item.daysUntil < 0
      ? `${Math.abs(item.daysUntil)}d overdue`
      : item.daysUntil === 0 ? "Today" : `${item.daysUntil}d remaining`;
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
    head: [["Document", "Module", "Site", "Type", "Date", "Remaining", "Urgency"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 28 },
      3: { cellWidth: 18 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 18 },
    },
    didParseCell: (data) => {
      if (data.column.index === 6 && data.section === "body") {
        const val = String(data.cell.raw).toLowerCase();
        if (val === "overdue") { data.cell.styles.textColor = BRAND.danger; data.cell.styles.fontStyle = "bold"; }
        else if (val === "critical") { data.cell.styles.textColor = BRAND.warning; data.cell.styles.fontStyle = "bold"; }
        else if (val === "good") data.cell.styles.textColor = BRAND.success;
      }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) buildHeader(doc, { title: "Expiry & Renewal Risk Report", companyName, logoDataUrl });
    },
  });

  addPageNumbers(doc);
  doc.save(`expiry-risk-${dateStamp()}.pdf`);
}

// ─── Report: Site Comparison ──────────────────────────────────────────────────

interface SiteComparisonItem {
  siteName: string; overallScore: number; totalDocs: number;
  scores: Record<string, { score: number; compliant: number; total: number }>;
}

export async function exportSiteComparison(data: SiteComparisonItem[], companyName?: string) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = buildHeader(doc, {
    title: "Site Compliance Comparison",
    subtitle: `${data.length} sites compared`,
    companyName,
    logoDataUrl,
  });

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

export async function exportApprovalPipeline(data: ApprovalPipelineItem[], companyName?: string) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const stale = data.filter((d) => d.daysWaiting >= 7).length;

  let y = buildHeader(doc, {
    title: "Approval Pipeline Report",
    subtitle: `${data.length} documents awaiting approval · ${stale} waiting 7+ days`,
    companyName,
    logoDataUrl,
  });

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
      0: { cellWidth: 55 }, 1: { cellWidth: 30 }, 2: { cellWidth: 28 },
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
    didDrawPage: (data) => {
      if (data.pageNumber > 1) buildHeader(doc, { title: "Approval Pipeline Report", companyName, logoDataUrl });
    },
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

export async function exportDeadlineRisk(milestones: MilestoneRisk[], incidents: IncidentRisk[], companyName?: string) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = buildHeader(doc, {
    title: "Deadline & Milestone Risk Report",
    subtitle: `${milestones.length} milestone risks · ${incidents.length} unresolved incidents`,
    companyName,
    logoDataUrl,
  });

  if (milestones.length > 0) {
    y = sectionTitle(doc, `Case Milestones (${milestones.length})`, y);
    const rows = milestones.map((item) => {
      const daysLabel = item.daysUntil < 0
        ? `${Math.abs(item.daysUntil)}d overdue`
        : item.daysUntil === 0 ? "Today" : `${item.daysUntil}d`;
      return [item.caseReference, item.milestoneTitle, item.employeeName, item.siteName, new Date(item.dueDate).toLocaleDateString("en-GB"), daysLabel];
    });
    autoTable(doc, {
      startY: y,
      head: [["Case Ref", "Milestone", "Employee", "Site", "Due Date", "Status"]],
      body: rows,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 55 }, 2: { cellWidth: 30 }, 3: { cellWidth: 28 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 } },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const v = String(data.cell.raw);
          if (v.includes("overdue")) { data.cell.styles.textColor = BRAND.danger; data.cell.styles.fontStyle = "bold"; }
          else if (v === "Today") { data.cell.styles.textColor = BRAND.warning; data.cell.styles.fontStyle = "bold"; }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (incidents.length > 0) {
    if (y > 235) { doc.addPage(); y = buildHeader(doc, { title: "Deadline & Milestone Risk Report", companyName, logoDataUrl }); }
    y = sectionTitle(doc, `Unresolved Incidents (${incidents.length})`, y);
    const rows = incidents.map((item) => [
      item.reference,
      item.title,
      item.siteName,
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
  companyName?: string;
}

export async function exportSummary(payload: SummaryPayload) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = buildHeader(doc, {
    title: "Compliance Reports Summary",
    subtitle: "Overview of all compliance metrics",
    companyName: payload.companyName,
    logoDataUrl,
  });

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
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 35, halign: "center" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const v = String(data.cell.raw);
        if (v === "Action Required") { data.cell.styles.textColor = BRAND.danger; data.cell.styles.fontStyle = "bold"; }
        else if (v === "Review") { data.cell.styles.textColor = BRAND.warning; data.cell.styles.fontStyle = "bold"; }
        else { data.cell.styles.textColor = BRAND.success; }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addPageNumbers(doc);
  doc.save(`compliance-summary-${dateStamp()}.pdf`);
}

// ─── Report: Changelog ────────────────────────────────────────────────────────

type ChangelogCategory = "bug" | "enhancement" | "feature" | "other";

interface ChangelogEntry {
  id: string;
  patch: number;
  message: string;
  category: ChangelogCategory;
  createdAt: string;
}

interface ChangelogVersion {
  id: string;
  major: number;
  minor: number;
  patch: number;
  label: string;
  isActive: boolean;
  createdAt: string;
  entries: ChangelogEntry[];
}

const CATEGORY_LABELS: Record<ChangelogCategory, string> = {
  bug: "Bug Fix",
  enhancement: "Enhancement",
  feature: "New Feature",
  other: "Other",
};

const CATEGORY_COLORS: Record<ChangelogCategory, [number, number, number]> = {
  bug: [185, 28, 28],
  enhancement: [29, 78, 216],
  feature: [21, 128, 61],
  other: [107, 114, 128],
};

function versionLabel(v: ChangelogVersion) {
  return `v${v.major}.${v.minor}`;
}

function formatPatch(v: ChangelogVersion, patch: number) {
  return `v${v.major}.${v.minor}.${String(patch).padStart(2, "0")}`;
}

export async function exportChangelogPdf(versions: ChangelogVersion[]) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const totalEntries = versions.reduce((n, v) => n + v.entries.length, 0);

  let y = buildHeader(doc, {
    title: "Changelog / Release Notes",
    subtitle: `${versions.length} version${versions.length !== 1 ? "s" : ""} · ${totalEntries} total entries`,
    logoDataUrl,
  });

  for (let vi = 0; vi < versions.length; vi++) {
    const version = versions[vi];

    // Check if we need a new page before each version header
    if (vi > 0 && y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = buildHeader(doc, { title: "Changelog / Release Notes", logoDataUrl });
    }

    // Version heading
    y = sectionTitle(
      doc,
      `${versionLabel(version)}${version.label ? `  —  ${version.label}` : ""}  ·  ${new Date(version.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
      y
    );

    if (version.entries.length === 0) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...BRAND.muted);
      doc.text("No entries for this version.", 18, y + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      y += 10;
      continue;
    }

    // Group entries by patch, newest first
    const patchMap = new Map<number, ChangelogEntry[]>();
    for (const entry of version.entries) {
      if (!patchMap.has(entry.patch)) patchMap.set(entry.patch, []);
      patchMap.get(entry.patch)!.push(entry);
    }
    const patchNums = [...patchMap.keys()].sort((a, b) => b - a);

    for (const patchNum of patchNums) {
      const entries = patchMap.get(patchNum)!;

      // Patch sub-header row
      const rows = entries.map((e) => [
        CATEGORY_LABELS[e.category] || e.category,
        e.message,
      ]);

      autoTable(doc, {
        startY: y,
        head: [[`${formatPatch(version, patchNum)}`, ""]],
        body: rows,
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: {
          fillColor: [243, 244, 246] as [number, number, number],
          textColor: BRAND.muted,
          fontStyle: "bold",
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: "bold" },
          1: { cellWidth: "auto" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const cat = entries[data.row.index]?.category as ChangelogCategory;
            if (cat && CATEGORY_COLORS[cat]) {
              data.cell.styles.textColor = CATEGORY_COLORS[cat];
            }
          }
        },
        margin: { left: 18, right: 14 },
        tableWidth: pageW - 32,
        didDrawPage: (data) => {
          if (data.pageNumber > 1) buildHeader(doc, { title: "Changelog / Release Notes", logoDataUrl });
        },
      });

      y = (doc as any).lastAutoTable.finalY + 4;
    }

    y += 4;
  }

  addPageNumbers(doc);
  doc.save(`changelog-${dateStamp()}.pdf`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
