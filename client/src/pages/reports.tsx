import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Filter,
  FileText,
  ShieldAlert,
  TrendingDown,
  GitPullRequest,
  Target,
  Info,
} from "lucide-react";
import type { Site, Company } from "@shared/schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── Tab 1: Compliance Gaps ──────────────────────────────────────────────────

interface GapSite {
  siteId: string;
  siteName: string;
  companyId: string;
  gaps: { module: string; missingTemplates: { templateId: string; templateName: string }[] }[];
}

function ComplianceGapsTab({ companyId, siteId }: { companyId: string; siteId: string }) {
  const params = new URLSearchParams();
  if (companyId !== "all") params.set("companyId", companyId);
  if (siteId !== "all") params.set("siteId", siteId);
  const url = `/api/reports/gaps${params.toString() ? `?${params}` : ""}`;

  const { data, isLoading } = useQuery<GapSite[]>({
    queryKey: ["/api/reports/gaps", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  if (isLoading) return <SkeletonRows />;
  if (!data || data.length === 0) {
    return <EmptyState icon={CheckCircle} title="No compliance gaps found" description="All required documents for the selected scope are fulfilled." />;
  }

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
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {site.siteName}
                </div>
                <Badge variant="destructive">{totalForSite} missing</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {site.gaps.map((gap) => (
                <div key={gap.module} className="rounded-md border p-3">
                  <div className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium border mb-2 ${MODULE_COLORS[gap.module] || "bg-muted text-muted-foreground"}`}>
                    {MODULE_LABELS[gap.module] || gap.module}
                  </div>
                  <ul className="space-y-1">
                    {gap.missingTemplates.map((tmpl) => (
                      <li key={tmpl.templateId} className="flex items-start gap-2 text-sm text-muted-foreground">
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

// ─── Tab 2: Expiry & Renewal Risk ───────────────────────────────────────────

interface ExpiryRiskItem {
  id: string;
  title: string;
  module: string;
  siteId: string;
  siteName: string;
  dateType: string;
  date: string;
  daysUntil: number;
  urgency: string;
  status: string;
  approvalStatus: string;
}

function ExpiryRiskTab({ companyId, siteId }: { companyId: string; siteId: string }) {
  const [window, setWindow] = useState("90");
  const [moduleFilter, setModuleFilter] = useState("all");

  const params = new URLSearchParams();
  if (companyId !== "all") params.set("companyId", companyId);
  if (siteId !== "all") params.set("siteId", siteId);
  params.set("window", window);
  if (moduleFilter !== "all") params.set("module", moduleFilter);
  const url = `/api/reports/expiry-risk?${params}`;

  const { data, isLoading } = useQuery<ExpiryRiskItem[]>({
    queryKey: ["/api/reports/expiry-risk", { companyId, siteId, window, moduleFilter }],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
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
            <SelectItem value="all">All overdue</SelectItem>
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
        <SkeletonRows />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No expiry risk in this window" description="No documents are overdue or expiring within the selected timeframe." />
      ) : (
        <div className="space-y-2">
          {data.map((item) => {
            const styles = getUrgencyStyles(item.urgency);
            const dateLabel = { expiry: "Expires", renewal: "Renewal due", review: "Review due" }[item.dateType] || "Due";
            const daysLabel = item.daysUntil < 0
              ? `${Math.abs(item.daysUntil)} days overdue`
              : item.daysUntil === 0
              ? "Due today"
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dateLabel}: {new Date(item.date).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Site Comparison ──────────────────────────────────────────────────

interface SiteComparisonItem {
  siteId: string;
  siteName: string;
  companyId: string;
  scores: Record<string, { score: number; total: number; compliant: number; overdue: number }>;
  overallScore: number;
  totalDocs: number;
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 90 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
    : score >= 70 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : score > 0 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score > 0 ? `${score}%` : "—"}
    </span>
  );
}

function SiteComparisonTab({ companyId }: { companyId: string }) {
  const params = new URLSearchParams();
  if (companyId !== "all") params.set("companyId", companyId);
  const url = `/api/reports/site-comparison${params.toString() ? `?${params}` : ""}`;

  const { data, isLoading } = useQuery<SiteComparisonItem[]>({
    queryKey: ["/api/reports/site-comparison", { companyId }],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  if (isLoading) return <SkeletonRows />;
  if (!data || data.length === 0) {
    return <EmptyState icon={Building2} title="No sites found" description="Select a company to compare site compliance scores." />;
  }

  const complianceMods = ["health_safety", "human_resources", "employment_law"];
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
                <th key={mod} className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                  {MODULE_LABELS[mod]}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Overall</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Total Docs</th>
            </tr>
          </thead>
          <tbody>
            {data.map((site, idx) => (
              <tr key={site.siteId} className={`border-b last:border-0 ${idx === 0 && site.overallScore < 90 ? "bg-red-50/50 dark:bg-red-900/10" : ""}`} data-testid={`row-site-${site.siteId}`}>
                <td className="px-4 py-3 font-medium">{site.siteName}</td>
                {complianceMods.map((mod) => {
                  const s = site.scores[mod] || { score: 0, total: 0 };
                  return (
                    <td key={mod} className="px-4 py-3 text-center">
                      <ScorePill score={s.score} />
                      {s.total > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{s.compliant}/{s.total}</p>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  <ScorePill score={site.overallScore} />
                </td>
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

// ─── Tab 4: Approval Pipeline ─────────────────────────────────────────────────

interface ApprovalPipelineItem {
  id: string;
  title: string;
  module: string;
  approvalStatus: string;
  siteId: string;
  siteName: string;
  uploaderName: string;
  daysWaiting: number;
  createdAt: string;
}

function ApprovalPipelineTab({ companyId, siteId }: { companyId: string; siteId: string }) {
  const params = new URLSearchParams();
  if (companyId !== "all") params.set("companyId", companyId);
  if (siteId !== "all") params.set("siteId", siteId);
  const url = `/api/reports/approval-pipeline${params.toString() ? `?${params}` : ""}`;

  const { data, isLoading } = useQuery<ApprovalPipelineItem[]>({
    queryKey: ["/api/reports/approval-pipeline", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  if (isLoading) return <SkeletonRows />;
  if (!data || data.length === 0) {
    return <EmptyState icon={CheckCircle} title="Pipeline is clear" description="No documents are currently awaiting approval." />;
  }

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

// ─── Tab 5: Deadline & Milestone Risk ────────────────────────────────────────

interface MilestoneRisk {
  caseId: string;
  caseReference: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  milestoneId: string;
  milestoneTitle: string;
  dueDate: string;
  daysUntil: number;
  isOverdue: boolean;
  urgency: string;
}

interface IncidentRisk {
  id: string;
  reference: string;
  title: string;
  siteId: string;
  siteName: string;
  severity: string;
  status: string;
  incidentDate: string;
  daysSinceReported: number;
  urgency: string;
}

interface DeadlineRiskData {
  milestoneRisks: MilestoneRisk[];
  incidentRisks: IncidentRisk[];
}

function DeadlineRiskTab({ companyId, siteId }: { companyId: string; siteId: string }) {
  const params = new URLSearchParams();
  if (companyId !== "all") params.set("companyId", companyId);
  if (siteId !== "all") params.set("siteId", siteId);
  const url = `/api/reports/deadline-risk${params.toString() ? `?${params}` : ""}`;

  const { data, isLoading } = useQuery<DeadlineRiskData>({
    queryKey: ["/api/reports/deadline-risk", { companyId, siteId }],
    queryFn: async () => {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  if (isLoading) return <SkeletonRows />;

  const milestones = data?.milestoneRisks || [];
  const incidents = data?.incidentRisks || [];
  const hasData = milestones.length > 0 || incidents.length > 0;

  if (!hasData) {
    return <EmptyState icon={Target} title="No deadline risks" description="No overdue or upcoming case milestones or unresolved incidents at risk." />;
  }

  const SEVERITY_COLORS: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    major: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    minor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

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
              const daysLabel = item.daysUntil < 0
                ? `${Math.abs(item.daysUntil)} days overdue`
                : item.daysUntil === 0 ? "Due today"
                : `Due in ${item.daysUntil} days`;
              return (
                <div key={item.milestoneId} className={`flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 ${styles.row}`} data-testid={`row-milestone-${item.milestoneId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.milestoneTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{item.caseReference}</span>
                      <span>·</span>
                      <span>{item.employeeName}</span>
                      <span>·</span>
                      <span>{item.siteName}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`${styles.badge} border-0 font-medium`}>{daysLabel}</Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due: {new Date(item.dueDate).toLocaleDateString("en-GB")}
                    </p>
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
                      <span>·</span>
                      <span>{item.siteName}</span>
                      <span>·</span>
                      <Badge className={`${SEVERITY_COLORS[item.severity] || "bg-muted text-muted-foreground"} border-0 text-xs py-0`}>
                        {item.severity}
                      </Badge>
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

// ─── Main Reports Page ───────────────────────────────────────────────────────

export default function Reports() {
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();
  const companyFilter = selectedCompany || "all";
  const siteFilter = selectedSiteId || "all";
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const setSiteFilter = (val: string) => setSelectedSiteId(val === "all" ? null : val);

  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesData?.companies || [];

  const { data: allSites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const filteredSites = companyFilter === "all"
    ? allSites
    : allSites.filter((site) => site.companyId === companyFilter);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-muted-foreground">Compliance analytics and actionable insights</p>
        </div>
        <Button variant="outline" data-testid="button-export-report">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-5 dash-animate">
        <div className="flex flex-wrap gap-3">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-48" data-testid="select-company-filter">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-48" data-testid="select-site-filter">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {filteredSites.map((site) => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="gaps" className="space-y-5">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="gaps" className="gap-1.5" data-testid="tab-gaps">
              <AlertTriangle className="h-3.5 w-3.5" />
              Compliance Gaps
            </TabsTrigger>
            <TabsTrigger value="expiry" className="gap-1.5" data-testid="tab-expiry">
              <Calendar className="h-3.5 w-3.5" />
              Expiry Risk
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-1.5" data-testid="tab-comparison">
              <Building2 className="h-3.5 w-3.5" />
              Site Comparison
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5" data-testid="tab-pipeline">
              <GitPullRequest className="h-3.5 w-3.5" />
              Approval Pipeline
            </TabsTrigger>
            <TabsTrigger value="deadline" className="gap-1.5" data-testid="tab-deadline">
              <Target className="h-3.5 w-3.5" />
              Deadline Risk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gaps">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Compliance Gap Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComplianceGapsTab companyId={companyFilter} siteId={siteFilter} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expiry">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Expiry & Renewal Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpiryRiskTab companyId={companyFilter} siteId={siteFilter} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Site Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SiteComparisonTab companyId={companyFilter} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitPullRequest className="h-4 w-4 text-purple-500" />
                  Approval Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalPipelineTab companyId={companyFilter} siteId={siteFilter} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deadline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-red-500" />
                  Deadline & Milestone Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DeadlineRiskTab companyId={companyFilter} siteId={siteFilter} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
