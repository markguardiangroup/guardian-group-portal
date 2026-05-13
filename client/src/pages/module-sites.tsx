import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  HardHat,
  Users,
  Scale,
  LayoutDashboard,
  Layers,
  X,
  Loader2,
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
  templateId?: string | null;
  sharedWithCompanyIds?: string[];
  sharedWithSiteIds?: string[];
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
  companyId?: string;
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
  const { selectedCompany, handleCompanyChange, setSelectedSiteId, selectedGroup, setSelectedGroup } = useSiteFilter();

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";
  const basePath =
    module === "health_safety"
      ? "/health-safety"
      : module === "human_resources"
      ? "/human-resources"
      : module === "employment_law"
      ? "/employment-law"
      : "/training";

  const [staffFilter, setStaffFilter] = useState<string>("my");
  const [sitePage, setSitePage] = useState(1);
  const SITES_PER_PAGE = 30;

  type StaffConsultant = { id: string; fullName: string };
  const { data: myStaff = [] } = useQuery<StaffConsultant[]>({
    queryKey: ["/api/consultants/my-staff"],
    queryFn: async () => {
      const res = await fetch("/api/consultants/my-staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isProConsultant,
  });

  const sitesUrl = !isProConsultant
    ? "/api/sites"
    : staffFilter === "my"
    ? "/api/sites?myAssigned=true"
    : staffFilter !== "all"
    ? `/api/sites?staffId=${staffFilter}`
    : "/api/sites";

  const { data: sites, isLoading: isLoadingSites } = useQuery<SiteWithCompany[]>({
    queryKey: [sitesUrl],
    queryFn: async () => {
      const res = await fetch(sitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sites");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: companiesResp } = useQuery<{ companies: CompanyListItem[] }>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch(`/api/companies?limit=1000`, { credentials: "include" });
      return res.json();
    },
  });
  const companies = companiesResp?.companies ?? [];

  // GO client users can see multiple companies and should get the company combobox
  const isGoClient = user?.role === "client" && companies.length > 1;

  // IDs of companies visible in the current staff-filtered site list
  const visibleCompanyIds = useMemo(() => new Set((sites ?? []).map(s => s.companyId)), [sites]);

  // Discover groups visible to the user — constrained to companies in the
  // current staff-scoped site list so the dropdown only shows relevant groups.
  const groupOwners = useMemo(() => {
    const map = new Map<string, string>(); // ownerId -> ownerName
    for (const c of companies) {
      if (!visibleCompanyIds.has(c.id)) continue;
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
  }, [companies, visibleCompanyIds]);

  const groupOwnerNames = useMemo(
    () => groupOwners.map((g) => g.name),
    [groupOwners]
  );

  // For GO clients, auto-select their group on first load so the full group
  // view is shown by default without showing the Group Owners dropdown.
  useEffect(() => {
    if (isGoClient && groupOwners.length > 0 && selectedGroup === "all") {
      setSelectedGroup(groupOwners[0].id);
    }
  }, [isGoClient, groupOwners, selectedGroup, setSelectedGroup]);

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

  // Company-level missing slots (no per-site exclusions) — used by company tiles
  // so their Missing count matches what the company Documents page shows.
  const { data: companyLevelMissingDetails = [] } = useQuery<MissingRequired[]>({
    queryKey: ["/api/missing-required-templates/by-company", module],
    queryFn: async () => {
      const res = await fetch(`/api/missing-required-templates/by-company?module=${module}`, { credentials: "include" });
      return res.json();
    },
  });

  // Effective required template IDs per site (after site-level overrides),
  // used to constrain the Site tile's Compliant/Review/Overdue counts so they
  // only credit docs whose template is actually required at that site. Without
  // this, a group/company-shared compliant doc whose template is not required
  // at the site (e.g. cascade missed propagating it down) inflates Compliant
  // beyond the site's effective required count.
  const { data: effectiveRequiredBySite = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/effective-required-template-ids-by-site", module],
    queryFn: async () => {
      const res = await fetch(`/api/effective-required-template-ids-by-site?module=${module}`, { credentials: "include" });
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
      const site = sites?.find(s => s.id === siteId);
      const siteDocs = (documents ?? []).filter(
        (d) => !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external" && (
          d.siteId === siteId ||
          (d.siteId === null && site && (
            (d.sharedWithSiteIds?.includes(siteId) ?? false) ||
            (d.sharedWithCompanyIds?.includes(site.companyId) ?? false) ||
            (d as any).entityId === site.companyId
          ))
        )
      );
      const total = siteDocs.length; // actual uploaded docs (not counting missing)
      const compliant = siteDocs.filter((d) => d.status === "compliant").length;
      const overdue = siteDocs.filter((d) => d.status === "overdue").length;
      const approvalRequired = siteDocs.filter((d) => d.status === "approval_required").length;
      const missingCount = missingRequiredDetails.filter((m) => m.siteId === siteId).length;
      const denom = compliant + approvalRequired + overdue + missingCount;
      // Use denom (not total) so sites with only missing docs get pct=0 rather than null
      const pct = denom > 0 ? Math.round((compliant / denom) * 100) : null;
      const hasIssues = missingCount > 0 || overdue > 0 || approvalRequired > 0;
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

  // How many summary cards (group + company) will be rendered above the site tiles.
  // They count toward the 21-tile-per-page budget on page 1.
  const summaryCardCount = useMemo(() => {
    if (selectedGroup === "all" && (!selectedCompany || selectedCompany === "all")) return 0;
    let count = 0;
    if (selectedGroup !== "all") count++; // group card
    const companyCardSource: CompanyListItem[] =
      selectedGroup !== "all"
        ? selectedGroupCompanies.filter((c) => c.id !== selectedGroup)
        : companies.filter((c) => c.name === selectedCompany);
    const companyCards = companyCardSource.filter((c) =>
      !selectedCompany || selectedCompany === "all" ? true : c.name === selectedCompany
    );
    count += companyCards.length;
    return count;
  }, [selectedGroup, selectedCompany, selectedGroupCompanies, companies]);

  // "All Sites" aggregate tile appears whenever there are 2+ filtered sites.
  const allSitesCardCount = filteredSites.length > 1 ? 1 : 0;

  // Page 1 gets a smaller site budget so that all fixed tiles fill the remainder.
  const page1SiteBudget = Math.max(1, SITES_PER_PAGE - summaryCardCount - allSitesCardCount);

  // Reset to page 1 whenever the filtered list or summary card count changes
  useEffect(() => { setSitePage(1); }, [selectedCompany, selectedGroup, staffFilter, summaryCardCount]);

  const totalSitePages =
    sortedFilteredSites.length <= page1SiteBudget
      ? 1
      : 1 + Math.ceil((sortedFilteredSites.length - page1SiteBudget) / SITES_PER_PAGE);

  const siteStartIdx =
    sitePage === 1 ? 0 : page1SiteBudget + (sitePage - 2) * SITES_PER_PAGE;
  const siteEndIdx =
    sitePage === 1
      ? Math.min(page1SiteBudget, sortedFilteredSites.length)
      : Math.min(siteStartIdx + SITES_PER_PAGE, sortedFilteredSites.length);

  const paginatedSites = sortedFilteredSites.slice(siteStartIdx, siteEndIdx);

  // Show pagination bar only when total tiles (summary + sites) exceed one page
  const showPagination = sortedFilteredSites.length > page1SiteBudget;

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
        <div className="flex items-center justify-between gap-3">
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
          <div className="flex items-center gap-2 shrink-0">
            {(isGoClient
              ? selectedCompany && selectedCompany !== "all"
              : selectedGroup !== "all" || (selectedCompany && selectedCompany !== "all")
            ) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!isGoClient) setSelectedGroup("all");
                  handleCompanyChange(null);
                }}
                data-testid="button-clear-filters"
                className="h-9 w-9"
                aria-label="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {isProConsultant && (
              <Select
                value={staffFilter}
                onValueChange={(v) => {
                  setStaffFilter(v);
                  setSelectedGroup("all");
                  handleCompanyChange(null);
                }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-staff-filter-docs">
                  <span className="truncate pointer-events-none">
                    {staffFilter === "my"
                      ? "My client sites"
                      : staffFilter === "all"
                      ? "All companies"
                      : (myStaff.find((s) => s.id === staffFilter)?.fullName ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {myStaff.map(s => (
                    <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-docs-${s.id}`}>
                      {s.fullName}'s client sites
                    </SelectItem>
                  ))}
                  <SelectItem value="all">All companies</SelectItem>
                </SelectContent>
              </Select>
            )}
            {!isGoClient && groupOwners.length > 0 && (
              <Select
                value={selectedGroup}
                onValueChange={(v) => {
                  setSelectedGroup(v);
                  // Clear any company filter when switching groups
                  handleCompanyChange(null);
                }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-group-sites">
                  <SelectValue placeholder="Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-group-option-all">
                    Groups
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
            {(isPrivilegedUser || isGoClient) && (() => {
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
                  className="w-[205px] text-sm"
                  testId="select-company-sites"
                  excludeNames={isGoClient ? [] : groupOwnerNames}
                />
              );
            })()}
          </div>
        </div>
      </div>

      {/* Sites grid */}
      <div id="page-content" className="flex-1 overflow-auto p-8 dash-animate">
        {isLoadingSites ? (
          <FetchingOverlay />
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
          <>
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
              // The Group tile uses the same data sources as the Company tile so all
              // three counts load together with the rest of the page (the previous
              // implementation depended on a separate /api/required-template-ids-by-company
              // query that resolved later than `documents` and `missingRequiredDetails`,
              // causing the Missing badge to flicker into view a beat after the other
              // tiles had finished rendering).
              //   - Compliant / Review: count visible group-scope documents by status
              //     (instant — driven by the already-loaded documents query).
              //   - Missing: unique missing template IDs at the group-owner company's
              //     own sites — taken from /api/missing-required-templates, which already
              //     accounts for site-template overrides and shared/site-scope docs that
              //     fulfil the slot. Deduped by templateId so a template required across
              //     multiple sites only counts once.
              let groupCompliant = 0;
              let groupApprovalRequired = 0;
              let groupOverdue = 0;
              for (const d of groupDocs) {
                if (d.status === "compliant") groupCompliant++;
                else if (d.status === "approval_required") groupApprovalRequired++;
                else if (d.status === "overdue") groupOverdue++;
              }
              const groupPending = groupDocs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
              const groupMissingTemplateIds = new Set<string>();
              for (const m of missingRequiredDetails) {
                if (m.companyId === selectedGroup && m.module === module) {
                  groupMissingTemplateIds.add(m.templateId);
                }
              }
              const groupMissing = groupMissingTemplateIds.size;
              const groupDenom = groupCompliant + groupApprovalRequired + groupOverdue + groupMissing;
              const groupPct = groupDenom > 0 ? Math.round((groupCompliant / groupDenom) * 100) : null;
              const groupHasIssues = groupMissing > 0 || groupOverdue > 0 || groupApprovalRequired > 0;

              return (
                <>
                  {/* Group card — group-scoped docs (only when a group is selected) */}
                  {selectedGroup !== "all" && (
                  <Card
                    className={`overflow-hidden transition-all hover:shadow-md border-2 border-solid ${moduleBorderDashedColors[module]}`}
                    data-testid={`card-group-${selectedGroup}`}
                  >
                    <CardContent className="p-5 pb-4">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                            <Layers className={`h-4 w-4 ${moduleColors[module]}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded mb-1">Group</span>
                            {isPrivilegedUser ? (
                              <Link
                                href={`/companies/${selectedGroup}?from=${encodeURIComponent(`${basePath}/sites`)}`}
                                className="font-semibold text-sm leading-snug truncate hover:underline cursor-pointer block"
                                data-testid={`text-group-name-${selectedGroup}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {selectedGroupOwnerName}
                              </Link>
                            ) : (
                              <span className="font-semibold text-sm leading-snug truncate block" data-testid={`text-group-name-${selectedGroup}`}>
                                {selectedGroupOwnerName}
                              </span>
                            )}
                          </div>
                        </div>
                        {groupHasIssues ? (
                          groupMissing > 0 ? (
                            <Badge className="shrink-0 bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20 border text-xs px-1.5">
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
                              Document Compliance
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

                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
                          {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className="text-sm font-bold text-foreground">{groupDocs.length}</p>}
                          <p className="text-[10px] text-muted-foreground/70">Total</p>
                        </div>
                        <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && (groupApprovalRequired + groupOverdue + groupMissing) > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                          {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${(groupApprovalRequired + groupOverdue + groupMissing) > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{groupApprovalRequired + groupOverdue + groupMissing}</p>}
                          <p className={`text-[10px] ${!isLoadingDocs && (groupApprovalRequired + groupOverdue + groupMissing) > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Non Comp.</p>
                        </div>
                        <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && groupOverdue > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                          {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${groupOverdue > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>{groupOverdue}</p>}
                          <p className={`text-[10px] ${!isLoadingDocs && groupOverdue > 0 ? "text-orange-600/70 dark:text-orange-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                        </div>
                        <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && groupPending > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                          {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${groupPending > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{groupPending}</p>}
                          <p className={`text-[10px] ${!isLoadingDocs && groupPending > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Approval</p>
                        </div>
                      </div>
                    </CardContent>
                    <div className="border-t flex">
                      <button
                        onClick={() => {
                          setSelectedSiteId("all");
                          navigate(
                            `${basePath}/documents?scope=group&entityId=${encodeURIComponent(selectedGroup)}&entityName=${encodeURIComponent(selectedGroupOwnerName || "")}`
                          );
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
                        (
                          // Native company-scoped doc owned by this company
                          (d.scope === "company" && d.entityId === company.id) ||
                          // Group/company doc explicitly shared with this company
                          (d.sharedWithCompanyIds?.includes(company.id) ?? false)
                        )
                    );
                    // The Company tile mirrors what the user sees on the company
                    // Documents page:
                    //   - Compliant / Review: count visible company/group-scoped
                    //     documents (own docs + group-shared docs targeting this
                    //     company) by their status.
                    //   - Missing: company-level required templates with no covering
                    //     document, computed WITHOUT per-site exclusions so the count
                    //     matches the company Documents page (uses the batch
                    //     /api/missing-required-templates/by-company endpoint).
                    let cCompliant = 0;
                    let cApprovalRequired = 0;
                    let cOverdue = 0;
                    for (const d of companyDocs) {
                      if (d.status === "compliant") cCompliant++;
                      else if (d.status === "approval_required") cApprovalRequired++;
                      else if (d.status === "overdue") cOverdue++;
                    }
                    const cPending = companyDocs.filter(d => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
                    // Use company-level missing slots (no per-site exclusions) so the
                    // tile count matches the company Documents page.
                    const cMissingTemplateIds = new Set<string>();
                    for (const m of companyLevelMissingDetails) {
                      if (m.companyId === company.id && m.module === module) {
                        cMissingTemplateIds.add(m.templateId);
                      }
                    }
                    const cMissing = cMissingTemplateIds.size;
                    const cDenom = cCompliant + cApprovalRequired + cOverdue + cMissing;
                    const cPct = cDenom > 0 ? Math.round((cCompliant / cDenom) * 100) : null;
                    const cHasIssues = cMissing > 0 || cOverdue > 0 || cApprovalRequired > 0;

                    return (
                      <Card
                        key={`company-${company.id}`}
                        className={`overflow-hidden transition-all hover:shadow-md border-2 border-dashed ${moduleBorderDashedColors[module]} hover:border-solid`}
                        data-testid={`card-company-${company.id}`}
                      >
                        <CardContent className="p-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-4">
                            <div className="flex items-start gap-2.5">
                              <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                                <Building2 className={`h-4 w-4 ${moduleColors[module]}`} />
                              </div>
                              <div className="min-w-0">
                                <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded mb-1">Company</span>
                                {isPrivilegedUser ? (
                                  <Link
                                    href={`/companies/${company.id}?from=${encodeURIComponent(`${basePath}/sites`)}`}
                                    className="font-semibold text-sm leading-snug truncate hover:underline cursor-pointer block"
                                    data-testid={`text-company-name-${company.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {company.name}
                                  </Link>
                                ) : (
                                  <span className="font-semibold text-sm leading-snug truncate block" data-testid={`text-company-name-${company.id}`}>
                                    {company.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            {cHasIssues ? (
                              cMissing > 0 ? (
                                <Badge className="shrink-0 bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20 border text-xs px-1.5">
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
                                  Document Compliance
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

                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
                              {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className="text-sm font-bold text-foreground">{companyDocs.length}</p>}
                              <p className="text-[10px] text-muted-foreground/70">Total</p>
                            </div>
                            <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && (cApprovalRequired + cOverdue + cMissing) > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                              {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${(cApprovalRequired + cOverdue + cMissing) > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{cApprovalRequired + cOverdue + cMissing}</p>}
                              <p className={`text-[10px] ${!isLoadingDocs && (cApprovalRequired + cOverdue + cMissing) > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Non Comp.</p>
                            </div>
                            <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && cOverdue > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                              {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${cOverdue > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>{cOverdue}</p>}
                              <p className={`text-[10px] ${!isLoadingDocs && cOverdue > 0 ? "text-orange-600/70 dark:text-orange-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                            </div>
                            <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && cPending > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                              {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${cPending > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`} data-testid={`text-company-missing-${company.id}`}>{cPending}</p>}
                              <p className={`text-[10px] ${!isLoadingDocs && cPending > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Approval</p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="border-t flex">
                          <button
                            onClick={() => {
                              setSelectedSiteId("all");
                              navigate(
                                `${basePath}/documents?scope=company&entityId=${encodeURIComponent(company.id)}&entityName=${encodeURIComponent(company.name)}`
                              );
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
                (d) => !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external" && (
                  filteredSites.some((s) => s.id === d.siteId) ||
                  (d.siteId === null && filteredSites.some((s) =>
                    (d.sharedWithSiteIds?.includes(s.id) ?? false) ||
                    (d.sharedWithCompanyIds?.includes(s.companyId) ?? false) ||
                    (d as any).entityId === s.companyId
                  ))
                )
              );
              // All counts expand shared docs once per covered site so that a shared
              // document registers as a separate entry for each site it applies to.
              const coveredSites = (d: typeof allDocs[0]) =>
                d.siteId !== null ? 1 : filteredSites.filter((s) =>
                  (d.sharedWithSiteIds?.includes(s.id) ?? false) ||
                  (d.sharedWithCompanyIds?.includes(s.companyId) ?? false) ||
                  (d as any).entityId === s.companyId
                ).length;
              let allTotal = 0;
              let allCompliant = 0;
              let allOverdue = 0;
              let allApprovalRequired = 0;
              let allOverdueAll = 0;
              let allPending = 0;
              for (const d of allDocs) {
                const n = coveredSites(d);
                allTotal += n;
                if (d.isRequired) {
                  if (d.status === "compliant") allCompliant += n;
                  else if (d.status === "overdue") allOverdue += n;
                  else if (d.status === "approval_required") allApprovalRequired += n;
                }
                if (d.status === "overdue") allOverdueAll += n;
                if (d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off") allPending += n;
              }
              const allMissing = missingRequiredDetails.filter((m) =>
                filteredSites.some((s) => s.id === m.siteId)
              ).length;
              const allDenom = allCompliant + allApprovalRequired + allOverdue + allMissing;
              const allPct = allDenom > 0 ? Math.round((allCompliant / allDenom) * 100) : null;
              const allHasIssues = allMissing > 0 || allOverdue > 0 || allApprovalRequired > 0;
              const allClear = allDenom > 0 && !allHasIssues && allPct === 100;

              return (
                <Card
                  className={`overflow-hidden transition-all hover:shadow-md border border-dashed hover:border-solid`}
                  data-testid="card-site-all"
                >
                  <CardContent className="p-5 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${moduleBgColors[module]}`}>
                          <MapPin className={`h-4 w-4 ${moduleColors[module]}`} />
                        </div>
                        <div className="min-w-0">
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 px-1.5 py-0.5 rounded mb-1">Site</span>
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
                            Overall Document Compliance
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

                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className="text-sm font-bold text-foreground">{allTotal}</p>}
                        <p className="text-[10px] text-muted-foreground/70">Total</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && (allApprovalRequired + allOverdue + allMissing) > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${(allApprovalRequired + allOverdue + allMissing) > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{allApprovalRequired + allOverdue + allMissing}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && (allApprovalRequired + allOverdue + allMissing) > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Non Comp.</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && allOverdueAll > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${allOverdueAll > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>{allOverdueAll}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && allOverdueAll > 0 ? "text-orange-600/70 dark:text-orange-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && allPending > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${allPending > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{allPending}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && allPending > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Approval</p>
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

            {paginatedSites.map((site) => {
              const siteDocs = (documents ?? []).filter(
                (d) =>
                  !d.isArchived &&
                  !d.caseId &&
                  !d.incidentId &&
                  d.source !== "external" &&
                  (
                    // Native site doc
                    d.siteId === site.id ||
                    // Scoped (group/company) doc visible to this site:
                    // shared explicitly, shared to company, or owned by this company
                    (d.siteId === null && (
                      (d.sharedWithSiteIds?.includes(site.id) ?? false) ||
                      (d.sharedWithCompanyIds?.includes(site.companyId) ?? false) ||
                      (d as any).entityId === site.companyId
                    ))
                  )
              );
              const total = siteDocs.length;
              // Compliant / Review / Overdue at the site reflect the site's
              // effective required slots — i.e. for each template required at
              // this site (after site-level overrides), look at the best
              // covering doc visible to the site (own / shared / group-cascaded)
              // and bucket by status. This keeps the tile internally consistent:
              // Compliant + Review + Overdue + Missing always equals the site's
              // effective required count. Crucially, group/company-shared docs
              // whose template is NOT in the site's required set do not count
              // toward Compliant — without this guard, a stray cascaded doc can
              // inflate Compliant beyond the actual number of required slots.
              const siteEffectiveRequired = new Set(effectiveRequiredBySite[site.id] ?? []);
              // Count each required doc individually (raw count, no slot-dedup).
              // Pass 1: docs whose template is in the effective required set.
              // This means both a compliant AND a review_required copy of the
              // same template are each counted — so the card reflects every doc
              // that needs attention without hiding the compliant ones.
              let compliant = 0;
              let approvalRequiredRequired = 0;
              let overdueRequired = 0;
              const countedDocIds = new Set<string>();
              for (const d of siteDocs) {
                if (!d.isRequired || !d.templateId) continue;
                if (!siteEffectiveRequired.has(d.templateId)) continue;
                countedDocIds.add(d.id);
                if (d.status === "compliant") compliant++;
                else if (d.status === "approval_required") approvalRequiredRequired++;
                else if (d.status === "overdue") overdueRequired++;
              }
              // Pass 2: manually-required docs not covered above (no templateId,
              // or template excluded at site level but doc is still marked required).
              const seenManualDocIds = new Set<string>();
              for (const d of siteDocs) {
                if (!d.isRequired) continue;
                if (countedDocIds.has(d.id)) continue;
                if (d.templateId && siteEffectiveRequired.has(d.templateId)) continue;
                if (seenManualDocIds.has(d.id)) continue;
                seenManualDocIds.add(d.id);
                if (d.status === "compliant") compliant++;
                else if (d.status === "approval_required") approvalRequiredRequired++;
                else if (d.status === "overdue") overdueRequired++;
              }
              const overdueAll = siteDocs.filter((d) => d.status === "overdue").length;
              const pendingAll = siteDocs.filter((d) => d.approvalStatus === "pending" || d.approvalStatus === "client_signed_off").length;
              const missingCount = missingRequiredDetails.filter(
                (m) => m.siteId === site.id
              ).length;
              const nonCompliant = approvalRequiredRequired + overdueRequired + missingCount;
              const scoreDenominator = compliant + approvalRequiredRequired + overdueRequired + missingCount;
              const pct =
                scoreDenominator > 0
                  ? Math.round((compliant / scoreDenominator) * 100)
                  : null;
              const hasIssues = missingCount > 0 || overdueRequired > 0 || approvalRequiredRequired > 0;
              const allClear = scoreDenominator > 0 && !hasIssues && pct === 100;

              return (
                <Card
                  key={site.id}
                  className={`overflow-hidden transition-all hover:shadow-md border ${
                    missingCount > 0 || overdueRequired > 0
                      ? "border-red-200 dark:border-red-900/50 hover:border-red-400"
                      : approvalRequiredRequired > 0
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
                          <MapPin className={`h-4 w-4 ${moduleColors[module]}`} />
                        </div>
                        <div className="min-w-0">
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 px-1.5 py-0.5 rounded mb-1">Site</span>
                          {isPrivilegedUser ? (
                            <Link
                              href={`/sites/${site.id}?from=${encodeURIComponent(`${basePath}/sites`)}`}
                              className="font-semibold text-sm leading-snug truncate hover:underline cursor-pointer block"
                              data-testid={`text-site-name-${site.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {site.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-sm leading-snug truncate block" data-testid={`text-site-name-${site.id}`}>
                              {site.name}
                            </span>
                          )}
                          {site.companyName && (
                            isPrivilegedUser ? (
                              <Link
                                href={`/companies/${site.companyId}?from=${encodeURIComponent(`${basePath}/sites`)}`}
                                className="text-xs text-muted-foreground truncate hover:underline cursor-pointer block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {site.companyName}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground truncate block">
                                {site.companyName}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      {missingCount > 0 || overdueRequired > 0 ? (
                        <Badge className="shrink-0 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 border text-xs px-1.5">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      ) : approvalRequiredRequired > 0 ? (
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
                            Document Compliance
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
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className="text-sm font-bold text-foreground">{total}</p>}
                        <p className="text-[10px] text-muted-foreground/70">Total</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && nonCompliant > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${nonCompliant > 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{nonCompliant}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && nonCompliant > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-muted-foreground/70"}`}>Non Comp.</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && overdueAll > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${overdueAll > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground"}`}>{overdueAll}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && overdueAll > 0 ? "text-orange-600/70 dark:text-orange-400/70" : "text-muted-foreground/70"}`}>Overdue</p>
                      </div>
                      <div className={`rounded-lg px-1.5 py-1.5 ${!isLoadingDocs && pendingAll > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"}`}>
                        {isLoadingDocs ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-muted-foreground my-0.5" /> : <p className={`text-sm font-bold ${pendingAll > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{pendingAll}</p>}
                        <p className={`text-[10px] ${!isLoadingDocs && pendingAll > 0 ? "text-amber-600/70 dark:text-amber-400/70" : "text-muted-foreground/70"}`}>Approval</p>
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

          </>
        )}
      </div>

      {/* Pagination — shrink-0 sibling outside the scroll area, pinned to frame bottom */}
      {!isLoadingSites && filteredSites.length > 1 && showPagination && (
        <div className="shrink-0 z-10 px-8 py-3 bg-background border-t flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground" data-testid="text-sites-pagination-summary">
            Showing {(siteStartIdx + 1).toLocaleString()}–{siteEndIdx.toLocaleString()} of {sortedFilteredSites.length.toLocaleString()} sites
          </span>
          <div className="flex items-center gap-1">
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setSitePage(1)}
              disabled={sitePage <= 1}
              aria-label="First page"
              data-testid="button-sites-first-page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setSitePage(p => Math.max(1, p - 1))}
              disabled={sitePage <= 1}
              aria-label="Previous page"
              data-testid="button-sites-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalSitePages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalSitePages || Math.abs(p - sitePage) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-2 text-sm text-muted-foreground select-none">…</span>
                ) : (
                  <button
                    key={p}
                    className={`h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ${p === sitePage ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"}`}
                    onClick={() => setSitePage(p as number)}
                    aria-label={`Page ${p}`}
                    aria-current={p === sitePage ? "page" : undefined}
                    data-testid={`button-sites-page-${p}`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setSitePage(p => Math.min(totalSitePages, p + 1))}
              disabled={sitePage >= totalSitePages}
              aria-label="Next page"
              data-testid="button-sites-next-page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              onClick={() => setSitePage(totalSitePages)}
              disabled={sitePage >= totalSitePages}
              aria-label="Last page"
              data-testid="button-sites-last-page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModuleSites({ module }: { module: ModuleType }) {
  return <ModuleSitesView module={module} />;
}
