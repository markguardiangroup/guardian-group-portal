import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/count-up";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useLocation, Link, useRoute, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
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
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
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
  Handshake,
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
  StickyNote,
  Maximize2,
  ClipboardList,
  Package,
  PackagePlus,
  Loader2,
  GripVertical,
  FileDown,
  FileSpreadsheet,
  Link as LinkIcon,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, formatDistanceToNow, isPast, isFuture, differenceInDays } from "date-fns";
import type { Case, CaseMilestone, CaseDocumentChecklist, CaseChecklistTemplate, CaseNote, CaseBundle, Document, AuditLog, CaseStatus, CaseType, SiteWithDetails, ComplianceSummary, Company, Site, User as UserType } from "@shared/schema";
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
  acas_conciliation: { label: "ACAS Conciliation", icon: Handshake },
  disciplinary: { label: "Disciplinary", icon: Briefcase },
  grievance: { label: "Grievance", icon: Briefcase },
  tupe: { label: "TUPE", icon: Briefcase },
  redundancy: { label: "Redundancy", icon: Briefcase },
  settlement: { label: "Settlement", icon: Briefcase },
  appeal: { label: "Appeal", icon: Briefcase },
  investigation: { label: "Investigation", icon: Briefcase },
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
  // Cases keeps its own remembered company/site filter ("cases" scope) so it
  // neither affects nor is affected by other pages' filters.
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter("cases");

  useEffect(() => {
    if (urlCompany) handleCompanyChange(urlCompany);
    if (urlSiteId) setSelectedSiteId(urlSiteId);
  }, [urlSiteId, urlCompany]);
  const [showArchived, setShowArchived] = useState(false);
  const [caseView, setCaseView] = useState<"table" | "kanban">("table");
  const [caseToArchive, setCaseToArchive] = useState<Case | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const [caseDeleteConfirmText, setCaseDeleteConfirmText] = useState("");
  const [metricDialog, setMetricDialog] = useState<null | "cases_active" | "cases_resolved" | "overdue" | "upcoming">(null);
  const [renewalMetricDialog, setRenewalMetricDialog] = useState<null | "overdue" | "due30" | "due60">(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isClientUser = user?.role === "client";
  const isDeveloper = user?.role === "developer";
  const isConsultant = user?.role === "consultant";
  const isAdministrator = user?.role === "administrator";
  const isCaseAdvocate = isDeveloper || ((isConsultant || isAdministrator) && user?.consultantPermissions?.caseAdvocate === true);
  const isPrivilegedUser = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, coverageSitesUrl, coverageQueryKey, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();
  
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: coverageQueryKey,
    queryFn: coverageSitesUrl !== "/api/sites" ? async () => {
      const res = await fetch(coverageSitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    } : undefined,
  });

  const { data: sourcesData = [] } = useQuery<SourceOption[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const sourceLabelMap = useMemo(
    () => Object.fromEntries(sourcesData.map((s) => [s.code, s.label])),
    [sourcesData]
  );

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

  // Only show sites that have at least one case
  const sitesWithCases = useMemo(() => {
    if (!sites) return [];
    const siteIds = new Set((cases ?? []).map((c: any) => c.siteId).filter(Boolean));
    return sites.filter(s => siteIds.has(s.id));
  }, [sites, cases]);

  // Filter sites by selected company (from cases-only list)
  const filteredSites = useMemo(() => {
    const base = sitesWithCases;
    if (!selectedCompany || selectedCompany === "all") return base;
    return base.filter(s => s.companyName === selectedCompany);
  }, [sitesWithCases, selectedCompany]);

  // Archive mutation
  const archiveCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest("POST", `/api/cases/${caseId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Case restored from archive" });
    },
    onError: () => {
      toast({ title: "Failed to restore case", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return apiRequest("DELETE", `/api/cases/${caseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({ title: "Case permanently deleted" });
      setCaseToDelete(null);
      setCaseDeleteConfirmText("");
    },
    onError: () => {
      toast({ title: "Failed to delete case", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowCreateDialog(false);
      toast({ title: "Case created successfully" });
    },
    onError: (error: any) => {
      const msg = error?.message ?? "";
      if (msg.startsWith("409")) {
        toast({ title: "Case number already in use", description: "Please choose a different case number.", variant: "destructive" });
      } else {
        toast({ title: "Failed to create case", variant: "destructive" });
      }
    },
  });

  const filteredCases = cases?.filter(c => {
    const matchesSearch = searchQuery === "" || 
      c.caseReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.caseNumber && c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
            {hasCoverage && (
              <Select
                value={coverageFilter}
                onValueChange={(v) => { setCoverageFilter(v); setSelectedSiteId(null); }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-cases">
                  <span className="truncate pointer-events-none">
                    {coverageFilter === "my"
                      ? "My client sites"
                      : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {coveringFor.map(c => (
                    <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-cases-${c.absentConsultantId}`}>
                      {c.absentConsultantName}'s client sites
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isProConsultant && (
              <Select
                value={proStaffFilter}
                onValueChange={(v) => { setProStaffFilter(v); setSelectedSiteId(null); }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-pro-staff-filter-cases">
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
                    <SelectItem key={s.id} value={s.id} data-testid={`pro-staff-filter-cases-${s.id}`}>
                      {s.fullName}'s client sites
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isCaseAdvocate && (
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
      {(isConsultant || isAdministrator) && !isCaseAdvocate ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Access Restricted</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              You don't have the Case Advocate permission required to view Employment Law cases. Please contact your administrator to request access.
            </p>
          </div>
        </div>
      ) : (
      <>
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
              <div className={`text-2xl font-bold ${overdueCases > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}><CountUp value={overdueCases} animate={casesWasLoadingRef.current} /></div>
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
              <div className={`text-2xl font-bold ${upcomingCases > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}><CountUp value={upcomingCases} animate={casesWasLoadingRef.current} /></div>
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
                  <SelectItem value="acas_conciliation">ACAS Conciliation</SelectItem>
                </SelectContent>
              </Select>
              {isPrivilegedUser ? (
                <>
                  <CompanyCombobox
                    sites={sitesWithCases}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-[180px]"
                    testId="select-company-cases"
                  />
                  <SiteCombobox
                    sites={filteredSites}
                    value={selectedSiteId}
                    onValueChange={handleSiteChange}
                    className="w-[180px]"
                    testId="select-site-cases"
                    disabled={!selectedCompany || selectedCompany === "all"}
                  />
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
                </>
              ) : (
                <>
                  {clientHasSites && (
                    <SiteCombobox
                      sites={sites ?? []}
                      value={selectedSiteId}
                      onValueChange={handleSiteChange}
                      className="w-[180px]"
                      testId="select-site-cases"
                    />
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); resetFilters(); }}
                disabled={!(!!searchQuery || statusFilter !== "all" || typeFilter !== "all" || (selectedCompany && selectedCompany !== "all") || (selectedSiteId && selectedSiteId !== "all"))}
                className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                data-testid="button-clear-filters-cases"
                title="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
              {/* View toggle */}
              <div className="flex items-center rounded-md border bg-muted/40 p-0.5 gap-0.5">
                <Button
                  variant={caseView === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCaseView("table")}
                  data-testid="button-view-table"
                  title="Table view"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={caseView === "kanban" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCaseView("kanban")}
                  data-testid="button-view-kanban"
                  title="Kanban view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={caseView === "kanban" ? "px-4 pb-4" : undefined}>
          {/* ── Kanban view ── */}
          {caseView === "kanban" && (() => {
            const KANBAN_COLS: { status: CaseStatus; label: string; color: string; headerCls: string; dotCls: string }[] = [
              { status: "open", label: "Open", color: "border-blue-300 dark:border-blue-700", headerCls: "text-blue-700 dark:text-blue-400", dotCls: "bg-blue-500" },
              { status: "under_investigation", label: "Under Investigation", color: "border-amber-300 dark:border-amber-700", headerCls: "text-amber-700 dark:text-amber-400", dotCls: "bg-amber-500" },
              { status: "hearing_scheduled", label: "Hearing Scheduled", color: "border-purple-300 dark:border-purple-700", headerCls: "text-purple-700 dark:text-purple-400", dotCls: "bg-purple-500" },
              { status: "resolved", label: "Resolved", color: "border-emerald-300 dark:border-emerald-700", headerCls: "text-emerald-700 dark:text-emerald-400", dotCls: "bg-emerald-500" },
              { status: "closed", label: "Closed", color: "border-gray-300 dark:border-gray-600", headerCls: "text-gray-600 dark:text-gray-400", dotCls: "bg-gray-400" },
            ];

            if (isLoading) {
              return <FetchingOverlay />;
            }

            return (
              <div className="flex gap-3 overflow-x-auto pb-2" data-testid="kanban-board">
                {KANBAN_COLS.map(col => {
                  const colCases = filteredCases.filter(c => c.status === col.status);
                  return (
                    <div key={col.status} className={`flex-none w-64 rounded-lg border-2 ${col.color} bg-muted/30 dark:bg-muted/10`} data-testid={`kanban-col-${col.status}`}>
                      {/* Column header */}
                      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-inherit">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${col.dotCls}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${col.headerCls}`}>{col.label}</span>
                        <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{colCases.length}</span>
                      </div>
                      {/* Cards */}
                      <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                        {colCases.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-6">No cases</p>
                        )}
                        {colCases.map(c => {
                          const rd = c.responseDeadline ? new Date(c.responseDeadline) : null;
                          const rdOverdue = rd && isPast(rd);
                          const overdueMilestone = c.overduesMilestoneDueDate ? new Date(c.overduesMilestoneDueDate) : null;
                          const upcomingMilestone = c.upcomingMilestoneDueDate ? new Date(c.upcomingMilestoneDueDate) : null;
                          const hasAlert = rdOverdue || !!overdueMilestone;
                          return (
                            <Link key={c.id} href={`/employment-law/cases/${c.id}`}>
                              <div
                                className={`rounded-md border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-module-accent/50 transition-all group ${hasAlert ? "border-l-4 border-l-red-400" : upcomingMilestone ? "border-l-4 border-l-amber-400" : ""}`}
                                data-testid={`kanban-card-${c.id}`}
                              >
                                {/* Ref + icons */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  {c.isConfidential && <Lock className="h-3 w-3 text-pink-500 shrink-0" />}
                                  {c.isArchived && <Archive className="h-3 w-3 text-muted-foreground shrink-0" />}
                                  <span className="font-mono text-[10px] font-semibold text-module-accent">
                                    {c.caseNumber || c.caseReference}
                                  </span>
                                  <CaseTypeBadge type={c.caseType as CaseType} />
                                </div>
                                {/* Case name */}
                                {c.caseName && (
                                  <p className="text-xs font-medium leading-snug mb-1 text-foreground group-hover:text-module-accent transition-colors line-clamp-2">
                                    {c.caseName}
                                  </p>
                                )}
                                {/* Employee */}
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{c.employeeName}</span>
                                </div>
                                {/* Source chips */}
                                {(c as any).sources && (c as any).sources.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 mb-1.5">
                                    {((c as any).sources as string[]).map((s: string) => (
                                      <span key={s} className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                        {sourceLabelMap[s] ?? s}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Deadline chips */}
                                <div className="flex flex-wrap gap-1">
                                  {rd && (
                                    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${rdOverdue ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : differenceInDays(rd, new Date()) <= 7 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                                      <Calendar className="h-2.5 w-2.5" />
                                      {rdOverdue ? "Overdue" : format(rd, "d MMM")}
                                    </span>
                                  )}
                                  {overdueMilestone && (
                                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      Milestone overdue
                                    </span>
                                  )}
                                  {!overdueMilestone && upcomingMilestone && (
                                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                      <Clock className="h-2.5 w-2.5" />
                                      {format(upcomingMilestone, "d MMM")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Table view ── */}
          {caseView === "table" && isLoading ? (
            <FetchingOverlay />
          ) : caseView === "table" && filteredCases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case No.</TableHead>
                  <TableHead>Case Name</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>ET3 Response Deadline</TableHead>
                  <TableHead>Next Milestone</TableHead>
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
                          {caseItem.caseNumber || caseItem.caseReference}
                        </span>
                        {caseItem.isArchived && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="text-sm font-medium truncate block" title={caseItem.caseName}>
                        {caseItem.caseName || <span className="text-muted-foreground italic">—</span>}
                      </span>
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
                      {(caseItem as any).sources && (caseItem as any).sources.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {((caseItem as any).sources as string[]).map((s: string) => (
                            <span key={s} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {sourceLabelMap[s] ?? s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {caseItem.responseDeadline ? (() => {
                        const rd = new Date(caseItem.responseDeadline);
                        return (
                          <div className={`flex items-center gap-1 text-sm ${
                            isPast(rd) ? "text-red-600 font-medium" :
                            differenceInDays(rd, new Date()) <= 7 ? "text-amber-600" :
                            "text-muted-foreground"
                          }`}>
                            {isPast(rd) && <AlertTriangle className="h-3 w-3" />}
                            <span>{format(rd, "MMM d, yyyy")}</span>
                          </div>
                        );
                      })() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const overdue = caseItem.overduesMilestoneDueDate;
                        const upcoming = caseItem.upcomingMilestoneDueDate;
                        const date = overdue ? new Date(overdue) : upcoming ? new Date(upcoming) : null;
                        if (!date) return <span className="text-muted-foreground">—</span>;
                        return (
                          <div className={`flex items-center gap-1 text-sm ${
                            overdue ? "text-red-600" :
                            differenceInDays(date, new Date()) <= 7 ? "text-amber-600" :
                            "text-muted-foreground"
                          }`}>
                            <Clock className="h-3 w-3" />
                            <span>{format(date, "MMM d")}</span>
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
                          {isDeveloper && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setCaseToDelete(caseItem); setCaseDeleteConfirmText(""); }}
                                className="text-destructive focus:text-destructive"
                                data-testid={`button-delete-case-${caseItem.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Case
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : caseView === "table" ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No cases found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first employment law case to get started"}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <CreateCaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={(data) => createCaseMutation.mutate(data)}
        isLoading={createCaseMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!caseToDelete} onOpenChange={(open) => { if (!open) { setCaseToDelete(null); setCaseDeleteConfirmText(""); } }}>
        <DialogContent className="theme-el sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Case
            </DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>
          {caseToDelete && (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium mb-2">You are about to permanently delete:</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Case: <strong>{caseToDelete.caseReference}</strong></li>
                  <li>Employee: <strong>{caseToDelete.employeeName}</strong></li>
                  <li>All documents, milestones, notes, and checklist items</li>
                  <li>All audit history for this case</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type <strong className="text-destructive">DELETE</strong> to confirm
                </p>
                <Input
                  value={caseDeleteConfirmText}
                  onChange={(e) => setCaseDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  data-testid="input-delete-case-confirm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCaseToDelete(null); setCaseDeleteConfirmText(""); }} data-testid="button-cancel-delete-case">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => caseToDelete && deleteCaseMutation.mutate(caseToDelete.id)}
              disabled={caseDeleteConfirmText !== "DELETE" || deleteCaseMutation.isPending}
              data-testid="button-confirm-delete-case"
            >
              {deleteCaseMutation.isPending ? "Deleting..." : "Delete Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      </>
      )}
      </div>
    </div>
  );
}

type SourceOption = { id: string; code: string; label: string; isActive: boolean };

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
  const blankForm = {
    entityId: "",
    siteId: "",
    caseNumber: "",
    caseName: "",
    employeeName: "",
    employeeId: "",
    caseType: "tribunal_claim" as CaseType,
    description: "",
    isConfidential: true,
    responseDeadline: "",
    sources: [] as string[],
  };
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    if (!open) setFormData(blankForm);
  }, [open]);

  const toggleSource = (code: string) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.includes(code)
        ? prev.sources.filter(s => s !== code)
        : [...prev.sources, code],
    }));
  };

  // Fetch available sources from admin-managed source database
  const { data: availableSources = [] } = useQuery<SourceOption[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Fetch companies for selection
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies?limit=1000"],
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
    if (!formData.entityId || !formData.siteId || !formData.caseName || formData.sources.length === 0 || (formData.caseType === "tribunal_claim" && !formData.responseDeadline)) {
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-pink-600" />
            Create New Case
          </DialogTitle>
          <DialogDescription>
            Create a new employment law case file for an individual
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
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
            <label className="text-sm font-medium">Case Number <span className="text-destructive">*</span></label>
            <Input
              value={formData.caseNumber}
              onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
              placeholder="e.g. ET/12345/2025"
              required
              data-testid="input-case-number"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Case Name <span className="text-destructive">*</span></label>
            <Input
              value={formData.caseName}
              onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
              placeholder="e.g. Smith v Acme Ltd"
              required
              data-testid="input-case-name"
            />
            <p className="text-xs text-muted-foreground">A short descriptive name for this case</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Case Type</label>
            <Select
              value={formData.caseType}
              onValueChange={(v) => setFormData({ ...formData, caseType: v as CaseType, responseDeadline: v === "tribunal_claim" ? formData.responseDeadline : "" })}
            >
              <SelectTrigger data-testid="select-case-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tribunal_claim">Tribunal Case</SelectItem>
                <SelectItem value="acas_conciliation">ACAS Conciliation</SelectItem>
                <SelectItem value="disciplinary">Disciplinary</SelectItem>
                <SelectItem value="grievance">Grievance</SelectItem>
                <SelectItem value="tupe">TUPE</SelectItem>
                <SelectItem value="redundancy">Redundancy</SelectItem>
                <SelectItem value="settlement">Settlement</SelectItem>
                <SelectItem value="appeal">Appeal</SelectItem>
                <SelectItem value="investigation">Investigation</SelectItem>
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
          {formData.caseType === "tribunal_claim" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">ET3 Response Deadline <span className="text-destructive">*</span></label>
              <Input
                type="date"
                value={formData.responseDeadline}
                onChange={(e) => setFormData({ ...formData, responseDeadline: e.target.value })}
                required
                data-testid="input-response-deadline"
              />
              <p className="text-xs text-muted-foreground">Required — will be tracked as a milestone on this case</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Source <span className="text-destructive">*</span> <span className="text-muted-foreground text-xs font-normal">(select all that apply)</span></label>
            <div className="grid grid-cols-2 gap-1.5 rounded-md border p-3 bg-muted/30">
              {availableSources.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-2">No sources configured — add them in Developer → Sources</p>
              )}
              {availableSources.map((src) => {
                const checked = formData.sources.includes(src.code);
                return (
                  <button
                    key={src.code}
                    type="button"
                    onClick={() => toggleSource(src.code)}
                    data-testid={`toggle-source-${src.code}`}
                    className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-left transition-colors ${checked ? "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-700" : "bg-background border border-border hover:border-pink-300 dark:hover:border-pink-700 text-foreground"}`}
                  >
                    <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${checked ? "bg-pink-600 border-pink-600 text-white" : "border-input"}`}>
                      {checked && "✓"}
                    </span>
                    {src.label}
                  </button>
                );
              })}
            </div>
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
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t mt-2">
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
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<CaseStatus>("open");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [editingSources, setEditingSources] = useState(false);
  const [sourcesDraft, setSourcesDraft] = useState<string[]>([]);
  const [editingCaseNumber, setEditingCaseNumber] = useState(false);
  const [caseNumberDraft, setCaseNumberDraft] = useState("");
  const [editingCaseName, setEditingCaseName] = useState(false);
  const [caseNameDraft, setCaseNameDraft] = useState("");
  const [caseNotesExpanded, setCaseNotesExpanded] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [checklistForm, setChecklistForm] = useState({ title: "", description: "", submissionDate: "" });
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

  // Fetch admin-managed sources for display labels and editing
  const { data: allSources = [] } = useQuery<SourceOption[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const detailSourceLabelMap = useMemo(
    () => Object.fromEntries(allSources.map((s) => [s.code, s.label])),
    [allSources]
  );

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
    enabled: user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator",
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

  // Get users who could be added to access list (only clients, show inactive greyed out)
  const availableUsers = useMemo(() => {
    if (!companyUsers) return [];
    return companyUsers.filter(u => !restrictedUserIds.includes(u.id) && u.role === "client");
  }, [companyUsers, restrictedUserIds]);

  const updateCaseMutation = useMutation({
    mutationFn: async (updates: Partial<Case>) => {
      return apiRequest("PATCH", `/api/cases/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setShowStatusDialog(false);
      toast({ title: "Case updated successfully" });
    },
    onError: (error: any) => {
      const msg = error?.message ?? "";
      if (msg.startsWith("409")) {
        toast({ title: "Case number already in use", description: "Please choose a different case number.", variant: "destructive" });
      } else {
        toast({ title: "Failed to update case", variant: "destructive" });
      }
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/milestones", { ...data, caseId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setShowMilestoneDialog(false);
      toast({ title: "Milestone added successfully" });
    },
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, completedDate, completionNotes }: { milestoneId: string; completedDate: string; completionNotes: string }) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, { isCompleted: true, completedDate, completionNotes: completionNotes || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setCompletingMilestone(null);
      toast({ title: "Milestone completed" });
    },
  });

  const reopenMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, { isCompleted: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      toast({ title: "Milestone reopened" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: any }) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      setEditingMilestone(null);
      toast({ title: "Milestone updated" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/employment_law"] });
      toast({ title: "Milestone deleted" });
    },
  });

  const createChecklistItemMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; submissionDate?: string | null }) => {
      return apiRequest("POST", "/api/checklist", { ...data, caseId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      setShowChecklistDialog(false);
      setChecklistForm({ title: "", description: "", submissionDate: "" });
      toast({ title: "Checklist item added" });
    },
  });

  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: any }) => {
      return apiRequest("PATCH", `/api/checklist/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      setEditingChecklistItem(null);
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/checklist/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Checklist item deleted" });
    },
  });

  const [docToDelete, setDocToDelete] = useState<{ id: string; title: string; linkedChecklistItem?: CaseDocumentChecklist } | null>(null);

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/cases/${id}/documents/${docId}`);
    },
    onSuccess: async (_, docId) => {
      // If it was fulfilling a checklist item, reopen that item
      const linked = docToDelete?.linkedChecklistItem;
      if (linked) {
        await apiRequest("PATCH", `/api/checklist/${linked.id}`, {
          isCompleted: false,
          linkedDocumentId: null,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "checklist"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: linked ? "Document deleted — essential document marked incomplete" : "Document deleted" });
      setDocToDelete(null);
    },
  });

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState<string | null>(null);
  const [showEssentialDocDialog, setShowEssentialDocDialog] = useState(false);
  const [pendingDocumentDate, setPendingDocumentDate] = useState<string>("");

  const [showLoadTemplateDialog, setShowLoadTemplateDialog] = useState(false);

  const [docToEdit, setDocToEdit] = useState<Document | null>(null);
  const [editDocTitle, setEditDocTitle] = useState("");
  const [editDocDate, setEditDocDate] = useState("");

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ docId, data }: { docId: string; data: { title?: string; documentDate?: string | null } }) => {
      return apiRequest("PATCH", `/api/documents/${docId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Document updated" });
      setDocToEdit(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update document", description: error?.message, variant: "destructive" });
    },
  });

  const doUpload = async (file: File, checklistItemId?: string | null, documentDate?: string | null) => {
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
      if (!uploadRes.ok) {
        if (uploadRes.status === 401) throw new Error("Your session has expired — please refresh the page and log back in.");
        throw new Error("Failed to upload file");
      }
      const { objectPath } = await uploadRes.json();

      const docRecord = await apiRequest("POST", `/api/cases/${id}/documents`, {
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
        mimeType: file.type,
        documentDate: documentDate || null,
      });
      const createdDoc = await docRecord.json().catch(() => null);

      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });

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
      setPendingDocumentDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Always intercept with a dialog so the user can optionally set a document date,
    // and (when applicable) match it to an outstanding essential document.
    setPendingFile(file);
    setSelectedChecklistItemId(null);
    setPendingDocumentDate("");
    setShowEssentialDocDialog(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const [checklistReopenDialog, setChecklistReopenDialog] = useState<{ item: CaseDocumentChecklist; linkedDoc?: { title: string; fileName: string } } | null>(null);
  const [checklistItemToDelete, setChecklistItemToDelete] = useState<CaseDocumentChecklist | null>(null);
  const [linkDocDialog, setLinkDocDialog] = useState<CaseDocumentChecklist | null>(null);
  const [linkDocSelectedId, setLinkDocSelectedId] = useState<string>("");

  // Document Bundles
  const { data: bundles = [] } = useQuery<CaseBundle[]>({
    queryKey: ["/api/cases", id, "bundles"],
    enabled: !!id,
  });

  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [editingBundle, setEditingBundle] = useState<CaseBundle | null>(null);
  const [bundleName, setBundleName] = useState("");
  const [bundleStartPageNumber, setBundleStartPageNumber] = useState("1");
  // bundleItemOrder: all linked item IDs in user's drag order (determines PDF order)
  const [bundleItemOrder, setBundleItemOrder] = useState<string[]>([]);
  // bundleCheckedIds: which of the above are selected/included (holds checklist item IDs and document IDs)
  const [bundleCheckedIds, setBundleCheckedIds] = useState<Set<string>>(new Set());
  // bundleDocOrder: case document IDs (not linked to a checklist item) in user's drag order
  const [bundleDocOrder, setBundleDocOrder] = useState<string[]>([]);
  const [downloadingBundleId, setDownloadingBundleId] = useState<string | null>(null);
  const [exportingBundleId, setExportingBundleId] = useState<string | null>(null);
  const [bundleToDelete, setBundleToDelete] = useState<CaseBundle | null>(null);
  const [bundleEditConfirmPending, setBundleEditConfirmPending] = useState(false);

  const linkedChecklistItems = useMemo(
    () => (checklistItems ?? []).filter(item => item.linkedDocumentId),
    [checklistItems],
  );
  const linkedChecklistMap = useMemo(
    () => new Map(linkedChecklistItems.map(item => [item.id, item])),
    [linkedChecklistItems],
  );
  const documentMap = useMemo(
    () => new Map((documents ?? []).map(doc => [doc.id, doc])),
    [documents],
  );
  // Case documents that are NOT linked to an essential (checklist) document
  const unlinkedCaseDocuments = useMemo(() => {
    const linkedDocIds = new Set(
      (checklistItems ?? []).map(i => i.linkedDocumentId).filter(Boolean) as string[],
    );
    return (documents ?? []).filter(doc => doc.fileUrl && !linkedDocIds.has(doc.id));
  }, [documents, checklistItems]);
  const bundleSensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const handleBundleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBundleItemOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };
  const handleBundleDocDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBundleDocOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const openNewBundleDialog = () => {
    setEditingBundle(null);
    setBundleName("");
    setBundleStartPageNumber("1");
    const ids = linkedChecklistItems.map(item => item.id);
    setBundleItemOrder(ids);
    setBundleDocOrder(unlinkedCaseDocuments.map(doc => doc.id));
    setBundleCheckedIds(new Set(ids)); // all essential documents selected by default
    setShowBundleDialog(true);
  };

  const openEditBundleDialog = (bundle: CaseBundle) => {
    setEditingBundle(bundle);
    setBundleName(bundle.name);
    setBundleStartPageNumber(String(bundle.startPageNumber ?? 1));
    const linkedIds = new Set(linkedChecklistItems.map(item => item.id));
    const savedIds = (bundle.checklistItemIds ?? []).filter(id => linkedIds.has(id));
    const savedIdsSet = new Set(savedIds);
    const remainingIds = linkedChecklistItems.map(item => item.id).filter(id => !savedIdsSet.has(id));
    setBundleItemOrder([...savedIds, ...remainingIds]);

    const docIds = new Set(unlinkedCaseDocuments.map(doc => doc.id));
    const savedDocIds = (bundle.documentIds ?? []).filter(docId => docIds.has(docId));
    const savedDocSet = new Set(savedDocIds);
    const remainingDocIds = unlinkedCaseDocuments.map(doc => doc.id).filter(docId => !savedDocSet.has(docId));
    setBundleDocOrder([...savedDocIds, ...remainingDocIds]);

    setBundleCheckedIds(new Set([...savedIds, ...savedDocIds]));
    setShowBundleDialog(true);
  };

  const createBundleMutation = useMutation<CaseBundle, Error, { name: string; checklistItemIds: string[]; documentIds: string[]; startPageNumber: number }>({
    mutationFn: (data) =>
      apiRequest("POST", `/api/cases/${id}/bundles`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "bundles"] });
    },
    onError: (err) => toast({ title: "Failed to save bundle", description: String(err), variant: "destructive" }),
  });

  const updateBundleMutation = useMutation<CaseBundle, Error, { bundleId: string; data: { name?: string; checklistItemIds?: string[]; documentIds?: string[]; startPageNumber?: number } }>({
    mutationFn: ({ bundleId, data }) =>
      apiRequest("PATCH", `/api/cases/${id}/bundles/${bundleId}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "bundles"] });
    },
    onError: (err) => toast({ title: "Failed to update bundle", description: String(err), variant: "destructive" }),
  });

  const deleteBundleMutation = useMutation({
    mutationFn: (bundleId: string) => apiRequest("DELETE", `/api/cases/${id}/bundles/${bundleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "bundles"] });
      setBundleToDelete(null);
      toast({ title: "Bundle deleted" });
    },
    onError: (err) => toast({ title: "Failed to delete bundle", description: String(err), variant: "destructive" }),
  });

  const handleSaveBundle = async () => {
    try {
      const checklistItemIds = bundleItemOrder.filter(id => bundleCheckedIds.has(id));
      const documentIds = bundleDocOrder.filter(id => bundleCheckedIds.has(id));
      const parsedStart = parseInt(bundleStartPageNumber, 10);
      const startPageNumber = Number.isInteger(parsedStart) && parsedStart >= 1 ? parsedStart : 1;
      editingBundle
        ? await updateBundleMutation.mutateAsync({ bundleId: editingBundle.id, data: { name: bundleName, checklistItemIds, documentIds, startPageNumber } })
        : await createBundleMutation.mutateAsync({ name: bundleName, checklistItemIds, documentIds, startPageNumber });
      setShowBundleDialog(false);
      setBundleEditConfirmPending(false);
      toast({
        title: editingBundle ? "Bundle updated" : "Bundle saved",
        description: "Use the Create PDF button next to your bundle to generate and download it.",
      });
    } catch {
      // errors handled in mutation onError
    }
  };

  const handleSaveBundleWithCheck = () => {
    if (editingBundle?.cachedFileUrl) {
      setBundleEditConfirmPending(true);
    } else {
      handleSaveBundle();
    }
  };

  const handleDownloadBundle = async (bundle: CaseBundle) => {
    setDownloadingBundleId(bundle.id);
    toast({
      title: "Generating PDF…",
      description: "This may take a few minutes depending on the number of files. The file will download automatically when complete.",
    });
    try {
      const res = await fetch(`/api/cases/${id}/bundles/${bundle.id}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof errBody.error === "string" ? errBody.error : "Failed to generate bundle");
      }
      // Read Content-Disposition for the correct server-generated filename
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${bundle.name}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "bundles"] });
      toast({ title: "Bundle downloaded" });
    } catch (err) {
      toast({ title: "Failed to download bundle", description: String(err), variant: "destructive" });
    } finally {
      setDownloadingBundleId(null);
    }
  };

  const handleExportBundleIndex = async (bundle: CaseBundle) => {
    setExportingBundleId(bundle.id);
    try {
      const res = await fetch(`/api/cases/${id}/bundles/${bundle.id}/export-index`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(typeof errBody.error === "string" ? errBody.error : "Failed to export bundle index");
      }
      const disposition = res.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `${bundle.name}-index.csv`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Index exported" });
    } catch (err) {
      toast({ title: "Failed to export index", description: String(err), variant: "destructive" });
    } finally {
      setExportingBundleId(null);
    }
  };

  // Case Notes
  const { data: caseNotes = [] } = useQuery<(CaseNote & { createdByName: string })[]>({
    queryKey: ["/api/cases", id, "notes"],
    enabled: !!id,
  });

  const [newNoteText, setNewNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<CaseNote | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [noteToDelete, setNoteToDelete] = useState<CaseNote | null>(null);

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/cases/${id}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "notes"] });
      setNewNoteText("");
      toast({ title: "Note added" });
    },
    onError: (err) => {
      toast({ title: "Failed to add note", description: String(err), variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      apiRequest("PATCH", `/api/notes/${noteId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "notes"] });
      setEditingNote(null);
      setEditNoteText("");
      toast({ title: "Note updated" });
    },
    onError: (err) => {
      toast({ title: "Failed to update note", description: String(err), variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiRequest("DELETE", `/api/notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "notes"] });
      setNoteToDelete(null);
      toast({ title: "Note deleted" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete note", description: String(err), variant: "destructive" });
    },
  });

  const [editingMilestone, setEditingMilestone] = useState<CaseMilestone | null>(null);
  const [showCompletedMilestones, setShowCompletedMilestones] = useState(false);
  const [completingMilestone, setCompletingMilestone] = useState<CaseMilestone | null>(null);
  const [completionForm, setCompletionForm] = useState({ completedDate: format(new Date(), "yyyy-MM-dd"), completionNotes: "" });
  const [expandedMilestoneNotes, setExpandedMilestoneNotes] = useState<Set<string>>(new Set());
  const [viewingMilestoneNotes, setViewingMilestoneNotes] = useState<CaseMilestone | null>(null);
  const [tickedNotes, setTickedNotes] = useState<Set<string>>(new Set());

  if (isLoading) {
    return <FetchingOverlay />;
  }

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Briefcase className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Case not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/employment-law/cases")}>
          Back to Cases
        </Button>
      </div>
    );
  }

  const completedMilestones = milestones?.filter(m => m.isCompleted).length || 0;
  const totalMilestones = milestones?.length || 0;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
  const responseDeadlineMilestone = milestones?.find(m => m.isResponseDeadline);

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
    <div>
      <div className="sticky top-0 z-30 bg-background border-b px-6 py-5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/employment-law/cases")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {caseData.isConfidential && <Lock className="h-5 w-5 text-pink-600" />}
                {editingCaseNumber ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="text-2xl font-bold border-b-2 border-pink-500 bg-transparent focus:outline-none w-48"
                      value={caseNumberDraft}
                      onChange={e => setCaseNumberDraft(e.target.value)}
                      autoFocus
                      data-testid="input-case-number-edit"
                    />
                    <Button
                      size="sm"
                      className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs"
                      onClick={() => {
                        if (!caseNumberDraft.trim()) return;
                        updateCaseMutation.mutate(
                          { caseNumber: caseNumberDraft.trim() } as any,
                          { onSuccess: () => setEditingCaseNumber(false) }
                        );
                      }}
                      disabled={updateCaseMutation.isPending || !caseNumberDraft.trim()}
                      data-testid="button-save-case-number"
                    >
                      {updateCaseMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setEditingCaseNumber(false)}
                      data-testid="button-cancel-case-number"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div>
                      <h1 className="text-2xl font-bold">
                        {caseData.caseNumber || caseData.caseReference}
                      </h1>
                      {editingCaseName ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            className="text-sm border-b-2 border-pink-500 bg-transparent focus:outline-none w-56"
                            value={caseNameDraft}
                            onChange={e => setCaseNameDraft(e.target.value)}
                            placeholder="e.g. Smith v Acme Ltd"
                            autoFocus
                            data-testid="input-case-name-edit"
                          />
                          <Button
                            size="sm"
                            className="bg-pink-600 hover:bg-pink-700 text-white h-6 text-xs"
                            onClick={() => {
                              updateCaseMutation.mutate(
                                { caseName: caseNameDraft.trim() } as any,
                                { onSuccess: () => setEditingCaseName(false) }
                              );
                            }}
                            disabled={updateCaseMutation.isPending}
                            data-testid="button-save-case-name"
                          >
                            {updateCaseMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => setEditingCaseName(false)}
                            data-testid="button-cancel-case-name"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          {caseData.caseName ? (
                            <p className="text-sm text-muted-foreground">{caseData.caseName}</p>
                          ) : (user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") ? (
                            <p className="text-sm text-muted-foreground/50 italic">No case name set</p>
                          ) : null}
                          {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => { setCaseNameDraft(caseData.caseName || ""); setEditingCaseName(true); }}
                              data-testid="button-edit-case-name"
                              title="Edit case name"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => { setCaseNumberDraft(caseData.caseNumber || ""); setEditingCaseNumber(true); }}
                        data-testid="button-edit-case-number"
                        title="Edit case number"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <CaseStatusBadge status={caseData.status as CaseStatus} />
              <CaseTypeBadge type={caseData.caseType as CaseType} />
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
              <User className="h-4 w-4" />
              {caseData.employeeName}
              {caseData.employeeId && <span>({caseData.employeeId})</span>}
              {company?.name && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>{company.name}</span>
                </>
              )}
              {site?.name && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{site.name}</span>
                </>
              )}
            </p>
          </div>
          {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAccessDialog(true)}
                data-testid="button-case-access"
              >
                <Shield className="mr-2 h-4 w-4" />
                Case Access
              </Button>
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
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 p-6">

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-pink-500" />
                  Case Details
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Summary information for this case</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Description — full width */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Description</p>
                    {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && !editingDescription && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => { setDescriptionDraft(caseData.description ?? ""); setEditingDescription(true); }}
                        data-testid="button-edit-description"
                        title="Edit description"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {editingDescription ? (
                    <div className="mt-1 space-y-2">
                      <Textarea
                        value={descriptionDraft}
                        onChange={e => setDescriptionDraft(e.target.value)}
                        className="text-sm min-h-[80px] resize-none"
                        placeholder="Add a description…"
                        autoFocus
                        data-testid="input-description-edit"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs"
                          onClick={() => {
                            updateCaseMutation.mutate(
                              { description: descriptionDraft },
                              { onSuccess: () => setEditingDescription(false) }
                            );
                          }}
                          disabled={updateCaseMutation.isPending}
                          data-testid="button-save-description"
                        >
                          {updateCaseMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setEditingDescription(false)}
                          data-testid="button-cancel-description"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm">{caseData.description || <span className="text-muted-foreground italic">No description provided</span>}</p>
                  )}
                </div>
                {/* Sources */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Source</p>
                    {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && !editingSources && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          setSourcesDraft((caseData as any).sources ?? []);
                          setEditingSources(true);
                        }}
                        data-testid="button-edit-sources"
                        title="Edit sources"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {editingSources ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1.5 rounded-md border p-3 bg-muted/30">
                        {allSources.length === 0 && (
                          <p className="col-span-2 text-xs text-muted-foreground text-center py-2">No sources configured — add them in Developer → Sources</p>
                        )}
                        {allSources.map((src) => {
                          const checked = sourcesDraft.includes(src.code);
                          return (
                            <button
                              key={src.code}
                              type="button"
                              onClick={() =>
                                setSourcesDraft(prev =>
                                  prev.includes(src.code)
                                    ? prev.filter(s => s !== src.code)
                                    : [...prev, src.code]
                                )
                              }
                              data-testid={`toggle-source-edit-${src.code}`}
                              className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm text-left transition-colors ${checked ? "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 border border-pink-300 dark:border-pink-700" : "bg-background border border-border hover:border-pink-300 dark:hover:border-pink-700 text-foreground"}`}
                            >
                              <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${checked ? "bg-pink-600 border-pink-600 text-white" : "border-input"}`}>
                                {checked && "✓"}
                              </span>
                              {src.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs"
                          onClick={() =>
                            updateCaseMutation.mutate(
                              { sources: sourcesDraft } as any,
                              { onSuccess: () => setEditingSources(false) }
                            )
                          }
                          disabled={updateCaseMutation.isPending}
                          data-testid="button-save-sources"
                        >
                          {updateCaseMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setEditingSources(false)}
                          data-testid="button-cancel-sources"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {((caseData as any).sources ?? []).length > 0
                        ? ((caseData as any).sources as string[]).map((s: string) => (
                            <span key={s} className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {detailSourceLabelMap[s] ?? s}
                            </span>
                          ))
                        : <span className="text-sm text-muted-foreground italic">No sources set</span>
                      }
                    </div>
                  )}
                </div>

                {/* Date fields — inline row, only rendered when values exist */}
                {(caseData.hearingDate || caseData.responseDeadline || caseData.resolutionDate) && (
                  <div className="flex flex-wrap gap-6 pt-1 border-t">
                  {caseData.hearingDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Hearing Date</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(caseData.hearingDate), "d MMM yyyy")}
                      </p>
                    </div>
                  )}
                  {caseData.responseDeadline && caseData.caseType === "tribunal_claim" && (
                    <div>
                      <p className="text-xs text-muted-foreground">ET3 Response Deadline</p>
                      <p className={`mt-0.5 flex items-center gap-1.5 text-sm ${responseDeadlineMilestone?.isCompleted ? "text-green-600" : isPast(new Date(caseData.responseDeadline)) ? "text-red-600" : ""}`}>
                        {responseDeadlineMilestone?.isCompleted ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        {format(new Date(caseData.responseDeadline), "d MMM yyyy")}
                        {responseDeadlineMilestone?.isCompleted ? (
                          <Badge className="ml-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0">Responded</Badge>
                        ) : isPast(new Date(caseData.responseDeadline)) ? (
                          <Badge variant="destructive" className="ml-1">Overdue</Badge>
                        ) : null}
                      </p>
                    </div>
                  )}
                  {caseData.resolutionDate && (
                    <div>
                      <p className="text-xs text-muted-foreground">Resolution Date</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {format(new Date(caseData.resolutionDate), "d MMM yyyy")}
                      </p>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Case Notes ─────────────────────────────────────────────── */}
          {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
            <Card>
              <button
                className="w-full text-left"
                onClick={() => setCaseNotesExpanded(v => !v)}
                data-testid="button-toggle-case-notes"
              >
                <CardHeader className={`flex flex-row items-center justify-between gap-4 ${caseNotesExpanded ? "border-b pb-4" : "pb-4"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <StickyNote className="h-5 w-5 text-pink-500 shrink-0" />
                    <div>
                      <CardTitle className="text-lg">Case Notes</CardTitle>
                      <CardDescription className="text-xs mt-0.5">Internal — not visible to clients</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {caseNotes.length > 0 && (
                      <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-0 font-semibold tabular-nums">
                        {caseNotes.length} {caseNotes.length === 1 ? "note" : "notes"}
                      </Badge>
                    )}
                    {caseNotes.length === 0 && !caseNotesExpanded && (
                      <span className="text-xs text-muted-foreground">No notes yet</span>
                    )}
                    {caseNotesExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {caseNotesExpanded && (
                <CardContent className="pt-4 space-y-3">
                  {caseNotes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No notes yet</p>
                  )}
                  {caseNotes.map((note) => {
                    const isTicked = tickedNotes.has(note.id);
                    return (
                    <div key={note.id} className={`flex items-start gap-2 group rounded-md transition-colors ${isTicked ? "bg-green-50/60 dark:bg-green-900/10" : ""}`} data-testid={`note-item-${note.id}`}>
                      <button
                        className={`mt-0.5 shrink-0 rounded-full transition-colors ${isTicked ? "text-green-600" : "text-muted-foreground/40 hover:text-green-500"}`}
                        onClick={() => setTickedNotes(prev => {
                          const next = new Set(prev);
                          next.has(note.id) ? next.delete(note.id) : next.add(note.id);
                          return next;
                        })}
                        title={isTicked ? "Mark as incomplete" : "Mark as complete"}
                        data-testid={`button-tick-note-${note.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        {editingNote?.id === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editNoteText}
                              onChange={e => setEditNoteText(e.target.value)}
                              className="text-sm min-h-[70px] resize-none"
                              autoFocus
                              data-testid={`input-edit-note-${note.id}`}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-pink-600 hover:bg-pink-700 text-white h-7 text-xs"
                                onClick={() => updateNoteMutation.mutate({ noteId: note.id, content: editNoteText })}
                                disabled={!editNoteText.trim() || updateNoteMutation.isPending}
                                data-testid={`button-save-note-${note.id}`}
                              >
                                {updateNoteMutation.isPending ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setEditingNote(null); setEditNoteText(""); }}
                                data-testid={`button-cancel-edit-note-${note.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap transition-all ${isTicked ? "line-through text-muted-foreground" : ""}`}>{note.content}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {note.createdByName} · {format(new Date(note.createdAt), "d MMM yyyy")}
                              {note.updatedAt !== note.createdAt && " · edited"}
                            </p>
                          </>
                        )}
                      </div>
                      {editingNote?.id !== note.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => { setEditingNote(note); setEditNoteText(note.content); }}
                            data-testid={`button-edit-note-${note.id}`}
                            title="Edit note"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => setNoteToDelete(note)}
                            data-testid={`button-delete-note-${note.id}`}
                            title="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                  })}
                  <div className="pt-2 border-t space-y-2">
                    <Textarea
                      placeholder="Add a note…"
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      className="text-sm min-h-[70px] resize-none"
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newNoteText.trim()) {
                          e.preventDefault();
                          addNoteMutation.mutate(newNoteText.trim());
                        }
                      }}
                      data-testid="input-new-note"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to save</span>
                      <Button
                        size="sm"
                        className="bg-pink-600 hover:bg-pink-700 text-white"
                        onClick={() => { if (newNoteText.trim()) addNoteMutation.mutate(newNoteText.trim()); }}
                        disabled={!newNoteText.trim() || addNoteMutation.isPending}
                        data-testid="button-add-note"
                      >
                        {addNoteMutation.isPending ? "Adding…" : "Add note"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

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
              {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowLoadTemplateDialog(true)}
                    data-testid="button-load-template"
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    Templates
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setEditingChecklistItem(null); setChecklistForm({ title: "", description: "" }); setShowChecklistDialog(true); }}
                    className="bg-pink-600 hover:bg-pink-700"
                    data-testid="button-add-checklist-item"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
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
                            onClick={() => {
                              if (!item.isCompleted) {
                                // Marking complete — proceed directly
                                updateChecklistItemMutation.mutate({ itemId: item.id, data: { isCompleted: true } });
                              } else if (item.linkedDocumentId) {
                                // Locked — linked to a document, cannot manually uncheck
                                const linkedDoc = documents?.find(d => d.id === item.linkedDocumentId);
                                setChecklistReopenDialog({ item, linkedDoc: linkedDoc ? { title: linkedDoc.title, fileName: linkedDoc.fileName } : undefined });
                              } else {
                                // Manual completion — ask for confirmation before reopening
                                setChecklistReopenDialog({ item });
                              }
                            }}
                            className={`mt-0.5 shrink-0 transition-colors ${
                              item.isCompleted
                                ? item.linkedDocumentId
                                  ? "text-green-600 cursor-not-allowed"
                                  : "text-green-600 hover:text-amber-500"
                                : "text-muted-foreground hover:text-pink-600"
                            }`}
                            data-testid={`button-toggle-checklist-${item.id}`}
                            title={
                              item.isCompleted
                                ? item.linkedDocumentId
                                  ? "Linked to a document — delete the document to mark incomplete"
                                  : "Click to mark incomplete"
                                : "Mark complete"
                            }
                          >
                            {item.isCompleted
                              ? item.linkedDocumentId
                                ? <Lock className="h-5 w-5 text-green-600" />
                                : <CheckSquare className="h-5 w-5" />
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
                            {item.submissionDate && !item.isCompleted && (
                              <p className={`text-xs mt-0.5 flex items-center gap-1 ${new Date(item.submissionDate) < new Date() ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                                <Calendar className="h-3 w-3" />
                                Submit by {format(new Date(item.submissionDate), "d MMM yyyy")}
                              </p>
                            )}
                            {item.isCompleted && item.completedAt && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                Completed {format(new Date(item.completedAt), "d MMM yyyy")}
                              </p>
                            )}
                          </div>
                          {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-checklist-menu-${item.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingChecklistItem(item);
                                    setChecklistForm({
                                      title: item.title,
                                      description: item.description ?? "",
                                      submissionDate: item.submissionDate ? format(new Date(item.submissionDate), "yyyy-MM-dd") : "",
                                    });
                                    setShowChecklistDialog(true);
                                  }}
                                  data-testid={`button-edit-checklist-${item.id}`}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {!item.isCompleted && (
                                  <DropdownMenuItem
                                    onClick={() => { setLinkDocSelectedId(""); setLinkDocDialog(item); }}
                                    data-testid={`button-link-doc-checklist-${item.id}`}
                                  >
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Link existing document
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (item.linkedDocumentId) {
                                      setChecklistItemToDelete(item);
                                    } else {
                                      deleteChecklistItemMutation.mutate(item.id);
                                    }
                                  }}
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
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-pink-500" />
                  Case Documents
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Documents linked to this case</CardDescription>
              </div>
              {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
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
                        <p className="text-xs text-muted-foreground">
                          {doc.fileName}
                          {doc.documentDate && (
                            <span> · Document date: {format(new Date(doc.documentDate), "d MMM yyyy")}</span>
                          )}
                        </p>
                        {linkedChecklistItem && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                            <CheckSquare className="h-3 w-3" />
                            Fulfils: {linkedChecklistItem.title}
                          </span>
                        )}
                      </div>
                      {doc.fileUrl && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/") || doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || doc.mimeType === "application/msword") && (
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
                      {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setDocToEdit(doc);
                            setEditDocTitle(doc.title);
                            setEditDocDate(doc.documentDate ? format(new Date(doc.documentDate), "yyyy-MM-dd") : "");
                          }}
                          data-testid={`button-edit-doc-${doc.id}`}
                          title="Edit document"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => setDocToDelete({
                            id: doc.id,
                            title: doc.title,
                            linkedChecklistItem: linkedChecklistItem,
                          })}
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg">Milestones</CardTitle>
                <CardDescription>Track key dates and tasks for this case</CardDescription>
              </div>
              {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
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
                      milestone.isCompleted
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : milestone.isResponseDeadline
                          ? "bg-pink-50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800"
                          : "bg-card"
                    }`}
                    data-testid={`milestone-${milestone.id}`}
                  >
                    <div className={`mt-0.5 rounded-full p-1 ${
                      milestone.isCompleted
                        ? "bg-green-100 dark:bg-green-900/40 text-green-600"
                        : milestone.isResponseDeadline
                          ? "bg-pink-100 dark:bg-pink-900/40 text-pink-600"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {milestone.isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {milestone.title}
                        </p>
                        {milestone.isResponseDeadline && (
                          <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-0 text-xs py-0">
                            ET3 Response Deadline
                          </Badge>
                        )}
                        {milestone.checklistItemId && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs py-0 flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            Essential document
                          </Badge>
                        )}
                      </div>
                      {milestone.description && !milestone.isResponseDeadline && (
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
                      {milestone.isCompleted && milestone.completedDate && (
                        <p className="text-xs mt-1 text-green-700 dark:text-green-400 font-medium">
                          Completed: {format(new Date(milestone.completedDate), "MMM d, yyyy")}
                        </p>
                      )}
                      {milestone.isCompleted && milestone.completionNotes && (
                        <div className="mt-1.5">
                          <button
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            onClick={() => setExpandedMilestoneNotes(prev => {
                              const next = new Set(prev);
                              next.has(milestone.id) ? next.delete(milestone.id) : next.add(milestone.id);
                              return next;
                            })}
                            data-testid={`button-toggle-notes-${milestone.id}`}
                          >
                            {expandedMilestoneNotes.has(milestone.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            Completion notes
                          </button>
                          {expandedMilestoneNotes.has(milestone.id) && (
                            <p className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 border-muted whitespace-pre-wrap" data-testid={`text-completion-notes-${milestone.id}`}>
                              {milestone.completionNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
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
                              onClick={() => {
                                setCompletionForm({ completedDate: format(new Date(), "yyyy-MM-dd"), completionNotes: "" });
                                setCompletingMilestone(milestone);
                              }}
                              data-testid={`button-complete-milestone-${milestone.id}`}
                            >
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                              Mark Complete
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() => reopenMilestoneMutation.mutate(milestone.id)}
                                data-testid={`button-reopen-milestone-${milestone.id}`}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reopen
                              </DropdownMenuItem>
                              {milestone.completionNotes && (
                                <DropdownMenuItem
                                  onClick={() => setViewingMilestoneNotes(milestone)}
                                  data-testid={`button-view-notes-${milestone.id}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Notes
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => setEditingMilestone(milestone)}
                            data-testid={`button-edit-milestone-${milestone.id}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {!milestone.isResponseDeadline && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                                className="text-red-600"
                                data-testid={`button-delete-milestone-${milestone.id}`}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Audit Trail
                {auditLogs && <Badge variant="secondary" className="text-xs">{auditLogs.length}</Badge>}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAuditModal(true)}
                data-testid="button-open-audit-modal"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                View all
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {(!auditLogs || auditLogs.length === 0) ? (
                <p className="text-center text-muted-foreground py-3 text-sm">No audit history yet</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.slice(0, 2).map((log) => {
                    const style = getActionStyle(log.action);
                    const ActionIcon = style.icon;
                    return (
                      <div key={log.id} className="flex items-start gap-2.5">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                          <ActionIcon className={`h-3 w-3 ${style.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-snug truncate">{log.details}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.userName} · {format(new Date(log.createdAt), "MMM d 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {auditLogs.length > 2 && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center pt-1"
                      onClick={() => setShowAuditModal(true)}
                      data-testid="button-audit-show-more"
                    >
                      + {auditLogs.length - 2} more entries
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Bundles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-pink-500" />
                  Document Bundles
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Saved document sets for download as PDF</CardDescription>
              </div>
              {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                <Button size="sm" variant="outline" onClick={openNewBundleDialog} data-testid="button-new-bundle">
                  <PackagePlus className="h-4 w-4 mr-1.5" />
                  New Bundle
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {bundles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No bundles yet</p>
              ) : (
                <div className="space-y-2">
                  {bundles.map((bundle) => (
                    <div
                      key={bundle.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                      data-testid={`bundle-row-${bundle.id}`}
                    >
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bundle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {((bundle.checklistItemIds?.length ?? 0) + (bundle.documentIds?.length ?? 0))} document{((bundle.checklistItemIds?.length ?? 0) + (bundle.documentIds?.length ?? 0)) === 1 ? "" : "s"}
                          {bundle.startPageNumber && bundle.startPageNumber !== 1 ? ` · starts at page ${bundle.startPageNumber}` : ""}
                        </p>
                        {bundle.cachedFileUrl && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {bundle.fileSizeBytes ? `${formatFileSize(bundle.fileSizeBytes)} · ` : ""}
                              {bundle.pageCount ? `${bundle.pageCount} ${bundle.pageCount === 1 ? "page" : "pages"}` : ""}
                            </p>
                            {bundle.cachedAt && (
                              <p className="text-xs text-muted-foreground">
                                Created: {format(new Date(bundle.cachedAt), "dd/MM/yyyy")}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={downloadingBundleId === bundle.id}
                          onClick={() => handleDownloadBundle(bundle)}
                          data-testid={`button-download-bundle-${bundle.id}`}
                          title={bundle.cachedFileUrl ? "Download bundle PDF" : "Create PDF"}
                        >
                          {downloadingBundleId === bundle.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : bundle.cachedFileUrl ? (
                            <Download className="h-4 w-4" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
                        </Button>
                        {bundle.cachedFileUrl && (bundle.documentPageInfo?.length ?? 0) > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={exportingBundleId === bundle.id}
                            onClick={() => handleExportBundleIndex(bundle)}
                            data-testid={`button-export-bundle-index-${bundle.id}`}
                            title="Export document index (CSV)"
                          >
                            {exportingBundleId === bundle.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {(user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator") && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditBundleDialog(bundle)}
                              data-testid={`button-edit-bundle-${bundle.id}`}
                              title="Edit bundle"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setBundleToDelete(bundle)}
                              data-testid={`button-delete-bundle-${bundle.id}`}
                              title="Delete bundle"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bundle Dialog */}
      <Dialog open={showBundleDialog} onOpenChange={setShowBundleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBundle ? "Edit Bundle" : "New Document Bundle"}</DialogTitle>
            <DialogDescription>
              Choose a name and select the documents to include in this bundle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">Bundle Name</label>
              <Input
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder="e.g. Claimant Documents"
                data-testid="input-bundle-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block text-foreground">Starting Page Number</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={bundleStartPageNumber}
                onChange={(e) => setBundleStartPageNumber(e.target.value)}
                placeholder="1"
                className="max-w-[120px]"
                data-testid="input-bundle-start-page-number"
              />
              <p className="text-xs text-muted-foreground mt-1">The generated PDF's page numbers will begin counting from this number.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Documents ({bundleCheckedIds.size} selected)
                </label>
                {(bundleItemOrder.length + bundleDocOrder.length) > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const allIds = [...bundleItemOrder, ...bundleDocOrder];
                      if (bundleCheckedIds.size === allIds.length) {
                        setBundleCheckedIds(new Set());
                      } else {
                        setBundleCheckedIds(new Set(allIds));
                      }
                    }}
                    data-testid="button-bundle-select-all"
                  >
                    {bundleCheckedIds.size === (bundleItemOrder.length + bundleDocOrder.length) ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {/* Essential Documents — linked to a case checklist item */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Essential Documents</p>
                <div className="max-h-44 overflow-y-auto rounded border divide-y">
                  {bundleItemOrder.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No completed checklist items with documents</p>
                  ) : (
                    <DndContext sensors={bundleSensors} collisionDetection={closestCenter} onDragEnd={handleBundleDragEnd}>
                      <SortableContext items={bundleItemOrder} strategy={verticalListSortingStrategy}>
                        {bundleItemOrder.map(itemId => {
                          const item = linkedChecklistMap.get(itemId);
                          if (!item) return null;
                          const linkedDoc = item.linkedDocumentId ? documentMap.get(item.linkedDocumentId) : undefined;
                          return (
                            <SortableBundleItem
                              key={itemId}
                              id={itemId}
                              title={item.title}
                              fileName={linkedDoc?.fileName}
                              mimeType={linkedDoc?.mimeType}
                              documentDate={linkedDoc?.documentDate}
                              checked={bundleCheckedIds.has(itemId)}
                              onCheckedChange={(checked) => {
                                setBundleCheckedIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(itemId); else next.delete(itemId);
                                  return next;
                                });
                              }}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>

              {/* Case Documents — case files not linked to an essential document */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Case Documents</p>
                <div className="max-h-44 overflow-y-auto rounded border divide-y">
                  {bundleDocOrder.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No other case documents available</p>
                  ) : (
                    <DndContext sensors={bundleSensors} collisionDetection={closestCenter} onDragEnd={handleBundleDocDragEnd}>
                      <SortableContext items={bundleDocOrder} strategy={verticalListSortingStrategy}>
                        {bundleDocOrder.map(docId => {
                          const doc = documentMap.get(docId);
                          if (!doc) return null;
                          return (
                            <SortableBundleItem
                              key={docId}
                              id={docId}
                              title={doc.title || doc.fileName || "Document"}
                              fileName={doc.fileName}
                              mimeType={doc.mimeType}
                              documentDate={doc.documentDate}
                              checked={bundleCheckedIds.has(docId)}
                              onCheckedChange={(checked) => {
                                setBundleCheckedIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(docId); else next.delete(docId);
                                  return next;
                                });
                              }}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>Cancel</Button>
            <Button
              disabled={!bundleName.trim() || bundleCheckedIds.size === 0 || !Number.isInteger(parseInt(bundleStartPageNumber, 10)) || parseInt(bundleStartPageNumber, 10) < 1 || createBundleMutation.isPending || updateBundleMutation.isPending}
              onClick={editingBundle ? handleSaveBundleWithCheck : handleSaveBundle}
              data-testid="button-save-bundle"
            >
              {(createBundleMutation.isPending || updateBundleMutation.isPending) && (
                <img src={logoIcon} alt="" className="h-4 w-4 mr-1.5 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />
              )}
              {editingBundle ? "Save Changes" : "Save Bundle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bundle Edit — overwrite cached PDF confirmation */}
      <AlertDialog open={bundleEditConfirmPending} onOpenChange={(o) => { if (!o) setBundleEditConfirmPending(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              Saving these changes will permanently delete the existing generated PDF. You will need to create the PDF again to download it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBundleEditConfirmPending(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSaveBundle}
              data-testid="button-confirm-bundle-overwrite"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bundle Delete Confirm */}
      <AlertDialog open={!!bundleToDelete} onOpenChange={(o) => { if (!o) setBundleToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              The bundle &ldquo;{bundleToDelete?.name}&rdquo; will be permanently deleted and cannot be recovered. Any generated PDF will also be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bundleToDelete && deleteBundleMutation.mutate(bundleToDelete.id)}
              data-testid="button-confirm-delete-bundle"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Essential document delete — linked document warning */}
      <AlertDialog open={!!checklistItemToDelete} onOpenChange={(open) => !open && setChecklistItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Essential Document?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <span className="font-semibold">"{checklistItemToDelete?.title}"</span> is currently linked to an uploaded document that has not been deleted.
              </p>
              <p>
                Deleting this essential document will remove the checklist entry but the uploaded document will remain in the case. Are you sure you want to continue?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-checklist">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (checklistItemToDelete) {
                  deleteChecklistItemMutation.mutate(checklistItemToDelete.id);
                  setChecklistItemToDelete(null);
                }
              }}
              disabled={deleteChecklistItemMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-checklist"
            >
              {deleteChecklistItemMutation.isPending ? "Deleting..." : "Delete Essential Document"}
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

      {/* Complete milestone dialog */}
      <Dialog open={!!completingMilestone} onOpenChange={(open) => !open && setCompletingMilestone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Milestone</DialogTitle>
            <DialogDescription>
              Record the completion details for &ldquo;{completingMilestone?.title}&rdquo;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Date <span className="text-destructive">*</span></label>
              <Input
                type="date"
                value={completionForm.completedDate}
                onChange={(e) => setCompletionForm(f => ({ ...f, completedDate: e.target.value }))}
                data-testid="input-completion-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Notes <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
              <Textarea
                placeholder="Add any notes about how this milestone was completed…"
                value={completionForm.completionNotes}
                onChange={(e) => setCompletionForm(f => ({ ...f, completionNotes: e.target.value }))}
                rows={4}
                data-testid="input-completion-notes"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCompletingMilestone(null)} data-testid="button-cancel-complete-milestone">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!completingMilestone || !completionForm.completedDate) return;
                  completeMilestoneMutation.mutate({
                    milestoneId: completingMilestone.id,
                    completedDate: completionForm.completedDate,
                    completionNotes: completionForm.completionNotes,
                  });
                }}
                disabled={!completionForm.completedDate || completeMilestoneMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-confirm-complete-milestone"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {completeMilestoneMutation.isPending ? "Saving…" : "Mark Complete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View milestone completion notes dialog */}
      <Dialog open={!!viewingMilestoneNotes} onOpenChange={(open) => !open && setViewingMilestoneNotes(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Completion Notes
            </DialogTitle>
            <DialogDescription>{viewingMilestoneNotes?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {viewingMilestoneNotes?.completedDate && (
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                Completed: {format(new Date(viewingMilestoneNotes.completedDate), "d MMM yyyy")}
              </p>
            )}
            <div className="rounded-md bg-muted/50 border p-3">
              <p className="text-sm whitespace-pre-wrap" data-testid="dialog-completion-notes">
                {viewingMilestoneNotes?.completionNotes}
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={() => setViewingMilestoneNotes(null)} data-testid="button-close-view-notes">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checklist add/edit dialog */}
      <Dialog open={showChecklistDialog} onOpenChange={(open) => { setShowChecklistDialog(open); if (!open) { setEditingChecklistItem(null); setChecklistForm({ title: "", description: "", submissionDate: "" }); } }}>
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-pink-500" />
                Submission date <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <Input
                type="date"
                value={checklistForm.submissionDate}
                onChange={e => setChecklistForm(f => ({ ...f, submissionDate: e.target.value }))}
                data-testid="input-checklist-submission-date"
              />
              {checklistForm.submissionDate && (
                <p className="text-xs text-muted-foreground">A milestone "Submit: {checklistForm.title || "…"}" will {editingChecklistItem?.linkedMilestoneId ? "be updated" : "appear"} in the milestone list.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowChecklistDialog(false)} data-testid="button-checklist-cancel">Cancel</Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700"
                disabled={!checklistForm.title.trim() || (editingChecklistItem ? updateChecklistItemMutation.isPending : createChecklistItemMutation.isPending)}
                onClick={() => {
                  if (editingChecklistItem) {
                    updateChecklistItemMutation.mutate({
                      itemId: editingChecklistItem.id,
                      data: {
                        title: checklistForm.title.trim(),
                        description: checklistForm.description.trim() || null,
                        submissionDate: checklistForm.submissionDate || null,
                      }
                    });
                    setShowChecklistDialog(false);
                  } else {
                    createChecklistItemMutation.mutate({
                      title: checklistForm.title.trim(),
                      description: checklistForm.description.trim(),
                      submissionDate: checklistForm.submissionDate || null,
                    });
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

      {/* Checklist item reopen dialog (confirmation or blocked) */}
      <Dialog open={!!checklistReopenDialog} onOpenChange={(open) => { if (!open) setChecklistReopenDialog(null); }}>
        <DialogContent className="max-w-md">
          {checklistReopenDialog?.linkedDoc ? (
            // Blocked — has a linked document
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-600" />
                  Cannot mark incomplete
                </DialogTitle>
                <DialogDescription className="space-y-3 pt-1">
                  <span>
                    <span className="font-medium text-foreground">"{checklistReopenDialog.item.title}"</span> was completed by uploading a specific document. To mark it incomplete, delete that document from Case Documents first.
                  </span>
                  <span className="flex items-start gap-2 p-3 rounded-lg bg-muted border text-sm">
                    <FileText className="h-4 w-4 mt-0.5 shrink-0 text-pink-600" />
                    <span>
                      <span className="font-medium">{checklistReopenDialog.linkedDoc.title}</span>
                      <span className="block text-muted-foreground text-xs mt-0.5">{checklistReopenDialog.linkedDoc.fileName}</span>
                    </span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setChecklistReopenDialog(null)} data-testid="button-close-blocked-reopen">
                  Got it
                </Button>
              </div>
            </>
          ) : (
            // Confirmation — manually completed, no linked doc
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="h-5 w-5" />
                  Mark as incomplete?
                </DialogTitle>
                <DialogDescription className="pt-1">
                  Are you sure you want to reopen <span className="font-medium text-foreground">"{checklistReopenDialog?.item.title}"</span> and mark it as not yet fulfilled?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setChecklistReopenDialog(null)} data-testid="button-cancel-reopen">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => {
                    if (checklistReopenDialog) {
                      updateChecklistItemMutation.mutate(
                        { itemId: checklistReopenDialog.item.id, data: { isCompleted: false } },
                        { onSuccess: () => setChecklistReopenDialog(null) }
                      );
                    }
                  }}
                  disabled={updateChecklistItemMutation.isPending}
                  data-testid="button-confirm-reopen"
                >
                  {updateChecklistItemMutation.isPending ? "Saving…" : "Mark incomplete"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Link existing document to checklist item */}
      <Dialog open={!!linkDocDialog} onOpenChange={(open) => { if (!open) { setLinkDocDialog(null); setLinkDocSelectedId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-pink-500" />
              Link existing document
            </DialogTitle>
            <DialogDescription>
              Select a document already uploaded to this case to fulfil <span className="font-medium text-foreground">"{linkDocDialog?.title}"</span>.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const alreadyLinked = new Set((checklistItems ?? []).map(i => i.linkedDocumentId).filter(Boolean));
            const available = (documents ?? []).filter(d => !alreadyLinked.has(d.id));
            return available.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No documents available to link. Upload a document first or all existing documents are already linked.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto py-1">
                {available.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setLinkDocSelectedId(doc.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-md border text-left transition-colors ${
                      linkDocSelectedId === doc.id
                        ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                    data-testid={`link-doc-option-${doc.id}`}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                    </div>
                    {linkDocSelectedId === doc.id && <CheckCircle className="h-4 w-4 shrink-0 text-pink-500" />}
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setLinkDocDialog(null); setLinkDocSelectedId(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-pink-600 hover:bg-pink-700 text-white"
              disabled={!linkDocSelectedId || updateChecklistItemMutation.isPending}
              onClick={() => {
                if (!linkDocDialog || !linkDocSelectedId) return;
                updateChecklistItemMutation.mutate(
                  { itemId: linkDocDialog.id, data: { isCompleted: true, linkedDocumentId: linkDocSelectedId } },
                  {
                    onSuccess: () => {
                      toast({ title: "Document linked — essential document marked complete" });
                      setLinkDocDialog(null);
                      setLinkDocSelectedId("");
                    },
                  }
                );
              }}
              data-testid="button-confirm-link-doc"
            >
              {updateChecklistItemMutation.isPending ? "Linking…" : "Link document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Note delete confirmation dialog */}
      <Dialog open={!!noteToDelete} onOpenChange={(open) => { if (!open) setNoteToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete note?
            </DialogTitle>
            <DialogDescription className="pt-1">
              This will permanently delete the note. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {noteToDelete && (
            <div className="p-3 rounded-lg bg-muted border text-sm text-muted-foreground line-clamp-3">
              {noteToDelete.content}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setNoteToDelete(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { if (noteToDelete) deleteNoteMutation.mutate(noteToDelete.id); }}
              disabled={deleteNoteMutation.isPending}
              data-testid="button-confirm-delete-note"
            >
              {deleteNoteMutation.isPending ? "Deleting…" : "Delete note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete document confirmation dialog */}
      <Dialog open={!!docToDelete} onOpenChange={(open) => { if (!open) setDocToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              Delete document?
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-1">
              <span>
                Are you sure you want to permanently delete <span className="font-medium text-foreground">"{docToDelete?.title}"</span>? This cannot be undone.
              </span>
              {docToDelete?.linkedChecklistItem && (
                <span className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    This document fulfils the essential document <span className="font-semibold">"{docToDelete.linkedChecklistItem.title}"</span>. Deleting it will mark that requirement as incomplete.
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocToDelete(null)}
              data-testid="button-cancel-delete-doc"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteDocumentMutation.isPending}
              onClick={() => { if (docToDelete) deleteDocumentMutation.mutate(docToDelete.id); }}
              data-testid="button-confirm-delete-doc"
            >
              {deleteDocumentMutation.isPending ? "Deleting…" : "Delete document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit document dialog */}
      <Dialog open={!!docToEdit} onOpenChange={(open) => { if (!open) setDocToEdit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit document
            </DialogTitle>
            <DialogDescription>
              Update the name and document date for "{docToEdit?.fileName}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-doc-title">Document name</Label>
              <Input
                id="edit-doc-title"
                value={editDocTitle}
                onChange={(e) => setEditDocTitle(e.target.value)}
                data-testid="input-edit-doc-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-doc-date">Document date (optional)</Label>
              <Input
                id="edit-doc-date"
                type="date"
                value={editDocDate}
                onChange={(e) => setEditDocDate(e.target.value)}
                data-testid="input-edit-doc-date"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDocToEdit(null)}
              data-testid="button-cancel-edit-doc"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateDocumentMutation.isPending || !editDocTitle.trim()}
              onClick={() => {
                if (!docToEdit) return;
                updateDocumentMutation.mutate({
                  docId: docToEdit.id,
                  data: {
                    title: editDocTitle.trim(),
                    documentDate: editDocDate || null,
                  },
                });
              }}
              data-testid="button-confirm-edit-doc"
            >
              {updateDocumentMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates management + load dialog */}
      <TemplatesDialog
        open={showLoadTemplateDialog}
        caseId={id}
        onClose={() => setShowLoadTemplateDialog(false)}
        onApplied={() => queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "checklist"] })}
      />

      {/* Pre-upload essential document matching dialog */}
      <Dialog
        open={showEssentialDocDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowEssentialDocDialog(false);
            setPendingFile(null);
            setSelectedChecklistItemId(null);
            setPendingDocumentDate("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-pink-600" />
              {(checklistItems ?? []).filter(i => !i.isCompleted).length > 0
                ? "Does this fulfil an essential document?"
                : "Upload document"}
            </DialogTitle>
            <DialogDescription>
              {pendingFile && (
                <>
                  Uploading <span className="font-medium text-foreground">"{pendingFile.name.replace(/\.[^/.]+$/, "")}"</span>.{" "}
                  {(checklistItems ?? []).filter(i => !i.isCompleted).length > 0
                    ? "Select which essential document this satisfies, or upload without linking."
                    : "Optionally set a document date."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {(checklistItems ?? []).filter(i => !i.isCompleted).length > 0 && (
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
          )}
          <div className="space-y-1.5 pt-1">
            <label className="text-sm font-medium">Document date <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
            <Input
              type="date"
              value={pendingDocumentDate}
              onChange={(e) => setPendingDocumentDate(e.target.value)}
              data-testid="input-document-date"
            />
          </div>
          <div className="flex justify-between items-center pt-2 border-t gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowEssentialDocDialog(false);
                if (pendingFile) doUpload(pendingFile, null, pendingDocumentDate || null);
              }}
              data-testid="button-upload-without-linking"
            >
              {(checklistItems ?? []).filter(i => !i.isCompleted).length > 0 ? "Upload without linking" : "Cancel"}
            </Button>
            {(checklistItems ?? []).filter(i => !i.isCompleted).length > 0 ? (
              <Button
                size="sm"
                className="bg-pink-600 hover:bg-pink-700 text-white"
                disabled={!selectedChecklistItemId || isUploading}
                onClick={() => {
                  setShowEssentialDocDialog(false);
                  if (pendingFile) doUpload(pendingFile, selectedChecklistItemId, pendingDocumentDate || null);
                }}
                data-testid="button-upload-and-complete"
              >
                {isUploading ? "Uploading…" : selectedChecklistItemId ? "Upload & Mark Complete" : "Select one above"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-pink-600 hover:bg-pink-700 text-white"
                disabled={isUploading}
                onClick={() => {
                  setShowEssentialDocDialog(false);
                  if (pendingFile) doUpload(pendingFile, null, pendingDocumentDate || null);
                }}
                data-testid="button-confirm-upload"
              >
                {isUploading ? "Uploading…" : "Upload"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-pink-600" />
              Case Access
            </DialogTitle>
            <DialogDescription>
              {caseData?.isConfidential
                ? "This case is confidential — only users listed below can view it."
                : "This case is visible to all company users."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {caseData?.isConfidential ? (
              <>
                {usersWithAccess.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Users with access</p>
                    {usersWithAccess.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{u.fullName}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
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
                {availableUsers.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add a user</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {availableUsers.map(u => {
                        const isInactive = u.status !== "active";
                        return (
                          <div
                            key={u.id}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-lg border",
                              isInactive
                                ? "opacity-50 cursor-not-allowed bg-muted/30"
                                : "hover-elevate cursor-pointer"
                            )}
                            onClick={() => {
                              if (isInactive) return;
                              const newList = [...restrictedUserIds, u.id];
                              updateCaseMutation.mutate({ restrictedToUsers: newList as any });
                            }}
                            data-testid={`button-grant-access-${u.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{u.fullName}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                              {isInactive && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <UserPlus className={cn("h-4 w-4", isInactive ? "text-muted-foreground" : "text-pink-600")} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Users className="h-4 w-4" />
                <span>All company users can view this case.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessDialog(false)}>Close</Button>
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
              if (mime === "application/pdf" ||
                  mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                  mime === "application/msword") {
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

      {/* Audit Trail Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Trail
              {auditLogs && <Badge variant="secondary" className="text-xs ml-1">{auditLogs.length} entries</Badge>}
            </DialogTitle>
            <DialogDescription>
              Full activity history for case {caseData?.caseReference}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
            {(!auditLogs || auditLogs.length === 0) ? (
              <p className="text-center text-muted-foreground py-8">No audit history yet</p>
            ) : (
              auditLogs.map((log) => {
                const style = getActionStyle(log.action);
                const ActionIcon = style.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 py-3 border-b last:border-0">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                      <ActionIcon className={`h-4 w-4 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{log.details}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.userName} · {format(new Date(log.createdAt), "d MMM yyyy 'at' h:mm a")}
                      </p>
                    </div>
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

  const isRD = milestone.isResponseDeadline;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRD && !formData.dueDate) return;
    onSubmit({
      title: formData.title,
      description: formData.description || null,
      dueDate: formData.dueDate || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRD && (
        <div className="rounded-md bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 px-3 py-2 text-sm text-pink-700 dark:text-pink-300">
          Changing the due date will also update the ET3 Response Deadline on the case file.
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Schedule hearing"
          required
          disabled={isRD}
          data-testid="input-edit-milestone-title"
        />
      </div>
      {!isRD && (
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
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Due Date {isRD ? <span className="text-destructive">*</span> : "(optional)"}
        </label>
        <Input
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          required={isRD}
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBundleFileTypeLabel(mimeType?: string | null, fileName?: string | null): string {
  if (mimeType) {
    const map: Record<string, string> = {
      "application/pdf": "PDF",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
      "application/msword": "DOC",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
      "application/vnd.ms-excel": "XLS",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
      "application/vnd.oasis.opendocument.text": "ODT",
      "text/html": "HTML",
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/gif": "GIF",
      "image/webp": "WEBP",
    };
    const label = map[mimeType] ?? mimeType.split("/").pop()?.toUpperCase() ?? "";
    if (label) return label;
  }
  if (fileName) {
    const ext = fileName.split(".").pop()?.toUpperCase();
    if (ext) return ext;
  }
  return "";
}

// Sortable item for bundle document list
function SortableBundleItem({
  id,
  title,
  fileName,
  mimeType,
  documentDate,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  fileName?: string | null;
  mimeType?: string | null;
  documentDate?: string | Date | null;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const fileTypeLabel = getBundleFileTypeLabel(mimeType, fileName);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 hover:bg-muted/50 select-none"
      data-testid={`bundle-item-${id}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...listeners}
        {...attributes}
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="checkbox"
        className="shrink-0"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        data-testid={`bundle-item-checkbox-${id}`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug truncate text-foreground">{title}</p>
        {(fileName || fileTypeLabel || documentDate) && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {fileName && <span>{fileName}</span>}
            {fileName && fileTypeLabel && <span className="mx-1">·</span>}
            {fileTypeLabel && <span>{fileTypeLabel}</span>}
            {(fileName || fileTypeLabel) && documentDate && <span className="mx-1">·</span>}
            {documentDate && <span>{format(new Date(documentDate), "d MMM yyyy")}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

type TemplateView = "list" | "edit";

function TemplatesDialog({
  open, caseId, onClose, onApplied,
}: {
  open: boolean;
  caseId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [view, setView] = useState<TemplateView>("list");
  const [editingTemplate, setEditingTemplate] = useState<CaseChecklistTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", notes: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ title: "", description: "" });
  const [addingItemForId, setAddingItemForId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; templateId: string; title: string; description: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "template"; id: string; name: string } | { type: "item"; id: string; templateId: string; name: string } | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<CaseChecklistTemplate[]>({
    queryKey: ["/api/case-checklist-templates"],
    enabled: open,
  });

  function resetAndClose() {
    setView("list");
    setEditingTemplate(null);
    setExpandedId(null);
    setAddingItemForId(null);
    setEditingItem(null);
    onClose();
  }

  // ── Template mutations ────────────────────────────────────────────────────
  const saveTemplate = useMutation({
    mutationFn: () => editingTemplate
      ? apiRequest("PATCH", `/api/case-checklist-templates/${editingTemplate.id}`, templateForm)
      : apiRequest("POST", "/api/case-checklist-templates", templateForm),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates"] });
      if (!editingTemplate) {
        const created = await res.json();
        setEditingTemplate(created);
        setExpandedId(created.id);
      }
      setView("list");
      setEditingTemplate(null);
      toast({ title: editingTemplate ? "Template updated" : "Template created" });
    },
    onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/case-checklist-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates"] });
      setConfirmDelete(null);
      toast({ title: "Template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  // ── Item mutations ────────────────────────────────────────────────────────
  const saveItem = useMutation({
    mutationFn: () => editingItem
      ? apiRequest("PATCH", `/api/case-checklist-template-items/${editingItem.id}`, { title: itemForm.title, description: itemForm.description })
      : apiRequest("POST", `/api/case-checklist-templates/${addingItemForId}/items`, { title: itemForm.title, description: itemForm.description }),
    onSuccess: () => {
      const tid = editingItem?.templateId ?? addingItemForId;
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates", tid, "items"] });
      setAddingItemForId(null);
      setEditingItem(null);
      setItemForm({ title: "", description: "" });
      toast({ title: editingItem ? "Item updated" : "Item added" });
    },
    onError: () => toast({ title: "Failed to save item", variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: ({ id }: { id: string; templateId: string }) => apiRequest("DELETE", `/api/case-checklist-template-items/${id}`),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-checklist-templates", templateId, "items"] });
      setConfirmDelete(null);
      toast({ title: "Item removed" });
    },
    onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
  });

  // ── Apply to case ─────────────────────────────────────────────────────────
  const applyTemplate = useMutation({
    mutationFn: (templateId: string) => apiRequest("POST", `/api/cases/${caseId}/apply-checklist-template/${templateId}`),
    onSuccess: (_, templateId) => {
      onApplied();
      setApplyingId(null);
      toast({ title: "Template loaded", description: "Document items added to this case." });
    },
    onError: () => { setApplyingId(null); toast({ title: "Failed to apply template", variant: "destructive" }); },
  });

  // ── Edit view ─────────────────────────────────────────────────────────────
  if (view === "edit") {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-pink-600" />
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update the template name and notes." : "Give this template a name, then add document items to it."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name <span className="text-destructive">*</span></label>
              <Input
                value={templateForm.name}
                onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tribunal Claim — Standard"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Textarea
                value={templateForm.notes}
                onChange={e => setTemplateForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="When to use this template…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => { setView("list"); setEditingTemplate(null); }}>Back</Button>
            <Button
              onClick={() => saveTemplate.mutate()}
              disabled={!templateForm.name.trim() || saveTemplate.isPending}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-save-template"
            >
              {saveTemplate.isPending ? "Saving…" : editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-pink-600" />
                  Essential Document Templates
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Apply a template to this case, or manage your templates below.
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => { setTemplateForm({ name: "", notes: "" }); setEditingTemplate(null); setView("edit"); }}
                data-testid="button-new-template"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
            {!isLoading && templates.length === 0 && (
              <div className="text-center py-10">
                <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No templates yet</p>
                <p className="text-xs text-muted-foreground mt-1">Click <strong>New</strong> to create your first template.</p>
              </div>
            )}
            {templates.map(template => (
              <TemplateRow
                key={template.id}
                template={template}
                expanded={expandedId === template.id}
                onToggle={() => setExpandedId(p => p === template.id ? null : template.id)}
                onEdit={() => { setTemplateForm({ name: template.name, notes: template.notes ?? "" }); setEditingTemplate(template); setView("edit"); }}
                onDelete={() => setConfirmDelete({ type: "template", id: template.id, name: template.name })}
                onApply={() => { setApplyingId(template.id); applyTemplate.mutate(template.id); }}
                isApplying={applyingId === template.id && applyTemplate.isPending}
                addingItemForId={addingItemForId}
                onStartAddItem={() => { setItemForm({ title: "", description: "" }); setAddingItemForId(template.id); setEditingItem(null); }}
                onCancelAddItem={() => setAddingItemForId(null)}
                itemForm={itemForm}
                onItemFormChange={setItemForm}
                onSaveItem={() => saveItem.mutate()}
                isSavingItem={saveItem.isPending}
                editingItem={editingItem}
                onStartEditItem={(item) => { setItemForm({ title: item.title, description: item.description ?? "" }); setEditingItem({ id: item.id, templateId: template.id, title: item.title, description: item.description ?? "" }); setAddingItemForId(null); }}
                onCancelEditItem={() => setEditingItem(null)}
                onDeleteItem={(item) => setConfirmDelete({ type: "item", id: item.id, templateId: template.id, name: item.title })}
              />
            ))}
          </div>

          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="outline" onClick={resetAndClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDelete?.type === "template" ? "Delete Template?" : "Remove Item?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.type === "template"
                ? <>Permanently delete <strong>{confirmDelete.name}</strong> and all its items?</>
                : <>Remove <strong>{confirmDelete?.name}</strong> from this template?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.type === "template") deleteTemplate.mutate(confirmDelete.id);
                else deleteItem.mutate({ id: confirmDelete.id, templateId: confirmDelete.templateId });
              }}
            >
              {confirmDelete?.type === "template" ? "Delete" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type TemplateItemShape = { id: string; title: string; description?: string | null; templateId: string };

function TemplateRow({
  template, expanded, onToggle, onEdit, onDelete, onApply, isApplying,
  addingItemForId, onStartAddItem, onCancelAddItem,
  itemForm, onItemFormChange, onSaveItem, isSavingItem,
  editingItem, onStartEditItem, onCancelEditItem, onDeleteItem,
}: {
  template: CaseChecklistTemplate;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApply: () => void;
  isApplying: boolean;
  addingItemForId: string | null;
  onStartAddItem: () => void;
  onCancelAddItem: () => void;
  itemForm: { title: string; description: string };
  onItemFormChange: (f: { title: string; description: string }) => void;
  onSaveItem: () => void;
  isSavingItem: boolean;
  editingItem: { id: string; templateId: string; title: string; description: string } | null;
  onStartEditItem: (item: TemplateItemShape) => void;
  onCancelEditItem: () => void;
  onDeleteItem: (item: TemplateItemShape) => void;
}) {
  const { data: items = [] } = useQuery<TemplateItemShape[]>({
    queryKey: ["/api/case-checklist-templates", template.id, "items"],
    queryFn: () => fetch(`/api/case-checklist-templates/${template.id}/items`, { credentials: "include" }).then(r => r.json()),
    enabled: expanded,
  });

  const isAddingForThis = addingItemForId === template.id;
  const isEditingItemForThis = editingItem?.templateId === template.id;

  return (
    <div className="rounded-lg border bg-card">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button className="flex-1 text-left min-w-0" onClick={onToggle}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{template.name}</span>
            <Badge variant="secondary" className="text-xs shrink-0">{expanded ? `${items.length} items` : "…"}</Badge>
          </div>
          {template.notes && !expanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{template.notes}</p>
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={onApply}
            disabled={isApplying}
            data-testid={`button-apply-template-${template.id}`}
          >
            {isApplying ? "Adding…" : "Add to Case"}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-template-${template.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`button-delete-template-${template.id}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <button onClick={onToggle} className="text-muted-foreground p-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-1.5">
          {template.notes && (
            <p className="text-xs text-muted-foreground border-l-2 pl-2 mb-2">{template.notes}</p>
          )}
          {items.length === 0 && !isAddingForThis && (
            <p className="text-xs text-muted-foreground text-center py-2">No items — add some below.</p>
          )}
          {items.map(item => (
            <div key={item.id}>
              {isEditingItemForThis && editingItem?.id === item.id ? (
                <div className="space-y-1.5 p-2 rounded border bg-muted/40">
                  <Input
                    value={itemForm.title}
                    onChange={e => onItemFormChange({ ...itemForm, title: e.target.value })}
                    placeholder="Document title"
                    className="h-7 text-sm"
                    autoFocus
                    data-testid="input-item-title-edit"
                  />
                  <Input
                    value={itemForm.description}
                    onChange={e => onItemFormChange({ ...itemForm, description: e.target.value })}
                    placeholder="Description (optional)"
                    className="h-7 text-sm"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancelEditItem}>Cancel</Button>
                    <Button size="sm" className="h-6 text-xs bg-pink-600 hover:bg-pink-700" onClick={onSaveItem} disabled={!itemForm.title.trim() || isSavingItem}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/40 group">
                  <span className="text-muted-foreground text-xs">•</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.title}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onStartEditItem(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDeleteItem(item)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add item inline form */}
          {isAddingForThis ? (
            <div className="space-y-1.5 p-2 rounded border bg-muted/40 mt-1">
              <Input
                value={itemForm.title}
                onChange={e => onItemFormChange({ ...itemForm, title: e.target.value })}
                placeholder="Document title *"
                className="h-7 text-sm"
                autoFocus
                data-testid="input-item-title"
              />
              <Input
                value={itemForm.description}
                onChange={e => onItemFormChange({ ...itemForm, description: e.target.value })}
                placeholder="Description (optional)"
                className="h-7 text-sm"
              />
              <div className="flex gap-1.5 justify-end">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancelAddItem}>Cancel</Button>
                <Button size="sm" className="h-6 text-xs bg-pink-600 hover:bg-pink-700" onClick={onSaveItem} disabled={!itemForm.title.trim() || isSavingItem}>
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground hover:text-foreground mt-1" onClick={onStartAddItem} data-testid={`button-add-item-${template.id}`}>
              <Plus className="mr-1 h-3 w-3" />
              Add item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Employment Law Dashboard with company/site filters

export default function ElCasesPage() {
  const [matchCaseDetail, paramsDetail] = useRoute("/employment-law/cases/:id");
  if (matchCaseDetail && paramsDetail?.id) {
    return <CaseDetailView id={paramsDetail.id} />;
  }
  return <CasesList />;
}
