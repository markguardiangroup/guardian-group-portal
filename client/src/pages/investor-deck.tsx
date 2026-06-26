import { useState, useEffect, useCallback } from "react";
import {
  FileText, CheckCircle, Building2, Bell, BarChart2, GraduationCap,
  FolderLock, Scale, HardHat, Wrench, Factory, Code2, Database, Lock,
  Radio, ClipboardList, Cloud, Link, Bot, FlaskConical, Smartphone,
  Globe, Rocket, Search, Monitor, Eye, Timer, Shield, Flame, Users,
  Settings, FolderOpen, MapPin, Upload, Archive, AlertTriangle, User,
  Route, Tag, Plug, Map, ArrowLeftRight, ArrowRight, Download,
} from "lucide-react";

function GuardianLogo({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Orange — top-left quadrant, pre-computed paths (no runtime Math) */}
      <path fill="#F7941D" d="M 4.001 49.277 A 46 46 0 0 1 49.277 4.006 L 49.576 23.003 A 27 27 0 0 0 23.001 49.576 Z" />
      {/* Green — top-right */}
      <path fill="#8DC63F" d="M 50.723 4.006 A 46 46 0 0 1 95.994 49.277 L 76.997 49.576 A 27 27 0 0 0 50.424 23.003 Z" />
      {/* Blue — bottom-right */}
      <path fill="#29ABE2" d="M 95.994 50.723 A 46 46 0 0 1 50.723 95.994 L 50.424 76.997 A 27 27 0 0 0 76.997 50.424 Z" />
      {/* Pink — bottom-left */}
      <path fill="#EC008C" d="M 49.277 95.994 A 46 46 0 0 1 4.006 49.277 L 23.003 49.576 A 27 27 0 0 0 49.576 76.997 Z" />
    </svg>
  );
}

const NAVY = "#0b1f3a";
const TEAL = "#0d8fa4";
const TEAL_LIGHT = "#14b8d4";
const WHITE = "#ffffff";
const SILVER = "#c8d6e5";
const GOLD = "#f0a500";

type Slide = {
  id: number;
  section: string;
  sectionColor: string;
  render: () => JSX.Element;
};

function SectionTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color, color: WHITE, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 12px", borderRadius: "999px", display: "inline-block", marginBottom: "1.2rem" }}>
      {label}
    </span>
  );
}

function Headline({ children, size = "3rem" }: { children: React.ReactNode; size?: string }) {
  return (
    <h2 style={{ fontSize: size, fontWeight: 800, color: WHITE, lineHeight: 1.1, margin: "0 0 1rem", letterSpacing: "-0.02em" }}>
      {children}
    </h2>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ color: SILVER, fontSize: "1.05rem", lineHeight: 1.6, margin: "0 0 1rem", maxWidth: "680px" }}>{children}</p>;
}

function Divider() {
  return <div style={{ width: "56px", height: "4px", background: TEAL, borderRadius: "2px", margin: "0.8rem 0 1.2rem" }} />;
}

function Card({ icon, title, desc, accent }: { icon: React.ReactNode; title: string; desc: string; accent?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${accent || "rgba(255,255,255,0.12)"}`, borderRadius: "12px", padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ color: TEAL_LIGHT, marginBottom: "0.1rem" }}>{icon}</div>
      <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.88rem" }}>{title}</div>
      <div style={{ color: SILVER, fontSize: "0.75rem", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

function BulletList({ items, accent }: { items: string[]; accent?: string }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", color: SILVER, fontSize: "0.88rem", lineHeight: 1.5 }}>
          <span style={{ color: accent || TEAL_LIGHT, fontWeight: 700, flexShrink: 0, marginTop: "0.1rem" }}>▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "1rem" }}>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: TEAL_LIGHT }}>{value}</div>
      <div style={{ color: SILVER, fontSize: "0.75rem", marginTop: "0.3rem" }}>{label}</div>
    </div>
  );
}

function PillarCard({ letter, title, items, accent }: { letter: string; title: string; items: string[]; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "1rem", borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
        <span style={{ background: accent, color: WHITE, fontWeight: 900, fontSize: "0.75rem", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{letter}</span>
        <span style={{ fontWeight: 700, color: WHITE, fontSize: "0.85rem" }}>{title}</span>
      </div>
      <BulletList items={items} accent={accent} />
    </div>
  );
}

const slides: Slide[] = [

  // ── 1 · HERO ────────────────────────────────────────────────────────────────
  {
    id: 1,
    section: "Introduction",
    sectionColor: TEAL,
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: "1.2rem" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.2rem" }}>
          <GuardianLogo size={60} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: "1.55rem", color: WHITE, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Guardian</div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: WHITE, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.85, marginTop: "0.05rem" }}>Group</div>
          </div>
        </div>
        <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.12)" }} />
        <h1 style={{ fontSize: "3.6rem", fontWeight: 900, color: WHITE, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: "680px", margin: 0 }}>
          Document Management<br />
          <span style={{ color: TEAL_LIGHT }}>to AI Compliance Partner.</span>
        </h1>
        <div style={{ width: "64px", height: "4px", background: TEAL, borderRadius: "2px" }} />
        <p style={{ color: SILVER, fontSize: "1.1rem", maxWidth: "520px", lineHeight: 1.6, margin: 0 }}>
          A live B2B compliance platform — built today, scaling into a connected, AI-powered ecosystem that redefines how SMEs manage H&S and Employment Law.
        </p>
        <div style={{ display: "flex", gap: "2rem", marginTop: "1rem" }}>
          <StatBlock value="Live" label="Platform in use today" />
          <StatBlock value="8" label="Group brands onboarding" />
          <StatBlock value="100+" label="Target live clients by Jun '27" />
        </div>
      </div>
    ),
  },

  // ── 2 · WHAT WE ARE TODAY ───────────────────────────────────────────────────
  {
    id: 2,
    section: "TODAY",
    sectionColor: "#1a6bbf",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="What · Live Today" color="#1a6bbf" />
        <Headline>A Production-Ready Compliance Platform</Headline>
        <Divider />
        <Sub>Not a prototype. A live portal managing real documents, real clients, and real compliance workflows — right now.</Sub>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.9rem" }}>
          {[
            { icon: <FileText size={24} />, title: "Document Management", desc: "Approval workflows, version control, expiry tracking across all modules." },
            { icon: <CheckCircle size={24} />, title: "Compliance Scoring", desc: "Live compliance % per site, gap tracking and required-template logic." },
            { icon: <Building2 size={24} />, title: "Multi-Site & Groups", desc: "Group owner hierarchy — manage dozens of sites under one parent company." },
            { icon: <Bell size={24} />, title: "Real-Time Alerts", desc: "Instant notifications to consultants and clients via server-sent events." },
            { icon: <BarChart2 size={24} />, title: "H&S Incident Tracking", desc: "Severity, milestones, linked documents and auto-generated reports." },
            { icon: <GraduationCap size={24} />, title: "Training Records", desc: "Training bookings and certificates visible directly in the portal." },
            { icon: <FolderLock size={24} />, title: "Secure Client Uploads", desc: "Expiring upload folders with granular access control and audit log." },
            { icon: <Scale size={24} />, title: "Employment Law Cases", desc: "Case management with document bundle builder and PDF generation." },
          ].map((item) => (
            <Card key={item.title} icon={item.icon} title={item.title} desc={item.desc} />
          ))}
        </div>
      </div>
    ),
  },

  // ── 3 · WHO IT SERVES ───────────────────────────────────────────────────────
  {
    id: 3,
    section: "TODAY",
    sectionColor: "#1a6bbf",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="What · Who It Serves" color="#1a6bbf" />
        <Headline>Three Stakeholders. One Platform.</Headline>
        <Divider />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem" }}>
          {[
            {
              icon: <HardHat size={32} color={TEAL} />, role: "Guardian Consultants", color: TEAL,
              items: ["Manage client documents & approvals", "Track compliance across all sites", "Handle EL cases end-to-end", "Create training bookings"],
            },
            {
              icon: <Wrench size={32} color="#1a6bbf" />, role: "Guardian Admin Team", color: "#1a6bbf",
              items: ["Full platform visibility & control", "Manage companies, sites & users", "Configure modules & templates", "Access reports & audit logs"],
            },
            {
              icon: <Factory size={32} color="#a0522d" />, role: "Client Companies", color: "#a0522d",
              items: ["Live compliance dashboard per site", "Review & approve documents", "Access training records", "Raise support requests"],
            },
          ].map((col) => (
            <div key={col.role} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1.5rem", borderTop: `3px solid ${col.color}` }}>
              <div style={{ marginBottom: "0.6rem" }}>{col.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "1rem", marginBottom: "0.9rem" }}>{col.role}</div>
              <BulletList items={col.items} accent={col.color} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1.2rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.8rem 1rem", textAlign: "center" }}>
            <span style={{ color: SILVER, fontSize: "0.8rem" }}>All three roles access the <strong style={{ color: WHITE }}>same platform</strong> — different views, same data.</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.8rem 1rem", textAlign: "center" }}>
            <span style={{ color: SILVER, fontSize: "0.8rem" }}>Client users see <strong style={{ color: WHITE }}>only their own</strong> sites, documents and compliance status.</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.8rem 1rem", textAlign: "center" }}>
            <span style={{ color: SILVER, fontSize: "0.8rem" }}>Full <strong style={{ color: WHITE }}>audit trail</strong> on every action — defensible compliance history at all times.</span>
          </div>
        </div>
      </div>
    ),
  },

  // ── 4 · TECHNICAL FOUNDATIONS ───────────────────────────────────────────────
  {
    id: 4,
    section: "HOW",
    sectionColor: "#2d7a4f",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="How · Built to Last" color="#2d7a4f" />
        <Headline>Production-Grade. Secure. Scalable.</Headline>
        <Divider />
        <Sub>Every module in the roadmap builds on a solid, proven technical foundation — no rewrites, no compromise on security or scale.</Sub>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.9rem" }}>
          {[
            { icon: <Code2 size={24} />, title: "React + TypeScript", desc: "Type-safe, tested frontend. Fast and accessible." },
            { icon: <Database size={24} />, title: "PostgreSQL + Drizzle", desc: "Relational DB with schema-validated, type-safe queries." },
            { icon: <Lock size={24} />, title: "Role-Based Access", desc: "Tenant isolation — every query scoped to what the user can see." },
            { icon: <Radio size={24} />, title: "Real-Time SSE", desc: "Server-sent events — no polling. Live updates instantly." },
            { icon: <ClipboardList size={24} />, title: "Full Audit Logging", desc: "Every action logged with user, timestamp and context." },
            { icon: <Cloud size={24} />, title: "Cloud Object Storage", desc: "Documents and PDFs in GCS. Secure, scalable, redundant." },
            { icon: <FileText size={24} />, title: "PDF Generation", desc: "pdfkit + LibreOffice pipeline — compliance PDFs on demand." },
            { icon: <Link size={24} />, title: "API-Ready", desc: "RESTful JSON API — designed for CRM sync and Guardian App integration." },
          ].map((item) => (
            <Card key={item.title} icon={item.icon} title={item.title} desc={item.desc} accent="rgba(45,122,79,0.3)" />
          ))}
        </div>
      </div>
    ),
  },

  // ── 5 · USP ─────────────────────────────────────────────────────────────────
  {
    id: 4,
    section: "WHY",
    sectionColor: "#a0522d",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Why · Competitive Advantage" color="#a0522d" />
        <Headline>Expertise + Platform.<br /><span style={{ color: TEAL_LIGHT }}>Neither Alone Is Enough.</span></Headline>
        <Divider />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "0.5rem" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontWeight: 700, color: "#f87171", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>The Market Today</div>
            <BulletList accent="#f87171" items={[
              "Consulting firms — expert advice, no technology",
              "SaaS tools — software with no domain expertise",
              "Generic document managers — no compliance logic",
              "No combined H&S + HR + Employment Law platform for SMEs",
            ]} />
          </div>
          <div style={{ background: "rgba(13,143,164,0.1)", border: `1px solid ${TEAL}`, borderRadius: "12px", padding: "1.5rem" }}>
            <div style={{ fontWeight: 700, color: TEAL_LIGHT, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Guardian Group</div>
            <BulletList accent={TEAL_LIGHT} items={[
              "Deep H&S and Employment Law consultancy expertise",
              "Owned, proprietary compliance platform — a permanent moat",
              "Three modules unified: H&S, HR, and Employment Law",
              "Real-time compliance scoring with full audit history",
            ]} />
          </div>
        </div>
        <div style={{ marginTop: "1.2rem", background: "rgba(240,165,0,0.08)", border: `1px solid ${GOLD}`, borderRadius: "8px", padding: "0.9rem 1.2rem" }}>
          <span style={{ color: GOLD, fontWeight: 700 }}>Vision: </span>
          <span style={{ color: SILVER, fontSize: "0.88rem" }}>To be every SME's proactive, transparent, and efficient compliance partner — delivering expertise backed by technology that no single-axis competitor can replicate.</span>
        </div>
      </div>
    ),
  },

  // ── 5 · COMMERCIAL BENEFITS ─────────────────────────────────────────────────
  {
    id: 5,
    section: "WHY",
    sectionColor: "#a0522d",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Why · Commercial Benefits" color="#a0522d" />
        <Headline>Five Revenue Drivers</Headline>
        <Divider />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          {[
            { n: "01", title: "Client Stickiness", desc: "Compliance data and approval workflows locked in the platform. High switching costs reinforce annual renewals.", stat: "Deep lock-in" },
            { n: "02", title: "Cross-Sell Surface", desc: "Training, modules, and services bookable directly through the portal — surfacing upsell at every touchpoint.", stat: "Built-in upsell" },
            { n: "03", title: "Consultant Efficiency", desc: "Digital workflows and auto-generated reports target >0.5 days saved per consultant per week — directly increasing billable capacity.", stat: ">0.5 days/wk" },
            { n: "04", title: "Retained Contract Uplift", desc: "The portal becomes a priced, named deliverable in every retained contract — not just consultant hours.", stat: "New revenue line" },
            { n: "05", title: "Future SaaS Monetisation", desc: "White-label or direct subscription tiers open a scalable recurring revenue stream beyond consulting. (Year 3+ vision.)", stat: "Year 3+ potential" },
          ].map((item) => (
            <div key={item.n} style={{ display: "flex", alignItems: "center", gap: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "0.85rem 1.1rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: TEAL, width: "2.2rem", flexShrink: 0 }}>{item.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.88rem" }}>{item.title}</div>
                <div style={{ color: SILVER, fontSize: "0.75rem", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
              <div style={{ background: "rgba(13,143,164,0.18)", border: `1px solid ${TEAL}`, borderRadius: "6px", padding: "0.25rem 0.65rem", fontSize: "0.68rem", fontWeight: 700, color: TEAL_LIGHT, flexShrink: 0, whiteSpace: "nowrap" }}>
                {item.stat}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── 6 · EVOLUTION VISION ────────────────────────────────────────────────────
  {
    id: 6,
    section: "VISION",
    sectionColor: TEAL,
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="The Journey" color={TEAL} />
        <Headline>From Document Platform<br /><span style={{ color: TEAL_LIGHT }}>to Compliance Ecosystem</span></Headline>
        <Divider />
        <Sub>The platform is the foundation. The roadmap transforms it into a connected, intelligent compliance partner.</Sub>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.5rem", marginTop: "0.5rem" }}>
          {[
            {
              stage: "Stage 1 — Now", icon: <FileText size={28} color="#1a6bbf" />, title: "Document Management Platform", color: "#1a6bbf",
              items: ["Live H&S, HR & EL modules", "Approval workflows & compliance scoring", "Multi-site group structure", "Role-based access & audit trail"],
            },
            {
              stage: "Stage 2 — Year 1–2", icon: <Link size={28} color={TEAL} />, title: "Connected Data Ecosystem", color: TEAL,
              items: ["Guardian App — on-site audits & data capture", "CRM API sync across all brands", "Training module with booking APIs", "Asset register & inspection records"],
            },
            {
              stage: "Stage 3 — Year 2–3", icon: <Bot size={28} color="#6b21a8" />, title: "AI-Enabled Compliance Partner", color: "#6b21a8",
              items: ["Auto-generated audit reports", "Compliance gap detection", "Predictive risk flags for clients", "Intelligent pathway recommendations"],
            },
          ].map((stage) => (
            <div key={stage.stage} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1.4rem", borderTop: `3px solid ${stage.color}` }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: stage.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.4rem" }}>{stage.stage}</div>
              <div style={{ marginBottom: "0.5rem" }}>{stage.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.9rem", marginBottom: "0.8rem" }}>{stage.title}</div>
              <BulletList items={stage.items} accent={stage.color} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1.2rem", textAlign: "center", color: SILVER, fontSize: "0.8rem" }}>
          Each stage builds on the last — data collected today becomes the foundation for AI insights tomorrow.
        </div>
      </div>
    ),
  },

  // ── 7 · MILESTONE JOURNEY ───────────────────────────────────────────────────
  {
    id: 7,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Roadmap · Key Milestones" color="#b45309" />
        <Headline>0–12 Months: Key Milestones</Headline>
        <Divider />
        <div style={{ marginBottom: "0.4rem", fontSize: "0.72rem", color: SILVER, opacity: 0.7 }}>Month 0 = initial live client testing (Jun 2026)</div>
        <div style={{ position: "relative", marginTop: "0.3rem" }}>
          <div style={{ position: "absolute", top: "28px", left: "0", right: "0", height: "2px", background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.8rem", position: "relative" }}>
            {[
              { month: "Pre-launch", date: "May '26", label: "CRM API — first link live", icon: <Link size={26} />, color: TEAL, done: true },
              { month: "Month 0", date: "Jun '26", label: "Initial client testing begins", icon: <FlaskConical size={26} />, color: "#22c55e", done: true },
              { month: "Month 4", date: "Oct '26", label: "30 clients + Push/Pull CRM API", icon: <Building2 size={26} />, color: "#1a6bbf", done: false },
              { month: "Month 5", date: "Nov '26", label: "Guardian App prototype", icon: <Smartphone size={26} />, color: "#a855f7", done: false },
              { month: "Month 7", date: "Jan '27", label: "All 8 brands with clients", icon: <Globe size={26} />, color: GOLD, done: false },
              { month: "Month 9", date: "Mar '27", label: "Guardian App live", icon: <Smartphone size={26} />, color: "#a0522d", done: false },
              { month: "Month 12", date: "Jun '27", label: "100 clients", icon: <Rocket size={26} />, color: TEAL_LIGHT, done: false },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: m.done ? m.color : "rgba(255,255,255,0.15)", border: `2px solid ${m.color}`, position: "relative", zIndex: 1, flexShrink: 0 }}>
                  {m.done && <div style={{ position: "absolute", inset: "2px", borderRadius: "50%", background: m.color }} />}
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${m.color}30`, borderRadius: "12px", padding: "1.1rem 0.9rem", textAlign: "center", width: "100%" }}>
                  <div style={{ color: m.color, marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>{m.icon}</div>
                  <div style={{ fontWeight: 900, color: m.color, fontSize: "0.82rem", marginBottom: "0.15rem" }}>{m.month}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginBottom: "0.4rem" }}>{m.date}</div>
                  <div style={{ color: SILVER, fontSize: "0.76rem", lineHeight: 1.5 }}>{m.label}</div>
                  {m.done && <div style={{ marginTop: "0.5rem", background: "rgba(34,197,94,0.18)", border: "1px solid #22c55e", color: "#4ade80", fontSize: "0.65rem", fontWeight: 700, borderRadius: "999px", padding: "2px 8px" }}>✓ LIVE</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "0.8rem 1rem" }}>
            <div style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.3rem" }}>0–12 Months</div>
            <div style={{ color: SILVER, fontSize: "0.75rem" }}>Live client testing, CRM sync, all 8 brands onboarded, Guardian App launched.</div>
          </div>
          <div style={{ background: "rgba(13,143,164,0.08)", border: `1px solid ${TEAL}30`, borderRadius: "8px", padding: "0.8rem 1rem" }}>
            <div style={{ color: TEAL_LIGHT, fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.3rem" }}>12–18 Months</div>
            <div style={{ color: SILVER, fontSize: "0.75rem" }}>Module expansion — asset registers, risk management, HRIS, group reporting.</div>
          </div>
          <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.3)", borderRadius: "8px", padding: "0.8rem 1rem" }}>
            <div style={{ color: "#c084fc", fontWeight: 700, fontSize: "0.78rem", marginBottom: "0.3rem" }}>18–24 Months</div>
            <div style={{ color: SILVER, fontSize: "0.75rem" }}>AI intelligence layer — auto-reports, gap detection, intelligent pathways.</div>
          </div>
        </div>
      </div>
    ),
  },

  // ── 8 · 0–12 MONTHS: 6 PILLARS ─────────────────────────────────────────────
  {
    id: 8,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Roadmap · 0–12 Months" color="#b45309" />
        <Headline>0–12 Months: Six Pillars</Headline>
        <Divider />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <PillarCard letter="A" title="Stabilisation" accent={TEAL} items={[
            "Performance and reliability improvements",
            "Efficiency tooling for consultants",
            "Support workflows and rapid iteration",
          ]} />
          <PillarCard letter="B" title="Client Onboarding" accent="#22c55e" items={[
            "Initial client testing from Jun 2026",
            "Onboarding across all 8 group brands",
            "Target 30 live clients by Oct 2026",
            "All brands live by Jan 2027",
          ]} />
          <PillarCard letter="C" title="Training Module" accent="#1a6bbf" items={[
            "Full training module development",
            "Online and in-person booking APIs",
            "Certificate tracking and visibility",
            "Client-accessible training records",
          ]} />
          <PillarCard letter="D" title="Tech Team Build" accent={GOLD} items={[
            "Hire CTO to own technical strategy",
            "Two additional developers",
            "Structured sprint delivery model",
          ]} />
          <PillarCard letter="E" title="Guardian App" accent="#a0522d" items={[
            "Mobile & tablet app for consultants on-site",
            "On-site data capture — audits, assessments",
            "QC validation before automatic portal sync",
            "Launch target: Mar 2027",
          ]} />
          <PillarCard letter="F" title="CRM API Sync" accent="#7c3aed" items={[
            "First API link to CRM — May 2026",
            "Full bidirectional CRM sync by Oct 2026",
            "Client data unified across systems",
            "Reduces manual admin for Guardian team",
          ]} />
        </div>
      </div>
    ),
  },

  // ── 9 · CONNECTED ECOSYSTEM ─────────────────────────────────────────────────
  {
    id: 9,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Roadmap · Connected Ecosystem" color="#b45309" />
        <Headline>The Data Loop That Changes Everything</Headline>
        <Divider />
        <Sub>When the Guardian App and CRM sync are live, Guardian becomes a closed-loop compliance engine — data flows in from the field, out to clients, and back into Guardian's systems automatically.</Sub>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginTop: "1rem" }}>
          {[
            { icon: <Building2 size={22} />, label: "CRM", sub: "Client records\nContract data\nAccount status", color: "#7c3aed" },
            { arrow: true, icon: <ArrowLeftRight size={20} color={TEAL_LIGHT} /> },
            { icon: <Smartphone size={22} />, label: "Guardian App", sub: "On-site audits\nForm submissions\nPhoto evidence", color: "#a0522d" },
            { arrow: true, icon: <ArrowRight size={20} color={TEAL_LIGHT} /> },
            { icon: <Search size={22} />, label: "QC Layer", sub: "Validation\nCompleteness\nApproval gates", color: "#1a6bbf" },
            { arrow: true, icon: <ArrowRight size={20} color={TEAL_LIGHT} /> },
            { icon: <Monitor size={22} />, label: "Portal", sub: "Compliance records\nAudit trail\nReports", color: TEAL },
            { arrow: true, icon: <ArrowRight size={20} color={TEAL_LIGHT} /> },
            { icon: <Eye size={22} />, label: "Client View", sub: "Live dashboards\nDocuments\nCompliance scores", color: "#22c55e" },
          ].map((step, i) => (
            step.arrow ? (
              <div key={i} style={{ padding: "0 0.4rem", flexShrink: 0 }}>{step.icon}</div>
            ) : (
              <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${(step as any).color}`, borderRadius: "10px", padding: "0.9rem 0.7rem", textAlign: "center", minWidth: "110px", flexShrink: 0 }}>
                <div style={{ color: (step as any).color, display: "flex", justifyContent: "center" }}>{step.icon}</div>
                <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.72rem", marginTop: "0.3rem", whiteSpace: "pre-line" }}>{(step as any).label}</div>
                <div style={{ color: SILVER, fontSize: "0.62rem", marginTop: "0.3rem", lineHeight: 1.4, whiteSpace: "pre-line" }}>{(step as any).sub}</div>
              </div>
            )
          ))}
        </div>
        <div style={{ marginTop: "1.4rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
          {[
            { icon: <Timer size={20} />, title: "Zero Re-entry", desc: "On-site data flows directly to the portal — no manual transcription." },
            { icon: <Link size={20} />, title: "CRM in Sync", desc: "Client records in CRM and portal always match — one source of truth." },
            { icon: <FileText size={20} />, title: "Auto-Reports", desc: "Submissions trigger draft reports — consultants review, not write." },
            { icon: <Shield size={20} />, title: "Defensible Records", desc: "Timestamped, QC'd evidence — audit-ready at all times." },
          ].map((item) => (
            <div key={item.title} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "0.9rem", textAlign: "center" }}>
              <div style={{ color: TEAL_LIGHT, marginBottom: "0.4rem", display: "flex", justifyContent: "center" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.78rem", marginBottom: "0.3rem" }}>{item.title}</div>
              <div style={{ color: SILVER, fontSize: "0.7rem", lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── 10 · APP FORM BUILDER ───────────────────────────────────────────────────
  {
    id: 10,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", gap: "1.8rem" }}>
        <div>
          <SectionTag label="Roadmap · Guardian App — Launch Mar 2027" color="#a0522d" />
          <Headline>The Guardian App.</Headline>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: TEAL_LIGHT, marginBottom: "0.6rem", marginTop: "-0.4rem" }}>On-Site. Structured. Synced.</div>
          <Divider />
          <p style={{ color: SILVER, fontSize: "1.05rem", margin: 0, maxWidth: "660px" }}>
            A dedicated mobile and tablet app for Guardian consultants — conducting audits, inspections and assessments in the field, with every result automatically synced to the client's portal in real time.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
          {[
            { icon: <Shield size={28} />, label: "H&S Audits" },
            { icon: <Flame size={28} />, label: "Fire Safety" },
            { icon: <Users size={28} />, label: "HR Compliance" },
            { icon: <Settings size={28} />, label: "Asset Testing" },
            { icon: <FileText size={28} />, label: "Risk Assessments" },
          ].map((item) => (
            <div key={item.label} style={{ background: "rgba(160,82,45,0.12)", border: "1px solid rgba(160,82,45,0.35)", borderRadius: "12px", padding: "1.2rem 0.8rem", textAlign: "center" }}>
              <div style={{ color: "#f97316", marginBottom: "0.5rem", display: "flex", justifyContent: "center" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.8rem" }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          {[
            { icon: <FolderOpen size={22} />, label: "Central Template Library", sub: "One source of truth, pushed to all app users" },
            { icon: <MapPin size={22} />, label: "On-Site Capture", sub: "Photos, signatures, pass/fail — on device" },
            { icon: <Link size={22} />, label: "Asset Register Link", sub: "Each result tied to a specific asset or site" },
            { icon: <Upload size={22} />, label: "Auto-Sync to Portal", sub: "QC'd and live for clients in seconds" },
          ].map((item) => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
              <div style={{ color: TEAL_LIGHT, marginBottom: "0.4rem", display: "flex", justifyContent: "center" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.78rem", marginBottom: "0.25rem" }}>{item.label}</div>
              <div style={{ color: SILVER, fontSize: "0.7rem", lineHeight: 1.4 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ color: GOLD, fontWeight: 700, fontSize: "0.78rem" }}>Used by:</span>
          {["H&S Consultants", "HR Consultants", "Fire Safety Advisors", "Engineers & Inspectors"].map((r) => (
            <span key={r} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.3)", borderRadius: "999px", padding: "2px 10px", fontSize: "0.7rem", color: SILVER }}>{r}</span>
          ))}
        </div>
      </div>
    ),
  },

  // ── 12–24 MONTHS H1 ────────────────────────────────────────────────────────
  {
    id: 12,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Roadmap · Year 2 H1" color="#b45309" />
        <Headline>12–18 Months: Module Expansion</Headline>
        <Divider />
        <Sub>With the core platform stable and clients onboarded, Year 2 H1 expands the module portfolio — transforming the portal from a document manager into a full compliance operating system.</Sub>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "0.5rem" }}>
          {[
            { icon: <Archive size={28} color="#22c55e" />, title: "Asset Registers", color: "#22c55e", desc: "Digital asset lifecycle — machinery, equipment, fire assets, vehicles. Full inspection and test history per asset, linked to compliance records." },
            { icon: <AlertTriangle size={28} color={TEAL} />, title: "Compliance Risk Management", color: TEAL, desc: "Formalised risk scoring, controls, and treatment plans. Clients manage their risk register within the portal — visible to consultants in real time." },
            { icon: <User size={28} color="#1a6bbf" />, title: "HRIS Module Integration", color: "#1a6bbf", desc: "Connect HR data — employee records, contracts, absence — for joined-up people and compliance management across H&S and Employment Law." },
            { icon: <BarChart2 size={28} color={GOLD} />, title: "Group-Level Reporting", color: GOLD, desc: "Portfolio-wide compliance views for multi-site operators and group owners. Executive dashboard showing compliance health across all brands and sites." },
          ].map((item) => (
            <div key={item.title} style={{ display: "flex", gap: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "1.2rem", borderLeft: `3px solid ${item.color}` }}>
              <div style={{ flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.9rem", marginBottom: "0.4rem" }}>{item.title}</div>
                <div style={{ color: SILVER, fontSize: "0.76rem", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── 13 · 12–24 MONTHS H2 ────────────────────────────────────────────────────
  {
    id: 13,
    section: "ROADMAP",
    sectionColor: "#b45309",
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Roadmap · Year 2 H2" color="#6b21a8" />
        <Headline>18–24 Months: <span style={{ color: "#c084fc" }}>The AI Layer</span></Headline>
        <Divider />
        <Sub>Guardian's proprietary compliance dataset — built from every document, audit, and inspection — becomes the foundation for AI that no new entrant can quickly replicate.</Sub>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginTop: "0.5rem" }}>
          {[
            { icon: <FileText size={28} />, title: "Auto-Generated Reports", desc: "Draft audit reports from on-site data — consultants review, not write." },
            { icon: <Search size={28} />, title: "Compliance Gap Detection", desc: "AI surfaces missing or overdue documents before anyone has to check." },
            { icon: <Route size={28} />, title: "Intelligent Pathways", desc: "Document finder personalised to client sector, profile, and history." },
            { icon: <BarChart2 size={28} />, title: "Document Intelligence", desc: "Auto-classify uploads, extract compliance obligations, assign renewal dates." },
          ].map((item) => (
            <div key={item.title} style={{ background: "rgba(107,33,168,0.12)", border: "1px solid rgba(107,33,168,0.3)", borderRadius: "12px", padding: "1.2rem", textAlign: "center" }}>
              <div style={{ color: "#c084fc", marginBottom: "0.6rem", display: "flex", justifyContent: "center" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.82rem", marginBottom: "0.4rem" }}>{item.title}</div>
              <div style={{ color: SILVER, fontSize: "0.72rem", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.25)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
            <div style={{ fontWeight: 700, color: "#c084fc", fontSize: "0.82rem", marginBottom: "0.3rem" }}>For Consultants</div>
            <div style={{ color: SILVER, fontSize: "0.75rem" }}>Significant reduction in routine report-writing time. More capacity for billable advisory work.</div>
          </div>
          <div style={{ background: "rgba(107,33,168,0.08)", border: "1px solid rgba(107,33,168,0.25)", borderRadius: "8px", padding: "0.9rem 1.1rem" }}>
            <div style={{ fontWeight: 700, color: "#c084fc", fontSize: "0.82rem", marginBottom: "0.3rem" }}>For Clients</div>
            <div style={{ color: SILVER, fontSize: "0.75rem" }}>Proactive alerts, plain-English compliance summaries, and predictive risk flags — compliance becomes effortless.</div>
          </div>
        </div>
      </div>
    ),
  },

  // ── 14 · VISION BEYOND 24 MONTHS ────────────────────────────────────────────
  {
    id: 14,
    section: "VISION",
    sectionColor: TEAL,
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <SectionTag label="Vision · Beyond Year 2" color={TEAL} />
        <Headline>The Long-Term Platform Vision</Headline>
        <Divider />
        <Sub>Beyond Year 2, Guardian Group becomes a full compliance ecosystem — scalable, white-labelable, and powered by proprietary AI.</Sub>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "0.5rem" }}>
          {[
            { icon: <Globe size={20} color={TEAL_LIGHT} />, title: "Full Compliance Ecosystem", desc: "H&S, HR, Employment Law, Training, Risk Management, and Asset Registers — unified in one platform. The go-to compliance partner for any UK SME." },
            { icon: <Tag size={20} color={TEAL_LIGHT} />, title: "White-Label & SaaS Subscription Tiers", desc: "License the platform to other consulting firms or offer self-serve SaaS tiers — recurring revenue at software margins, alongside retained consulting." },
            { icon: <Bot size={20} color={TEAL_LIGHT} />, title: "Predictive Compliance AI", desc: "Models trained on years of multi-client data predict incidents and breaches before they happen. A defensible, compounding data moat." },
            { icon: <Plug size={20} color={TEAL_LIGHT} />, title: "Open API Ecosystem", desc: "Payroll, HR platforms, insurers and health surveillance providers connect via API — Guardian becomes the compliance backbone of the SME supply chain." },
            { icon: <Map size={20} color={TEAL_LIGHT} />, title: "Market Expansion", desc: "Geographic expansion beyond UK, sector-specific modules, and potential M&A of smaller consulting practices onto the platform." },
          ].map((item) => (
            <div key={item.title} style={{ display: "flex", gap: "1rem", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "0.85rem 1.1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, marginTop: "0.1rem" }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: WHITE, fontSize: "0.85rem" }}>{item.title}</div>
                <div style={{ color: SILVER, fontSize: "0.74rem", lineHeight: 1.5, marginTop: "0.2rem" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ── 15 · OUTRO ──────────────────────────────────────────────────────────────
  {
    id: 16,
    section: "CLOSE",
    sectionColor: TEAL,
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: "1rem" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.2rem" }}>
          <GuardianLogo size={60} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: "1.55rem", color: WHITE, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Guardian</div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: WHITE, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.85, marginTop: "0.05rem" }}>Group</div>
          </div>
        </div>
        <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.12)" }} />
        <h2 style={{ fontSize: "3rem", fontWeight: 900, color: WHITE, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: "580px", margin: 0 }}>
          Proactive. Transparent.<br />
          <span style={{ color: TEAL_LIGHT }}>Efficient.</span>
        </h2>
        <div style={{ width: "64px", height: "4px", background: TEAL, borderRadius: "2px" }} />
        <p style={{ color: SILVER, fontSize: "1rem", maxWidth: "480px", lineHeight: 1.6 }}>
          From document management platform today — to AI-enabled compliance partner for every UK SME.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1.2rem", maxWidth: "580px" }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "1rem" }}>
            <div style={{ fontWeight: 800, color: TEAL_LIGHT, fontSize: "1.3rem" }}>Today</div>
            <div style={{ color: SILVER, fontSize: "0.72rem", marginTop: "0.3rem" }}>Live compliance platform serving real clients</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "1rem" }}>
            <div style={{ fontWeight: 800, color: TEAL_LIGHT, fontSize: "1.3rem" }}>Year 1–2</div>
            <div style={{ color: SILVER, fontSize: "0.72rem", marginTop: "0.3rem" }}>Connected ecosystem, 100+ clients, AI layer</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "1rem" }}>
            <div style={{ fontWeight: 800, color: TEAL_LIGHT, fontSize: "1.3rem" }}>Beyond</div>
            <div style={{ color: SILVER, fontSize: "0.72rem", marginTop: "0.3rem" }}>SaaS platform, open API, market expansion</div>
          </div>
        </div>
        <div style={{ marginTop: "0.8rem", color: "#64748b", fontSize: "0.7rem" }}>
          Confidential · Guardian Group · {new Date().getFullYear()}
        </div>
      </div>
    ),
  },
];

const DECK_PASSWORD = import.meta.env.VITE_DECK_PASSWORD as string | undefined;
const SESSION_KEY = "deck_unlocked";

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (DECK_PASSWORD && value === DECK_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setValue("");
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", gap: "1.5rem" }}
      data-testid="deck-password-gate"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <GuardianLogo size={42} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", color: WHITE, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Guardian</div>
          <div style={{ fontWeight: 700, fontSize: "0.72rem", color: WHITE, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.8 }}>Group</div>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: SILVER, fontSize: "0.85rem" }}>Strategic Overview — Access Required</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.8rem", width: "100%", maxWidth: "320px", animation: shaking ? "shake 0.4s ease" : "none" }}>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
        `}</style>
        <input
          type="password"
          placeholder="Enter password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          autoFocus
          data-testid="input-deck-password"
          style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.15)"}`, borderRadius: "8px", padding: "0.75rem 1rem", color: WHITE, fontSize: "0.95rem", outline: "none", width: "100%", boxSizing: "border-box" }}
        />
        {error && <div style={{ color: "#f87171", fontSize: "0.78rem", textAlign: "center" }}>Incorrect password — please try again</div>}
        <button type="submit" data-testid="button-deck-unlock" style={{ background: TEAL, color: WHITE, border: "none", borderRadius: "8px", padding: "0.75rem", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", width: "100%" }}>
          View Presentation
        </button>
      </form>
      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem" }}>
        Confidential · Guardian Group · {new Date().getFullYear()}
      </div>
    </div>
  );
}


export default function InvestorDeck() {
  const exportMode = new URLSearchParams(window.location.search).get("exportKey") === "GUARDIAN_EXPORT_2026";
  const isAlreadyUnlocked = exportMode || !DECK_PASSWORD || sessionStorage.getItem(SESSION_KEY) === "1";
  const [unlocked, setUnlocked] = useState(isAlreadyUnlocked);
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);
  const goTo = useCallback((i: number) => setCurrent(i), []);

  useEffect(() => {
    if (!unlocked) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [unlocked, goNext, goPrev]);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  const slide = slides[current];

  return (
    <>
    <style>{`
      @media print {
        @page { size: A4 landscape; margin: 0; }
        .deck-interactive { display: none !important; }
        .deck-print-container { display: block !important; }
        .deck-print-slide {
          width: 100vw;
          height: 100vh;
          background: #0b1f3a !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          page-break-after: always;
          break-after: page;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 5rem;
          box-sizing: border-box;
          overflow: hidden;
          font-family: 'Inter','Segoe UI',system-ui,sans-serif;
          color: #ffffff;
        }
        .deck-print-slide:last-child { page-break-after: avoid; break-after: avoid; }
      }
    `}</style>

    {/* ── All-slides print container (hidden in browser, shown on print) ── */}
    <div className="deck-print-container" style={{ display: "none" }}>
      {slides.map((s, i) => (
        <div key={i} className="deck-print-slide">
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {s.render()}
          </div>
        </div>
      ))}
    </div>

    <div
      className="deck-interactive"
      style={{ position: "fixed", inset: 0, background: NAVY, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: WHITE, overflow: "hidden", display: "flex", flexDirection: "column" }}
      data-testid="investor-deck"
    >
      {/* Header */}
      <div style={{ flexShrink: 0, height: "3.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.8rem", color: WHITE, flexShrink: 0 }}>GG</div>
          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: SILVER }}>Guardian Group</span>
          <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 0.3rem" }}>·</span>
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>Strategic Overview</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>{current + 1} / {total}</span>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/downloads/strategic-overview.pptx?key=GUARDIAN_EXPORT_2026";
              a.download = "guardian-group-strategic-overview.pptx";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            data-testid="button-download-pptx"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(240,165,0,0.12)", border: `1px solid ${GOLD}`, borderRadius: "6px", padding: "0.3rem 0.75rem", cursor: "pointer", color: GOLD, fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(240,165,0,0.25)"; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(240,165,0,0.12)"; }}
          >
            <Download size={13} /> Download PPTX
          </button>
          <button
            onClick={() => window.print()}
            data-testid="button-download-pdf"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(13,143,164,0.15)", border: `1px solid ${TEAL}`, borderRadius: "6px", padding: "0.3rem 0.75rem", cursor: "pointer", color: TEAL_LIGHT, fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit", transition: "all 0.2s" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(13,143,164,0.3)"; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(13,143,164,0.15)"; }}
          >
            <Download size={13} /> Download PDF
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ flexShrink: 0, height: "3px", background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", background: TEAL, width: `${((current + 1) / total) * 100}%`, transition: "width 0.3s ease" }} />
      </div>

      {/* Slide area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <button onClick={goPrev} disabled={current === 0} data-testid="button-prev-slide" aria-label="Previous slide"
          style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: current === 0 ? "transparent" : "rgba(13,143,164,0.25)", border: `2px solid ${current === 0 ? "transparent" : TEAL}`, cursor: current === 0 ? "default" : "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", opacity: current === 0 ? 0 : 0.75, transition: "all 0.2s" }}
          onMouseEnter={(e) => { if (current > 0) { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = "1"; b.style.background = "rgba(13,143,164,0.5)"; }}}
          onMouseLeave={(e) => { if (current > 0) { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = "0.75"; b.style.background = "rgba(13,143,164,0.25)"; }}}
        >
          <span style={{ fontSize: "1.4rem", color: WHITE, lineHeight: 1, marginRight: "2px" }}>‹</span>
        </button>

        <div style={{ flex: 1, padding: "1.8rem 5rem", overflowY: "auto", display: "flex", flexDirection: "column" }} key={current}>
          {slide.render()}
        </div>

        <button onClick={goNext} disabled={current === total - 1} data-testid="button-next-slide" aria-label="Next slide"
          style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: current === total - 1 ? "transparent" : "rgba(13,143,164,0.25)", border: `2px solid ${current === total - 1 ? "transparent" : TEAL}`, cursor: current === total - 1 ? "default" : "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", opacity: current === total - 1 ? 0 : 0.75, transition: "all 0.2s" }}
          onMouseEnter={(e) => { if (current < total - 1) { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = "1"; b.style.background = "rgba(13,143,164,0.5)"; }}}
          onMouseLeave={(e) => { if (current < total - 1) { const b = e.currentTarget as HTMLButtonElement; b.style.opacity = "0.75"; b.style.background = "rgba(13,143,164,0.25)"; }}}
        >
          <span style={{ fontSize: "1.4rem", color: WHITE, lineHeight: 1, marginLeft: "2px" }}>›</span>
        </button>
      </div>

      {/* Dot nav */}
      <div style={{ flexShrink: 0, padding: "0.7rem 2rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", flexWrap: "wrap" }}>
        {slides.map((s, i) => (
          <button key={i} onClick={() => goTo(i)} data-testid={`dot-slide-${i + 1}`} title={`Slide ${i + 1}: ${s.section}`} aria-label={`Go to slide ${i + 1}`}
            style={{ width: i === current ? "20px" : "8px", height: "8px", borderRadius: "4px", background: i === current ? TEAL : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s ease" }}
          />
        ))}
      </div>
    </div>
    </>
  );
}
