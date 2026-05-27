import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  exportComplianceGaps,
  exportExpiryRisk,
  exportSiteComparison,
  exportApprovalPipeline,
  exportDeadlineRisk,
  exportSummary,
  exportElCases,
} from "@/lib/export-pdf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Scale,
  ShieldAlert,
  TrendingDown,
  GitPullRequest,
  Target,
  Info,
} from "lucide-react";
import type { Site, Company } from "@shared/schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

type ReportId = "gaps" | "expiry" | "comparison" | "pipeline" | "deadline" | "el-cases";

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
  toolkit: "Toolkit",
};

const MODULE_COLORS: Record<string, string> = {
  health_safety: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  human_resources: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  employment_law: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800",
  training: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  support: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
};

function getUrgencyStyles(urgency: string) {
  switch (urgency) {
    case "overdue":
      return { badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", row: "border-l-4 border-l-red-500" };
    case "critical":
      return { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", row: "border-l-4 border-l-amber-500" };
    case "warning":
      return { badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", row: "border-l-4 border-l-yellow-400" };
    default:
      return { badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", row: "border-l-4 border-l-emerald-500" };
  }
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

// ─── API query builder ───────────────────────────────────────────────────────

function buildUrl(path: string, companyId: string, siteId: string, extra?: Record<string, string>) {
  const p = new URLSearchParams();
  if (companyId !== "all") p.set("companyId", companyId);
  if (siteId !== "all") p.set("siteId", siteId);
  if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
  return `${path}${p.toString() ? `?${p}` : ""}`;
}

// ─── Report: Compliance Gaps ─────────────────────────────────────────────────

interface GapSite {
  siteId: string; siteName: string; companyId: string;
  gaps: { module: string; missingTemplates: { templateId: string; templateName: string }[] }[];
}

function ComplianceGapsReport({ companyId, siteId }: { companyId: string; siteId: string }) {
  const { data, isLoading } = useQuery<GapSite[]>({
    queryKey: ["/api/reports/gaps", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/gaps", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  if (isLoading) return <FetchingOverlay />;
  if (!data || data.length === 0)
    return <EmptyState icon={CheckCircle} title="No compliance gaps found" description="All required documents for the selected scope are fulfilled." />;

  const totalMissing = data.reduce((s, site) => s + site.gaps.reduce((g, gap) => g + gap.missingTemplates.length, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{totalMissing}</span> required {totalMissing === 1 ? "document" : "documents"} missing across <span className="font-semibold">{data.length}</span> {data.length === 1 ? "site" : "sites"}.
        </p>
      </div>
      {data.map((site) => {
        const totalForSite = site.gaps.reduce((s, g) => s + g.missingTemplates.length, 0);
        return (
          <Card key={site.siteId}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {site.siteName}
              </div>
              <Badge variant="destructive">{totalForSite} missing</Badge>
            </div>
            <CardContent className="space-y-3 pt-0">
              {site.gaps.map((gap) => (
                <div key={gap.module} className="rounded-md border p-3">
                  <div className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium border mb-2 ${MODULE_COLORS[gap.module] || "bg-muted text-muted-foreground"}`}>
                    {MODULE_LABELS[gap.module] || gap.module}
                  </div>
                  <ul className="space-y-1">
                    {gap.missingTemplates.map((tmpl) => (
                      <li key={tmpl.templateId} className="flex items-start gap-2 text-sm text-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                        {tmpl.templateName}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Report: Expiry Risk ─────────────────────────────────────────────────────

interface ExpiryRiskItem {
  id: string; title: string; module: string; siteId: string; siteName: string;
  dateType: string; date: string; daysUntil: number; urgency: string;
}

function ExpiryRiskReport({ companyId, siteId }: { companyId: string; siteId: string }) {
  const [window, setWindow] = useState("90");
  const [moduleFilter, setModuleFilter] = useState("all");

  const { data, isLoading } = useQuery<ExpiryRiskItem[]>({
    queryKey: ["/api/reports/expiry-risk", { companyId, siteId, window, moduleFilter }],
    queryFn: async () => {
      const extra: Record<string, string> = { window };
      if (moduleFilter !== "all") extra.module = moduleFilter;
      const r = await fetch(buildUrl("/api/reports/expiry-risk", companyId, siteId, extra), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const overdue = data?.filter((d) => d.urgency === "overdue").length || 0;
  const critical = data?.filter((d) => d.urgency === "critical").length || 0;
  const warning = data?.filter((d) => d.urgency === "warning").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={window} onValueChange={setWindow}>
          <SelectTrigger className="w-40" data-testid="select-expiry-window">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="60">Next 60 days</SelectItem>
            <SelectItem value="90">Next 90 days</SelectItem>
            <SelectItem value="all">Overdue only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-44" data-testid="select-expiry-module">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="health_safety">Health & Safety</SelectItem>
            <SelectItem value="human_resources">Human Resources</SelectItem>
            <SelectItem value="employment_law">Employment Law</SelectItem>
            <SelectItem value="training">Training</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isLoading && data && data.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{overdue}</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Overdue</p>
          </div>
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{critical}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Within 30 days</p>
          </div>
          <div className="rounded-md border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{warning}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">31–90 days</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <FetchingOverlay />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No expiry risk in this window" description="No documents are overdue or expiring within the selected timeframe." />
      ) : (
        <div className="space-y-2">
          {data.map((item) => {
            const styles = getUrgencyStyles(item.urgency);
            const dateLabel = { expiry: "Expires", renewal: "Renewal due", review: "Review due" }[item.dateType] || "Due";
            const daysLabel = item.daysUntil < 0
              ? `${Math.abs(item.daysUntil)} days overdue`
              : item.daysUntil === 0 ? "Due today"
              : `${item.daysUntil} days remaining`;
            return (
              <div key={item.id} className={`flex items-center justify-between rounded-md border bg-card px-4 py-3 gap-3 ${styles.row}`} data-testid={`row-expiry-${item.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${MODULE_COLORS[item.module] || "bg-muted text-muted-foreground"}`}>
                      {MODULE_LABELS[item.module] || item.module}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.siteName}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={`${styles.badge} border-0 font-medium`}>{daysLabel}</Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}: {new Date(item.date).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Report: Site Comparison ─────────────────────────────────────────────────

interface SiteComparisonItem {
  siteId: string; siteName: string; companyId: string;
  scores: Record<string, { score: number; total: number; compliant: number; overdue: number }>;
  overallScore: number; totalDocs: number;
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 90 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
    : score >= 70 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : score > 0 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{score > 0 ? `${score}%` : "—"}</span>;
}

function SiteComparisonReport({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery<SiteComparisonItem[]>({
    queryKey: ["/api/reports/site-comparison", { companyId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/site-comparison", companyId, "all"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  if (isLoading) return <FetchingOverlay />;
  if (!data || data.length === 0)
    return <EmptyState icon={Building2} title="No sites found" description="Select a company to compare site compliance scores." />;

  const complianceMods = ["health_safety", "human_resources", "employment_law"] as const;
  const lowestSite = [...data].sort((a, b) => a.overallScore - b.overallScore)[0];

  return (
    <div className="space-y-4">
      {lowestSite && lowestSite.overallScore < 90 && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-300">
            Lowest performing site: <span className="font-semibold">{lowestSite.siteName}</span> — overall score {lowestSite.overallScore}%.
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site</th>
              {complianceMods.map((mod) => (
                <th key={mod} className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">{MODULE_LABELS[mod]}</th>
              ))}
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Overall</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Docs</th>
            </tr>
          </thead>
          <tbody>
            {data.map((site, idx) => (
              <tr key={site.siteId} className={`border-b last:border-0 ${idx === 0 && site.overallScore < 90 ? "bg-red-50/50 dark:bg-red-900/10" : ""}`} data-testid={`row-site-${site.siteId}`}>
                <td className="px-4 py-3 font-medium">{site.siteName}</td>
                {complianceMods.map((mod) => {
                  const s = site.scores[mod] || { score: 0, total: 0, compliant: 0 };
                  return (
                    <td key={mod} className="px-4 py-3 text-center">
                      <ScorePill score={s.score} />
                      {s.total > 0 && <p className="text-xs text-muted-foreground mt-0.5">{s.compliant}/{s.total}</p>}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center"><ScorePill score={site.overallScore} /></td>
                <td className="px-4 py-3 text-center text-muted-foreground">{site.totalDocs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />≥90% Good</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />70–89% Attention</div>
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />&lt;70% Critical</div>
        <div className="flex items-center gap-1.5"><Info className="h-3 w-3" />Sorted by lowest score first</div>
      </div>
    </div>
  );
}

// ─── Report: Approval Pipeline ────────────────────────────────────────────────

interface ApprovalPipelineItem {
  id: string; title: string; module: string; approvalStatus: string;
  siteId: string; siteName: string; uploaderName: string; daysWaiting: number; createdAt: string;
}

function ApprovalPipelineReport({ companyId, siteId }: { companyId: string; siteId: string }) {
  const { data, isLoading } = useQuery<ApprovalPipelineItem[]>({
    queryKey: ["/api/reports/approval-pipeline", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/approval-pipeline", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  if (isLoading) return <FetchingOverlay />;
  if (!data || data.length === 0)
    return <EmptyState icon={CheckCircle} title="Pipeline is clear" description="No documents are currently awaiting approval." />;

  const pendingCount = data.filter((d) => d.approvalStatus === "pending").length;
  const clientSignedCount = data.filter((d) => d.approvalStatus === "client_signed_off").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="rounded-md border px-4 py-3 flex items-center gap-3">
          <Clock className="h-4 w-4 text-amber-500" />
          <div>
            <p className="text-lg font-semibold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting first review</p>
          </div>
        </div>
        <div className="rounded-md border px-4 py-3 flex items-center gap-3">
          <CheckCircle className="h-4 w-4 text-blue-500" />
          <div>
            <p className="text-lg font-semibold">{clientSignedCount}</p>
            <p className="text-xs text-muted-foreground">Client signed off</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((item) => {
          const isStale = item.daysWaiting >= 7;
          return (
            <div key={item.id} className={`flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 ${isStale ? "border-l-4 border-l-amber-500" : ""}`} data-testid={`row-pipeline-${item.id}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${MODULE_COLORS[item.module] || "bg-muted text-muted-foreground"}`}>
                    {MODULE_LABELS[item.module] || item.module}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.siteName}</span>
                  <span className="text-xs text-muted-foreground">by {item.uploaderName}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant={item.approvalStatus === "client_signed_off" ? "default" : "secondary"} className="text-xs mb-1">
                  {item.approvalStatus === "client_signed_off" ? "Client signed off" : "Pending"}
                </Badge>
                <p className={`text-sm font-semibold ${item.daysWaiting >= 14 ? "text-red-600 dark:text-red-400" : item.daysWaiting >= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {item.daysWaiting === 0 ? "Today" : `${item.daysWaiting}d waiting`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Report: Deadline Risk ────────────────────────────────────────────────────

interface MilestoneRisk {
  caseId: string; caseReference: string; employeeName: string; siteId: string; siteName: string;
  milestoneId: string; milestoneTitle: string; dueDate: string; daysUntil: number; isOverdue: boolean; urgency: string;
}
interface IncidentRisk {
  id: string; reference: string; title: string; siteId: string; siteName: string;
  severity: string; status: string; incidentDate: string; daysSinceReported: number; urgency: string;
}
interface DeadlineRiskData { milestoneRisks: MilestoneRisk[]; incidentRisks: IncidentRisk[]; }

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  major: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function DeadlineRiskReport({ companyId, siteId }: { companyId: string; siteId: string }) {
  const { data, isLoading } = useQuery<DeadlineRiskData>({
    queryKey: ["/api/reports/deadline-risk", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/deadline-risk", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  if (isLoading) return <FetchingOverlay />;
  const milestones = data?.milestoneRisks || [];
  const incidents = data?.incidentRisks || [];
  if (milestones.length === 0 && incidents.length === 0)
    return <EmptyState icon={Target} title="No deadline risks" description="No overdue or upcoming case milestones or unresolved incidents at risk." />;

  return (
    <div className="space-y-6">
      {milestones.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            Case Milestones ({milestones.length})
          </h3>
          <div className="space-y-2">
            {milestones.map((item) => {
              const styles = getUrgencyStyles(item.urgency);
              const daysLabel = item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} days overdue` : item.daysUntil === 0 ? "Due today" : `Due in ${item.daysUntil} days`;
              return (
                <div key={item.milestoneId} className={`flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 ${styles.row}`} data-testid={`row-milestone-${item.milestoneId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.milestoneTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{item.caseReference}</span>
                      <span>·</span><span>{item.employeeName}</span>
                      <span>·</span><span>{item.siteName}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`${styles.badge} border-0 font-medium`}>{daysLabel}</Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">Due: {new Date(item.dueDate).toLocaleDateString("en-GB")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {incidents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Unresolved Incidents ({incidents.length})
          </h3>
          <div className="space-y-2">
            {incidents.map((item) => {
              const styles = getUrgencyStyles(item.urgency);
              return (
                <div key={item.id} className={`flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 ${styles.row}`} data-testid={`row-incident-${item.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{item.reference}</span>
                      <span>·</span><span>{item.siteName}</span>
                      <span>·</span>
                      <Badge className={`${SEVERITY_COLORS[item.severity] || "bg-muted text-muted-foreground"} border-0 text-xs py-0`}>{item.severity}</Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${item.urgency === "overdue" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {item.daysSinceReported}d open
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{item.status.replace("_", " ")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report: EL Case Status ───────────────────────────────────────────────────

interface ElCaseRow {
  id: string;
  caseReference: string;
  caseName: string;
  caseType: "tribunal_claim" | "acas_conciliation";
  status: string;
  sources: string[];
  siteId: string;
  siteName: string;
  responseDeadline: string | null;
  responseDeadlineOverdue: boolean;
  hearingDate: string | null;
  overdueCount: number;
  upcomingCount: number;
  checklistTotal: number;
  checklistCompleted: number;
  createdAt: string;
}

interface ElCasesData {
  cases: ElCaseRow[];
  metrics: { total: number; overdue: number; upcoming: number; responseOverdue: number };
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  under_investigation: "Under Investigation",
  hearing_scheduled: "Hearing Scheduled",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  under_investigation: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  hearing_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

function ElCasesReport({ companyId, siteId }: { companyId: string; siteId: string }) {
  const { data, isLoading } = useQuery<ElCasesData>({
    queryKey: ["/api/reports/el-cases", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/el-cases", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: sourcesData = [] } = useQuery<{ code: string; label: string }[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const r = await fetch("/api/sources", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const sourceLabelMap = Object.fromEntries(sourcesData.map((s) => [s.code, s.label]));

  const now = new Date();

  if (isLoading) return <FetchingOverlay />;
  if (!data || data.cases.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No live employment law cases"
        description="All cases are closed, resolved, or none have been created for the selected scope."
      />
    );
  }

  const { metrics, cases } = data;

  return (
    <div className="space-y-5">
      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4" data-testid="metric-el-total">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Live Cases</p>
          <p className="text-3xl font-bold">{metrics.total}</p>
        </div>
        <div className={`rounded-lg border p-4 ${metrics.overdue > 0 ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10" : "bg-card"}`} data-testid="metric-el-overdue">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Overdue Items</p>
          <p className={`text-3xl font-bold ${metrics.overdue > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{metrics.overdue}</p>
        </div>
        <div className={`rounded-lg border p-4 ${metrics.upcoming > 0 ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10" : "bg-card"}`} data-testid="metric-el-upcoming">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Due in 14 Days</p>
          <p className={`text-3xl font-bold ${metrics.upcoming > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{metrics.upcoming}</p>
        </div>
        <div className={`rounded-lg border p-4 ${metrics.responseOverdue > 0 ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10" : "bg-card"}`} data-testid="metric-el-response-overdue">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Response Overdue</p>
          <p className={`text-3xl font-bold ${metrics.responseOverdue > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{metrics.responseOverdue}</p>
        </div>
      </div>

      {/* Case rows */}
      <div className="space-y-3">
        {cases.map((c) => {
          const checklistPct = c.checklistTotal > 0
            ? Math.round((c.checklistCompleted / c.checklistTotal) * 100)
            : null;
          const borderClass = c.overdueCount > 0
            ? "border-l-4 border-l-red-500"
            : c.upcomingCount > 0
            ? "border-l-4 border-l-amber-400"
            : "border-l-4 border-l-emerald-400";

          return (
            <Card key={c.id} className={`overflow-hidden ${borderClass}`} data-testid={`card-el-case-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  {/* Left: ref + name + site */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                        {c.caseReference}
                      </span>
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
                        {c.caseType === "tribunal_claim" ? "ET Claim" : "ACAS"}
                      </span>
                    </div>
                    <p className="font-medium text-sm leading-snug">{c.caseName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {c.siteName}
                    </div>
                    {c.sources && c.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.sources.map((s) => (
                          <span key={s} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {sourceLabelMap[s] ?? s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: deadline + counts */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5 text-xs">
                    {c.responseDeadline && (
                      <div className={`flex items-center gap-1 font-medium ${c.responseDeadlineOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                        <Calendar className="h-3 w-3" />
                        {c.responseDeadlineOverdue ? "Response overdue" : "Response by"}{" "}
                        {new Date(c.responseDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                    {c.hearingDate && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        Hearing{" "}
                        {new Date(c.hearingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.overdueCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          {c.overdueCount} overdue
                        </span>
                      )}
                      {c.upcomingCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          {c.upcomingCount} upcoming
                        </span>
                      )}
                      {c.overdueCount === 0 && c.upcomingCount === 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          On track
                        </span>
                      )}
                    </div>
                    {checklistPct !== null && (
                      <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${checklistPct === 100 ? "bg-emerald-500" : checklistPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${checklistPct}%` }}
                          />
                        </div>
                        <span>{c.checklistCompleted}/{c.checklistTotal} docs</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary data hooks (for tiles) ──────────────────────────────────────────

function useTileSummaries(companyId: string, siteId: string) {
  const gaps = useQuery<GapSite[]>({
    queryKey: ["/api/reports/gaps", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/gaps", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const expiry = useQuery<ExpiryRiskItem[]>({
    queryKey: ["/api/reports/expiry-risk", { companyId, siteId, window: "90", moduleFilter: "all" }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/expiry-risk", companyId, siteId, { window: "90" }), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const pipeline = useQuery<ApprovalPipelineItem[]>({
    queryKey: ["/api/reports/approval-pipeline", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/approval-pipeline", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const deadline = useQuery<DeadlineRiskData>({
    queryKey: ["/api/reports/deadline-risk", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/deadline-risk", companyId, siteId), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const comparison = useQuery<SiteComparisonItem[]>({
    queryKey: ["/api/reports/site-comparison", { companyId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/site-comparison", companyId, "all"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const elCases = useQuery<ElCasesData>({
    queryKey: ["/api/reports/el-cases", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(buildUrl("/api/reports/el-cases", companyId, siteId), { credentials: "include" });
      if (!r.ok) {
        if (r.status === 403) return { cases: [], metrics: { total: 0, overdue: 0, upcoming: 0, responseOverdue: 0 } };
        throw new Error("Failed");
      }
      return r.json();
    },
  });

  return { gaps, expiry, pipeline, deadline, comparison, elCases };
}

// ─── Report tile config ───────────────────────────────────────────────────────

function MetricNumber({ value, loading, danger }: { value: number | undefined; loading: boolean; danger?: boolean }) {
  if (loading) return <Skeleton className="h-8 w-12 rounded" />;
  return (
    <span className={`text-3xl font-bold ${danger && value && value > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
      {value ?? "—"}
    </span>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

export default function Reports() {
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();
  const { user } = useAuth();
  // companyFilter holds the company NAME (same convention as all other pages)
  const companyFilter = selectedCompany || "all";
  const siteFilter = selectedSiteId || "all";
  // Store company name in global state (not UUID) so other pages stay in sync
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const setSiteFilter = (val: string) => setSelectedSiteId(val === "all" ? null : val);

  const isAdmin = user?.role === "admin";
  const isCaseAdvocate = isAdmin || (user?.role === "consultant" && (user?.consultantPermissions as any)?.caseAdvocate === true);
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, coverageSitesUrl, coverageQueryKey, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();

  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({ queryKey: ["/api/companies?limit=1000"] });
  const companies = companiesData?.companies || [];
  const { data: allSites = [] } = useQuery<Site[]>({
    queryKey: coverageQueryKey,
    queryFn: coverageSitesUrl !== "/api/sites" ? async () => {
      const res = await fetch(coverageSitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    } : undefined,
  });

  // Derive company ID from the company name for API calls
  const companyId = companyFilter === "all"
    ? "all"
    : (companies.find((c) => c.name === companyFilter)?.id ?? "all");

  const filteredSites = companyFilter === "all"
    ? allSites
    : allSites.filter((s) => s.companyId === companyId);

  const summaries = useTileSummaries(companyId, siteFilter);

  // Selected company name for PDF export — companyFilter IS the name already
  const selectedCompanyName = companyFilter === "all" ? undefined : companyFilter;

  // Derived summary metrics for tiles
  const gapCount = summaries.gaps.data?.reduce((s, site) => s + site.gaps.reduce((g, gap) => g + gap.missingTemplates.length, 0), 0) ?? 0;
  const gapSiteCount = summaries.gaps.data?.length ?? 0;
  const expiryCount = summaries.expiry.data?.length ?? 0;
  const expiryOverdue = summaries.expiry.data?.filter((d) => d.urgency === "overdue").length ?? 0;
  const pipelineCount = summaries.pipeline.data?.length ?? 0;
  const deadlineCount = (summaries.deadline.data?.milestoneRisks.length ?? 0) + (summaries.deadline.data?.incidentRisks.length ?? 0);
  const comparisonCount = summaries.comparison.data?.length ?? 0;
  const lowestScore = summaries.comparison.data?.length
    ? Math.min(...summaries.comparison.data.map((s) => s.overallScore))
    : null;

  const REPORT_TILES: {
    id: ReportId;
    icon: React.ElementType;
    iconColor: string;
    title: string;
    description: string;
    metric: React.ReactNode;
    metricLabel: string;
    accentColor: string;
  }[] = [
    {
      id: "gaps",
      icon: AlertTriangle,
      iconColor: "text-amber-600 dark:text-amber-400",
      title: "Compliance Gaps",
      description: "Required documents that are missing or unfulfilled across your sites.",
      metric: <MetricNumber value={gapCount} loading={summaries.gaps.isLoading} danger />,
      metricLabel: `missing across ${gapSiteCount} ${gapSiteCount === 1 ? "site" : "sites"}`,
      accentColor: "hover:border-amber-400 dark:hover:border-amber-600",
    },
    {
      id: "expiry",
      icon: Calendar,
      iconColor: "text-blue-600 dark:text-blue-400",
      title: "Expiry & Renewal Risk",
      description: "Documents expiring or due for renewal within the next 90 days.",
      metric: <MetricNumber value={expiryCount} loading={summaries.expiry.isLoading} danger={expiryOverdue > 0} />,
      metricLabel: expiryOverdue > 0 ? `${expiryOverdue} overdue` : "at risk in 90 days",
      accentColor: "hover:border-blue-400 dark:hover:border-blue-600",
    },
    {
      id: "comparison",
      icon: Building2,
      iconColor: "text-primary",
      title: "Site Comparison",
      description: "Side-by-side compliance score comparison across all sites by module.",
      metric: <MetricNumber value={comparisonCount} loading={summaries.comparison.isLoading} />,
      metricLabel: lowestScore !== null ? `lowest score ${lowestScore}%` : "sites tracked",
      accentColor: "hover:border-primary/50",
    },
    {
      id: "pipeline",
      icon: GitPullRequest,
      iconColor: "text-purple-600 dark:text-purple-400",
      title: "Approval Pipeline",
      description: "Documents currently awaiting consultant or client approval, sorted by wait time.",
      metric: <MetricNumber value={pipelineCount} loading={summaries.pipeline.isLoading} danger />,
      metricLabel: "awaiting approval",
      accentColor: "hover:border-purple-400 dark:hover:border-purple-600",
    },
    {
      id: "deadline",
      icon: Target,
      iconColor: "text-red-600 dark:text-red-400",
      title: "Deadline & Milestone Risk",
      description: "Overdue case milestones and unresolved incidents past their resolution window.",
      metric: <MetricNumber value={deadlineCount} loading={summaries.deadline.isLoading} danger />,
      metricLabel: "active risks",
      accentColor: "hover:border-red-400 dark:hover:border-red-600",
    },
    ...(isCaseAdvocate ? [{
      id: "el-cases" as ReportId,
      icon: Scale,
      iconColor: "text-pink-600 dark:text-pink-400",
      title: "EL Case Status",
      description: "Live employment law cases — response deadlines, overdue items, and upcoming milestones.",
      metric: <MetricNumber value={summaries.elCases.data?.metrics.total} loading={summaries.elCases.isLoading} />,
      metricLabel: summaries.elCases.data?.metrics.overdue
        ? `${summaries.elCases.data.metrics.overdue} overdue item${summaries.elCases.data.metrics.overdue !== 1 ? "s" : ""}`
        : "live cases",
      accentColor: "hover:border-pink-400 dark:hover:border-pink-600",
    }] : []),
  ];

  const REPORT_COMPONENTS: Record<ReportId, React.ReactNode> = {
    gaps: <ComplianceGapsReport companyId={companyId} siteId={siteFilter} />,
    expiry: <ExpiryRiskReport companyId={companyId} siteId={siteFilter} />,
    comparison: <SiteComparisonReport companyId={companyId} />,
    pipeline: <ApprovalPipelineReport companyId={companyId} siteId={siteFilter} />,
    deadline: <DeadlineRiskReport companyId={companyId} siteId={siteFilter} />,
    "el-cases": <ElCasesReport companyId={companyId} siteId={siteFilter} />,
  };

  const activeTile = REPORT_TILES.find((t) => t.id === activeReport);

  async function handleExport() {
    setIsExporting(true);
    try {
      const fetchJson = async (path: string) => {
        const r = await fetch(path, { credentials: "include" });
        if (!r.ok) throw new Error("Failed to fetch " + path);
        return r.json();
      };

      if (!activeReport) {
        await exportSummary({
          gapCount,
          gapSiteCount,
          expiryCount,
          expiryOverdue,
          pipelineCount,
          deadlineCount,
          comparisonCount,
          lowestScore,
          companyName: selectedCompanyName,
        });
      } else if (activeReport === "gaps") {
        const data = summaries.gaps.data ?? await fetchJson(buildUrl("/api/reports/gaps", companyId, siteFilter));
        await exportComplianceGaps(data, selectedCompanyName);
      } else if (activeReport === "expiry") {
        const data = summaries.expiry.data ?? await fetchJson(buildUrl("/api/reports/expiry-risk", companyId, siteFilter, { window: "90" }));
        await exportExpiryRisk(data, "next 90 days", selectedCompanyName);
      } else if (activeReport === "comparison") {
        const data = summaries.comparison.data ?? await fetchJson(buildUrl("/api/reports/site-comparison", companyId, "all"));
        await exportSiteComparison(data, selectedCompanyName);
      } else if (activeReport === "pipeline") {
        const data = summaries.pipeline.data ?? await fetchJson(buildUrl("/api/reports/approval-pipeline", companyId, siteFilter));
        await exportApprovalPipeline(data, selectedCompanyName);
      } else if (activeReport === "deadline") {
        const data = summaries.deadline.data ?? await fetchJson(buildUrl("/api/reports/deadline-risk", companyId, siteFilter));
        await exportDeadlineRisk(data.milestoneRisks ?? [], data.incidentRisks ?? [], selectedCompanyName);
      } else if (activeReport === "el-cases") {
        const [data, sourcesData] = await Promise.all([
          fetchJson(buildUrl("/api/reports/el-cases", companyId, siteFilter)),
          fetchJson("/api/sources"),
        ]);
        const sourceMap: Record<string, string> = Object.fromEntries(
          (sourcesData as { code: string; label: string }[]).map((s) => [s.code, s.label])
        );
        await exportElCases(data, sourceMap, selectedCompanyName);
      }
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="theme-reports flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div className="flex items-center gap-3">
          {activeReport ? (
            <Button variant="ghost" size="icon" onClick={() => setActiveReport(null)} className="shrink-0" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="p-2 rounded-lg bg-module-accent/10 shrink-0">
              <BarChart3 className="h-6 w-6 text-module-accent" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold">
              {activeReport ? activeTile?.title : "Reports"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {activeReport ? activeTile?.description : "Compliance intelligence across your sites"}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={isExporting} data-testid="button-export-report">
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting…" : "Export PDF"}
        </Button>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-5 dash-animate">
        {/* Filters — always visible */}
        <div className="flex flex-wrap gap-3">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-48" data-testid="select-company-filter">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeReport !== "comparison" && (
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-48" data-testid="select-site-filter">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {filteredSites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasCoverage && (
            <Select
              value={coverageFilter}
              onValueChange={(v) => { setCoverageFilter(v); setCompanyFilter("all"); setSiteFilter("all"); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-reports">
                <span className="truncate pointer-events-none">
                  {coverageFilter === "my"
                    ? "My client sites"
                    : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my">My client sites</SelectItem>
                {coveringFor.map(c => (
                  <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-reports-${c.absentConsultantId}`}>
                    {c.absentConsultantName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isProConsultant && (
            <Select
              value={proStaffFilter}
              onValueChange={(v) => { setProStaffFilter(v); setCompanyFilter("all"); setSiteFilter("all"); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-pro-staff-filter-reports">
                <span className="truncate pointer-events-none">
                  {proStaffFilter === "my"
                    ? "My client sites"
                    : proStaffFilter === "all"
                      ? "All client sites"
                      : (myStaff.find(s => s.id === proStaffFilter)?.fullName ?? "Staff") + "'s client sites"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my">My client sites</SelectItem>
                <SelectItem value="all">All client sites</SelectItem>
                {myStaff.map(s => (
                  <SelectItem key={s.id} value={s.id} data-testid={`pro-staff-filter-reports-${s.id}`}>
                    {s.fullName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Landing: tile grid */}
        {!activeReport && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_TILES.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setActiveReport(tile.id)}
                data-testid={`tile-report-${tile.id}`}
                className={`group text-left rounded-lg border bg-card p-5 transition-all duration-150 ${tile.accentColor} hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-md bg-muted ${tile.iconColor}`}>
                    <tile.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </div>
                <p className="font-semibold text-base mb-1">{tile.title}</p>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{tile.description}</p>
                <div className="flex items-baseline gap-2">
                  {tile.metric}
                  <span className="text-sm text-muted-foreground">{tile.metricLabel}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Drill-down: full report */}
        {activeReport && (
          <div>
            {REPORT_COMPONENTS[activeReport]}
          </div>
        )}
      </div>
    </div>
  );
}
