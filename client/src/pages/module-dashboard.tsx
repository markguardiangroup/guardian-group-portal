import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RAGBadge, ApprovalBadge } from "@/components/rag-badge";
import { SiteCombobox } from "@/components/site-combobox";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Calendar,
  HardHat,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import type { ComplianceSummary, Document, AuditLog, ModuleType, Site } from "@shared/schema";
import { moduleConfig } from "@shared/schema";

interface ModuleDashboardData {
  summary: ComplianceSummary;
  recentDocuments: Document[];
  recentActivity: AuditLog[];
  upcomingReviews: Document[];
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  testId,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
  testId?: string;
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${variantStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold" data-testid={testId ? `${testId}-value` : undefined}>{value}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{description}</span>
          {trend && (
            <span className={`flex items-center gap-0.5 ${trend.isPositive ? "text-emerald-600" : "text-red-600"}`}>
              <TrendingUp className={`h-3 w-3 ${!trend.isPositive && "rotate-180"}`} />
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceScoreCard({ score, moduleName }: { score: number; moduleName: string }) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card data-testid="card-module-compliance-score">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {moduleName} Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold ${getScoreColor(score)}`} data-testid="text-module-compliance-score">
            {score}%
          </span>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full transition-all ${getScoreBg(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ModuleDashboardProps {
  module: ModuleType;
}

export default function ModuleDashboard({ module }: ModuleDashboardProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";
  const ModuleIcon = module === "health_safety" ? HardHat : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : "theme-hr";
  
  const canSelectSites = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for admin/consultant users
  const { data: sites, isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: canSelectSites,
  });
  
  // Determine which site to show data for
  // "all" means show data across all sites
  const siteId = user?.role === "client" 
    ? user?.siteId 
    : (selectedSiteId === "all" ? null : (selectedSiteId || null));

  const { data, isLoading } = useQuery<ModuleDashboardData>({
    queryKey: ["/api/dashboard", module, siteId],
    queryFn: async () => {
      const url = siteId 
        ? `/api/dashboard/${module}?siteId=${siteId}`
        : `/api/dashboard/${module}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  const currentSiteName = canSelectSites 
    ? (selectedSiteId === "all" || !selectedSiteId ? "All Clients" : sites?.find((s: Site) => s.id === siteId)?.name)
    : null;

  if (isLoading || isAuthLoading || (canSelectSites && sitesLoading)) {
    return (
      <div className="space-y-8 p-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-2 h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalDocuments: 0,
    compliantDocuments: 0,
    reviewRequired: 0,
    overdueDocuments: 0,
    pendingApprovals: 0,
    complianceScore: 0,
  };

  const getDocTypeLabel = (type: string) => {
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  return (
    <div className={`${themeClass}`}>
      {/* Module Header with tinted background */}
      <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ModuleIcon className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">{config.name}</h1>
              <p className="text-muted-foreground">
                Module compliance overview
                {currentSiteName && <span className="font-medium"> - {currentSiteName}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Site selector for admin/consultant oversight */}
            {canSelectSites && sites && sites.length > 0 && (
              <SiteCombobox
                sites={sites}
                value={selectedSiteId}
                onValueChange={setSelectedSiteId}
                className="w-56"
                testId="select-site-module-dashboard"
              />
            )}
            <Button variant="outline" asChild>
              <Link href={`${basePath}/documents`} data-testid="link-view-documents">
                <FileText className="mr-2 h-4 w-4" />
                View Documents
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-8">

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <ComplianceScoreCard score={summary.complianceScore} moduleName={config.shortName} />
        <MetricCard
          title="Total Documents"
          value={summary.totalDocuments}
          description="In this module"
          icon={FileText}
          testId="card-module-total-documents"
        />
        <MetricCard
          title="Compliant"
          value={summary.compliantDocuments}
          description="Up to date"
          icon={CheckCircle}
          variant="success"
          testId="card-module-compliant"
        />
        <MetricCard
          title="Review Required"
          value={summary.reviewRequired}
          description="Pending review"
          icon={Clock}
          variant="warning"
          testId="card-module-review"
        />
        <MetricCard
          title="Overdue"
          value={summary.overdueDocuments}
          description="Action needed"
          icon={AlertTriangle}
          variant="danger"
          testId="card-module-overdue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Recent Documents</CardTitle>
              <CardDescription>Latest {config.shortName} documents</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${basePath}/documents`} data-testid="link-view-all-documents">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.recentDocuments && data.recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                    data-testid={`card-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          v{doc.version} - {getDocTypeLabel(doc.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RAGBadge status={doc.status} />
                      <ApprovalBadge status={doc.approvalStatus} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No documents in this module
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.upcomingReviews && data.upcomingReviews.length > 0 ? (
              <div className="divide-y">
                {data.upcomingReviews.slice(0, 5).map((doc) => {
                  const reviewDate = doc.reviewDate ? new Date(doc.reviewDate) : null;
                  const daysUntil = reviewDate 
                    ? Math.ceil((reviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  
                  return (
                    <div key={doc.id} className="flex items-center gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {reviewDate && format(reviewDate, "MMM d, yyyy")}
                        </p>
                      </div>
                      {daysUntil !== null && (
                        <span className={`text-xs font-medium ${
                          daysUntil <= 7 
                            ? "text-red-600 dark:text-red-400" 
                            : daysUntil <= 14 
                            ? "text-amber-600 dark:text-amber-400" 
                            : "text-muted-foreground"
                        }`}>
                          {daysUntil <= 0 ? "Overdue" : `${daysUntil}d`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming reviews
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data?.recentActivity && data.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.recentActivity.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm">{log.details}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.userName} - {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
