import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import type { Response } from "express";

const NAVY   = "0B1F3A";
const TEAL   = "0D8FA4";
const WHITE  = "FFFFFF";
const GREEN  = "166534";
const RED    = "991B1B";
const AMBER  = "92400E";
const PURPLE = "7C3AED";
const GREY_BG = "EFF6FF";
const MID_GREY = "D0DAE4";

const TICK  = "\u2713";
const CROSS = "\u2717";
const ARROW = "\u2192";
const STAR  = "\u2605";
const WARN  = "\u26A0";

function cellColor(text: string): string {
  if (text.startsWith(TICK))  return GREEN;
  if (text.startsWith(CROSS)) return RED;
  if (text.startsWith(ARROW)) return TEAL;
  if (text.startsWith(STAR))  return PURPLE;
  if (text.startsWith(WARN))  return AMBER;
  return "1F2937";
}

function makeRow(cells: string[], isHeader: boolean, stripe: boolean) {
  const bg = isHeader ? NAVY : stripe ? GREY_BG : WHITE;
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map(cell =>
      new TableCell({
        shading: { fill: bg, type: ShadingType.CLEAR, color: bg },
        margins: { top: 90, bottom: 90, left: 130, right: 130 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cell,
                bold: isHeader,
                color: isHeader ? WHITE : cellColor(cell),
                size: isHeader ? 18 : 17,
              }),
            ],
          }),
        ],
      })
    ),
  });
}

function table(rows: string[][], widths: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: rows.map((r, i) => makeRow(r, i === 0, i % 2 === 0 && i > 0)),
  });
}

function h1(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: NAVY, size: 34 })],
    spacing: { before: 520, after: 200 },
    border: { bottom: { color: MID_GREY, size: 8, style: BorderStyle.SINGLE } },
  });
}

function h2(text: string, color = TEAL) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color, size: 24 })],
    spacing: { before: 300, after: 140 },
  });
}

function h3(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: NAVY, size: 21 })],
    spacing: { before: 240, after: 100 },
  });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 19, color: "374151" })],
    spacing: { before: 80, after: 100 },
  });
}

function bp(icon: string, color: string, text: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: icon + "  ", color, bold: true, size: 19 }),
      new TextRun({ text, size: 19, color: "374151" }),
    ],
    indent: { left: 380 },
    spacing: { before: 60, after: 60 },
  });
}

function sp() {
  return new Paragraph({ text: "", spacing: { before: 180 } });
}

function iconKey() {
  return new Paragraph({
    children: [
      new TextRun({ text: TICK  + "  Available / complete     ", color: GREEN,  bold: true, size: 18 }),
      new TextRun({ text: CROSS + "  Not available     ",        color: RED,    bold: true, size: 18 }),
      new TextRun({ text: ARROW + "  On roadmap     ",           color: TEAL,   bold: true, size: 18 }),
      new TextRun({ text: STAR  + "  Guardian unique     ",      color: PURPLE, bold: true, size: 18 }),
      new TextRun({ text: WARN  + "  Gap flagged",               color: AMBER,  bold: true, size: 18 }),
    ],
    spacing: { before: 0, after: 480 },
  });
}

// ── TABLE DATA ────────────────────────────────────────────────────────────────

const hsTable = [
  ["Capability",                   "Guardian (Live)",                        "Guardian 0–12 mths",          "Donesafe",                       "T100 / Business Safety",              "HandsHQ RAMS"],
  ["Document & Policy Management", TICK+" Full workflows, versioning, expiry","—",                           TICK+" Full module",               TICK+" Safety Policies + Handbooks",   CROSS+" N/A"],
  ["Compliance Scoring",           TICK+" Live % per site, gap tracking",     "—",                           TICK+" Dashboards & analytics",   TICK+" Real-time dashboards",          CROSS+" Not offered"],
  ["H&S Incident Tracking",        TICK+" Severity, milestones, reports",     "—",                           TICK+" Incident Management",      TICK+" Incident Manager module",       CROSS+" Not offered"],
  ["Risk Assessments / RAMS",      TICK+" Live (incidents)",                  ARROW+" Full module roadmap",  TICK+" RAMS Management",          TICK+" Risk Assessments module",       TICK+" Core product — specialist RAMS"],
  ["Method Statements",            CROSS+" Not yet",                          "—",                           TICK+" RAMS module",               TICK+" Via Risk Assessments",         TICK+" Core product — specialist"],
  ["Checklists & Inspections",     CROSS+" Not yet",                          ARROW+" Guardian App Mar 27",  TICK+" Full module",               TICK+" Checklists module",             CROSS+" Not offered"],
  ["Audit Management",             CROSS+" Not yet",                          "—",                           TICK+" Configurable module",       CROSS+" Not listed",                   CROSS+" Not offered"],
  ["Multi-Site / Group Structure", TICK+" Group owner hierarchy",             "—",                           TICK+" Multi-site support",        TICK+" Multi-site supported",          TICK+" Company-level analytics"],
  ["Mobile / On-Site Capture",     CROSS+" Not yet",                          ARROW+" Guardian App Mar 27",  TICK+" Mobile-first platform",     TICK+" Mobile app included",           TICK+" Any device"],
  ["Real-Time Notifications",      TICK+" SSE-based alerts",                  "—",                           TICK+" Safety Alerts module",      TICK+" Automated alerts",              TICK+" Email reminders (training expiry)"],
  ["Full Audit Trail",             TICK+" Every action logged",               "—",                           TICK+" Full audit trail",          TICK+" Included",                      CROSS+" Not featured"],
  ["Contractor Management",        CROSS+" Not yet",                          "—",                           TICK+" Full module",               CROSS+" Not listed",                   CROSS+" Not offered"],
  ["Permit to Work",               CROSS+" Not yet",                          "—",                           TICK+" Full module",               CROSS+" Not listed",                   CROSS+" Not offered"],
  ["Asset Management",             CROSS+" Not yet",                          "—",                           TICK+" Full module",               CROSS+" Not listed",                   CROSS+" Not offered"],
  ["RIDDOR Reporting (UK)",        CROSS+" Not yet",                          WARN+" Recommended addition",  TICK+" Supported",                 CROSS+" Not listed",                   CROSS+" Not offered"],
  ["CRM API Sync",                 TICK+" Live May 26",                       ARROW+" Full sync Oct 26",     CROSS+" Not offered",              CROSS+" Not offered",                  CROSS+" Not offered"],
  ["Consultant-Managed Model",     STAR+" Core to Guardian",                  "—",                           CROSS+" Self-service only",        TICK+" CMIOSH consultants available",  CROSS+" Self-service only"],
];

const hrTable = [
  ["Capability",                     "Guardian (Live)",                       "Guardian 12–18 mths",         "Donesafe",           "T100 / Business Safety HR"],
  ["Employee Records",               CROSS+" Not yet",                        ARROW+" HRIS module",          CROSS+" Not offered", TICK+" Full employee records"],
  ["Absence & Holiday Management",   CROSS+" Not yet",                        ARROW+" HRIS module",          CROSS+" Not offered", TICK+" Absence & holiday module"],
  ["Disciplinary Management",        CROSS+" Not yet",                        ARROW+" HRIS module",          CROSS+" Not offered", TICK+" Disciplinary workflows"],
  ["Grievance Management",           CROSS+" Not yet",                        ARROW+" HRIS module",          CROSS+" Not offered", TICK+" Grievances module"],
  ["Onboarding / Offboarding",       CROSS+" Not yet",                        ARROW+" HRIS module",          CROSS+" Not offered", TICK+" Onboard / offboard"],
  ["Recruitment",                    CROSS+" Not yet",                        "—",                           CROSS+" Not offered", TICK+" Recruitment module"],
  ["Occupational Health Referrals",  CROSS+" Not yet",                        "—",                           CROSS+" Not offered", TICK+" OH referrals included"],
  ["Policy Management",              TICK+" Document workflows, sign-off",    "—",                           CROSS+" Not offered", TICK+" Policy management module"],
  ["Third-Party Consultant Access",  STAR+" Core to Guardian",                "—",                           CROSS+" Not offered", TICK+" Consultant access supported"],
  ["White-Label / Branded Portal",   STAR+" Core to Guardian",                "—",                           CROSS+" Not offered", TICK+" White-label option offered"],
  ["H&S + HR + EL in One Platform",  STAR+" UNIQUE — combined",               "—",                           CROSS+" Not offered", TICK+" Integrated (H&S + HR + EL)"],
  ["CRM Sync",                       TICK+" Live May 26",                     ARROW+" Full Oct 26",          CROSS+" Not offered", CROSS+" Not offered"],
];

const elTable = [
  ["Capability",                       "Guardian (Live)",                       "Guardian 0–12 mths",              "Donesafe",                       "T100 / Business Safety EL",                    "HandsHQ Training Register"],
  ["Training Bookings / Records",      TICK+" Bookings & records live",         "—",                               TICK+" Certification Management", TICK+" Full training/competency records",        TICK+" Training records in one place"],
  ["Training Matrix (Skill Gaps)",     CROSS+" Not yet",                        ARROW+" Expanded module",           CROSS+" Not featured",            CROSS+" Not listed",                            TICK+" Core feature — skill gap analysis"],
  ["Expiry Alerts / Reminders",        CROSS+" Not yet",                        ARROW+" Planned",                   CROSS+" Not featured",            TICK+" Notifications when out of date",          TICK+" Email reminders before expiry"],
  ["E-Learning Course Library",        CROSS+" Not yet",                        "—",                               CROSS+" Not featured",            TICK+" 75+ RoSPA/CPD/IIRSM courses",             TICK+" eLearning integration"],
  ["Custom Course Creation",           CROSS+" Not yet",                        "—",                               CROSS+" Not featured",            TICK+" Custom courses available",                CROSS+" Not listed"],
  ["Course Bundles / Inductions",      CROSS+" Not yet",                        "—",                               CROSS+" Not featured",            TICK+" Bundle courses for inductions",           CROSS+" Not listed"],
  ["External Training Tracking",       CROSS+" Not yet",                        ARROW+" Planned",                   CROSS+" Not featured",            TICK+" Track external training",                 TICK+" External evidence upload"],
  ["Certificates & Compliance Proof",  CROSS+" Not yet",                        ARROW+" Planned",                   CROSS+" Not featured",            TICK+" Printable certificates",                  TICK+" Instant access to evidence"],
  ["Training Reports",                 CROSS+" Not yet",                        ARROW+" Planned",                   CROSS+" Not featured",            TICK+" Full training reports",                   TICK+" One-click reports"],
  ["RAMS Integration",                 CROSS+" Not yet",                        "—",                               CROSS+" Not featured",            CROSS+" Not listed",                            TICK+" Native RAMS + Training link"],
  ["H&S + HR + Training Unified",      STAR+" UNIQUE — all three combined",     "—",                               CROSS+" Not offered",             TICK+" Integrated all three modules",            CROSS+" H&S only (RAMS + Training)"],
];

const elTable2 = [
  ["Capability",                     "Guardian (Live)",                        "Donesafe",           "T100 / Business Safety EL",          "HandsHQ"],
];

const empLawTable = [
  ["Capability",                        "Guardian (Live)",                        "Donesafe",           "T100 / Business Safety",  "HandsHQ"],
  ["Employment Law Case Management",    STAR+" Full case management",             CROSS+" Not offered", CROSS+" Not offered",       CROSS+" Not offered"],
  ["Employment Tribunal Tracking",      STAR+" Integrated",                       CROSS+" Not offered", TICK+" Tribunal management",CROSS+" Not offered"],
  ["Case Document Bundle Builder",      STAR+" PDF merge, multi-file bundles",    CROSS+" Not offered", CROSS+" Not offered",       CROSS+" Not offered"],
  ["Legal Document Workflows",          STAR+" Sign-off, version, expiry",        CROSS+" Not offered", CROSS+" Not offered",       CROSS+" Not offered"],
  ["HR Incident Linkage",               STAR+" H&S incidents linked to EL cases", CROSS+" Not offered", CROSS+" Not offered",       CROSS+" Not offered"],
  ["Consultant Case Access",            STAR+" Consultant-managed access",        CROSS+" Not offered", CROSS+" Not offered",       CROSS+" Not offered"],
  ["Combined H&S + HR + EL Platform",  STAR+" UNIQUE — no competitor offers this",CROSS+" Not offered", CROSS+" Partial (no EL)",  CROSS+" Not offered"],
];

// ── BUILD DOCUMENT ────────────────────────────────────────────────────────────

export async function buildCompetitiveReport(): Promise<Buffer> {
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 19 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        children: [
          // ── COVER ──────────────────────────────────────────────────────────
          new Paragraph({
            children: [new TextRun({ text: "COMPETITIVE ANALYSIS REPORT", bold: true, size: 52, color: NAVY, allCaps: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 160 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Guardian Group Portal & Roadmap", bold: true, size: 30, color: TEAL })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Module-by-Module Comparison vs Key Competitors", size: 22, color: "6B7280" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Competitors reviewed: HSI Donesafe  |  T100 / Business Safety  |  HandsHQ", size: 20, color: "6B7280" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 120 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "Prepared: June 2026  |  Confidential & Commercially Sensitive", size: 17, color: "9CA3AF" })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 500 },
          }),

          // Icon Key
          new Paragraph({ children: [new TextRun({ text: "Icon Key", bold: true, color: NAVY, size: 20 })], spacing: { before: 0, after: 130 } }),
          iconKey(),

          // ── 1. EXECUTIVE SUMMARY ──────────────────────────────────────────
          h1("1. Executive Summary"),
          body("This report provides a module-by-module comparison of the Guardian Group compliance portal and its 0–24 month product roadmap against three competitors: HSI Donesafe (large enterprise EHS SaaS), T100 Risk Manager / Business Safety (SME-focused, combined H&S + HR + E-Learning), and HandsHQ (specialist RAMS and Training Register platform)."),
          body("The four modules covered are: Health & Safety, HR, Employment Law, and Training. Each section identifies where Guardian currently leads, where competitors have deeper coverage, and what the roadmap delivers."),
          sp(),

          // Competitor overview table
          h2("Competitor Profiles"),
          table([
            ["Competitor",         "Focus",                        "Target Market",    "Model",               "Combined H&S + HR + EL?"],
            ["Guardian Group",     "H&S + HR + Employment Law",    "UK SMEs",          "Consultancy-led SaaS", STAR+" Yes — all four modules"],
            ["HSI Donesafe",       "EHS / H&S + Risk",             "Large enterprise", "Self-service SaaS",   CROSS+" H&S only"],
            ["T100 / Bus. Safety", "H&S + HR + E-Learning",        "UK SMEs",          "Self-service SaaS",   TICK+" Yes — but no Employment Law"],
            ["HandsHQ",            "RAMS + Training Register",     "Construction / FM", "Self-service SaaS",  CROSS+" H&S + Training only"],
          ], [2000, 2200, 1600, 1800, 2400]),
          sp(),

          // ── 2. H&S MODULE ─────────────────────────────────────────────────
          h1("2. Health & Safety Module"),
          body("This section compares Guardian's H&S capabilities against all three competitors. Donesafe is the broadest EHS platform. T100 covers core SME H&S needs. HandsHQ specialises exclusively in RAMS (Risk Assessments & Method Statements)."),
          sp(),
          table(hsTable, [2100, 1850, 1500, 1550, 1700, 1500]),
          sp(),

          h2(TICK + " Where Guardian Leads"),
          bp(STAR, PURPLE, "Consultancy-managed model — Guardian consultants actively run compliance on behalf of clients; all three competitors are self-service only (though T100 offers optional consultant access)."),
          bp(STAR, PURPLE, "CRM API sync (live May 26) — connects the portal to the Guardian business ecosystem; no competitor offers this."),
          bp(TICK, GREEN,  "Core compliance parity — document management, compliance scoring, incident tracking, multi-site, and audit trail match or exceed Donesafe and T100."),
          bp(TICK, GREEN,  "Group owner hierarchy — multi-company management is a built-in architectural feature; competitors treat multi-site as a configuration option."),
          sp(),

          h2(CROSS + " Where Competitors Lead (H&S)"),
          bp(TICK, RED,   "RAMS — HandsHQ is the dedicated specialist (1,500+ companies, NHS, G4S). Donesafe and T100 both have configurable RAMS modules. Guardian's roadmap should include a RAMS module to close this gap."),
          bp(TICK, RED,   "Checklists & Inspections — Donesafe, T100, and HandsHQ all offer this. Guardian App (Mar 2027) will address."),
          bp(TICK, RED,   "Mobile app — T100 and Donesafe both offer mobile apps for on-site capture. Guardian App closes this."),
          bp(WARN, AMBER, "RIDDOR Reporting — Donesafe explicitly supports UK statutory RIDDOR. T100 and HandsHQ do not call this out. A Guardian RIDDOR addition to the incident module is a low-cost high-value win."),
          sp(),

          // ── 3. HR MODULE ──────────────────────────────────────────────────
          h1("3. HR Module"),
          body("Donesafe has no HR capability. HandsHQ has no HR capability. T100/Business Safety is the only direct competitor with an HR module. Guardian's HRIS module is planned for the 12–18 month roadmap."),
          sp(),
          table(hrTable, [2400, 2000, 1700, 1500, 2400]),
          sp(),

          h2(TICK + " Where Guardian Leads (HR)"),
          bp(STAR, PURPLE, "Third-party consultant access is core to Guardian's model — T100 mentions this as an add-on for smaller businesses."),
          bp(STAR, PURPLE, "White-label portal — Guardian's consultancy brand is built in. T100 also offers white-labelling, making this a shared feature."),
          bp(STAR, PURPLE, "Combined H&S + HR + Employment Law + Training in one platform — T100 combines H&S + HR + E-Learning but has no Employment Law module."),
          bp(TICK, GREEN,  "Policy management with consultant-managed workflows is live today; T100 has this but it is self-configured."),
          sp(),

          h2(CROSS + " Where T100 Currently Leads (HR)"),
          bp(TICK, RED,   "T100 HR is live today and covers the full HR lifecycle: employee records, absence, disciplinary, grievances, onboarding, recruitment, and occupational health referrals."),
          bp(TICK, RED,   "Guardian's HRIS module is a 12–18 month roadmap item — until it ships, T100 has a clear advantage in this module."),
          bp(TICK, RED,   "Employment tribunal management — T100 explicitly includes this. This overlaps with Guardian's Employment Law module and should be factored into the EL module scope."),
          sp(),

          // ── 4. EMPLOYMENT LAW MODULE ──────────────────────────────────────
          h1("4. Employment Law Module"),
          body("This is Guardian's most distinctive and uncontested module. No competitor — enterprise or SME — offers Employment Law case management as part of a compliance platform. This is genuine white space."),
          sp(),
          table(empLawTable, [2800, 2200, 1700, 1900, 1400]),
          sp(),

          h2(STAR + " Guardian's Unique Position"),
          bp(STAR, PURPLE, "Employment Law case management — covers the full case lifecycle from initial instruction through to resolution, with milestone tracking and document management."),
          bp(STAR, PURPLE, "Case document bundle builder — generates merged PDFs from multiple document types (images, Word, PDFs) for Employment Tribunal use. No competitor has this."),
          bp(STAR, PURPLE, "H&S incident linkage — Guardian links H&S incidents directly to EL cases, creating a traceable thread from workplace event to legal outcome. Unique to the market."),
          bp(STAR, PURPLE, "All-in-one compliance platform — H&S + HR + Employment Law + Training in a single portal with a shared audit trail. No other product exists with this scope."),
          sp(),
          body("Note: T100's HR module includes 'Employment Tribunal Management' as a feature — this is HR case tracking, not legal case management. Guardian's EL module goes significantly deeper and includes consultant-managed workflows."),
          sp(),

          // ── 5. TRAINING MODULE ────────────────────────────────────────────
          h1("5. Training Module"),
          body("Donesafe has a lightweight certification management module. T100/Business Safety has a full LMS with 75+ accredited e-learning courses. HandsHQ's Training Register is purpose-built for tracking employee training competency and integrates natively with their RAMS product."),
          sp(),
          table(elTable, [2100, 1700, 1500, 1550, 1900, 1900]),
          sp(),

          h2(TICK + " Where Guardian Leads (Training)"),
          bp(TICK, GREEN,  "Training bookings and records are live today — ahead of Donesafe's certification-only module."),
          bp(STAR, PURPLE, "Combined H&S + HR + Training + EL context — Guardian is the only platform where a training record sits alongside a live H&S compliance score and an EL case, giving consultants full client oversight."),
          sp(),

          h2(CROSS + " Where Competitors Lead (Training)"),
          bp(TICK, RED,   "Training matrix / skill gap analysis — HandsHQ's core strength. T100 also tracks competency. Guardian does not yet have this."),
          bp(TICK, RED,   "E-learning course library — T100 has 75+ RoSPA/CPD/IIRSM accredited courses. This is a significant gap for Guardian's training offering."),
          bp(TICK, RED,   "Expiry alerts and reminders — both T100 and HandsHQ send automated alerts when training is due for renewal. Guardian's roadmap plans this but it is not live."),
          bp(TICK, RED,   "External training tracking and certificate storage — HandsHQ and T100 both support logging external (non-platform) courses and uploading evidence. Important for CSCS cards, first aid, etc."),
          bp(TICK, RED,   "RAMS + Training integration — HandsHQ natively links training competency records to specific RAMS projects. Relevant for higher-risk sectors."),
          sp(),

          // ── 6. STRATEGIC SUMMARY ──────────────────────────────────────────
          h1("6. Strategic Summary & Recommendations"),

          h3(STAR + "  Guardian's Defensible Advantages"),
          bp(STAR, PURPLE, "Employment Law module — no competitor offers this. It converts a pure-software play into an end-to-end legal + H&S + HR compliance service."),
          bp(STAR, PURPLE, "Consultancy-led managed service — all competitors are self-service. Guardian's consultants own client configuration, maintenance, and compliance outcomes."),
          bp(STAR, PURPLE, "Four-module unified platform (H&S + HR + EL + Training) — T100 gets close (H&S + HR + E-Learning) but has no Employment Law and no consultancy layer."),
          bp(STAR, PURPLE, "CRM API sync — unique to Guardian. Creates a data moat and positions the portal as the operational hub, not just a standalone tool."),
          sp(),

          h3(ARROW + "  Priority Roadmap Additions"),
          bp(ARROW, TEAL, "RAMS module — HandsHQ is the clear specialist leader. Donesafe and T100 both cover this. A Guardian RAMS module is a clear gap for the H&S module."),
          bp(ARROW, TEAL, "Training expiry alerts — quick win; both T100 and HandsHQ have this. Should be an early delivery within the Training module expansion."),
          bp(ARROW, TEAL, "Training matrix / skill gap view — HandsHQ's flagship feature. A matrix view per site would significantly strengthen the Training module."),
          bp(ARROW, TEAL, "E-learning course library — consider a partnership or white-label deal with a content provider (e.g. RoSPA-accredited library) to avoid building 75+ courses from scratch."),
          bp(ARROW, TEAL, "RIDDOR reporting — add to the existing incident module. Low build cost, high regulatory value for UK clients, and explicitly called out by Donesafe."),
          bp(ARROW, TEAL, "HRIS module (12–18 months) — T100 is the only competitor with a live HR module. Once Guardian ships this, it surpasses T100 by adding Employment Law depth."),
          sp(),

          h3(WARN + "  Watch Points"),
          bp(WARN, AMBER, "T100 is the closest structural competitor — H&S + HR + E-Learning + white-label consultant access. The key differentiators to emphasise vs T100 are: Employment Law module, consultancy-managed (not self-service), and CRM sync."),
          bp(WARN, AMBER, "HandsHQ is dominant in RAMS and growing. If Guardian targets construction or facilities management, a credible RAMS answer is essential before entering that segment."),
          sp(),

          new Paragraph({ text: "", spacing: { before: 560 } }),
          new Paragraph({
            children: [new TextRun({ text: "Confidential  |  Guardian Group  |  June 2026", size: 15, color: "9CA3AF" })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}

export async function serveCompetitiveReport(res: Response) {
  try {
    const buf = await buildCompetitiveReport();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", 'attachment; filename="guardian-competitive-analysis.docx"');
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (err) {
    console.error("[competitive-report] generation failed:", err);
    res.status(500).json({ error: "Report generation failed" });
  }
}
