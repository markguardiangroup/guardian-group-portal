import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableOfContents,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import { writeFileSync } from "fs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRAND = "0D2137"; // deep navy
const ACCENT = "1D6FA4"; // guardian blue
const LIGHT_BLUE = "D6E8F5";
const LIGHT_GREY = "F5F5F5";
const DARK_GREY = "4A4A4A";
const HIGH_RED = "C0392B";
const MED_AMBER = "E67E22";
const LOW_GREEN = "27AE60";

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    run: { color: BRAND, bold: true },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    run: { color: ACCENT, bold: true },
  });
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
        color: DARK_GREY,
        ...opts,
      }),
    ],
    spacing: { before: 100, after: 100 },
  });
}

function bold(text) {
  return body(text, { bold: true });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [
      new TextRun({ text, size: 22, color: DARK_GREY }),
    ],
    bullet: { level },
    spacing: { before: 60, after: 60 },
  });
}

function spacer(lines = 1) {
  return new Paragraph({
    children: [new TextRun({ text: "", size: 22 })],
    spacing: { before: lines * 80, after: 0 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function labelledPara(label, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, color: BRAND }),
      new TextRun({ text, size: 22, color: DARK_GREY }),
    ],
    spacing: { before: 80, after: 80 },
  });
}

// ─── Risk Table ───────────────────────────────────────────────────────────────

function exposureBadge(level) {
  const map = {
    High: { color: "FFFFFF", bg: HIGH_RED },
    Medium: { color: "FFFFFF", bg: MED_AMBER },
    Low: { color: "FFFFFF", bg: LOW_GREEN },
  };
  const { color, bg } = map[level] || { color: DARK_GREY, bg: LIGHT_GREY };
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: level, bold: true, size: 20, color })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.CLEAR, color: "auto", fill: bg },
    width: { size: 12, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function riskTable(rows) {
  const headerCells = ["Risk Area", "Exposure", "Current Mitigations", "Key Gaps"].map(
    (text, i) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text, bold: true, size: 20, color: "FFFFFF" })],
          }),
        ],
        shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND },
        width: {
          size: [30, 12, 30, 28][i],
          type: WidthType.PERCENTAGE,
        },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
      })
  );

  const tableRows = [
    new TableRow({ children: headerCells, tableHeader: true }),
    ...rows.map(
      ({ risk, exposure, mitigations, gaps }, idx) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: risk, size: 20, bold: true, color: BRAND })],
                }),
              ],
              shading: {
                type: ShadingType.CLEAR,
                color: "auto",
                fill: idx % 2 === 0 ? LIGHT_GREY : "FFFFFF",
              },
              width: { size: 30, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            exposureBadge(exposure),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: mitigations, size: 19, color: DARK_GREY })],
                }),
              ],
              shading: {
                type: ShadingType.CLEAR,
                color: "auto",
                fill: idx % 2 === 0 ? LIGHT_GREY : "FFFFFF",
              },
              width: { size: 30, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: gaps, size: 19, color: DARK_GREY })],
                }),
              ],
              shading: {
                type: ShadingType.CLEAR,
                color: "auto",
                fill: idx % 2 === 0 ? LIGHT_GREY : "FFFFFF",
              },
              width: { size: 28, type: WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            }),
          ],
        })
    ),
  ];

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideV: { style: BorderStyle.NONE },
    },
  });
}

// ─── Callout box (simulated via shaded paragraph) ────────────────────────────

function callout(text, fill = LIGHT_BLUE) {
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, size: 21, color: BRAND, italics: true })],
                spacing: { before: 60, after: 60 },
              }),
            ],
            shading: { type: ShadingType.CLEAR, color: "auto", fill },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideH: { style: BorderStyle.NONE },
      insideV: { style: BorderStyle.NONE },
    },
  });
}

// ─── Document ─────────────────────────────────────────────────────────────────

const doc = new Document({
  creator: "Guardian Group",
  title: "AI Risk & Mitigation — Internal Board Paper",
  description: "Confidential board paper for Guardian Group leadership",
  styles: {
    paragraphStyles: [
      {
        id: "Normal",
        name: "Normal",
        run: { font: "Calibri", size: 22, color: DARK_GREY },
      },
    ],
  },
  sections: [
    {
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "CONFIDENTIAL — INTERNAL USE ONLY", size: 18, color: "999999", italics: true }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Guardian Group  |  AI Risk & Mitigation  |  Board Paper  |  June 2026  |  Page ", size: 18, color: "999999" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "999999" }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1.1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.1),
          },
        },
      },
      children: [

        // ── Cover ──────────────────────────────────────────────────────────────
        spacer(4),
        new Paragraph({
          children: [new TextRun({ text: "GUARDIAN GROUP", bold: true, size: 56, color: BRAND, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
        }),
        spacer(1),
        new Paragraph({
          children: [new TextRun({ text: "AI Risk & Mitigation", bold: true, size: 40, color: ACCENT, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: "Internal Board Paper", size: 28, color: DARK_GREY, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
        }),
        spacer(2),
        new Paragraph({
          children: [new TextRun({ text: "June 2026", size: 24, color: "888888", font: "Calibri" })],
          alignment: AlignmentType.CENTER,
        }),
        spacer(1),
        new Paragraph({
          children: [new TextRun({ text: "CONFIDENTIAL — For Board and SMT only. Not for external distribution.", size: 20, color: HIGH_RED, bold: true, font: "Calibri" })],
          alignment: AlignmentType.CENTER,
        }),
        spacer(2),
        new Paragraph({
          children: [new TextRun({ text: "Prepared by: Management", size: 20, color: "888888" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: "Presented to: Board of Directors & Senior Management Team", size: 20, color: "888888" })],
          alignment: AlignmentType.CENTER,
        }),
        pageBreak(),

        // ── 1. Purpose & Context ───────────────────────────────────────────────
        heading1("1.  Purpose & Context"),
        body(
          "This paper has been prepared for the Board and Senior Management Team (SMT) as an honest, structured assessment of the risks that the rapid adoption of artificial intelligence (AI) technologies poses to Guardian Group's business model, competitive position, and internal operations."
        ),
        spacer(),
        body(
          "The trigger for this paper is a direct question raised by an investor: if AI tools are enabling consultants and clients to work faster and more efficiently, does that not reduce the number of billable hours required to deliver the same outcome — and, by extension, does it undermine the value case for Guardian's retained service packages?"
        ),
        spacer(),
        body(
          "That is a legitimate concern and one we take seriously. This paper does not dismiss it. Instead, it sets out a candid view of all material AI-related risks, the structural defences Guardian already has in place, the gaps we must close, and the actions we recommend. The Board's role is to challenge, stress-test, and ultimately agree a position that can then inform our investor communications."
        ),
        spacer(),
        callout(
          "This paper is written for internal leadership and is deliberately candid. It is NOT the investor response — that document should be prepared after the Board has reviewed and stress-tested the arguments here."
        ),

        spacer(2),

        // ── 2. Executive Summary ───────────────────────────────────────────────
        heading1("2.  Executive Summary — The Five Most Material Risks"),
        body(
          "Of the six risk categories assessed in this paper, the following five are judged to be most material to Guardian Group at this time:"
        ),
        spacer(),

        heading3("Risk 1 — Billing Model Pressure (HIGH)"),
        body(
          "AI tools are making consultants more efficient. If clients become aware that the same quality output takes less time to produce, they may question why they are paying for a retained package priced on historic effort levels. This is the investor's primary concern and it is real. The mitigation is not to hide the efficiency gain but to reframe value: clients pay for outcomes, expertise, liability coverage, and continuous availability — not for hours. The package model needs to be articulated and, over time, repriced around outcome-based value, not input volume."
        ),
        spacer(),

        heading3("Risk 2 — Competitor Disruption by AI-Native Entrants (HIGH)"),
        body(
          "SaaS-native or AI-native competitors with lower cost bases could enter the H&S and Employment Law compliance market offering lower headline prices. Guardian's defence is the depth and breadth of its combined HR/H&S/Employment Law offering, the consultant relationship model, and professional liability — none of which a new entrant can replicate quickly. The risk is real but the barrier to credible competition remains high."
        ),
        spacer(),

        heading3("Risk 3 — Client Self-Sufficiency (MEDIUM–HIGH)"),
        body(
          "General-purpose AI tools (ChatGPT, Copilot, etc.) are already giving some clients confidence to attempt compliance tasks in-house. The risk is that AI lowers the perceived complexity of compliance, leading some clients — particularly smaller or less risk-aware ones — to opt out of retained services. Guardian's mitigation is the genuine complexity of multi-jurisdiction Employment Law and H&S, and the personal liability that rests with the employer, which competent clients will still want to transfer to a professional firm."
        ),
        spacer(),

        heading3("Risk 4 — Margin Erosion Through Price Competition (MEDIUM)"),
        body(
          "Even if Guardian retains clients, AI-driven cost reduction across the industry could compress market pricing. Competitors may pass efficiency gains to clients as lower prices, creating pressure on Guardian's fee levels. The response is to use efficiency gains to invest in depth and quality rather than passing them on as discounts."
        ),
        spacer(),

        heading3("Risk 5 — Internal Operational Risks (MEDIUM)"),
        body(
          "Guardian's own consultants using AI tools without governance creates risks: AI-generated advice may contain errors, clients' confidential data may be shared with third-party AI providers, and institutional knowledge may erode if consultants rely on AI rather than developing expertise. These risks are addressable with clear policy and governance but require deliberate action."
        ),
        spacer(),

        callout(
          "Single most important strategic response: Reframe the value proposition — explicitly and consistently — around outcomes, expertise, liability, and continuous access. Retained packages are not paying for hours; they are paying for a professional firm's accountability and always-on availability. This reframing must run through client communications, the portal experience, and eventually the investor narrative."
        ),

        pageBreak(),

        // ── 3. Risk Register ───────────────────────────────────────────────────
        heading1("3.  Risk Register — Full Assessment"),
        body("The table below summarises all six risk categories with exposure ratings, current mitigations, and key gaps. Each category is then examined in detail in the sections that follow."),
        spacer(),

        riskTable([
          {
            risk: "Billing Model / Perceived Value of Retained Packages",
            exposure: "High",
            mitigations: "Outcome-based delivery; combined service breadth; personal consultant relationships",
            gaps: "No explicit outcome-based pricing narrative; investor concern not yet formally addressed",
          },
          {
            risk: "Margin Erosion Through Price Competition",
            exposure: "Medium",
            mitigations: "Premium positioning; combined H&S + HR + Employment Law offering; professional liability",
            gaps: "No explicit cost baseline to quantify efficiency gains vs pricing pressure",
          },
          {
            risk: "Pricing Pressure / Perceived Value Reduction",
            exposure: "Medium",
            mitigations: "Guardian portal as evidence of service value; audit trails; continuous availability",
            gaps: "Client communications do not proactively frame value beyond hours/deliverables",
          },
          {
            risk: "Market Shrinkage / Client Self-Sufficiency",
            exposure: "Medium",
            mitigations: "Complexity of genuine compliance risk; employer personal liability; regulatory environment",
            gaps: "Smaller clients may be more vulnerable to self-service drift; no formal client segment risk mapping",
          },
          {
            risk: "Competitor Disruption (AI-Native Entrants)",
            exposure: "High",
            mitigations: "Combined multi-discipline offering; consultant accountability model; portal switching costs",
            gaps: "Market monitoring for new AI-native entrants is informal; no formal competitive intelligence process",
          },
          {
            risk: "Internal Operational Risks (AI Governance)",
            exposure: "Medium",
            mitigations: "Experienced consultant team; informal peer review culture",
            gaps: "No formal AI use policy; no data handling guidelines for AI tools; no QA framework for AI-assisted outputs",
          },
        ]),

        spacer(2),

        // ── 3.1 Billing Model Risk ─────────────────────────────────────────────
        heading2("3.1  Billing Model Risk — The Investor's Core Concern"),

        heading3("Description"),
        body(
          "Guardian Group's primary service model is the retained compliance package: clients pay a fixed monthly or annual fee in exchange for ongoing access to consultants, documentation support, policy management, and regulatory guidance. The pricing of these packages has historically reflected the number of consultant hours required to deliver the service."
        ),
        spacer(),
        body(
          "The investor's question is direct: if AI tools enable consultants to produce the same quality output in half the time, why should clients continue to pay for a package priced on the old effort level? Does AI efficiency not fundamentally reduce the volume of billable work required — and, if so, does it not logically lead to either lower prices or fewer contracts?"
        ),
        spacer(),
        body(
          "This risk manifests in three ways:"
        ),
        bullet("Clients who become aware of AI efficiency gains may demand fee reductions or renegotiate at renewal"),
        bullet("Prospective clients may anchor their price expectations to what they perceive AI makes possible, expecting lower prices from all providers"),
        bullet("Investors and analysts may question whether the retained model is structurally sustainable in an AI-enabled market"),
        spacer(),

        heading3("Exposure: HIGH"),

        heading3("Existing Mitigations"),
        body(
          "Guardian's retained packages have never been priced purely on hours — they bundle availability, expertise, regulatory monitoring, professional liability, and continuous access into a single fee. Most clients do not track or care about how many consultant hours they consume each month; they care whether their compliance obligations are met and whether they are protected if something goes wrong."
        ),
        spacer(),
        body(
          "The combined H&S, HR, and Employment Law offering is broader and more integrated than a simple time-and-materials arrangement. Clients would need to replicate this across multiple providers or internal hires to achieve the same coverage — at far greater cost."
        ),
        spacer(),

        heading3("Gaps"),
        body(
          "Guardian's client-facing language still leans on deliverables and response times rather than explicitly articulating outcome-based value. If a client asks 'what exactly am I paying for?' today, the answer is not crisp enough. The investor's concern reflects a real communications gap, not just a structural one."
        ),
        spacer(),
        body(
          "There is currently no formal narrative — written, tested, and consistently used by the sales and account management team — that separates the value of the package from the volume of hours delivered."
        ),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Develop and codify an explicit outcome-based value narrative — what does the client receive (risk transfer, professional liability, always-on availability, regulatory monitoring, peace of mind) regardless of hour count?"),
        bullet("Train all client-facing staff to use this narrative consistently, particularly at renewal and when handling price objections"),
        bullet("Evaluate whether retained package pricing should evolve toward value-based tiers (e.g. by client size, sector, risk profile) rather than effort-based structures"),
        bullet("Consider proactively communicating to key clients how Guardian uses technology to improve responsiveness and quality — framing AI as a service enhancement, not a cost-reduction exercise"),

        spacer(2),

        // ── 3.2 Margin Erosion ─────────────────────────────────────────────────
        heading2("3.2  Margin Erosion Through Price Competition"),

        heading3("Description"),
        body(
          "Even if Guardian successfully retains its clients on current pricing, the broader market may experience fee compression. If competitors pass AI efficiency gains on to clients through lower prices, Guardian will face growing pressure to match. Over time, this can erode operating margins even without client churn."
        ),
        spacer(),

        heading3("Exposure: MEDIUM"),

        heading3("Existing Mitigations"),
        bullet("Guardian's premium positioning, professional reputation, and multi-discipline offering create a genuine value premium that not all buyers will sacrifice for lower prices"),
        bullet("The Employment Law element carries personal employer liability — clients are unlikely to cut corners when the financial and reputational stakes of getting it wrong are high"),
        bullet("H&S compliance has a regulatory enforcement dimension that keeps demand for professional support structurally robust"),
        spacer(),

        heading3("Gaps"),
        bullet("Guardian does not currently track the relationship between its operational efficiency improvements and its pricing — meaning it cannot demonstrate, internally or externally, that margins are being maintained or where they are most exposed"),
        bullet("The market for lower-complexity H&S compliance (e.g. single-site SME clients) may be more price-sensitive and more vulnerable to low-cost AI-powered alternatives"),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Establish a basic cost-per-client metric internally so that the impact of AI efficiency on margin can be tracked over time"),
        bullet("Segment the client base by complexity and risk profile; ensure pricing strategy is calibrated to each segment's willingness to pay and switching risk"),
        bullet("Use AI efficiency gains to invest in service depth and quality, not to justify margin reduction — position the company as a premium provider whose efficiency benefits clients through better service, not lower prices"),

        spacer(2),

        // ── 3.3 Pricing Pressure / Perceived Value ─────────────────────────────
        heading2("3.3  Pricing Pressure & Perceived Value"),

        heading3("Description"),
        body(
          "Even without formal competitor pricing pressure, individual clients may develop their own perception that AI has 'made compliance easier' and that they should be paying less. This risk is often triggered by media coverage of AI capabilities, conversations with peers, or their own experimentation with AI tools. It is distinct from true self-sufficiency — the client is not necessarily doing the work themselves, they just believe the work is now worth less."
        ),
        spacer(),

        heading3("Exposure: MEDIUM"),

        heading3("Existing Mitigations"),
        bullet("The Guardian portal creates a visible, tangible record of the ongoing service — audit trails, documents under management, training records, incident logs — making the value of the service more concrete than a monthly invoice"),
        bullet("Consultant relationships, where strong, create personal trust that is resistant to abstract concerns about AI pricing"),
        spacer(),

        heading3("Gaps"),
        bullet("The portal and broader client communication do not proactively articulate the full value of what is being delivered — they surface the outputs but do not frame the value in business terms"),
        bullet("Guardian does not currently run a formal client satisfaction or value perception programme that would give early warning of shifting attitudes"),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Introduce a structured client check-in programme (annual review, mid-year pulse) that explicitly surfaces and reinforces value delivered"),
        bullet("Enhance the portal's reporting capabilities to give clients a clear, data-driven picture of compliance activity — incidents managed, documents kept current, legal changes monitored and responded to — framed as business value, not just system data"),
        bullet("Brief account managers to proactively address AI pricing questions in renewal conversations rather than waiting for clients to raise them"),

        spacer(2),

        // ── 3.4 Market Shrinkage / Self-Sufficiency ────────────────────────────
        heading2("3.4  Market Shrinkage & Client Self-Sufficiency"),

        heading3("Description"),
        body(
          "AI tools — particularly large language models accessible via consumer interfaces — are giving individuals and businesses the ability to draft policies, generate risk assessments, and answer compliance questions without specialist input. As AI improves, some clients — particularly those with low compliance complexity or low risk awareness — may conclude that they can manage compliance in-house, reducing demand for external support."
        ),
        spacer(),

        heading3("Exposure: MEDIUM–HIGH"),

        heading3("Existing Mitigations"),
        bullet("The Employment Law element carries genuine legal complexity, jurisdictional variation, and case-law dependency that AI tools currently handle poorly — particularly in contentious or novel situations"),
        bullet("H&S enforcement risk is real: the consequences of an inadequate risk assessment being relied on when an incident occurs are severe, and most employers understand this"),
        bullet("Personal liability cannot be outsourced to an AI tool; it remains with the employer, which creates a strong structural incentive to maintain professional support"),
        bullet("The regulatory environment is unlikely to accept AI-generated compliance documentation without professional sign-off in high-risk settings"),
        spacer(),

        heading3("Gaps"),
        bullet("Smaller clients with lower risk complexity are most vulnerable — they have less to lose from a compliance failure and may be more tempted to self-serve"),
        bullet("Guardian does not have a formal segmentation of its client base by churn risk in an AI-enabled world"),
        bullet("The company has not yet articulated a clear position on what a client genuinely cannot do with AI tools alone — which is the most powerful retention argument available"),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Develop a clear, client-facing position on 'what AI can and cannot do' in H&S and Employment Law compliance — honest, non-scaremongering, but firmly grounded in the genuine limits of AI in legal and regulatory contexts"),
        bullet("Segment clients by self-sufficiency risk; develop tailored retention and value communication strategies for the most vulnerable segments"),
        bullet("Consider whether a lighter-touch or modular service tier could retain price-sensitive or lower-complexity clients who might otherwise leave"),

        spacer(2),

        // ── 3.5 Competitor Disruption ──────────────────────────────────────────
        heading2("3.5  Competitor Disruption — AI-Native Entrants"),

        heading3("Description"),
        body(
          "The most significant medium-term structural risk is the emergence of AI-native competitors — businesses built from the outset on AI-enabled service delivery, with lower fixed cost bases, able to offer compliance support at prices that established firms cannot match without restructuring. These entrants may not be full-service providers initially; they are more likely to attack a specific segment (e.g. SME H&S documentation) before expanding."
        ),
        spacer(),

        heading3("Exposure: HIGH"),

        heading3("Existing Mitigations"),
        bullet("The combined H&S, HR, and Employment Law offering is genuinely difficult to replicate — it requires professional expertise, qualified personnel, and regulatory credibility that cannot be built quickly"),
        bullet("Employment Law in particular requires up-to-date knowledge of case law, tribunal decisions, and ACAS guidance — areas where AI tools currently require significant human oversight"),
        bullet("The consultant relationship model creates switching costs that a software platform cannot easily replicate — clients trust individuals, not interfaces"),
        bullet("The Guardian portal creates meaningful operational switching costs — clients with documents, training records, incident logs, and audit trails embedded in the system face friction in moving to a new provider"),
        spacer(),

        heading3("Gaps"),
        bullet("Competitive intelligence is informal — Guardian does not systematically monitor new entrants or track competitor AI adoption"),
        bullet("The lower end of the SME market (single-site businesses, low risk complexity) is most vulnerable to attack from lower-cost AI-enabled alternatives"),
        bullet("Guardian has not yet defined what a 'minimum credible AI-native competitor' would look like or what it would take to respond to one"),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Establish a simple, quarterly competitive intelligence process: who is entering the market, at what price point, and with what proposition?"),
        bullet("Prioritise deepening portal functionality and embeddedness — the more Guardian's systems are woven into a client's operations, the higher the switching cost"),
        bullet("Accelerate the 'AI as multiplier' internal narrative — positioning Guardian's consultants as AI-augmented experts who deliver better outcomes faster, rather than defending against AI adoption"),
        bullet("Define a contingency position: what would Guardian do if a credible AI-native competitor emerged at 50% of current market pricing? Having this answer prepared is itself a risk mitigation"),

        spacer(2),

        // ── 3.6 Internal Operational Risks ────────────────────────────────────
        heading2("3.6  Internal Operational Risks — Governance, Quality & Confidentiality"),

        heading3("Description"),
        body(
          "Risks do not only come from outside. Guardian's own consultants are already using AI tools — in all likelihood — to draft documents, answer client queries, and research regulatory questions. Without governance, this creates three internal risk vectors:"
        ),
        bullet("Quality risk: AI-generated content can be plausible but wrong, particularly in fast-moving areas of law or where nuanced judgment is required. If a consultant relies on AI output without sufficient review, incorrect advice may reach clients"),
        bullet("Confidentiality risk: General-purpose AI tools (ChatGPT, Copilot, Gemini) are not GDPR-compliant data processors for client-confidential information. If consultants input client data into these tools, Guardian may be in breach of its data protection obligations"),
        bullet("Skills erosion: If consultants routinely offload drafting and research to AI tools, the company risks gradual erosion of the deep expertise that underpins its credibility and justifies its pricing premium"),
        spacer(),

        heading3("Exposure: MEDIUM"),

        heading3("Existing Mitigations"),
        bullet("Guardian employs experienced, professionally qualified consultants with strong personal commitment to quality"),
        bullet("Informal peer review and management oversight provide some quality control"),
        bullet("The Employment Law and H&S disciplines require specialist knowledge that limits the extent to which AI can fully automate delivery"),
        spacer(),

        heading3("Gaps"),
        bullet("There is no formal AI use policy — no guidance on which tools are permitted, how AI-generated content must be reviewed, or how to handle client data in AI contexts"),
        bullet("There are no data handling guidelines specific to AI tools — consultants may not be aware of the GDPR implications of sharing client information with consumer AI services"),
        bullet("There is no QA framework for AI-assisted outputs — no checkpoint at which AI-generated advice is confirmed to be accurate and up-to-date before reaching a client"),
        spacer(),

        heading3("Recommended Actions"),
        bullet("Develop and publish a formal AI Use Policy covering: permitted tools, prohibited tools, data handling rules, review requirements for AI-generated content, and escalation routes for uncertainty"),
        bullet("Conduct a brief audit of current AI tool usage across the consultant team — understand what tools are being used, for what purposes, and whether client data is being input"),
        bullet("Introduce a lightweight QA process for AI-assisted client-facing outputs — this does not need to be burdensome but must create an auditable review step"),
        bullet("Invest in keeping consultant expertise current — use AI efficiency gains to create time for professional development, not just to process more clients"),

        pageBreak(),

        // ── 4. Guardian's Structural Moats ────────────────────────────────────
        heading1("4.  Guardian Group's Structural Moats"),
        body(
          "Before examining the recommended actions in detail, it is worth summarising the structural defences Guardian already has in place — and mapping them to the risks they address. These moats are genuine; the risk is that they erode over time if not actively maintained."
        ),
        spacer(),

        heading2("4.1  The Combined H&S + HR + Employment Law Offering"),
        body(
          "No single-discipline competitor can replicate Guardian's integrated service without significant investment in a second or third discipline. The combination is compelling because employment, health and safety, and HR compliance are deeply intertwined — a client managing an employee incident needs all three simultaneously. This addresses Competitor Disruption risk and Market Shrinkage risk."
        ),
        spacer(),

        heading2("4.2  The Consultant-Led (Not Self-Service) Model"),
        body(
          "Guardian's model places a qualified, named consultant at the centre of the client relationship. This is the opposite of a software platform. It creates personal trust, accountability, and a human judgment layer that AI alone cannot replicate. It is Guardian's strongest defence against both self-service drift and AI-native entrants — but only if the relationship model is actively maintained, not allowed to drift toward portal-only interactions. This addresses Billing Model risk and Self-Sufficiency risk."
        ),
        spacer(),

        heading2("4.3  The Portal as Switching-Cost Infrastructure"),
        body(
          "The Guardian portal is not simply a document repository — it is the operational home of a client's compliance programme. Documents, training records, incident logs, audit trails, and policy workflows are all embedded in the system. A client who has used the portal for 18 months has invested time, operational processes, and institutional knowledge in it. Moving to an alternative provider means reconstructing all of that. This addresses Competitor Disruption risk and Pricing Pressure risk."
        ),
        spacer(),

        heading2("4.4  Professional Accountability and Liability"),
        body(
          "When Guardian advises a client, it accepts professional responsibility for the quality of that advice. No AI tool accepts liability. No self-service platform accepts liability. This is perhaps the most underappreciated moat: in a world where AI makes compliance advice more accessible, the question of who is responsible when something goes wrong becomes more important, not less. This addresses Market Shrinkage risk and Self-Sufficiency risk."
        ),
        spacer(),

        heading2("4.5  Retained Package Pricing Creates Stickiness"),
        body(
          "Retained contracts create financial and operational inertia. Clients on annual contracts are unlikely to churn mid-term; renewal cycles create structured moments for value reinforcement. The retained model is under pressure, but it is also genuinely valuable for clients who want predictable cost and continuous availability. This addresses Billing Model risk."
        ),

        pageBreak(),

        // ── 5. Recommended Actions ─────────────────────────────────────────────
        heading1("5.  Recommended Actions"),
        body(
          "The following actions are recommended to close the gaps identified in the risk register. They are grouped by priority and the nature of the action required."
        ),
        spacer(),

        heading2("5.1  Accelerate Now (High Priority — No Material Investment Required)"),
        spacer(),

        heading3("A.  Codify the Outcome-Based Value Narrative"),
        body(
          "This is the single most important action. Guardian must develop a clear, written articulation of what clients are paying for — in terms of outcomes, risk transfer, liability coverage, and availability — that is entirely separate from any reference to consultant hours. This narrative should be:"
        ),
        bullet("Used consistently by all client-facing staff, particularly in renewal conversations"),
        bullet("Embedded in sales materials and proposal templates"),
        bullet("Tested with a small group of existing clients for resonance and credibility before broad rollout"),
        body("Owner: Commercial / Account Management. Timeline: 60 days."),
        spacer(),

        heading3("B.  Develop an Internal AI Use Policy"),
        body(
          "A practical, proportionate policy governing how Guardian consultants may and may not use AI tools. It does not need to prohibit AI use — it needs to govern it. The policy should cover: permitted tools and platforms, data handling rules (what can and cannot be input), review requirements for AI-generated content, and how to escalate uncertainty."
        ),
        body("Owner: Operations / HR. Timeline: 45 days."),
        spacer(),

        heading3("C.  Conduct a Current-State AI Audit"),
        body(
          "A brief internal survey or set of conversations with consultants to understand: which AI tools are currently being used, for what purposes, and whether any client data is being handled in non-compliant ways. The goal is not to police but to understand and then govern."
        ),
        body("Owner: Operations Lead. Timeline: 30 days."),
        spacer(),

        heading2("5.2  Develop in the Medium Term (3–6 Months)"),
        spacer(),

        heading3("D.  Enhance Portal Value Reporting"),
        body(
          "Develop portal reporting that gives clients a clear, business-language view of compliance activity: documents kept current, training completions, incidents managed, legal changes responded to. This makes the value of the retained service visible and data-driven — reducing the risk that clients perceive it as intangible."
        ),
        body("Owner: Technology / Product. Timeline: 3–6 months."),
        spacer(),

        heading3("E.  Establish a Competitive Intelligence Process"),
        body(
          "A lightweight, quarterly review of the competitive landscape: new entrants, competitor AI announcements, pricing changes, and market positioning shifts. This does not require a dedicated resource — it can be owned by a member of the SMT as a quarterly agenda item."
        ),
        body("Owner: SMT. Timeline: Ongoing from Q3 2026."),
        spacer(),

        heading3("F.  Client Segmentation by Self-Sufficiency Risk"),
        body(
          "Map the client base by complexity, risk profile, and relationship strength to identify which clients are most likely to drift toward self-service or respond to lower-cost alternatives. Develop tailored retention and value communication plans for the highest-risk segments."
        ),
        body("Owner: Account Management. Timeline: 4–5 months."),
        spacer(),

        heading2("5.3  Monitor and Review (Ongoing)"),
        spacer(),

        heading3("G.  Track Margin at the Client Level"),
        body(
          "As AI tools improve efficiency, establish a baseline and ongoing tracking of the relationship between AI adoption and margin per client. This is not about cutting prices — it is about understanding whether Guardian is capturing the efficiency gain or inadvertently absorbing it through increased service scope."
        ),
        spacer(),

        heading3("H.  Review Package Pricing Structure Annually"),
        body(
          "Consider whether the current retained package structure remains appropriate as AI capabilities evolve. An outcome-based or tiered pricing model may be more defensible in the medium term. This is a strategic review item, not an immediate action."
        ),
        spacer(),

        heading3("I.  Invest in Consultant Professional Development"),
        body(
          "Use any efficiency gains that AI tools generate to create time for consultants to deepen their expertise — particularly in fast-evolving areas such as Employment Law, where case law and tribunal decisions move quickly. This protects the depth of expertise that justifies premium pricing."
        ),

        pageBreak(),

        // ── 6. Investor Response Framing ──────────────────────────────────────
        heading1("6.  Framing the Investor Response"),
        body(
          "This section does not attempt to draft the investor response — that is the Board's task after reviewing and stress-testing this paper. However, it sets out the principles that should govern how the investor question is answered."
        ),
        spacer(),

        heading2("6.1  Acknowledge the Concern Directly"),
        body(
          "The investor's question about billable hours and AI efficiency is legitimate. Any response that appears to dismiss it or deflect it will reduce confidence, not increase it. The investor response should open by acknowledging the concern clearly: yes, AI is making service delivery more efficient, and yes, this has implications for the retained model. The rest of the response then explains why Guardian is well-positioned to navigate this — not despite the challenge, but because of specific structural advantages."
        ),
        spacer(),

        heading2("6.2  Lead with the Structural Moats"),
        body(
          "The strongest investor arguments are the ones that are hardest to replicate: the combined multi-discipline offering, the consultant-led model, the portal as switching-cost infrastructure, and professional liability. These are durable advantages that an AI-native entrant cannot replicate in 12–18 months. The investor response should make these concrete and specific, not generic."
        ),
        spacer(),

        heading2("6.3  Be Honest About the Gaps and the Actions"),
        body(
          "An investor will not be reassured by a response that claims there are no risks. They will be reassured by a response that demonstrates the business has thought rigorously about the risks and has a credible plan to address them. The investor response should reference the specific actions Guardian is taking (the AI use policy, the value narrative, the portal enhancements) as evidence of active risk management."
        ),
        spacer(),

        heading2("6.4  Frame AI as a Service Enhancer, Not a Threat"),
        body(
          "The investor narrative should position AI as something Guardian is actively using to deliver better, faster service — not something happening to the company that it is defending against. This requires Guardian to have a genuine answer to: 'How does Guardian use AI to improve client outcomes?' That answer is more compelling than any defensive argument about why the retained model is still valid."
        ),
        spacer(),

        heading2("6.5  Commit to Transparency on Progress"),
        body(
          "Consider offering the investor a follow-up briefing in 90 days, at which point Guardian can report on the actions taken: the AI use policy in place, the value narrative codified, the competitive intelligence process launched. This demonstrates governance maturity and converts the risk question into an evidence-based ongoing dialogue."
        ),
        spacer(),

        callout(
          "The investor question about billable hours is not primarily a financial modelling question. It is a strategic confidence question: does Guardian's leadership understand the risk and have a credible plan? This board paper is the foundation of that answer."
        ),

        pageBreak(),

        // ── 7. Appendix ────────────────────────────────────────────────────────
        heading1("7.  Appendix — Risk Exposure Definitions"),
        spacer(),

        body("The following definitions apply to the exposure ratings used in the risk register:"),
        spacer(),

        labelledPara("HIGH", "The risk has a plausible near-term pathway to material impact on revenue, margin, or competitive position. Board-level attention and active mitigation are required."),
        labelledPara("MEDIUM", "The risk is real and should be monitored and mitigated, but does not currently represent an existential or immediate threat. SMT-level ownership is appropriate."),
        labelledPara("LOW", "The risk exists in theory but current mitigations are strong and the likelihood of material impact in the near term is low. Monitor only."),

        spacer(2),
        body("MEDIUM–HIGH indicates a risk assessed between the two bands — typically where exposure is real and growing but has not yet reached the threshold of requiring immediate Board-level action. It warrants SMT-level priority."),

        spacer(2),
        new Paragraph({
          children: [
            new TextRun({ text: "— END OF PAPER —", bold: true, size: 22, color: "888888" }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        }),
        spacer(2),
        new Paragraph({
          children: [
            new TextRun({
              text: "This document is confidential and intended solely for the Board of Directors and Senior Management Team of Guardian Group. It must not be shared externally without Board approval.",
              size: 18,
              color: "AAAAAA",
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
});

// ─── Write file ───────────────────────────────────────────────────────────────

const buffer = await Packer.toBuffer(doc);
writeFileSync("Guardian_Group_AI_Risk_Board_Paper.docx", buffer);
console.log("✓ Guardian_Group_AI_Risk_Board_Paper.docx written successfully.");
