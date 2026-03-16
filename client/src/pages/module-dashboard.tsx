import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RAGBadge, ApprovalBadge } from "@/components/rag-badge";
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";
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
  Building2,
  FileQuestion,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
import type { ComplianceSummary, Document, AuditLog, ModuleType } from "@shared/schema";
import { moduleConfig } from "@shared/schema";

interface SiteWithCompany {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  companySearchTag?: string | null;
  address: string | null;
  siteManager: string | null;
  contactPhone: string | null;
}

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
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange } = useSiteFilter();
  const [, navigate] = useLocation();
  
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "employment_law" ? "/employment-law" : "/human-resources";
  const ModuleIcon = module === "health_safety" ? HardHat : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : "theme-hr";
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (clients see their accessible sites)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can see the site filter to confirm their access (even with single site)
  const clientHasSites = isClientUser && sites && sites.length > 0;
  
  // Filter sites by selected company
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);
  
  // Determine which site(s) to show data for
  // Clients can now filter by site if they have multiple sites
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  // Get site IDs for selected company (for API filtering)
  // Use full sites list to get all sites for selected company
  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    if (selectedSiteId && selectedSiteId !== "all") return null; // Use specific site instead
    const companySites = sites.filter(s => s.companyName === selectedCompany);
    return companySites.map(s => s.id);
  }, [sites, selectedCompany, selectedSiteId]);
  
  // Create stable string key for company site IDs (avoid nested arrays in query keys)
  const companySiteIdsKey = companySiteIds?.join(",") || null;

  const { data, isLoading } = useQuery<ModuleDashboardData>({
    queryKey: ["/api/dashboard", module, siteId, companySiteIdsKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) {
        params.set("siteId", siteId);
      } else if (companySiteIds && companySiteIds.length > 0) {
        params.set("siteIds", companySiteIds.join(","));
      }
      const queryString = params.toString();
      const url = queryString 
        ? `/api/dashboard/${module}?${queryString}`
        : `/api/dashboard/${module}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  // Fetch documents for renewal date calculations
  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module],
  });
  
  // Calculate renewal compliance metrics
  const renewalMetrics = useMemo(() => {
    if (!documents) return { overdue: 0, due30Days: 0, due60Days: 0, upcomingRenewals: [] };
    
    const now = new Date();
    let overdue = 0;
    let due30Days = 0;
    let due60Days = 0;
    const upcomingRenewals: Document[] = [];
    
    // Filter by selected site/company if applicable
    const filteredDocs = documents.filter(doc => {
      if (doc.isArchived) return false;
      if (siteId) return doc.siteId === siteId;
      if (companySiteIds && companySiteIds.length > 0) {
        return companySiteIds.includes(doc.siteId);
      }
      return true;
    });
    
    filteredDocs.forEach(doc => {
      // Use renewalDate if set, otherwise fall back to expiryDate
      const trackingDate = doc.renewalDate || doc.expiryDate;
      if (!trackingDate) return;
      
      const renewalDate = new Date(trackingDate);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRenewal < 0) {
        overdue++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal <= 30) {
        due30Days++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal <= 60) {
        due60Days++;
        upcomingRenewals.push(doc);
      }
    });
    
    // Sort by renewal date (soonest first), falling back to expiryDate
    upcomingRenewals.sort((a, b) => {
      const trackA = a.renewalDate || a.expiryDate;
      const trackB = b.renewalDate || b.expiryDate;
      const dateA = trackA ? new Date(trackA).getTime() : Infinity;
      const dateB = trackB ? new Date(trackB).getTime() : Infinity;
      return dateA - dateB;
    });
    
    return { overdue, due30Days, due60Days, upcomingRenewals };
  }, [documents, siteId, companySiteIds]);
  
  // Build context description for display
  const currentContextName = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find((s) => s.id === selectedSiteId)?.name || null;
    }
    if (isPrivilegedUser) {
      if (selectedCompany && selectedCompany !== "all") {
        return `${selectedCompany} (all sites)`;
      }
      return "All Clients";
    }
    // For clients with multiple sites showing "all"
    if (clientHasSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasSites]);
  
  // Build URL for View Documents with filter context
  const viewDocumentsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSiteId && selectedSiteId !== "all") {
      params.set("siteId", selectedSiteId);
    } else if (selectedCompany && selectedCompany !== "all") {
      params.set("company", selectedCompany);
    }
    const queryString = params.toString();
    return queryString ? `${basePath}/documents?${queryString}` : `${basePath}/documents`;
  }, [basePath, selectedSiteId, selectedCompany]);

  const summary = data?.summary || {
    totalDocuments: 0,
    compliantDocuments: 0,
    reviewRequired: 0,
    overdueDocuments: 0,
    missingRequiredDocuments: 0,
    complianceScore: 0,
    allDocuments: 0,
    allCompliantDocuments: 0,
    allReviewRequired: 0,
    allOverdueDocuments: 0,
    pendingApprovals: 0,
    awaitingYourApproval: 0,
    awaitingOthersApproval: 0,
  };

  type DocsDialogFilter = "req_compliant" | "req_overdue" | "total" | "all_compliant" | "all_review" | "all_overdue";
  const [docsDialogFilter, setDocsDialogFilter] = useState<DocsDialogFilter | null>(null);

  const filteredModuleDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc => {
      if (doc.isArchived) return false;
      if (siteId) return doc.siteId === siteId;
      if (companySiteIds && companySiteIds.length > 0) return companySiteIds.includes(doc.siteId);
      return true;
    });
  }, [documents, siteId, companySiteIds]);

  const docsDialogDocs = useMemo((): Document[] => {
    if (!docsDialogFilter) return [];
    switch (docsDialogFilter) {
      case "req_compliant": return filteredModuleDocs.filter(d => d.isRequired && d.status === "compliant");
      case "req_overdue": return filteredModuleDocs.filter(d => d.isRequired && d.status === "overdue");
      case "total": return filteredModuleDocs;
      case "all_compliant": return filteredModuleDocs.filter(d => d.status === "compliant");
      case "all_review": return filteredModuleDocs.filter(d => d.status === "review_required");
      case "all_overdue": return filteredModuleDocs.filter(d => d.status === "overdue");
      default: return [];
    }
  }, [docsDialogFilter, filteredModuleDocs]);

  const docsDialogMeta: Record<DocsDialogFilter, { title: string }> = {
    req_compliant: { title: "Compliant (Required Documents)" },
    req_overdue: { title: "Overdue (Required Documents)" },
    total: { title: "All Documents" },
    all_compliant: { title: "All Compliant Documents" },
    all_review: { title: "Review Required" },
    all_overdue: { title: "All Overdue Documents" },
  };

  const statusColorMap: Record<string, string> = {
    compliant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    review_required: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (sites) sites.forEach(s => { map[s.id] = `${s.name}${s.companyName ? ` — ${s.companyName}` : ""}`; });
    return map;
  }, [sites]);

  const getDocTypeLabel = (type: string) => {
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  return (
    <div className={`${themeClass}`}>
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ModuleIcon className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">{config.name}</h1>
              <p className="text-muted-foreground">
                Module compliance overview
                {currentContextName && <span className="font-medium"> - {currentContextName}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Company and Site selectors - admin/consultant get both, clients with multiple sites get site selector */}
            {(isPrivilegedUser || clientHasSites) && sites && sites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isPrivilegedUser && (
                  <>
                    <CompanyCombobox
                      sites={sites}
                      value={selectedCompany}
                      onValueChange={handleCompanyChange}
                      className="w-44"
                      testId="select-company-module-dashboard"
                    />
                    <span className="text-muted-foreground">/</span>
                  </>
                )}
                <SiteCombobox
                  sites={isPrivilegedUser ? filteredSites : sites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-module-dashboard"
                />
              </div>
            )}
            <Button className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground" asChild>
              <Link href={viewDocumentsUrl} data-testid="link-view-documents">
                <FileText className="mr-2 h-4 w-4" />
                View Documents
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-8 dash-animate">

        {/* Compliance Section */}
        <Card data-testid="card-compliance-summary">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {config.shortName} Compliance
            </CardTitle>
            <CardDescription>Based on required documents only</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-md border p-3 text-center">
                    <Skeleton className="h-7 w-10 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <div className="rounded-md border p-3 text-center" data-testid="card-module-score">
                  <div className={`flex items-center justify-center gap-1 ${summary.complianceScore >= 90 ? "text-emerald-600 dark:text-emerald-400" : summary.complianceScore >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.complianceScore}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Score</p>
                </div>
                <button
                  onClick={() => summary.compliantDocuments > 0 && setDocsDialogFilter("req_compliant")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.compliantDocuments > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="card-module-compliant"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.compliantDocuments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Compliant</p>
                  {summary.compliantDocuments > 0 && <p className="text-xs text-emerald-500/70 mt-0.5">Click to view</p>}
                </button>
                <button
                  onClick={() => summary.overdueDocuments > 0 && setDocsDialogFilter("req_overdue")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.overdueDocuments > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="card-module-overdue"
                >
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.overdueDocuments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Overdue</p>
                  {summary.overdueDocuments > 0 && <p className="text-xs text-red-500/70 mt-0.5">Click to view</p>}
                </button>
                <div className="rounded-md border p-3 text-center" data-testid="card-module-missing">
                  <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                    <FileQuestion className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.missingRequiredDocuments || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Missing Required</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Progress Section */}
        <Card data-testid="card-document-progress">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Progress
            </CardTitle>
            <CardDescription>Status across all {config.shortName} documents</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-md border p-3 text-center">
                    <Skeleton className="h-7 w-10 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <button
                  onClick={() => summary.allDocuments > 0 && setDocsDialogFilter("total")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.allDocuments > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-total"
                >
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-semibold">{summary.allDocuments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                  {summary.allDocuments > 0 && <p className="text-xs text-muted-foreground/60 mt-0.5">Click to view</p>}
                </button>
                <button
                  onClick={() => summary.allCompliantDocuments > 0 && setDocsDialogFilter("all_compliant")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.allCompliantDocuments > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-compliant"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.allCompliantDocuments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Compliant</p>
                  {summary.allCompliantDocuments > 0 && <p className="text-xs text-emerald-500/70 mt-0.5">Click to view</p>}
                </button>
                <button
                  onClick={() => summary.allReviewRequired > 0 && setDocsDialogFilter("all_review")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.allReviewRequired > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-review"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.allReviewRequired}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Review Required</p>
                  {summary.allReviewRequired > 0 && <p className="text-xs text-amber-500/70 mt-0.5">Click to view</p>}
                </button>
                <button
                  onClick={() => summary.allOverdueDocuments > 0 && setDocsDialogFilter("all_overdue")}
                  className={`rounded-md border p-3 text-center w-full transition-colors ${summary.allOverdueDocuments > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-overdue"
                >
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary.allOverdueDocuments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Overdue</p>
                  {summary.allOverdueDocuments > 0 && <p className="text-xs text-red-500/70 mt-0.5">Click to view</p>}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Renewal Compliance Section */}
      <Card data-testid="card-renewal-compliance">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Renewal Compliance
              </CardTitle>
              <CardDescription>Documents approaching or past renewal dates</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`${basePath}/documents?renewal=30days`} data-testid="link-view-renewals">
                View All Renewals
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-renewals-overdue">{renewalMetrics.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue Renewals</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" data-testid="text-renewals-30days">{renewalMetrics.due30Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 30 Days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="text-renewals-60days">{renewalMetrics.due60Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 60 Days</p>
                </div>
              </div>
            </div>
            
            {renewalMetrics.upcomingRenewals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Documents Requiring Attention</h4>
                <div className="divide-y">
                  {renewalMetrics.upcomingRenewals.slice(0, 5).map((doc) => {
                    const trackingDate = doc.renewalDate || doc.expiryDate;
                    const renewalDate = trackingDate ? new Date(trackingDate) : null;
                    const daysUntilRenewal = renewalDate 
                      ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    
                    return (
                      <Link 
                        key={doc.id} 
                        href={`${basePath}/documents/${doc.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover-elevate rounded-md px-2 -mx-2"
                        data-testid={`link-renewal-doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.renewalDate ? "Renewal" : "Expires"}: {renewalDate && format(renewalDate, "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium whitespace-nowrap ${
                          daysUntilRenewal !== null && daysUntilRenewal < 0
                            ? "text-red-600 dark:text-red-400" 
                            : daysUntilRenewal !== null && daysUntilRenewal <= 30 
                            ? "text-amber-600 dark:text-amber-400" 
                            : "text-blue-600 dark:text-blue-400"
                        }`}>
                          {daysUntilRenewal !== null && daysUntilRenewal < 0 
                            ? `${Math.abs(daysUntilRenewal)}d overdue` 
                            : `${daysUntilRenewal}d remaining`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border p-4">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
                  </div>
                ))}
              </div>
            ) : data?.recentDocuments && data.recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => {
                      const docSite = sites?.find(s => s.id === doc.siteId);
                      if (docSite) {
                        setSelectedCompany(docSite.companyName || null);
                        setSelectedSiteId(docSite.id);
                      }
                      navigate(`${basePath}/documents/${doc.id}`);
                    }}
                    className="flex items-center justify-between gap-4 rounded-md border p-4 hover-elevate cursor-pointer"
                    data-testid={`link-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(() => {
                            const docSite = sites?.find(s => s.id === doc.siteId);
                            return docSite ? `${docSite.companyName} - ${docSite.name}` : null;
                          })()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          v{doc.version} - {getDocTypeLabel(doc.type)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RAGBadge status={doc.status} approvalStatus={doc.approvalStatus} />
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
            {isLoading ? (
              <div className="divide-y">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-8 shrink-0" />
                  </div>
                ))}
              </div>
            ) : data?.upcomingReviews && data.upcomingReviews.length > 0 ? (
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
      {/* Document list dialog */}
      <Dialog open={docsDialogFilter !== null} onOpenChange={(open) => { if (!open) setDocsDialogFilter(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-module-docs-list">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {docsDialogFilter ? docsDialogMeta[docsDialogFilter].title : ""} ({docsDialogDocs.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {docsDialogDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No documents to display.</p>
            ) : (
              docsDialogDocs.map((doc) => {
                const siteName = doc.siteId ? siteNameMap[doc.siteId] : null;
                const statusLabel = doc.status === "review_required" ? "Review Required" : doc.status === "overdue" ? "Overdue" : "Compliant";
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border p-3 gap-3 hover:bg-muted/40 cursor-pointer"
                    onClick={() => { setDocsDialogFilter(null); navigate(`${basePath}/documents/${doc.id}`); }}
                    data-testid={`row-module-doc-${doc.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      {siteName && <p className="text-xs text-muted-foreground truncate">{siteName}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusColorMap[doc.status] || "bg-muted text-muted-foreground"}`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
