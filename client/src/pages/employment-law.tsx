import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { CountUp } from "@/components/ui/count-up";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useLocation, Link, useRoute, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PdfViewer } from "@/components/pdf-viewer";
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  Eye,
  FileText,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  History,
  Lock,
  User,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Scale,
  Users,
  Upload,
  Download,
  LayoutDashboard,
  FolderOpen,
  Building2,
  TrendingUp,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  UserPlus,
  UserMinus,
  Shield,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  FileQuestion,
  X,
  ListChecks,
  Square,
  CheckSquare,
  Check,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture, differenceInDays } from "date-fns";
import type { Case, CaseMilestone, CaseDocumentChecklist, Document, AuditLog, CaseStatus, CaseType, SiteWithDetails, ComplianceSummary, Company, Site, User as UserType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const caseStatusConfig: Record<CaseStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: "Open", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  under_investigation: { label: "Under Investigation", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/40" },
  hearing_scheduled: { label: "Hearing Scheduled", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
  resolved: { label: "Resolved", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40" },
  closed: { label: "Closed", color: "text-gray-700 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

const caseTypeConfig: Record<CaseType, { label: string; icon: typeof Briefcase }> = {
  tribunal_claim: { label: "Tribunal Case", icon: Scale },
};

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const config = caseStatusConfig[status];
  return (
    <Badge className={`${config.bgColor} ${config.color} border-0`}>
      {config.label}
    </Badge>
  );
}

function CaseTypeBadge({ type }: { type: string }) {
  const config = caseTypeConfig[type as CaseType];
  // Fallback for legacy case types that no longer exist in config
  if (!config) {
    return (
      <Badge variant="outline" className="gap-1">
        <Scale className="h-3 w-3" />
        {type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  }
  const Icon = config.icon;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function useDelayedSkeleton(loading: boolean, delay = 200): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);
  return show;
}

// Cases list component (reused by cases tab)
function CasesList() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const urlSiteId = urlParams.get("siteId");
  const urlCompany = urlParams.get("company");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter();
  useEffect(() => {
    if (urlCompany) handleCompanyChange(urlCompany);
    if (urlSiteId) setSelectedSiteId(urlSiteId);
  }, [urlSiteId, urlCompany]);
  const [showArchived, setShowArchived] = useState(false);
  const [caseToArchive, setCaseToArchive] = useState<Case | null>(null);
  const [metricDialog, setMetricDialog] = useState<null | "cases_active" | "cases_resolved" | "overdue" | "upcoming">(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can see the site filter to confirm their access (even with single site)
  const clientHasSites = isClientUser && sites && sites.length > 0;

  // When selecting a site also sync the company dropdown
  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && siteId !== "all" && sites) {
      const site = sites.find(s => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites, setSelectedSiteId, setSelectedCompany]);

  // Filter sites by selected company
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);
  
  // Get site IDs for the selected company
  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany]);
  
  // Get company ID for the selected company (for API filtering)
  const selectedCompanyId = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    const companySite = sites.find(s => s.companyName === selectedCompany);
    return companySite?.companyId || null;
  }, [sites, selectedCompany]);
  
  // Determine site filter for API
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  const casesWasLoadingRef = useRef(false);
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases", siteId, selectedCompanyId, showArchived],
    placeholderData: keepPreviousData,
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) {
        params.set("siteId", siteId);
      }
      if (selectedCompanyId) {
        params.set("entityId", selectedCompanyId);
      }
      if (showArchived) {
        params.set("includeArchived", "true");
      }
      const url = params.toString() ? `/api/cases?${params.toString()}` : "/api/cases";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  if (isLoading) casesWasLoadingRef.current = true;

  // Archive mutation
  const archiveCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest("POST", `/api/cases/${caseId}/archive`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      setCaseToArchive(null);
      toast({ title: "Case archived successfully" });
    },
    onError: () => {
      toast({ title: "Failed to archive case", variant: "destructive" });
    },
  });

  // Unarchive mutation
  const unarchiveCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest("POST", `/api/cases/${caseId}/unarchive`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Case restored from archive" });
    },
    onError: () => {
      toast({ title: "Failed to restore case", variant: "destructive" });
    },
  });
  
  // Build current context label
  const currentContextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (isPrivilegedUser) {
      if (selectedCompany && selectedCompany !== "all") {
        return selectedCompany;
      }
      return "All Clients";
    }
    if (clientHasSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasSites]);

  const contextCompany = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyName || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    return null;
  }, [selectedSiteId, selectedCompany, sites]);

  const contextSite = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") return "All sites";
    return null;
  }, [selectedSiteId, selectedCompany, sites]);

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cases", data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      setShowCreateDialog(false);
      toast({ title: "Case created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create case", variant: "destructive" });
    },
  });

  const filteredCases = cases?.filter(c => {
    const matchesSearch = searchQuery === "" || 
      c.caseReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesType = typeFilter === "all" || c.caseType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  // Always exclude archived cases from metrics
  const activeCases = cases?.filter(c => !c.isArchived) || [];
  const openCases = activeCases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length;
  const resolvedCases = activeCases.filter(c => c.status === "resolved" || c.status === "closed").length;

  // Returns deadline display info for the table column (nearest date, any type)
  const getCaseDisplayDeadline = (c: any): { date: Date; label: string } | null => {
    const candidates: { date: Date; label: string }[] = [];
    if (c.responseDeadline) candidates.push({ date: new Date(c.responseDeadline), label: "Response" });
    if (c.hearingDate) candidates.push({ date: new Date(c.hearingDate), label: "Hearing" });
    if (c.overduesMilestoneDueDate) candidates.push({ date: new Date(c.overduesMilestoneDueDate), label: "Milestone" });
    if (c.upcomingMilestoneDueDate) candidates.push({ date: new Date(c.upcomingMilestoneDueDate), label: "Milestone" });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  };

  // Returns nearest future-only deadline (for Upcoming Deadlines dialog)
  const getCaseUpcomingDeadline = (c: any): { date: Date; label: string } | null => {
    const candidates: { date: Date; label: string }[] = [];
    if (c.responseDeadline && isFuture(new Date(c.responseDeadline))) candidates.push({ date: new Date(c.responseDeadline), label: "Response" });
    if (c.hearingDate && isFuture(new Date(c.hearingDate))) candidates.push({ date: new Date(c.hearingDate), label: "Hearing" });
    if (c.upcomingMilestoneDueDate) candidates.push({ date: new Date(c.upcomingMilestoneDueDate), label: "Milestone" });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  };

  // Returns nearest past-only deadline (for Overdue dialog)
  const getCaseOverdueDeadline = (c: any): { date: Date; label: string } | null => {
    const candidates: { date: Date; label: string }[] = [];
    if (c.responseDeadline && isPast(new Date(c.responseDeadline))) candidates.push({ date: new Date(c.responseDeadline), label: "Response" });
    if (c.hearingDate && isPast(new Date(c.hearingDate))) candidates.push({ date: new Date(c.hearingDate), label: "Hearing" });
    if (c.overduesMilestoneDueDate) candidates.push({ date: new Date(c.overduesMilestoneDueDate), label: "Milestone" });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  };

  // Overdue: has any past deadline from case fields OR from overdue milestones
  const overdueCases = activeCases.filter(c => {
    if (c.responseDeadline && isPast(new Date(c.responseDeadline))) return true;
    if (c.hearingDate && isPast(new Date(c.hearingDate))) return true;
    if (c.overduesMilestoneDueDate) return true;
    return false;
  }).length;

  // Upcoming: has any future deadline within 30 days from case fields OR upcoming milestones within 30 days
  const upcomingCases = activeCases.filter(c => {
    if (c.responseDeadline && isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 30) return true;
    if (c.hearingDate && isFuture(new Date(c.hearingDate)) && differenceInDays(new Date(c.hearingDate), new Date()) <= 30) return true;
    if (c.upcomingMilestoneDueDate && differenceInDays(new Date(c.upcomingMilestoneDueDate), new Date()) <= 30) return true;
    return false;
  }).length;

  const urgentCases = overdueCases + upcomingCases;

  return (
    <div className="theme-el flex flex-col h-full">
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Briefcase className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Employment Law
                <span className="font-normal text-muted-foreground text-2xl"> - Cases</span>
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
          <div className="flex flex-wrap items-center gap-3">
            {(isPrivilegedUser || clientHasSites) && sites && sites.length > 0 && (
              <div className="flex items-center gap-2">
                {((selectedCompany && selectedCompany !== "all") || (selectedSiteId && selectedSiteId !== "all")) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    data-testid="button-clear-filters-cases"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex flex-row items-center gap-2">
                  {isPrivilegedUser && (
                    <CompanyCombobox
                      sites={sites}
                      value={selectedCompany}
                      onValueChange={handleCompanyChange}
                      className="w-[200px]"
                      testId="select-company-cases"
                    />
                  )}
                  <SiteCombobox
                    sites={isPrivilegedUser ? filteredSites : sites}
                    value={selectedSiteId}
                    onValueChange={handleSiteChange}
                    className="w-[200px]"
                    testId="select-site-cases"
                  />
                </div>
              </div>
            )}
            {(user?.role === "admin" || user?.role === "consultant") && (
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="bg-pink-600 hover:bg-pink-700"
                data-testid="button-create-case"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Case
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div id="page-content" className="flex-1 overflow-auto space-y-6 p-8 dash-animate">
      <div className="grid gap-4 md:grid-cols-3">
          {/* Tile 1: Cases — active + resolved split */}
          <div className="rounded-lg border-l-4 border-l-pink-500 border bg-card shadow-sm transition-all hover:shadow-md">
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <div className="text-sm font-medium">Cases</div>
              <div className="rounded-full bg-pink-100 dark:bg-pink-900/40 p-2">
                <Briefcase className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
            </div>
            <div className="p-6 pt-1">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-28" />
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={() => setMetricDialog("cases_active")}
                    className="w-full flex items-center justify-between rounded-md px-1 py-1 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors group"
                    data-testid="stat-card-cases-active"
                  >
                    <span className="text-xs text-muted-foreground group-hover:text-pink-600 transition-colors">Active</span>
                    <span className="text-lg font-bold text-pink-600 dark:text-pink-400"><CountUp value={openCases} animate={casesWasLoadingRef.current} /></span>
                  </button>
                  <div className="border-t" />
                  <button
                    onClick={() => setMetricDialog("cases_resolved")}
                    className="w-full flex items-center justify-between rounded-md px-1 py-1 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors group"
                    data-testid="stat-card-cases-resolved"
                  >
                    <span className="text-xs text-muted-foreground group-hover:text-green-600 transition-colors">Resolved</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400"><CountUp value={resolvedCases} animate={casesWasLoadingRef.current} /></span>
                  </button>
                  <p className="text-xs text-muted-foreground px-1 pt-0.5">Click row to view list</p>
                </div>
              )}
            </div>
          </div>

          {/* Tile 2: Overdue Deadlines */}
          <button
            onClick={() => setMetricDialog("overdue")}
            data-testid="stat-card-overdue"
            className={`text-left rounded-lg border-l-4 border bg-card shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-400/40 ${overdueCases > 0 ? "border-l-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" : "border-l-slate-300"}`}
          >
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <div className="text-sm font-medium">Overdue Deadlines</div>
              <div className={`rounded-full p-2 ${overdueCases > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-slate-100 dark:bg-slate-800/40"}`}>
                <AlertTriangle className={`h-4 w-4 ${overdueCases > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`} />
              </div>
            </div>
            <div className="p-6 pt-0">
              {isLoading ? <Skeleton className="h-8 w-12" /> : <div className={`text-2xl font-bold ${overdueCases > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}><CountUp value={overdueCases} animate={casesWasLoadingRef.current} /></div>}
              <p className="text-xs text-muted-foreground mt-1">Click to view list</p>
            </div>
          </button>

          {/* Tile 3: Upcoming Deadlines */}
          <button
            onClick={() => setMetricDialog("upcoming")}
            data-testid="stat-card-upcoming"
            className={`text-left rounded-lg border-l-4 border bg-card shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${upcomingCases > 0 ? "border-l-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20" : "border-l-slate-300"}`}
          >
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <div className="text-sm font-medium">Upcoming Deadlines</div>
              <div className={`rounded-full p-2 ${upcomingCases > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-slate-100 dark:bg-slate-800/40"}`}>
                <Clock className={`h-4 w-4 ${upcomingCases > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`} />
              </div>
            </div>
            <div className="p-6 pt-0">
              {isLoading ? <Skeleton className="h-8 w-12" /> : <div className={`text-2xl font-bold ${upcomingCases > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}><CountUp value={upcomingCases} animate={casesWasLoadingRef.current} /></div>}
              <p className="text-xs text-muted-foreground mt-1">Click to view list</p>
            </div>
          </button>
        </div>

        {/* Metric breakdown dialog */}
        <Dialog open={metricDialog !== null} onOpenChange={(open) => { if (!open) setMetricDialog(null); }}>
          <DialogContent className="theme-el sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {metricDialog === "cases_active" && <><Briefcase className="h-5 w-5 text-pink-600" /> Active Cases</>}
                {metricDialog === "cases_resolved" && <><CheckCircle className="h-5 w-5 text-green-600" /> Resolved Cases</>}
                {metricDialog === "overdue" && <><AlertTriangle className="h-5 w-5 text-red-500" /> Overdue Deadlines</>}
                {metricDialog === "upcoming" && <><Clock className="h-5 w-5 text-amber-500" /> Upcoming Deadlines</>}
              </DialogTitle>
              <DialogDescription>
                {metricDialog === "cases_active" && "Cases currently open, under investigation, or with a hearing scheduled."}
                {metricDialog === "cases_resolved" && "Cases that have been resolved or closed."}
                {metricDialog === "overdue" && "Cases with a response deadline, hearing date, or milestone that has already passed."}
                {metricDialog === "upcoming" && "Cases with a deadline due within the next 30 days."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
              {(() => {
                let listCases: any[] = [];
                if (metricDialog === "cases_active") {
                  listCases = activeCases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled");
                } else if (metricDialog === "cases_resolved") {
                  listCases = activeCases.filter(c => c.status === "resolved" || c.status === "closed");
                } else if (metricDialog === "overdue") {
                  listCases = activeCases.filter(c => {
                    if (c.responseDeadline && isPast(new Date(c.responseDeadline))) return true;
                    if (c.hearingDate && isPast(new Date(c.hearingDate))) return true;
                    if (c.overduesMilestoneDueDate) return true;
                    return false;
                  });
                } else if (metricDialog === "upcoming") {
                  listCases = activeCases.filter(c => {
                    if (c.responseDeadline && isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 30) return true;
                    if (c.hearingDate && isFuture(new Date(c.hearingDate)) && differenceInDays(new Date(c.hearingDate), new Date()) <= 30) return true;
                    if (c.upcomingMilestoneDueDate && differenceInDays(new Date(c.upcomingMilestoneDueDate), new Date()) <= 30) return true;
                    return false;
                  });
                }
                if (listCases.length === 0) {
                  return <div className="py-8 text-center text-muted-foreground text-sm">No cases to display.</div>;
                }
                return listCases.map((c) => {
                  const deadline = metricDialog === "upcoming" ? getCaseUpcomingDeadline(c) : metricDialog === "overdue" ? getCaseOverdueDeadline(c) : getCaseDisplayDeadline(c);
                  return (
                    <Link key={c.id} href={`/employment-law/cases/${c.id}`} onClick={() => setMetricDialog(null)}>
                      <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/60 cursor-pointer transition-colors group">
                        <div className="min-w-0">
                          <span className="text-xs font-mono font-semibold text-module-accent">{c.caseReference}</span>
                          <p className="text-sm font-medium truncate mt-0.5 group-hover:text-module-accent transition-colors">{c.employeeName}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.caseType?.replace(/_/g, " ")}</p>
                        </div>
                        <div className="ml-4 shrink-0 flex items-center gap-2">
                          {deadline && (metricDialog === "overdue" || metricDialog === "upcoming") && (
                            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${isPast(deadline.date) ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
                              <Clock className={`h-3 w-3 ${isPast(deadline.date) ? "text-red-600" : "text-amber-600"}`} />
                              <span className={`text-xs font-semibold ${isPast(deadline.date) ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                                {format(deadline.date, "MMM d")}
                              </span>
                            </div>
                          )}
                          {(metricDialog === "cases_active" || metricDialog === "cases_resolved") && (
                            <CaseStatusBadge status={c.status as CaseStatus} />
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-module-accent transition-colors" />
                        </div>
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
          </DialogContent>
        </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Case Files</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[200px] pl-8"
                  data-testid="input-search-cases"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="under_investigation">Under Investigation</SelectItem>
                  <SelectItem value="hearing_scheduled">Hearing Scheduled</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tribunal_claim">Tribunal Case</SelectItem>
                </SelectContent>
              </Select>
              {isPrivilegedUser && (
                <Button
                  variant={showArchived ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowArchived(!showArchived)}
                  data-testid="button-toggle-archived"
                  className="gap-2"
                >
                  <Archive className="h-4 w-4" />
                  {showArchived ? "Hide Archived" : "Show Archived"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : filteredCases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((caseItem) => (
                  <TableRow key={caseItem.id} data-testid={`row-case-${caseItem.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {caseItem.isConfidential && <Lock className="h-3 w-3 text-pink-600" />}
                        {caseItem.isArchived && <Archive className="h-3 w-3 text-muted-foreground" />}
                        <span className={caseItem.isArchived ? "text-muted-foreground" : ""}>
                          {caseItem.caseReference}
                        </span>
                        {caseItem.isArchived && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {caseItem.employeeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CaseTypeBadge type={caseItem.caseType as CaseType} />
                    </TableCell>
                    <TableCell>
                      <CaseStatusBadge status={caseItem.status as CaseStatus} />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const nearest = getCaseDisplayDeadline(caseItem);
                        if (!nearest) return <span className="text-muted-foreground">-</span>;
                        return (
                          <div className={`flex items-center gap-1 text-sm ${
                            isPast(nearest.date) ? "text-red-600" :
                            differenceInDays(nearest.date, new Date()) <= 7 ? "text-amber-600" :
                            "text-muted-foreground"
                          }`}>
                            <Clock className="h-3 w-3" />
                            <span>{format(nearest.date, "MMM d")}</span>
                            <span className="text-xs opacity-70">({nearest.label})</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(caseItem.updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-case-menu-${caseItem.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/employment-law/cases/${caseItem.id}`} data-testid={`button-view-case-${caseItem.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Case
                            </Link>
                          </DropdownMenuItem>
                          {isPrivilegedUser && (
                            <>
                              <DropdownMenuSeparator />
                              {caseItem.isArchived ? (
                                <DropdownMenuItem
                                  onClick={() => unarchiveCaseMutation.mutate(caseItem.id)}
                                  data-testid={`button-unarchive-case-${caseItem.id}`}
                                >
                                  <ArchiveRestore className="mr-2 h-4 w-4" />
                                  Restore from Archive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setCaseToArchive(caseItem)}
                                  data-testid={`button-archive-case-${caseItem.id}`}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive Case
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No cases found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first employment law case to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createCaseMutation.mutate(data)}
        isLoading={createCaseMutation.isPending}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!caseToArchive} onOpenChange={(open) => !open && setCaseToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive case <span className="font-semibold">{caseToArchive?.caseReference}</span>?
              <br /><br />
              Archived cases will be hidden from the main case list but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => caseToArchive && archiveCaseMutation.mutate(caseToArchive.id)}
              disabled={archiveCaseMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveCaseMutation.isPending ? "Archiving..." : "Archive Case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

function CreateCaseDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    entityId: "",
    siteId: "",
    employeeName: "",
    employeeId: "",
    caseType: "tribunal_claim" as CaseType,
    description: "",
    isConfidential: true,
    responseDeadline: "",
  });

  // Fetch companies for selection
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    select: (data: any) => data.companies || data,
  });

  // Fetch sites filtered by selected company
  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!formData.entityId,
    select: (data) => data.filter((site: Site) => site.companyId === formData.entityId),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.entityId || !formData.siteId) {
      return;
    }
    onSubmit(formData);
  };

  // Reset site when company changes
  const handleCompanyChange = (companyId: string) => {
    setFormData({ ...formData, entityId: companyId, siteId: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-pink-600" />
            Create New Case
          </DialogTitle>
          <DialogDescription>
            Create a new employment law case file for an individual
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company and Site Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Company <span className="text-destructive">*</span></label>
              <Select
                value={formData.entityId}
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger data-testid="select-company">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Site <span className="text-destructive">*</span></label>
              <Select
                value={formData.siteId}
                onValueChange={(v) => setFormData({ ...formData, siteId: v })}
                disabled={!formData.entityId}
              >
                <SelectTrigger data-testid="select-site">
                  <SelectValue placeholder={formData.entityId ? "Select site" : "Select company first"} />
                </SelectTrigger>
                <SelectContent>
                  {sites?.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Case Type</label>
            <Select
              value={formData.caseType}
              onValueChange={(v) => setFormData({ ...formData, caseType: v as CaseType })}
            >
              <SelectTrigger data-testid="select-case-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tribunal_claim">Tribunal Case</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee Name</label>
              <Input
                value={formData.employeeName}
                onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                placeholder="Full name"
                required
                data-testid="input-employee-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Employee ID (optional)</label>
              <Input
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="EMP-XXXX"
                data-testid="input-employee-id"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Response Deadline (optional)</label>
            <Input
              type="date"
              value={formData.responseDeadline}
              onChange={(e) => setFormData({ ...formData, responseDeadline: e.target.value })}
              data-testid="input-response-deadline"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the case..."
              rows={3}
              data-testid="input-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-submit-case"
            >
              {isLoading ? "Creating..." : "Create Case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CaseDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<CaseStatus>("open");
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [checklistForm, setChecklistForm] = useState({ title: "", description: "" });
  const [editingChecklistItem, setEditingChecklistItem] = useState<CaseDocumentChecklist | null>(null);
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: ["/api/cases", id],
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/cases", id, "documents"],
  });

  const { data: milestones } = useQuery<CaseMilestone[]>({
    queryKey: ["/api/cases", id, "milestones"],
  });

  const { data: checklistItems } = useQuery<CaseDocumentChecklist[]>({
    queryKey: ["/api/cases", id, "checklist"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/cases", id, "audit"],
  });

  // Fetch company and site details for display
  const { data: company } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/companies", caseData?.entityId],
    enabled: !!caseData?.entityId,
  });

  const { data: site } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/sites", caseData?.siteId],
    enabled: !!caseData?.siteId,
  });

  // Fetch all users for access management (admin/consultant only)
  const { data: allUsers } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" || user?.role === "consultant",
  });

  // Filter to company users
  const companyUsers = useMemo(() => {
    if (!allUsers || !caseData?.entityId) return [];
    return allUsers.filter(u => u.companyId === caseData.entityId);
  }, [allUsers, caseData?.entityId]);

  // Parse restrictedToUsers (stored as JSON string)
  const restrictedUserIds = useMemo(() => {
    if (!caseData?.restrictedToUsers) return [] as string[];
    try {
      const parsed = typeof caseData.restrictedToUsers === 'string' 
        ? JSON.parse(caseData.restrictedToUsers) 
        : caseData.restrictedToUsers;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [] as string[];
    }
  }, [caseData]);

  // Get users who currently have access to this case
  const usersWithAccess = useMemo(() => {
    if (!companyUsers) return [];
    return companyUsers.filter(u => restrictedUserIds.includes(u.id));
  }, [companyUsers, restrictedUserIds]);

  // Get users who could be added to access list (only clients)
  const availableUsers = useMemo(() => {
    if (!companyUsers) return [];
    return companyUsers.filter(u => !restrictedUserIds.includes(u.id) && u.role === "client");
  }, [companyUsers, restrictedUserIds]);

  const updateCaseMutation = useMutation({
    mutationFn: async (updates: Partial<Case>) => {
      return apiRequest("PATCH", `/api/cases/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setShowStatusDialog(false);
      toast({ title: "Case updated successfully" });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/milestones", { ...data, caseId: id });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setShowMilestoneDialog(false);
      toast({ title: "Milestone added successfully" });
    },
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, { isCompleted: true });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      toast({ title: "Milestone completed" });
    },
  });

  const reopenMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, { isCompleted: false });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      toast({ title: "Milestone reopened" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: any }) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setEditingMilestone(null);
      toast({ title: "Milestone updated" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/employment_law"] });
      toast({ title: "Milestone deleted" });
    },
  });

  const createChecklistItemMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      return apiRequest("POST", "/api/checklist", { ...data, caseId: id });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      setShowChecklistDialog(false);
      setChecklistForm({ title: "", description: "" });
      toast({ title: "Checklist item added" });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: any }) => {
      return apiRequest("PATCH", `/api/checklist/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      setEditingChecklistItem(null);
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/checklist/${itemId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Checklist item deleted" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/cases/${id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Document deleted" });
    },
  });

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState<string | null>(null);
  const [showEssentialDocDialog, setShowEssentialDocDialog] = useState(false);

  const doUpload = async (file: File, checklistItemId?: string | null) => {
    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const uploadRes = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": file.name,
        },
        body: buffer,
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file");
      const { objectPath } = await uploadRes.json();

      const docRecord = await apiRequest("POST", `/api/cases/${id}/documents`, {
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
        mimeType: file.type,
      });
      const createdDoc = await docRecord.json().catch(() => null);

      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.refetchQueries({ queryKey: ["/api/cases", id, "audit"] });

      if (checklistItemId) {
        updateChecklistItemMutation.mutate(
          { itemId: checklistItemId, data: { isCompleted: true, linkedDocumentId: createdDoc?.id ?? null } },
          {
            onSuccess: () => {
              toast({ title: "Document uploaded & essential document marked complete" });
            },
          }
        );
      } else {
        toast({ title: "Document uploaded successfully" });
      }
    } catch (error) {
      toast({ title: "Failed to upload document", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      setSelectedChecklistItemId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const incompleteItems = (checklistItems ?? []).filter(i => !i.isCompleted);
    if (incompleteItems.length > 0) {
      // Intercept — show dialog before uploading
      setPendingFile(file);
      setSelectedChecklistItemId(null);
      setShowEssentialDocDialog(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      doUpload(file);
    }
  };

  const [editingMilestone, setEditingMilestone] = useState<CaseMilestone | null>(null);
  const [showCompletedMilestones, setShowCompletedMilestones] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Briefcase className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Case not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/employment-law")}>
          Back to Cases
        </Button>
      </div>
    );
  }

  const completedMilestones = milestones?.filter(m => m.isCompleted).length || 0;
  const totalMilestones = milestones?.length || 0;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const INITIAL_DISPLAY_COUNT = 3;
  const displayedLogs = showAllAuditLogs ? auditLogs : auditLogs?.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreLogs = (auditLogs?.length || 0) > INITIAL_DISPLAY_COUNT;

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'case_created':
        return { icon: Plus, bg: 'bg-pink-100 dark:bg-pink-900/40', color: 'text-pink-600 dark:text-pink-400' };
      case 'case_status_changed':
        return { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400' };
      case 'document_uploaded':
        return { icon: Upload, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400' };
      case 'milestone_added':
        return { icon: Calendar, bg: 'bg-purple-100 dark:bg-purple-900/40', color: 'text-purple-600 dark:text-purple-400' };
      case 'milestone_completed':
        return { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400' };
      case 'case_access_updated':
        return { icon: Shield, bg: 'bg-indigo-100 dark:bg-indigo-900/40', color: 'text-indigo-600 dark:text-indigo-400' };
      case 'checklist_item_added':
        return { icon: ListChecks, bg: 'bg-pink-100 dark:bg-pink-900/40', color: 'text-pink-600 dark:text-pink-400' };
      case 'checklist_item_completed':
        return { icon: CheckSquare, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400' };
      case 'checklist_item_reopened':
        return { icon: RotateCcw, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400' };
      case 'checklist_item_deleted':
        return { icon: Trash2, bg: 'bg-red-100 dark:bg-red-900/40', color: 'text-red-600 dark:text-red-400' };
      default:
        return { icon: FileText, bg: 'bg-muted', color: 'text-muted-foreground' };
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/employment-law")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {caseData.isConfidential && <Lock className="h-5 w-5 text-pink-600" />}
              {caseData.caseReference}
            </h1>
            <CaseStatusBadge status={caseData.status as CaseStatus} />
            <CaseTypeBadge type={caseData.caseType as CaseType} />
          </div>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <User className="h-4 w-4" />
            {caseData.employeeName}
            {caseData.employeeId && <span className="text-sm">({caseData.employeeId})</span>}
          </p>
        </div>
        {(user?.role === "admin" || user?.role === "consultant") && (
          <Button
            variant="outline"
            onClick={() => {
              setNewStatus(caseData.status as CaseStatus);
              setShowStatusDialog(true);
            }}
            data-testid="button-update-status"
          >
            Update Status
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Case Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="mt-1 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {company?.name || "Loading..."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Site</p>
                    <p className="mt-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {site?.name || "Loading..."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1">{caseData.description || "No description provided"}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {caseData.hearingDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Hearing Date</p>
                      <p className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(caseData.hearingDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {caseData.responseDeadline && (
                    <div>
                      <p className="text-sm text-muted-foreground">Response Deadline</p>
                      <p className={`mt-1 flex items-center gap-2 ${
                        isPast(new Date(caseData.responseDeadline)) ? "text-red-600" : ""
                      }`}>
                        <Clock className="h-4 w-4" />
                        {format(new Date(caseData.responseDeadline), "MMMM d, yyyy")}
                        {isPast(new Date(caseData.responseDeadline)) && (
                          <Badge variant="destructive" className="ml-2">Overdue</Badge>
                        )}
                      </p>
                    </div>
                  )}
                  {caseData.resolutionDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Resolution Date</p>
                      <p className="mt-1 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {format(new Date(caseData.resolutionDate), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg">Milestones</CardTitle>
                <CardDescription>Track key dates and tasks for this case</CardDescription>
              </div>
              {(user?.role === "admin" || user?.role === "consultant") && (
                <Button 
                  size="sm" 
                  onClick={() => setShowMilestoneDialog(true)}
                  className="bg-pink-600 hover:bg-pink-700"
                  data-testid="button-add-milestone"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Milestone
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {totalMilestones > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{completedMilestones} of {totalMilestones} completed</span>
                  </div>
                  <Progress value={milestoneProgress} className="h-2" />
                </div>
              )}
              {(() => {
                const pending = (milestones ?? [])
                  .filter(m => !m.isCompleted)
                  .sort((a, b) => {
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  });
                const completed = (milestones ?? []).filter(m => m.isCompleted);

                const renderMilestone = (milestone: CaseMilestone) => (
                  <div
                    key={milestone.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      milestone.isCompleted ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card"
                    }`}
                    data-testid={`milestone-${milestone.id}`}
                  >
                    <div className={`mt-0.5 rounded-full p-1 ${
                      milestone.isCompleted
                        ? "bg-green-100 dark:bg-green-900/40 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {milestone.isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {milestone.title}
                      </p>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                      )}
                      {milestone.dueDate && (
                        <p className={`text-xs mt-1 ${
                          !milestone.isCompleted && isPast(new Date(milestone.dueDate))
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        }`}>
                          {!milestone.isCompleted && isPast(new Date(milestone.dueDate)) ? "Overdue · " : "Due: "}
                          {format(new Date(milestone.dueDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    {(user?.role === "admin" || user?.role === "consultant") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-milestone-menu-${milestone.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!milestone.isCompleted ? (
                            <DropdownMenuItem
                              onClick={() => completeMilestoneMutation.mutate(milestone.id)}
                              data-testid={`button-complete-milestone-${milestone.id}`}
                            >
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Mark Complete
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => reopenMilestoneMutation.mutate(milestone.id)}
                              data-testid={`button-reopen-milestone-${milestone.id}`}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reopen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setEditingMilestone(milestone)}
                            data-testid={`button-edit-milestone-${milestone.id}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                            className="text-red-600"
                            data-testid={`button-delete-milestone-${milestone.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );

                return (
                  <div className="space-y-3">
                    {pending.length === 0 && completed.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No milestones yet</p>
                    )}
                    {pending.map(renderMilestone)}
                    {pending.length === 0 && completed.length > 0 && (
                      <p className="text-center text-sm text-muted-foreground py-2">All milestones completed</p>
                    )}
                    {completed.length > 0 && (
                      <div>
                        <button
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-1"
                          onClick={() => setShowCompletedMilestones(v => !v)}
                          data-testid="button-toggle-completed-milestones"
                        >
                          {showCompletedMilestones ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          {completed.length} completed milestone{completed.length !== 1 ? "s" : ""}
                        </button>
                        {showCompletedMilestones && (
                          <div className="space-y-3 mt-2">
                            {completed.map(renderMilestone)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* ── Essential Documents Checklist ─────────────────────────────── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-pink-600" />
                  Essential Documents
                </CardTitle>
                <CardDescription>Key documents required for this case</CardDescription>
              </div>
              {(user?.role === "admin" || user?.role === "consultant") && (
                <Button
                  size="sm"
                  onClick={() => { setEditingChecklistItem(null); setChecklistForm({ title: "", description: "" }); setShowChecklistDialog(true); }}
                  className="bg-pink-600 hover:bg-pink-700"
                  data-testid="button-add-checklist-item"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {(() => {
                const items = checklistItems ?? [];
                const completedCount = items.filter(i => i.isCompleted).length;
                const totalCount = items.length;
                const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                return (
                  <>
                    {totalCount > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{completedCount} of {totalCount} completed</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                      </div>
                    )}
                    <div className="space-y-2">
                      {items.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No essential documents listed yet</p>
                      )}
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            item.isCompleted ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-card hover:bg-muted/30"
                          }`}
                          data-testid={`checklist-item-${item.id}`}
                        >
                          <button
                            onClick={() => updateChecklistItemMutation.mutate({ itemId: item.id, data: { isCompleted: !item.isCompleted } })}
                            className={`mt-0.5 shrink-0 transition-colors ${item.isCompleted ? "text-green-600" : "text-muted-foreground hover:text-pink-600"}`}
                            data-testid={`button-toggle-checklist-${item.id}`}
                            title={item.isCompleted ? "Mark incomplete" : "Mark complete"}
                          >
                            {item.isCompleted
                              ? <CheckSquare className="h-5 w-5" />
                              : <Square className="h-5 w-5" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                            {item.isCompleted && item.completedAt && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                Completed {format(new Date(item.completedAt), "d MMM yyyy")}
                              </p>
                            )}
                          </div>
                          {(user?.role === "admin" || user?.role === "consultant") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-checklist-menu-${item.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => { setEditingChecklistItem(item); setChecklistForm({ title: item.title, description: item.description ?? "" }); setShowChecklistDialog(true); }}
                                  data-testid={`button-edit-checklist-${item.id}`}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteChecklistItemMutation.mutate(item.id)}
                                  className="text-red-600"
                                  data-testid={`button-delete-checklist-${item.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg">Case Documents</CardTitle>
                <CardDescription>Documents linked to this case</CardDescription>
              </div>
              {(user?.role === "admin" || user?.role === "consultant") && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    data-testid="input-file-upload"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-document"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload"}
                  </Button>
                </>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {documents && documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const linkedChecklistItem = (checklistItems ?? []).find(i => i.linkedDocumentId === doc.id);
                    return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border hover-elevate">
                      <FileText className="h-5 w-5 text-pink-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                        {linkedChecklistItem && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                            <CheckSquare className="h-3 w-3" />
                            Fulfils: {linkedChecklistItem.title}
                          </span>
                        )}
                      </div>
                      {doc.fileUrl && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/")) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewDoc(doc)}
                          data-testid={`button-preview-doc-${doc.id}`}
                          title="Preview document"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" data-testid={`button-download-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                      {(user?.role === "admin" || user?.role === "consultant") && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => deleteDocumentMutation.mutate(doc.id)}
                          data-testid={`button-delete-doc-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No documents uploaded yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(user?.role === "admin" || user?.role === "consultant") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5" />
                  Case Access
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowAccessDialog(true)}
                  data-testid="button-manage-access"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent>
                {caseData?.isConfidential ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>This case is confidential</span>
                    </div>
                    {usersWithAccess.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Users with access:</p>
                        {usersWithAccess.map(u => (
                          <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="text-sm">{u.fullName}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                              onClick={() => {
                                const newList = restrictedUserIds.filter(id => id !== u.id);
                                updateCaseMutation.mutate({ restrictedToUsers: newList as any });
                              }}
                              data-testid={`button-remove-access-${u.id}`}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No client users have been granted access yet.</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>This case is visible to all company users</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Audit Trail
                {auditLogs && <Badge variant="secondary" className="text-xs">{auditLogs.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayedLogs?.map((log) => {
                  const style = getActionStyle(log.action);
                  const ActionIcon = style.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                        <ActionIcon className={`h-4 w-4 ${style.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.details}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.userName} - {format(new Date(log.createdAt), "MMM d 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {(!auditLogs || auditLogs.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">No audit history yet</p>
                )}
              </div>
              {hasMoreLogs && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setShowAllAuditLogs(!showAllAuditLogs)}
                  data-testid="button-toggle-audit-logs"
                >
                  {showAllAuditLogs ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Show {(auditLogs?.length || 0) - INITIAL_DISPLAY_COUNT} More
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>You are about to change the status of case <span className="font-semibold">{caseData?.caseReference}</span>.</p>
              <div className="flex items-center gap-2 py-2">
                <span className="text-muted-foreground">Current:</span>
                <CaseStatusBadge status={caseData?.status as CaseStatus || "open"} />
                <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
                <span className="text-muted-foreground">New:</span>
                <CaseStatusBadge status={newStatus} />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-2 block">Select New Status</label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as CaseStatus)}>
              <SelectTrigger data-testid="select-new-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="under_investigation">Under Investigation</SelectItem>
                <SelectItem value="hearing_scheduled">Hearing Scheduled</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateCaseMutation.mutate({ status: newStatus })}
              disabled={updateCaseMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-confirm-status"
            >
              {updateCaseMutation.isPending ? "Updating..." : "Confirm Status Change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>Add a key date or task to track for this case</DialogDescription>
          </DialogHeader>
          <CreateMilestoneForm
            onSubmit={(data) => createMilestoneMutation.mutate(data)}
            onCancel={() => setShowMilestoneDialog(false)}
            isLoading={createMilestoneMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMilestone} onOpenChange={(open) => !open && setEditingMilestone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>Update the milestone details</DialogDescription>
          </DialogHeader>
          {editingMilestone && (
            <EditMilestoneForm
              milestone={editingMilestone}
              onSubmit={(data) => updateMilestoneMutation.mutate({ milestoneId: editingMilestone.id, data })}
              onCancel={() => setEditingMilestone(null)}
              isLoading={updateMilestoneMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Checklist add/edit dialog */}
      <Dialog open={showChecklistDialog} onOpenChange={(open) => { setShowChecklistDialog(open); if (!open) { setEditingChecklistItem(null); setChecklistForm({ title: "", description: "" }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChecklistItem ? "Edit Essential Document" : "Add Essential Document"}</DialogTitle>
            <DialogDescription>
              {editingChecklistItem ? "Update the document checklist item" : "Add a key document that must be completed for this case"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Document name <span className="text-red-500">*</span></label>
              <Input
                placeholder="e.g. ET1 Claim Form, Settlement Agreement…"
                value={checklistForm.title}
                onChange={e => setChecklistForm(f => ({ ...f, title: e.target.value }))}
                data-testid="input-checklist-title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Textarea
                placeholder="Any additional details about this document…"
                value={checklistForm.description}
                onChange={e => setChecklistForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                data-testid="input-checklist-description"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowChecklistDialog(false)} data-testid="button-checklist-cancel">Cancel</Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700"
                disabled={!checklistForm.title.trim() || (editingChecklistItem ? updateChecklistItemMutation.isPending : createChecklistItemMutation.isPending)}
                onClick={() => {
                  if (editingChecklistItem) {
                    updateChecklistItemMutation.mutate({ itemId: editingChecklistItem.id, data: { title: checklistForm.title.trim(), description: checklistForm.description.trim() || null } });
                    setShowChecklistDialog(false);
                  } else {
                    createChecklistItemMutation.mutate({ title: checklistForm.title.trim(), description: checklistForm.description.trim() });
                  }
                }}
                data-testid="button-checklist-save"
              >
                {editingChecklistItem ? "Save Changes" : "Add to Checklist"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-upload essential document matching dialog */}
      <Dialog
        open={showEssentialDocDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowEssentialDocDialog(false);
            setPendingFile(null);
            setSelectedChecklistItemId(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-pink-600" />
              Does this fulfil an essential document?
            </DialogTitle>
            <DialogDescription>
              {pendingFile && (
                <>
                  Uploading <span className="font-medium text-foreground">"{pendingFile.name.replace(/\.[^/.]+$/, "")}"</span>. Select which essential document this satisfies, or upload without linking.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto py-1">
            {(checklistItems ?? []).filter(i => !i.isCompleted).map(item => {
              const isSelected = selectedChecklistItemId === item.id;
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                    isSelected
                      ? "bg-pink-50 dark:bg-pink-900/30 border-pink-400 dark:border-pink-600"
                      : "bg-card hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:border-pink-300 dark:hover:border-pink-700"
                  }`}
                  onClick={() => setSelectedChecklistItemId(isSelected ? null : item.id)}
                  data-testid={`button-link-checklist-${item.id}`}
                >
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-sm border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "bg-pink-600 border-pink-600" : "border-muted-foreground"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-2 border-t gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowEssentialDocDialog(false);
                if (pendingFile) doUpload(pendingFile, null);
              }}
              data-testid="button-upload-without-linking"
            >
              Upload without linking
            </Button>
            <Button
              size="sm"
              className="bg-pink-600 hover:bg-pink-700 text-white"
              disabled={!selectedChecklistItemId || isUploading}
              onClick={() => {
                setShowEssentialDocDialog(false);
                if (pendingFile) doUpload(pendingFile, selectedChecklistItemId);
              }}
              data-testid="button-upload-and-complete"
            >
              {isUploading ? "Uploading…" : selectedChecklistItemId ? "Upload & Mark Complete" : "Select one above"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Case Access</DialogTitle>
            <DialogDescription>Select a client user to grant access to this case</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableUsers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableUsers.map(u => (
                  <div 
                    key={u.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => {
                      const newList = [...restrictedUserIds, u.id];
                      updateCaseMutation.mutate({ restrictedToUsers: newList as any });
                      setShowAccessDialog(false);
                    }}
                    data-testid={`button-grant-access-${u.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{u.fullName}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <UserPlus className="h-5 w-5 text-pink-600" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                All client users already have access to this case.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="h-[80vh] flex flex-col p-0 gap-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewDoc?.title || previewDoc?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewDoc && (() => {
              const mime = previewDoc.mimeType || "";
              const previewUrl = `/api/documents/${previewDoc.id}/preview`;
              if (mime === "application/pdf") {
                return <PdfViewer url={previewUrl} />;
              }
              if (mime.startsWith("image/")) {
                return (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-muted/20">
                    <img
                      src={previewUrl}
                      alt={previewDoc.title}
                      className="max-w-full max-h-full object-contain rounded"
                      data-testid="preview-image"
                    />
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateMilestoneForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Schedule hearing"
          required
          data-testid="input-milestone-title"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description (optional)</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional details..."
          rows={2}
          data-testid="input-milestone-description"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Due Date (optional)</label>
        <Input
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          data-testid="input-milestone-due-date"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-pink-600 hover:bg-pink-700"
          data-testid="button-submit-milestone"
        >
          {isLoading ? "Adding..." : "Add Milestone"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditMilestoneForm({
  milestone,
  onSubmit,
  onCancel,
  isLoading,
}: {
  milestone: CaseMilestone;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: milestone.title,
    description: milestone.description || "",
    dueDate: milestone.dueDate ? format(new Date(milestone.dueDate), "yyyy-MM-dd") : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: formData.title,
      description: formData.description || null,
      dueDate: formData.dueDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Schedule hearing"
          required
          data-testid="input-edit-milestone-title"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description (optional)</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional details..."
          rows={2}
          data-testid="input-edit-milestone-description"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Due Date (optional)</label>
        <Input
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          data-testid="input-edit-milestone-due-date"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-pink-600 hover:bg-pink-700"
          data-testid="button-save-milestone"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Metric Card component (matches module-dashboard.tsx pattern)
function ELMetricCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  testId,
  loading = false,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  testId?: string;
  loading?: boolean;
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
        <div className="text-3xl font-semibold" data-testid={testId ? `${testId}-value` : undefined}>{loading ? "–" : value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}

// Compliance Score Card for Employment Law
function ELComplianceScoreCard({ score, loading = false }: { score: number; loading?: boolean }) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (s >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (s: number) => {
    if (s >= 90) return "bg-emerald-500";
    if (s >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card data-testid="card-el-compliance-score">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Employment Law Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold ${loading ? "text-muted-foreground" : getScoreColor(score)}`} data-testid="text-el-compliance-score">
            {loading ? "–" : `${score}%`}
          </span>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full transition-all ${loading ? "bg-muted" : getScoreBg(score)}`}
              style={{ width: loading ? "0%" : `${score}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
}

// Employment Law Dashboard with company/site filters
function EmploymentLawDashboardView() {
  const { user } = useAuth();
  const { selectedCompany, selectedSiteId } = useSiteFilter();
  const [, navigate] = useLocation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  type DocsDialogFilter = "req_compliant" | "req_non_compliant" | "req_overdue" | "total" | "all_compliant" | "all_review" | "all_overdue";
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [docsDialogFilter, setDocsDialogFilter] = useState<DocsDialogFilter | null>(null);
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (needed for site name lookup in recent docs/cases)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Get site IDs for the selected company
  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany]);
  
  // Get company ID for the selected company (for API filtering)
  const selectedCompanyId = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    const companySite = sites.find(s => s.companyName === selectedCompany);
    return companySite?.companyId || null;
  }, [sites, selectedCompany]);
  
  const contextCompany = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyName || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    return null;
  }, [selectedSiteId, selectedCompany, sites]);

  const contextSite = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") return "All Sites";
    return "All Sites";
  }, [selectedSiteId, selectedCompany, sites]);

  // Determine site filter for API
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  // Single combined fetch for all Employment Law dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{
    summary: ComplianceSummary;
    cases: Case[];
    allDocuments: Document[];
    recentDocuments: Document[];
  }>({
    queryKey: ["/api/dashboard/employment_law", siteId, selectedCompanyId],
    placeholderData: keepPreviousData,
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (selectedCompanyId) params.set("entityId", selectedCompanyId);
      const url = params.toString() ? `/api/dashboard/employment_law?${params.toString()}` : "/api/dashboard/employment_law";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const companySiteIdsKey = companySiteIds?.join(",") || null;

  const { data: missingRequiredDetails = [] } = useQuery<MissingRequiredTemplateDetail[]>({
    queryKey: ["/api/missing-required-templates", "employment_law", siteId, companySiteIdsKey],
    queryFn: async () => {
      const params: string[] = ["module=employment_law"];
      if (siteId) params.push(`siteId=${siteId}`);
      else if (companySiteIds && companySiteIds.length > 0) params.push(`siteIds=${companySiteIds.join(",")}`);
      const res = await fetch(`/api/missing-required-templates?${params.join("&")}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch missing required templates");
      return res.json();
    },
  });

  const summary = dashboardData?.summary;
  const cases = dashboardData?.cases;
  const recentDocuments = dashboardData?.allDocuments;

  const isLoading = dashboardLoading || sitesLoading;
  
  // Always exclude archived cases from metrics
  const activeCases = cases?.filter(c => !c.isArchived) || [];
  const openCases = activeCases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length;

  const overdueCases2 = activeCases.filter(c => {
    if (c.responseDeadline && isPast(new Date(c.responseDeadline))) return true;
    if (c.hearingDate && isPast(new Date(c.hearingDate))) return true;
    if (c.overduesMilestoneDueDate) return true;
    return false;
  }).length;

  const upcomingCases2 = activeCases.filter(c => {
    if (c.responseDeadline && isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 30) return true;
    if (c.hearingDate && isFuture(new Date(c.hearingDate)) && differenceInDays(new Date(c.hearingDate), new Date()) <= 30) return true;
    if (c.upcomingMilestoneDueDate && differenceInDays(new Date(c.upcomingMilestoneDueDate), new Date()) <= 30) return true;
    return false;
  }).length;

  const urgentCases = overdueCases2 + upcomingCases2;
  
  // Get recent 5 documents and cases (excluding archived)
  const recentDocs = useMemo(() => {
    if (!recentDocuments) return [];
    return [...recentDocuments]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [recentDocuments]);
  
  const recentCases = useMemo(() => {
    if (!cases) return [];
    return [...cases]
      .filter(c => !c.isArchived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [cases]);
  
  // Calculate renewal metrics
  const renewalMetrics = useMemo(() => {
    if (!recentDocuments) return { overdue: 0, due30Days: 0, due60Days: 0, upcomingRenewals: [] as Document[] };

    const now = Date.now();
    let overdue = 0;
    let due30Days = 0;
    let due60Days = 0;
    const upcomingRenewals: Document[] = [];

    recentDocuments.forEach((doc) => {
      if (!doc.renewalDate) return;
      const renewalDate = new Date(doc.renewalDate).getTime();
      const daysUntilRenewal = Math.ceil((renewalDate - now) / (1000 * 60 * 60 * 24));

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

    upcomingRenewals.sort((a, b) => {
      const aDate = a.renewalDate ? new Date(a.renewalDate).getTime() : Infinity;
      const bDate = b.renewalDate ? new Date(b.renewalDate).getTime() : Infinity;
      return aDate - bDate;
    });

    return { overdue, due30Days, due60Days, upcomingRenewals };
  }, [recentDocuments]);

  const filteredModuleDocs = useMemo(() => {
    if (!recentDocuments) return [];
    return recentDocuments.filter(doc => {
      if (doc.isArchived) return false;
      if (siteId) return doc.siteId === siteId;
      if (companySiteIds && companySiteIds.length > 0) return companySiteIds.includes(doc.siteId);
      return true;
    });
  }, [recentDocuments, siteId, companySiteIds]);

  const docsDialogMeta: Record<DocsDialogFilter, { title: string }> = {
    req_compliant: { title: "Compliant (Required Documents)" },
    req_non_compliant: { title: "Not Compliant (Required Documents)" },
    req_overdue: { title: "Overdue (Required Documents)" },
    total: { title: "All Documents" },
    all_compliant: { title: "All Compliant Documents" },
    all_review: { title: "Review Required" },
    all_overdue: { title: "All Overdue Documents" },
  };

  const docsDialogDocs = useMemo((): Document[] => {
    if (!docsDialogFilter) return [];
    switch (docsDialogFilter) {
      case "req_compliant": return filteredModuleDocs.filter(d => d.isRequired && d.status === "compliant");
      case "req_non_compliant": return filteredModuleDocs.filter(d => d.isRequired && (d.status === "overdue" || d.status === "review_required"));
      case "req_overdue": return filteredModuleDocs.filter(d => d.isRequired && d.status === "overdue");
      case "total": return filteredModuleDocs.filter(d => !!d.isRequired);
      case "all_compliant": return filteredModuleDocs.filter(d => !!d.isRequired && d.status === "compliant");
      case "all_review": return filteredModuleDocs.filter(d => !!d.isRequired && d.status === "review_required");
      case "all_overdue": return filteredModuleDocs.filter(d => !!d.isRequired && d.status === "overdue");
      default: return [];
    }
  }, [docsDialogFilter, filteredModuleDocs]);

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

  // Build URL for View Documents with filter context
  const viewDocumentsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSiteId && selectedSiteId !== "all") {
      params.set("siteId", selectedSiteId);
    } else if (selectedCompany && selectedCompany !== "all") {
      params.set("company", selectedCompany);
    }
    const queryString = params.toString();
    return queryString ? `/employment-law/documents?${queryString}` : "/employment-law/documents";
  }, [selectedSiteId, selectedCompany]);
  
  // Build URL for View Cases with filter context
  const viewCasesUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSiteId && selectedSiteId !== "all") {
      params.set("siteId", selectedSiteId);
    } else if (selectedCompany && selectedCompany !== "all") {
      params.set("company", selectedCompany);
    }
    const queryString = params.toString();
    return queryString ? `/employment-law/cases?${queryString}` : "/employment-law/cases";
  }, [selectedSiteId, selectedCompany]);

  return (
    <div className="theme-el flex flex-col h-full">
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Scale className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Employment Law
                <span className="font-normal text-muted-foreground text-2xl"> — Legal Document Compliance</span>
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
          <Button className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground" asChild>
            <Link href={viewDocumentsUrl} data-testid="link-view-documents-el">
              <FileText className="mr-2 h-4 w-4" />
              View Documents
            </Link>
          </Button>
        </div>
      </div>
      
      <div id="page-content" className="flex-1 overflow-auto space-y-8 p-8 dash-animate">

        {/* Compliance Section */}
        {(() => {
          const score = summary?.complianceScore || 0;
          const compliantCount = summary?.compliantDocuments || 0;
          const nonCompliantCount = (summary?.overdueDocuments || 0) + (summary?.reviewRequired || 0);
          const documentsMissingCount = summary?.missingRequiredDocuments || 0;
          const scoreColor = score >= 90 ? "text-emerald-600 dark:text-emerald-400" : score >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
          const scoreBg = score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-red-500";
          return (
            <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-compliance-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  EL Compliance
                </CardTitle>
                <CardDescription>Based on required documents only</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-32" />
                    <Skeleton className="h-3 w-full rounded-full" />
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}
                    </div>
                    <div className="rounded-md border bg-muted/30 p-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Score */}
                    <div>
                      <span className={`text-6xl font-bold ${scoreColor}`} data-testid="card-el-score">
                        {score}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${scoreBg}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>

                    {/* Compliance stats: required docs only */}
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => compliantCount > 0 && setDocsDialogFilter("req_compliant")}
                        className={`rounded-md border p-3 text-center w-full transition-colors bg-background ${compliantCount > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                        data-testid="card-el-compliant"
                      >
                        <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-2xl font-semibold">{compliantCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Compliant</p>
                        {compliantCount > 0 && <p className="text-xs text-emerald-500/70 mt-0.5">Click to view</p>}
                      </button>
                      <button
                        onClick={() => nonCompliantCount > 0 && setDocsDialogFilter("req_non_compliant")}
                        className={`rounded-md border p-3 text-center w-full transition-colors bg-background ${nonCompliantCount > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                        data-testid="card-el-non-compliant"
                      >
                        <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-2xl font-semibold">{nonCompliantCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Not Compliant</p>
                        {nonCompliantCount > 0 && <p className="text-xs text-red-500/70 mt-0.5">Click to view</p>}
                      </button>
                      <button
                        onClick={() => documentsMissingCount > 0 && setShowMissingDialog(true)}
                        className={`rounded-md border p-3 text-center w-full transition-colors bg-background ${documentsMissingCount > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                        data-testid="card-el-docs-missing"
                      >
                        <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                          <FileQuestion className="h-4 w-4" />
                          <span className="text-2xl font-semibold">{documentsMissingCount}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Required Docs Missing</p>
                        {documentsMissingCount > 0 && <p className="text-xs text-orange-500/70 mt-0.5">Click to view</p>}
                      </button>
                    </div>

                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Document Progress Card */}
        <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-el-document-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Progress
            </CardTitle>
            <CardDescription>All documents across this module</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  onClick={() => (summary?.allDocuments || 0) > 0 && setDocsDialogFilter("total")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${(summary?.allDocuments || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-el-total"
                >
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-semibold">{summary?.allDocuments || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Total</p>
                </button>
                <button
                  onClick={() => (summary?.allCompliantDocuments || 0) > 0 && setDocsDialogFilter("all_compliant")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${(summary?.allCompliantDocuments || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-el-compliant"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary?.allCompliantDocuments || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </button>
                <button
                  onClick={() => (summary?.allReviewRequired || 0) > 0 && setDocsDialogFilter("all_review")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${(summary?.allReviewRequired || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-el-review"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary?.allReviewRequired || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Review Required</p>
                </button>
                <button
                  onClick={() => (summary?.allOverdueDocuments || 0) > 0 && setDocsDialogFilter("all_overdue")}
                  className={`text-center rounded-md border p-3 transition-colors bg-background ${(summary?.allOverdueDocuments || 0) > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                  data-testid="progress-el-overdue"
                >
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{summary?.allOverdueDocuments || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Case Overview Section */}
        <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-case-overview">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Case Overview
            </CardTitle>
            <CardDescription>Active employment law case status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-3 grid-cols-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-md border p-3 text-center">
                    <Skeleton className="h-7 w-10 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-3">
                <div className="rounded-md border p-3 text-center" data-testid="card-el-active-cases">
                  <div className="flex items-center justify-center gap-1 text-pink-600 dark:text-pink-400">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{openCases}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Active</p>
                </div>
                <div className="rounded-md border p-3 text-center" data-testid="card-el-overdue">
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{overdueCases2}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Overdue</p>
                </div>
                <div className="rounded-md border p-3 text-center" data-testid="card-el-upcoming">
                  <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-semibold">{upcomingCases2}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Due Soon</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Renewal Status Section */}
        <Card className="border-t-4 border-t-module-accent bg-muted/40" data-testid="card-renewal-compliance">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Renewal Status
              </CardTitle>
              <CardDescription>Documents approaching or past renewal dates</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`${viewDocumentsUrl}${viewDocumentsUrl.includes("?") ? "&" : "?"}renewal=30days`} data-testid="link-view-renewals-el">
                View All Renewals
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/20">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-el-renewals-overdue">{dashboardLoading ? "–" : renewalMetrics.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue Renewals</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" data-testid="text-el-renewals-30days">{dashboardLoading ? "–" : renewalMetrics.due30Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 30 Days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="text-el-renewals-60days">{dashboardLoading ? "–" : renewalMetrics.due60Days}</p>
                  <p className="text-sm text-muted-foreground">Due in 60 Days</p>
                </div>
              </div>
            </div>
            
            {renewalMetrics.upcomingRenewals.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Documents Requiring Attention</h4>
                <div className="divide-y">
                  {renewalMetrics.upcomingRenewals.slice(0, 5).map((doc) => {
                    const renewalDate = doc.renewalDate ? new Date(doc.renewalDate) : null;
                    const daysUntilRenewal = renewalDate 
                      ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    
                    return (
                      <Link 
                        key={doc.id} 
                        href={`/employment-law/documents/${doc.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover-elevate rounded-md px-2 -mx-2"
                        data-testid={`link-el-renewal-doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Renewal: {renewalDate && format(renewalDate, "MMM d, yyyy")}
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

        {/* Recent Documents and Cases Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Documents */}
          <Card className="border-t-4 border-t-module-accent bg-muted/40">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Latest employment law documents</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={viewDocumentsUrl} data-testid="link-all-documents-el">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-documents-el">No documents yet</p>
              ) : (
                <div className="space-y-3">
                  {recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        const docSite = sites?.find(s => s.id === doc.siteId);
                        if (docSite) {
                          setSelectedCompany(docSite.companyName || null);
                          setSelectedSiteId(docSite.id);
                        }
                        navigate(`/employment-law/documents/${doc.id}`);
                      }}
                      className="flex items-center justify-between rounded-lg border p-3 hover-elevate cursor-pointer"
                      data-testid={`link-document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-pink-600" />
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-document-title-${doc.id}`}>{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              const docSite = sites?.find(s => s.id === doc.siteId);
                              return docSite ? `${docSite.companyName} - ${docSite.name}` : "Site";
                            })()} - {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={doc.status === "compliant" ? "default" : doc.status === "review_required" ? "secondary" : "destructive"}
                        className={doc.status === "compliant" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ""}
                        data-testid={`badge-document-status-${doc.id}`}
                      >
                        {doc.status === "compliant" ? "Compliant" : doc.status === "review_required" ? "Review" : "Overdue"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Cases */}
          <Card className="border-t-4 border-t-module-accent bg-muted/40">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recent Cases</CardTitle>
                <CardDescription>Latest employment law cases</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={viewCasesUrl} data-testid="link-all-cases-el">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentCases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-cases-el">No cases yet</p>
              ) : (
                <div className="space-y-3">
                  {recentCases.map((c) => (
                    <Link
                      key={c.id}
                      href={`/employment-law/cases/${c.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover-elevate"
                      data-testid={`link-case-${c.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-pink-600" />
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-case-ref-${c.id}`}>{c.caseReference} - {c.employeeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sites?.find(s => s.id === c.siteId)?.name || "Site"} - {c.caseType.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <CaseStatusBadge status={c.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Missing Required Dialog */}
      <Dialog open={showMissingDialog} onOpenChange={setShowMissingDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-el-missing-required">
          <DialogHeader>
            <DialogTitle>Missing Required Documents</DialogTitle>
          </DialogHeader>
          {missingRequiredDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No missing required documents.</p>
          ) : (
            <div className="divide-y">
              {missingRequiredDetails.map((item, i) => (
                <div key={`${item.templateId}-${item.siteId}-${i}`} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.templateName}</p>
                      <p className="text-xs text-muted-foreground">{item.siteName} — {item.companyName}</p>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-300 shrink-0 text-xs">
                      {item.requiresApproval ? "Approval Required" : "Not Uploaded"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Drill-down Dialog */}
      <Dialog open={!!docsDialogFilter} onOpenChange={(open) => !open && setDocsDialogFilter(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col" data-testid="dialog-el-docs">
          <DialogHeader>
            <DialogTitle>{docsDialogFilter ? docsDialogMeta[docsDialogFilter].title : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto divide-y">
            {docsDialogDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No documents.</p>
            ) : (
              <>
                {docsDialogDocs.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">{siteNameMap[doc.siteId] || doc.siteId}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusColorMap[doc.status] || ""}`}>
                      {doc.status === "compliant" ? "Compliant" : doc.status === "review_required" ? "Review Required" : "Overdue"}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Cases list view
function EmploymentLawCasesView() {
  return <CasesList />;
}

export default function EmploymentLawPage() {
  const [matchDashboard] = useRoute("/employment-law");
  const [matchDocuments] = useRoute("/employment-law/documents");
  const [matchCases] = useRoute("/employment-law/cases");
  const [matchCaseDetail, paramsDetail] = useRoute("/employment-law/cases/:id");

  // Case detail view (no tabs, focused on single case)
  if (matchCaseDetail && paramsDetail?.id) {
    return <CaseDetailView id={paramsDetail.id} />;
  }

  // Documents view - will be handled by ModuleDocuments
  if (matchDocuments) {
    return null; // Handled by separate route
  }

  // Cases list view
  if (matchCases) {
    return <EmploymentLawCasesView />;
  }

  // Dashboard view (default)
  return <EmploymentLawDashboardView />;
}
