import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CompanyCombobox } from "@/components/company-combobox";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  MapPin,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  ChevronRight,
  HardHat,
  Users,
  Scale,
  LayoutDashboard,
  Layers,
  X,
} from "lucide-react";
import type { ModuleType } from "@shared/schema";

interface SiteWithCompany {
  id: string;
  name: string;
  companyName?: string | null;
  companyId: string;
}

interface Document {
  id: string;
  siteId: string | null;
  status: string;
  approvalStatus: string;
  isArchived: boolean;
  caseId?: string | null;
  incidentId?: string | null;
  source?: string;
  scope?: "site" | "company" | "group" | null;
  entityId?: string | null;
  isRequired?: boolean;
}

interface CompanyListItem {
  id: string;
  name: string;
  groupOwnerId?: string | null;
  groupOwnerName?: string | null;
  isGroupOwner?: boolean;
}

interface MissingRequired {
  siteId: string;
}

const moduleColors: Record<ModuleType, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
  training: "text-purple-600 dark:text-purple-400",
  support: "text-slate-600 dark:text-slate-400",
};

const moduleBgColors: Record<ModuleType, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
  training: "bg-purple-100 dark:bg-purple-900/30",
  support: "bg-slate-100 dark:bg-slate-900/30",
};

const moduleAccentBg: Record<ModuleType, string> = {
  health_safety: "bg-emerald-600 hover:bg-emerald-700",
  human_resources: "bg-blue-600 hover:bg-blue-700",
  employment_law: "bg-pink-600 hover:bg-pink-700",
  training: "bg-purple-600 hover:bg-purple-700",
  support: "bg-slate-600 hover:bg-slate-700",
};

const moduleActionBg: Record<ModuleType, string> = {
  health_safety: "bg-emerald-50 dark:bg-emerald-900/25 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
  human_resources: "bg-blue-50 dark:bg-blue-900/25 hover:bg-blue-100 dark:hover:bg-blue-900/40",
  employment_law: "bg-pink-50 dark:bg-pink-900/25 hover:bg-pink-100 dark:hover:bg-pink-900/40",
  training: "bg-purple-50 dark:bg-purple-900/25 hover:bg-purple-100 dark:hover:bg-purple-900/40",
  support: "bg-slate-50 dark:bg-slate-900/25 hover:bg-slate-100 dark:hover:bg-slate-900/40",
};

const moduleBorderDashedColors: Record<ModuleType, string> = {
  health_safety: "border-emerald-300 dark:border-emerald-700",
  human_resources: "border-blue-300 dark:border-blue-700",
  employment_law: "border-pink-300 dark:border-pink-700",
  training: "border-purple-300 dark:border-purple-700",
  support: "border-slate-300 dark:border-slate-700",
};

const moduleLabels: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
};

function ModuleSitesView({ module }: { module: ModuleType }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { selectedCompany, handleCompanyChange, setSelectedSiteId } = useSiteFilter();
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const basePath =
    module === "health_safety"
      ? "/health-safety"
      : module === "human_resources"
      ? "/human-resources"
      : module === "employment_law"
      ? "/employment-law"
      : "/training";

  const { data: sites, isLoading: isLoadingSites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: companiesResp } = useQuery<{ companies: CompanyListItem[] }>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch(`/api/companies?limit=1000`, { credentials: "include" });
      return res.json();
    },
  });
  const companies = companiesResp?.companies ?? [];

  // Discover groups visible to the user. A group is identified by its
  // group-owner companyId. Members reference it via groupOwnerId, and the
  // owner itself appears with isGroupOwner=true (when visible).
  const groupOwners = useMemo(() => {
    const map = new Map<string, string>(); // ownerId -> ownerName
    for (const c of companies) {
      if (c.isGroupOwner) {
        map.set(c.id, c.name);
      }
      if (c.groupOwnerId && c.groupOwnerName && !map.has(c.groupOwnerId)) {
        map.set(c.groupOwnerId, c.groupOwnerName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies]);

  const groupOwnerNames = useMemo(
    () => groupOwners.map((g) => g.name),
    [groupOwners]
  );

  // Companies belonging to the selected group (members + owner if visible)
  const selectedGroupCompanies = useMemo(() => {
    if (selectedGroup === "all") return [] as CompanyListItem[];
    return companies.filter(
      (c) => c.id === selectedGroup || c.groupOwnerId === selectedGroup
    );
  }, [companies, selectedGroup]);

  const selectedGroupOwnerName =
    groupOwners.find((g) => g.id === selectedGroup)?.name ?? "";

  const { data: documents, isLoading: isLoadingDocs } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module],
    queryFn: async () => {
      const res = await fetch(`/api/documents/module/${module}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: missingRequiredDetails = [] } = useQuery<MissingRequired[]>({
    queryKey: ["/api/missing-required-templates", module],
    queryFn: async () => {
      const res = await fetch(`/api/missing-required-templates?module=${module}`, { credentials: "include" });
      return res.json();
    },
  });

  const isLoading = isLoadingSites || isLoadingDocs;

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    let result = sites;
    if (selectedGroup !== "all") {
      const groupCompanyIds = new Set(selectedGroupCompanies.map((c) => c.id));
      result = result.filter((s) => groupCompanyIds.has(s.companyId));
    }
    if (selectedCompany && selectedCompany !== "all") {
      result = result.filter((s) => s.companyName === selectedCompany);
    }
    return result;
  }, [sites, selectedCompany, selectedGroup, selectedGroupCompanies]);

  // Sort sites by compliance priority:
  // 1. Any issues (missing, overdue, review) — sorted by compliance % ascending (0% first)
  // 2. 100% compliant
  // 3. Empty — no required docs, no attention needed
  const sortedFilteredSites = useMemo(() => {
    const getSiteMetrics = (siteId: string) => {
      const siteDocs = (documents ?? []).filter(
        (d) => d.siteId === siteId && !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external"
      );
      const total = siteDocs.length; // actual uploaded docs (not counting missing)
      const compliant = siteDocs.filter((d) => d.status === "compliant").length;
      const overdue = siteDocs.filter((d) => d.status === "overdue").length;
      const reviewRequired = siteDocs.filter((d) => d.status === "review_required").length;
      const missingCount = missingRequiredDetails.filter((m) => m.siteId === siteId).length;
      const denom = compliant + reviewRequired + overdue + missingCount;
      // Use denom (not total) so sites with only missing docs get pct=0 rather than null
      const pct = denom > 0 ? Math.round((compliant / denom) * 100) : null;
      const hasIssues = missingCount > 0 || overdue > 0 || reviewRequired > 0;
      return { pct, hasIssues, total };
    };

    const getPriority = (pct: number | null, hasIssues: boolean) => {
      if (hasIssues) return 0;  // any issues (missing, overdue, review) → sort by pct asc (lowest first)
      if (pct === 100) return 1; // fully compliant
      return 2;                  // empty, no attention needed
    };

    return [...filteredSites].sort((a, b) => {
      const am = getSiteMetrics(a.id);
      const bm = getSiteMetrics(b.id);
      const ap = getPriority(am.pct, am.hasIssues);
      const bp = getPriority(bm.pct, bm.hasIssues);
      if (ap !== bp) return ap - bp;
      // Within the "has issues" bucket, sort lowest score first (0% missing-only sites float to top)
      if (ap === 0) return (am.pct ?? 0) - (bm.pct ?? 0);
      return 0;
    });
  }, [filteredSites, documents, missingRequiredDetails]);

  const handleSiteClick = (siteId: string) => {
    setSelectedSiteId(siteId);
    navigate(`${basePath}/documents`);
  };

  const handleSiteDashboardClick = (siteId: string) => {
    setSelectedSiteId(siteId);
    navigate(basePath);
  };

  const handleAllSitesClick = () => {
    setSelectedSiteId("all");
    navigate(`${basePath}/documents`);
  };

  const handleAllSitesDashboardClick = () => {
    setSelectedSiteId("all");
    navigate(basePath);
  };

  const ModuleIcon =
    module === "health_safety" ? HardHat : module === "employment_law" ? Scale : Users;

  return (
    <div className={`module-page theme-${module === "health_safety" ? "hs" : module === "human_resources" ? "hr" : module === "employment_law" ? "el" : "training"} flex flex-col h-full`}>
      {/* Page header */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ModuleIcon className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {moduleLabels[module]}
                <span className="font-normal text-muted-foreground text-2xl"> — Site Documents</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground">
                Select a site to view and manage its documents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {groupOwners.length > 0 && (
              <Select
                value={selectedGroup}
                onValueChange={(v) => {
                  setSelectedGroup(v);
                  // Clear any company filter when switching groups
                  handleCompanyChange(null);
                }}
              >
                <SelectTrigger className="w-[240px]" data-testid="select-group-sites">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="h-4 w-4 shrink-0 opacity-60" />
                    <SelectValue placeholder="Group Owners" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-group-option-all">
                    Group Owners
                  </SelectItem>
                  {groupOwners.map((g) => (
                    <SelectItem
                      key={g.id}
                      value={g.id}
                      data-testid={`select-group-option-${g.id}`}
                    >
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isPrivilegedUser && (() => {
              // When a group is selected, restrict the company filter to
              // companies that belong to that group.
              const sitesForCombobox =
                selectedGroup === "all"
                  ? sites
                  : (sites ?? []).filter((s) => {
                      const ids = new Set(selectedGroupCompanies.map((c) => c.id));
                      return ids.has(s.companyId);
                    });
              return (
                <CompanyCombobox
                  sites={sitesForCombobox}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-[260px]"
                  testId="select-company-sites"
                  excludeNames={groupOwnerNames}
                />
              );
            })()}
            {(selectedGroup !== "all" ||
              (selectedCompany && selectedCompany !== "all")) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGroup("all");
                  handleCompanyChange(null);
                }}
                data-testid="button-clear-filters"
                className="h-9"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Sites grid */}
      <div id="page-content" className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
            <MapPin className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No sites found</p>
            <p className="text-xs mt-1">
              {selectedCompany && selectedCompany !== "all"
                ? "No sites match the selected company filter"
                : "No sites are available for this module"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Group + Company cards */}
            {(selectedGroup !== "all" ||
              (selectedCompany && selectedCompany !== "all")) && (() => {
              // Companies to render company cards for:
              // - If a group is selected: members of that group (excluding the group-owner itself),
              //   optionally narrowed to the selected company.
              // - If no group but a company is selected: just that company.
              const companyCardSource: CompanyListItem[] =
                selectedGroup !== "all"
                  ? selectedGroupCompanies.filter((c) => c.id !== selectedGroup)
                  : companies.filter((c) => c.name === selectedCompany);
              const companyCards = companyCardSource.filter((c) =>
                !selectedCompany || selectedCompany === "all"
                  ? true
                  : c.name === selectedCompany
              );

              const groupDocs = (documents ?? []).filter(
                (d) =>
                  !d.isArchived &&
                  !d.caseId &&
                  !d.incidentId &&
                  d.source !== "external" &&
                  d.scope === "group" &&
                  d.entityId === selectedGroup
              );
              const groupRequired = groupDocs.filter((d) => d.isRequired);
              const groupCompliant = groupRequired.filter((d) => d.status === "compliant").length;
              const groupOverdue = groupRequired.filter((d) => d.status === "overdue").length;
              const groupReview = groupRequired.filter((d) => d.status === "review_required").length;
              const groupDenom = groupCompliant + groupReview + groupOverdue;
              const groupPct = groupDenom > 0 ? Math.round((groupCompliant / groupDenom) * 100) : null;
              const groupHasIssues = groupOverdue > 0 || groupReview > 0;

              return (
                <>
                  {/* Group card — group-scoped docs (only when a group is selected) */}
                  {selectedGroup !== "all" && (
                  <Card
                    className={`overflow-hidden transition-all hover:shadow-md border-2 ${moduleBorderDashedColors[module]} hover:border-solid`}
                    data-testid={`card-group-${selectedGroup}`}
                  >
                    <CardContent className="p-5 pb-4">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                            <Layers className={`h-4 w-4 ${moduleColors[module]}`} />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="font-semibold text-sm leading-snug truncate"
                              data-testid={`text-group-name-${selectedGroup}`}
                            >
                              {selectedGroupOwnerName}
                            </p>
                            <p className="text-xs text-muted-foreground">Group documents</p>
                          </div>
                        </div>
                        {groupHasIssues ? (
                          groupOverdue > 0 ? (
                            <Badge className="shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 border text-xs px-1.5">
                              <AlertTriangle className="h-3 w-3" />
                            </Badge>
                          ) : (
                            <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 border text-xs px-1.5">
                              <Clock className="h-3 w-3" />
                            </Badge>
                          )
                        ) : groupPct === 100 ? (
                          <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 border text-xs px-1.5">
                            <CheckCircle className="h-3 w-3" />
                          </Badge>
                        ) : null}
                      </div>

                      {groupDenom > 0 ? (
                        <div className="mb-4 min-h-[38px]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Compliance
                            </span>
                            <span className={`text-xs font-semibold ${
                              groupPct === 100 ? "text-emerald-600 dark:text-emerald-400"
                              : (groupPct ?? 0) >= 70 ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                            }`}>
                              {groupPct}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                groupPct === 100 ? "bg-emerald-500"
                                : (groupPct ?? 0) >= 70 ? "bg-amber-500"
                                : "bg-red-500"
                              }`}
                              style={{ width: `${groupPct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-4 min-h-[38px] flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">
                            {groupDocs.length === 0 ? "No group documents yet" : `${groupDocs.length} document${groupDocs.length !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
                          <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{groupCompliant}</p>
                          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Compliant</p>
                        </div>
                        <div className={`rounded-lg px-2 py-1.5 ${groupReview > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                          <p className={`text-base font-bold ${groupReview > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{groupReview}</p>
                          <p className={`text-xs ${groupReview > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Review</p>
                        </div>
                        <div className={`rounded-lg px-2 py-1.5 ${groupOverdue > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                          <p className={`text-base font-bold ${groupOverdue > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{groupOverdue}</p>
                          <p className={`text-xs ${groupOverdue > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                        </div>
                      </div>
                    </CardContent>
                    <div className="border-t flex">
                      <button
                        onClick={() => {
                          setSelectedSiteId("all");
                          navigate(`${basePath}/documents`);
                        }}
                        className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold ${moduleColors[module]} ${moduleActionBg[module]} transition-colors`}
                        data-testid={`link-view-group-${selectedGroup}`}
                      >
                        Documents
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Card>
                  )}

                  {/* One card per company — company-scoped docs */}
                  {companyCards.map((company) => {
                    const companyDocs = (documents ?? []).filter(
                      (d) =>
                        !d.isArchived &&
                        !d.caseId &&
                        !d.incidentId &&
                        d.source !== "external" &&
                        d.scope === "company" &&
                        d.entityId === company.id
                    );
                    const cReq = companyDocs.filter((d) => d.isRequired);
                    const cCompliant = cReq.filter((d) => d.status === "compliant").length;
                    const cOverdue = cReq.filter((d) => d.status === "overdue").length;
                    const cReview = cReq.filter((d) => d.status === "review_required").length;
                    const cDenom = cCompliant + cReview + cOverdue;
                    const cPct = cDenom > 0 ? Math.round((cCompliant / cDenom) * 100) : null;
                    const cHasIssues = cOverdue > 0 || cReview > 0;

                    return (
                      <Card
                        key={`company-${company.id}`}
                        className={`overflow-hidden transition-all hover:shadow-md border-2 ${moduleBorderDashedColors[module]} hover:border-solid`}
                        data-testid={`card-company-${company.id}`}
                      >
                        <CardContent className="p-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-4">
                            <div className="flex items-start gap-2.5">
                              <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                                <Building2 className={`h-4 w-4 ${moduleColors[module]}`} />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="font-semibold text-sm leading-snug truncate"
                                  data-testid={`text-company-name-${company.id}`}
                                >
                                  {company.name}
                                </p>
                                <p className="text-xs text-muted-foreground">Company documents</p>
                              </div>
                            </div>
                            {cHasIssues ? (
                              cOverdue > 0 ? (
                                <Badge className="shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 border text-xs px-1.5">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              ) : (
                                <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 border text-xs px-1.5">
                                  <Clock className="h-3 w-3" />
                                </Badge>
                              )
                            ) : cPct === 100 ? (
                              <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 border text-xs px-1.5">
                                <CheckCircle className="h-3 w-3" />
                              </Badge>
                            ) : null}
                          </div>

                          {cDenom > 0 ? (
                            <div className="mb-4 min-h-[38px]">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Compliance
                                </span>
                                <span className={`text-xs font-semibold ${
                                  cPct === 100 ? "text-emerald-600 dark:text-emerald-400"
                                  : (cPct ?? 0) >= 70 ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                                }`}>
                                  {cPct}%
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    cPct === 100 ? "bg-emerald-500"
                                    : (cPct ?? 0) >= 70 ? "bg-amber-500"
                                    : "bg-red-500"
                                  }`}
                                  style={{ width: `${cPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 min-h-[38px] flex items-center justify-center">
                              <p className="text-xs text-muted-foreground">
                                {companyDocs.length === 0 ? "No company documents yet" : `${companyDocs.length} document${companyDocs.length !== 1 ? "s" : ""}`}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
                              <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{cCompliant}</p>
                              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Compliant</p>
                            </div>
                            <div className={`rounded-lg px-2 py-1.5 ${cReview > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                              <p className={`text-base font-bold ${cReview > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{cReview}</p>
                              <p className={`text-xs ${cReview > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Review</p>
                            </div>
                            <div className={`rounded-lg px-2 py-1.5 ${cOverdue > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                              <p className={`text-base font-bold ${cOverdue > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{cOverdue}</p>
                              <p className={`text-xs ${cOverdue > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="border-t flex">
                          <button
                            onClick={() => {
                              handleCompanyChange(company.name);
                              setSelectedSiteId("all");
                              navigate(`${basePath}/documents`);
                            }}
                            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold ${moduleColors[module]} ${moduleActionBg[module]} transition-colors`}
                            data-testid={`link-view-company-${company.id}`}
                          >
                            Documents
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Card>
                    );
                  })}
                </>
              );
            })()}

            {/* All Sites aggregate tile — only shown when there are 2+ sites */}
            {(() => {
              if (filteredSites.length <= 1) return null;
              const allDocs = (documents ?? []).filter(
                (d) => !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external" &&
                  filteredSites.some((s) => s.id === d.siteId)
              );
              const allTotal = allDocs.length;
              const allRequiredDocs = allDocs.filter((d) => d.isRequired);
              const allCompliant = allRequiredDocs.filter((d) => d.status === "compliant").length;
              const allOverdue = allRequiredDocs.filter((d) => d.status === "overdue").length;
              const allReview = allRequiredDocs.filter((d) => d.status === "review_required").length;
              const allPending = allDocs.filter((d) => d.approvalStatus === "pending").length;
              const allMissing = missingRequiredDetails.filter((m) =>
                filteredSites.some((s) => s.id === m.siteId)
              ).length;
              const allDenom = allCompliant + allReview + allOverdue + allMissing;
              const allPct = allDenom > 0 ? Math.round((allCompliant / allDenom) * 100) : null;
              const allHasIssues = allMissing > 0 || allOverdue > 0 || allReview > 0;
              const allClear = allDenom > 0 && !allHasIssues && allPct === 100;

              return (
                <Card
                  className={`overflow-hidden transition-all hover:shadow-md border-2 border-dashed ${moduleBorderDashedColors[module]} hover:border-solid`}
                  data-testid="card-site-all"
                >
                  <CardContent className="p-5 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                          <MapPin className={`h-4 w-4 ${moduleColors[module]}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-snug" data-testid="text-site-name-all">
                            All Sites
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {filteredSites.length} site{filteredSites.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {allHasIssues ? (
                        allMissing > 0 || allOverdue > 0 ? (
                          <Badge className="shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 border text-xs px-1.5">
                            <AlertTriangle className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 border text-xs px-1.5">
                            <Clock className="h-3 w-3" />
                          </Badge>
                        )
                      ) : allClear ? (
                        <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 border text-xs px-1.5">
                          <CheckCircle className="h-3 w-3" />
                        </Badge>
                      ) : null}
                    </div>

                    {allDenom > 0 ? (
                      <div className="mb-4 min-h-[38px]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Overall Compliance
                          </span>
                          <span className={`text-xs font-semibold ${
                            allPct === 100 ? "text-emerald-600 dark:text-emerald-400"
                            : (allPct ?? 0) >= 70 ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                          }`}>
                            {allPct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              allPct === 100 ? "bg-emerald-500"
                              : (allPct ?? 0) >= 70 ? "bg-amber-500"
                              : "bg-red-500"
                            }`}
                            style={{ width: `${allPct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 min-h-[38px] flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{allCompliant}</p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Compliant</p>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 ${allReview > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                        <p className={`text-base font-bold ${allReview > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{allReview}</p>
                        <p className={`text-xs ${allReview > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Review</p>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 ${allMissing > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                        <p className={`text-base font-bold ${allMissing > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>{allMissing}</p>
                        <p className={`text-xs ${allMissing > 0 ? "text-orange-600/70 dark:text-orange-400/70" : "text-muted-foreground/70"}`}>Missing</p>
                      </div>
                    </div>

                  </CardContent>
                  {/* Split action bar */}
                  <div className="border-t flex divide-x">
                    <button
                      onClick={handleAllSitesDashboardClick}
                      className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-colors ${moduleAccentBg[module]}`}
                      data-testid="link-dashboard-all"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </button>
                    <button
                      onClick={handleAllSitesClick}
                      className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold ${moduleColors[module]} ${moduleActionBg[module]} transition-colors`}
                      data-testid="link-view-documents-all"
                    >
                      Documents
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })()}

            {sortedFilteredSites.map((site) => {
              const siteDocs = (documents ?? []).filter(
                (d) =>
                  d.siteId === site.id &&
                  !d.isArchived &&
                  !d.caseId &&
                  !d.incidentId &&
                  d.source !== "external"
              );
              const total = siteDocs.length;
              const requiredSiteDocs = siteDocs.filter((d) => d.isRequired);
              const compliant = requiredSiteDocs.filter((d) => d.status === "compliant").length;
              const overdue = requiredSiteDocs.filter((d) => d.status === "overdue").length;
              const reviewRequired = requiredSiteDocs.filter((d) => d.status === "review_required").length;
              const pending = siteDocs.filter((d) => d.approvalStatus === "pending").length;
              const missingCount = missingRequiredDetails.filter(
                (m) => m.siteId === site.id
              ).length;
              const scoreDenominator = compliant + reviewRequired + overdue + missingCount;
              const pct =
                scoreDenominator > 0
                  ? Math.round((compliant / scoreDenominator) * 100)
                  : null;
              const hasIssues = missingCount > 0 || overdue > 0 || reviewRequired > 0;
              const allClear = scoreDenominator > 0 && !hasIssues && pct === 100;

              return (
                <Card
                  key={site.id}
                  className={`overflow-hidden transition-all hover:shadow-md border-2 ${
                    missingCount > 0 || overdue > 0
                      ? "border-red-200 dark:border-red-900/50 hover:border-red-400"
                      : reviewRequired > 0
                      ? "border-amber-200 dark:border-amber-900/50 hover:border-amber-400"
                      : allClear
                      ? "border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400"
                      : "hover:border-primary/30"
                  }`}
                  data-testid={`card-site-${site.id}`}
                >
                  <CardContent className="p-5 pb-4">
                    {/* Site header */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                          <Building2 className={`h-4 w-4 ${moduleColors[module]}`} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-sm leading-snug truncate"
                            data-testid={`text-site-name-${site.id}`}
                          >
                            {site.name}
                          </p>
                          {site.companyName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {site.companyName}
                            </p>
                          )}
                        </div>
                      </div>
                      {missingCount > 0 || overdue > 0 ? (
                        <Badge className="shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 border text-xs px-1.5">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      ) : reviewRequired > 0 ? (
                        <Badge className="shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 border text-xs px-1.5">
                          <Clock className="h-3 w-3" />
                        </Badge>
                      ) : allClear ? (
                        <Badge className="shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 border text-xs px-1.5">
                          <CheckCircle className="h-3 w-3" />
                        </Badge>
                      ) : null}
                    </div>

                    {/* Compliance bar */}
                    {scoreDenominator > 0 ? (
                      <div className="mb-4 min-h-[38px]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Compliance
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              pct === 100
                                ? "text-emerald-600 dark:text-emerald-400"
                                : (pct ?? 0) >= 70
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct === 100
                                ? "bg-emerald-500"
                                : (pct ?? 0) >= 70
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 min-h-[38px] flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">No documents uploaded yet</p>
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                          {compliant}
                        </p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                          Compliant
                        </p>
                      </div>
                      <div
                        className={`rounded-lg px-2 py-1.5 ${
                          reviewRequired > 0
                            ? "bg-amber-50 dark:bg-amber-900/20"
                            : "bg-muted/50"
                        }`}
                      >
                        <p
                          className={`text-base font-bold ${
                            reviewRequired > 0
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {reviewRequired}
                        </p>
                        <p
                          className={`text-xs ${
                            reviewRequired > 0
                              ? "text-amber-600/70 dark:text-amber-400/70"
                              : "text-muted-foreground/70"
                          }`}
                        >
                          Review
                        </p>
                      </div>
                      <div
                        className={`rounded-lg px-2 py-1.5 ${
                          missingCount > 0
                            ? "bg-orange-50 dark:bg-orange-900/20"
                            : "bg-muted/50"
                        }`}
                      >
                        <p
                          className={`text-base font-bold ${
                            missingCount > 0
                              ? "text-orange-700 dark:text-orange-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {missingCount}
                        </p>
                        <p
                          className={`text-xs ${
                            missingCount > 0
                              ? "text-orange-600/70 dark:text-orange-400/70"
                              : "text-muted-foreground/70"
                          }`}
                        >
                          Missing
                        </p>
                      </div>
                    </div>

                  </CardContent>
                  {/* Split action bar */}
                  <div className="border-t flex divide-x">
                    <button
                      onClick={() => handleSiteDashboardClick(site.id)}
                      className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-colors ${moduleAccentBg[module]}`}
                      data-testid={`link-dashboard-${site.id}`}
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => handleSiteClick(site.id)}
                      className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold ${moduleColors[module]} ${moduleActionBg[module]} transition-colors`}
                      data-testid={`link-view-documents-${site.id}`}
                    >
                      Documents
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModuleSites({ module }: { module: ModuleType }) {
  return <ModuleSitesView module={module} />;
}
