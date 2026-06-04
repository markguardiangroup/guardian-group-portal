import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComplianceBadge, DocumentStatusBadge } from "@/components/rag-badge";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Calendar,
  HardHat,
  Users,
  FileQuestion,
  ShieldCheck,
  Scale,
  Briefcase,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
import type { ComplianceSummary, Document, ModuleType } from "@shared/schema";
import { moduleConfig } from "@shared/schema";
import { statusCounts, isCountableDoc } from "@/lib/doc-stats";

interface SiteWithCompany {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  companySearchTag?: string | null;
  address: string | null;

  contactPhone: string | null;
}

interface CompanyListItem {
  id: string;
  name: string;
  groupOwnerId?: string | null;
}

interface MissingRequiredTemplateDetail {
  templateId: string;
  templateName: string;
  module: string;
  requiresApproval: boolean;
  siteId: string;
  siteName: string;
  companyId: string;
  companyName: string;
  documentId?: string;
  documentStatus?: string;
  kind?: "template_slot" | "required_document";
}

interface ModuleDashboardData {
  summary: ComplianceSummary;
  recentDocuments: Document[];
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
  const { selectedCompany, selectedSiteId, selectedGroup } = useSiteFilter();
  const [, navigate] = useLocation();

  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "employment_law" ? "/employment-law" : "/human-resources";
  const ModuleIcon = module === "health_safety" ? HardHat : module === "employment_law" ? Scale : Users;
  const dashboardSubtitle = module === "health_safety"
    ? "Safety Document Compliance"
    : module === "human_resources"
    ? "HR Document Compliance"
    : "Legal Document Compliance";
  const themeClass = module === "health_safety" ? "theme-hs" : module === "employment_law" ? "theme-el" : "theme-hr";
  
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (clients see their accessible sites)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch companies for group scope filtering (only when a group is selected)
  const { data: companiesResp } = useQuery<{ companies: CompanyListItem[] }>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch(`/api/companies?limit=1000`, { credentials: "include" });
      return res.json();
    },
    enabled: selectedGroup !== "all",
  });
  const companies = companiesResp?.companies ?? [];

  // Set of company IDs that belong to the selected group (owner + members)
  const groupCompanyIds = useMemo(() => {
    if (selectedGroup === "all" || !companies.length) return null;
    const ids = companies
      .filter(c => c.id === selectedGroup || c.groupOwnerId === selectedGroup)
      .map(c => c.id);
    return ids.length > 0 ? new Set(ids) : null;
  }, [selectedGroup, companies]);
  
  // Determine which site(s) to show data for
  // Clients can now filter by site if they have multiple sites
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  // Get site IDs for selected company/group (for API filtering)
  const companySiteIds = useMemo(() => {
    if (!sites) return null;
    if (selectedSiteId && selectedSiteId !== "all") return null; // Use specific site instead
    if (groupCompanyIds) {
      let groupSites = sites.filter(s => groupCompanyIds.has(s.companyId));
      if (selectedCompany && selectedCompany !== "all") {
        groupSites = groupSites.filter(s => s.companyName === selectedCompany);
      }
      return groupSites.map(s => s.id);
    }
    if (!selectedCompany || selectedCompany === "all") return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany, selectedSiteId, groupCompanyIds]);
  
  // Create stable string key for company site IDs (avoid nested arrays in query keys)
  const companySiteIdsKey = companySiteIds?.join(",") || null;

  const { data, isLoading, isFetching } = useQuery<ModuleDashboardData>({
    queryKey: ["/api/dashboard", module, siteId, companySiteIdsKey],
    placeholderData: keepPreviousData,
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

  // Fetch missing required template details for this module
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [renewalMetricDialog, setRenewalMetricDialog] = useState<null | "overdue" | "due30" | "due60">(null);
  const { data: missingRequiredDetails = [], isLoading: isMissingLoading } = useQuery<MissingRequiredTemplateDetail[]>({
    queryKey: ["/api/missing-required-templates", module, siteId, companySiteIdsKey],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: string[] = [`module=${module}`];
      if (siteId) params.push(`siteId=${siteId}`);
      else if (companySiteIds && companySiteIds.length > 0) params.push(`siteIds=${companySiteIds.join(",")}`);
      const res = await fetch(`/api/missing-required-templates?${params.join("&")}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch missing required templates");
      return res.json();
    },
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
      if (doc.caseId) return false;
      if ((doc as any).incidentId) return false;
      if ((doc as any).source === "external") return false;
      if (siteId) return doc.siteId === siteId;
      if (companySiteIds && companySiteIds.length > 0) {
        return companySiteIds.includes(doc.siteId);
      }
      return true;
    });
    
    filteredDocs.forEach(doc => {
      // Overdue bucket: trust the compliance engine status, not date arithmetic
      if (doc.status === "overdue") {
        overdue++;
        upcomingRenewals.push(doc);
        return; // don't double-count in due30/due60
      }

      // Due in 30/60 days: date-based, only for non-overdue docs
      const trackingDate = doc.renewalDate || doc.expiryDate;
      if (!trackingDate) return;
      
      const renewalDate = new Date(trackingDate);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 30) {
        due30Days++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal > 30 && daysUntilRenewal <= 60) {
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
  
  const groupOwnerName = useMemo(() => {
    if (selectedGroup === "all" || !companies.length) return null;
    return companies.find(c => c.id === selectedGroup)?.name ?? null;
  }, [selectedGroup, companies]);

  const contextCompany = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyName || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    if (groupOwnerName) return `${groupOwnerName} (Group)`;
    return null;
  }, [selectedSiteId, selectedCompany, sites, groupOwnerName]);

  const contextSite = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") return "All Sites";
    if (groupOwnerName) return "All Sites";
    return "All Sites";
  }, [selectedSiteId, selectedCompany, sites, groupOwnerName]);
  
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
    approvalRequired: 0,
    overdueDocuments: 0,
    missingRequiredDocuments: 0,
    complianceScore: 0,
    allDocuments: 0,
    allCompliantDocuments: 0,
    allApprovalRequired: 0,
    allOverdueDocuments: 0,
    pendingApprovals: 0,
    awaitingYourApproval: 0,
    awaitingOthersApproval: 0,
  };

  type DocsDialogFilter = "req_compliant" | "req_non_compliant" | "req_overdue" | "total" | "all_compliant" | "all_review" | "all_overdue";
  const [docsDialogFilter, setDocsDialogFilter] = useState<DocsDialogFilter | null>(null);
  const filteredModuleDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc => {
      if (doc.isArchived) return false;
      if (siteId) {
        // Site-owned doc — direct match
        if (doc.siteId === siteId) return true;
        // Scoped (group/company) doc — include if shared with this site or the
        // site's owning company. isSharedLink is false for origin/admin users
        // so we check siteId===null as the reliable signal for a scoped doc.
        if (doc.siteId === null) {
          const siteCompanyId = sites?.find(s => s.id === siteId)?.companyId;
          const sharedWithSiteIds = (doc as any).sharedWithSiteIds as string[] | undefined;
          const sharedWithCompanyIds = (doc as any).sharedWithCompanyIds as string[] | undefined;
          return (
            (sharedWithSiteIds?.includes(siteId) ?? false) ||
            !!(siteCompanyId && sharedWithCompanyIds?.includes(siteCompanyId)) ||
            // Doc owned by the same company as the site (no share record on origin docs)
            !!(siteCompanyId && (doc as any).entityId === siteCompanyId)
          );
        }
        return false;
      }
      if (companySiteIds && companySiteIds.length > 0) {
        if (companySiteIds.includes(doc.siteId)) return true;
        // Also include scoped docs shared with (or owned by) ANY of the companies
        // in scope. The selection can span multiple companies (e.g. a group
        // owner viewing all member companies), so we match against the full set
        // of in-scope company IDs — not a single one — otherwise company-owned
        // docs for the other in-scope companies would be wrongly dropped.
        if (doc.siteId === null) {
          const companySiteIdSet = new Set(companySiteIds);
          const companyIdSet = new Set(
            (sites ?? [])
              .filter(s => companySiteIdSet.has(s.id))
              .map(s => s.companyId)
          );
          const sharedWithSiteIds = (doc as any).sharedWithSiteIds as string[] | undefined;
          const sharedWithCompanyIds = (doc as any).sharedWithCompanyIds as string[] | undefined;
          const entityId = (doc as any).entityId as string | undefined;
          return (
            (sharedWithSiteIds?.some(sid => companySiteIdSet.has(sid)) ?? false) ||
            (sharedWithCompanyIds?.some(cid => companyIdSet.has(cid)) ?? false) ||
            // Doc owned by any in-scope company (no share record needed for origin)
            !!(entityId && companyIdSet.has(entityId))
          );
        }
        return false;
      }
      return true;
    });
  }, [documents, siteId, companySiteIds, sites]);

  const docsDialogDocs = useMemo((): Document[] => {
    if (!docsDialogFilter) return [];
    switch (docsDialogFilter) {
      case "req_compliant": return filteredModuleDocs.filter(d => isCountableDoc(d) && d.isMandatory && d.status === "compliant");
      case "req_non_compliant": return filteredModuleDocs.filter(d => isCountableDoc(d) && d.isMandatory && (d.status === "overdue" || d.status === "approval_required"));
      case "req_overdue": return filteredModuleDocs.filter(d => isCountableDoc(d) && d.isMandatory && d.status === "overdue");
      case "total": return filteredModuleDocs.filter(isCountableDoc);
      case "all_compliant": return filteredModuleDocs.filter(d => isCountableDoc(d) && (d.status === "compliant" || d.status === "approved"));
      case "all_review": return filteredModuleDocs.filter(d => isCountableDoc(d) && d.status === "approval_required");
      case "all_overdue": return filteredModuleDocs.filter(d => isCountableDoc(d) && d.status === "overdue");
      default: return [];
    }
  }, [docsDialogFilter, filteredModuleDocs]);

  const docsDialogMeta: Record<DocsDialogFilter, { title: string }> = {
    req_compliant: { title: "Compliant (Mandatory Documents)" },
    req_non_compliant: { title: "Non Compliant (Mandatory Documents)" },
    req_overdue: { title: "Overdue (Mandatory Documents)" },
    total: { title: "All Documents" },
    all_compliant: { title: "Complete Documents" },
    all_review: { title: "Approval Required" },
    all_overdue: { title: "All Overdue Documents" },
  };

  const statusColorMap: Record<string, string> = {
    compliant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    complete: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    approval_required: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (sites) sites.forEach(s => { map[s.id] = `${s.name}${s.companyName ? ` — ${s.companyName}` : ""}`; });
    return map;
  }, [sites]);

  // Document Progress tiles — single source of truth = the in-scope document
  // list. Status-based buckets, each document counted exactly once (no per-site
  // expansion), so the tiles always equal the matching dialog's row count.
  const allDocStats = useMemo(
    () => statusCounts(filteredModuleDocs, true),
    [filteredModuleDocs],
  );

  // Mandatory-document compliance — doc-based and using each document's own
  // `status` field, so these headline numbers always equal the rows shown when
  // the user clicks through to the dialog. Compliant = mandatory docs that are
  // approved (status "compliant"). Non-compliant = mandatory docs that are
  // missing OR not approved (overdue / awaiting approval). Cloud uploads, case,
  // incident and archived docs are always excluded via isCountableDoc.
  const reqCompliantCount = useMemo(
    () => filteredModuleDocs.filter(d => isCountableDoc(d) && d.isMandatory && d.status === "compliant").length,
    [filteredModuleDocs],
  );
  const reqNonCompliantPresent = useMemo(
    () => filteredModuleDocs.filter(d => isCountableDoc(d) && d.isMandatory && (d.status === "overdue" || d.status === "approval_required")).length,
    [filteredModuleDocs],
  );
  const reqNonCompliantCount = reqNonCompliantPresent + missingRequiredDetails.length;
  const complianceDenom = reqCompliantCount + reqNonCompliantCount;
  const complianceScore = complianceDenom > 0 ? Math.round((reqCompliantCount / complianceDenom) * 100) : 0;

  // One row per document (no per-site expansion) so the dialog row count always
  // matches the tile number. Site docs show their site; scoped (group/company)
  // docs show their owning company so the user still sees where they live.
  const expandedDocsDialogRows = useMemo(() => {
    return docsDialogDocs.map(doc => {
      if (doc.siteId) {
        return { doc, key: doc.id, siteName: siteNameMap[doc.siteId] ?? null };
      }
      const entityId = (doc as any).entityId as string | undefined;
      const ownerCompany = entityId ? sites?.find(s => s.companyId === entityId)?.companyName ?? null : null;
      return { doc, key: doc.id, siteName: ownerCompany };
    });
  }, [docsDialogDocs, siteNameMap, sites]);

  const getDocTypeLabel = (type: string) => {
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  return (
    <div className={`${themeClass} flex flex-col h-full`}>
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ModuleIcon className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {config.name}
                <span className="font-normal text-muted-foreground text-2xl"> — {dashboardSubtitle}</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                {isPrivilegedUser && (
                  <span className="font-semibold text-foreground">{contextCompany || "All Companies"}</span>
                )}
                {!isPrivilegedUser && contextCompany && (
                  <span className="font-semibold text-foreground">{contextCompany}</span>
                )}
                {(isPrivilegedUser || contextCompany) && contextSite && <span> - </span>}
                {contextSite && <span>{contextSite}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.history.back()} data-testid="link-sites-from-dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {module === "employment_law" && (
              <Button variant="outline" asChild>
                <Link href="/employment-law/cases" data-testid="link-view-cases">
                  <Briefcase className="mr-2 h-4 w-4" />
                  View Cases
                </Link>
              </Button>
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

      <div id="page-content" className="flex-1 overflow-auto space-y-8 p-8 dash-animate">

        {/* Compliance Section */}
        {(() => {
          const scoreColor = complianceScore >= 90 ? "text-emerald-600 dark:text-emerald-400" : complianceScore >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
          const scoreBg = complianceScore >= 90 ? "bg-emerald-500" : complianceScore >= 70 ? "bg-amber-500" : "bg-red-500";
          const nonCompliantCount = reqNonCompliantCount;
          return (
            <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-compliance-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {config.shortName} Compliance
                </CardTitle>
                <CardDescription>Based on mandatory documents only</CardDescription>
              </CardHeader>
              <CardContent className={`space-y-6 transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
                    {/* Score */}
                    <div>
                      <span className={`text-6xl font-bold ${scoreColor}`} data-testid="card-module-score">
                        {complianceScore}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all duration-500 ${scoreBg}`}
                        style={{ width: `${complianceScore}%` }}
                      />
                    </div>

                    {/* Compliance stats: required docs only */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => reqCompliantCount > 0 && setDocsDialogFilter("req_compliant")}
                        className={`rounded-md border p-3 text-center w-full transition-colors bg-background ${reqCompliantCount > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                        data-testid="card-module-compliant"
                      >
                        <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-2xl font-semibold">{reqCompliantCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Compliant</p>
                        {reqCompliantCount > 0 && <p className="text-xs text-emerald-500/70 mt-0.5">Click to view</p>}
                      </button>
                      <button
                        onClick={() => nonCompliantCount > 0 && setDocsDialogFilter("req_non_compliant")}
                        className={`rounded-md border p-3 text-center w-full transition-colors bg-background ${nonCompliantCount > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                        data-testid="card-module-non-compliant"
                      >
                        <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-2xl font-semibold">{nonCompliantCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Non Compliant</p>
                        {nonCompliantCount > 0 && <p className="text-xs text-red-500/70 mt-0.5">Click to view</p>}
                      </button>
                    </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Document Progress Card */}
        <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-document-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Progress
            </CardTitle>
            <CardDescription>All documents across this module</CardDescription>
          </CardHeader>
          <CardContent className={`transition-opacity duration-300 ${isFetching ? "opacity-50" : "opacity-100"}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  onClick={() => allDocStats.total > 0 && setDocsDialogFilter("total")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${allDocStats.total > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-total"
                >
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-semibold">{allDocStats.total}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </button>
                <button
                  onClick={() => (allDocStats.compliant + allDocStats.approved) > 0 && setDocsDialogFilter("all_compliant")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${(allDocStats.compliant + allDocStats.approved) > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-compliant"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{allDocStats.compliant + allDocStats.approved}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </button>
                <button
                  onClick={() => allDocStats.approvalRequired > 0 && setDocsDialogFilter("all_review")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${allDocStats.approvalRequired > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-review"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{allDocStats.approvalRequired}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Approval Required</p>
                </button>
                <button
                  onClick={() => allDocStats.overdue > 0 && setDocsDialogFilter("all_overdue")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${allDocStats.overdue > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-overdue"
                >
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{allDocStats.overdue}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </button>
              </div>
          </CardContent>
        </Card>

      {/* Overdue Status Section */}
      <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-renewal-compliance">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Overdue Status
            </CardTitle>
            <CardDescription>Documents approaching or past renewal dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <button onClick={() => setRenewalMetricDialog("overdue")} className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-overdue">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-renewals-overdue">{renewalMetrics.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue Renewals</p>
                </div>
              </button>
              <button onClick={() => setRenewalMetricDialog("due30")} className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-30days">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" data-testid="text-renewals-30days">{renewalMetrics.due30Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 30 Days</p>
                </div>
              </button>
              <button onClick={() => setRenewalMetricDialog("due60")} className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-60days">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="text-renewals-60days">{renewalMetrics.due60Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 60 Days</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

      <Dialog open={renewalMetricDialog !== null} onOpenChange={(open) => { if (!open) setRenewalMetricDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {renewalMetricDialog === "overdue" && <><AlertTriangle className="h-5 w-5 text-red-600" /> Overdue Renewals</>}
              {renewalMetricDialog === "due30" && <><Clock className="h-5 w-5 text-amber-600" /> Due in 30 Days</>}
              {renewalMetricDialog === "due60" && <><Calendar className="h-5 w-5 text-blue-600" /> Due in 60 Days</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(() => {
              const docs = renewalMetrics.upcomingRenewals.filter(doc => {
                const trackingDate = doc.renewalDate || doc.expiryDate;
                const renewalDate = trackingDate ? new Date(trackingDate) : null;
                const daysUntilRenewal = renewalDate ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                
                if (renewalMetricDialog === "overdue") return doc.status === "overdue";
                if (renewalMetricDialog === "due30") return daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
                if (renewalMetricDialog === "due60") return daysUntilRenewal !== null && daysUntilRenewal > 30 && daysUntilRenewal <= 60;
                return false;
              });

              if (docs.length === 0) {
                return <div className="py-8 text-center text-muted-foreground text-sm">No documents to display.</div>;
              }

              return docs.map(doc => {
                const trackingDate = doc.renewalDate || doc.expiryDate;
                const renewalDate = trackingDate ? new Date(trackingDate) : null;
                const daysUntilRenewal = renewalDate ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const docSite = sites?.find(s => s.id === doc.siteId);

                return (
                  <Link key={doc.id} href={`${basePath}/documents/${doc.id}`} className="flex items-start justify-between gap-3 p-3 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        {docSite && (
                          <p className="text-xs text-muted-foreground truncate">{docSite.name}{docSite.companyName ? ` — ${docSite.companyName}` : ""}</p>
                        )}
                        {renewalDate && (
                          <p className="text-xs text-muted-foreground">{doc.renewalDate ? "Renewal" : "Expires"}: {format(renewalDate, "MMM d, yyyy")}</p>
                        )}
                      </div>
                    </div>
                    {daysUntilRenewal !== null && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap mt-0.5 ${
                        daysUntilRenewal < 0
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : daysUntilRenewal <= 30
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {daysUntilRenewal < 0 ? `${Math.abs(daysUntilRenewal)}d overdue` : `${daysUntilRenewal}d remaining`}
                      </span>
                    )}
                  </Link>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Document list dialog */}
      <Dialog open={docsDialogFilter !== null} onOpenChange={(open) => { if (!open) setDocsDialogFilter(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-module-docs-list">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {docsDialogFilter ? docsDialogMeta[docsDialogFilter].title : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {expandedDocsDialogRows.length === 0 && (docsDialogFilter !== "req_non_compliant" || missingRequiredDetails.length === 0) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No documents to display.</p>
            ) : (
              <>
                {expandedDocsDialogRows.map(({ doc, key, siteName }) => {
                  const isComplete = doc.status === "approved" || (!doc.isMandatory && doc.status === "compliant");
                  const statusKey = isComplete ? "complete" : doc.status;
                  const statusLabel = doc.status === "approval_required" ? "Approval Required" : doc.status === "overdue" ? "Overdue" : isComplete ? "Complete" : "Compliant";
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md border p-3 gap-3 hover:bg-muted/40 cursor-pointer"
                      onClick={() => { setDocsDialogFilter(null); navigate(`${basePath}/documents/${doc.id}`); }}
                      data-testid={`row-module-doc-${key}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        {siteName && <p className="text-xs text-muted-foreground truncate">{siteName}</p>}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${statusColorMap[statusKey] || "bg-muted text-muted-foreground"}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
                {docsDialogFilter === "req_non_compliant" && missingRequiredDetails.length > 0 && (
                  <>
                    {expandedDocsDialogRows.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground pt-2 pb-1 uppercase tracking-wide">Missing Mandatory Documents</p>
                    )}
                    {missingRequiredDetails.map((item, idx) => (
                      <div
                        key={`missing-${item.templateId}-${item.siteId}-${idx}`}
                        className="flex items-center justify-between rounded-md border p-3 gap-3"
                        data-testid={`row-missing-noncompliant-${item.templateId}-${idx}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.templateName}</p>
                          {(item.siteName || item.companyName) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.siteName}{item.companyName ? ` — ${item.companyName}` : ""}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Not Uploaded
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Required Documents dialog */}
      <Dialog open={showMissingDialog} onOpenChange={setShowMissingDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-missing-required">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-orange-500" />
              Missing Mandatory Documents ({missingRequiredDetails.length})
            </DialogTitle>
          </DialogHeader>
          {isMissingLoading ? (
            <FetchingOverlay />
          ) : missingRequiredDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No missing required documents found.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {missingRequiredDetails.map((item, idx) => (
                <div
                  key={`${item.templateId}-${item.siteId}-${idx}`}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`row-missing-${item.templateId}-${item.siteId}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.templateName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.siteName}{item.companyName ? ` — ${item.companyName}` : ""}
                    </p>
                  </div>
                  <div className="ml-2 shrink-0">
                    {item.kind === "required_document" ? (
                      <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 capitalize">
                        {item.documentStatus?.replace("_", " ") || "Not Compliant"}
                      </Badge>
                    ) : item.requiresApproval ? (
                      <Badge variant="outline" className="text-xs">Approval Required</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Not Uploaded</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
