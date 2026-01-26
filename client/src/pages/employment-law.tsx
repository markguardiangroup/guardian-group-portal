import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture, differenceInDays } from "date-fns";
import type { Case, CaseMilestone, Document, AuditLog, CaseStatus, CaseType, SiteWithDetails, ComplianceSummary, Company, Site, User as UserType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const caseStatusConfig: Record<CaseStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: "Open", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/40" },
  under_investigation: { label: "Under Investigation", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/40" },
  hearing_scheduled: { label: "Hearing Scheduled", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/40" },
  resolved: { label: "Resolved", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/40" },
  closed: { label: "Closed", color: "text-gray-700 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

const caseTypeConfig: Record<CaseType, { label: string; icon: typeof Briefcase }> = {
  disciplinary: { label: "Disciplinary", icon: Scale },
  grievance: { label: "Grievance", icon: Users },
  tupe: { label: "TUPE", icon: Briefcase },
  redundancy: { label: "Redundancy", icon: Users },
  tribunal_claim: { label: "Tribunal Claim", icon: Scale },
  settlement: { label: "Settlement", icon: FileText },
  appeal: { label: "Appeal", icon: Scale },
  investigation: { label: "Investigation", icon: Search },
};

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const config = caseStatusConfig[status];
  return (
    <Badge className={`${config.bgColor} ${config.color} border-0`}>
      {config.label}
    </Badge>
  );
}

function CaseTypeBadge({ type }: { type: CaseType }) {
  const config = caseTypeConfig[type];
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
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(urlSiteId);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(urlCompany);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can filter by site if they have multiple sites
  const clientHasMultipleSites = isClientUser && sites && sites.length > 1;
  
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
  
  // Handle company selection
  const handleCompanyChange = (company: string | null) => {
    setSelectedCompany(company);
    if (selectedSiteId && company && company !== "all") {
      const currentSite = sites?.find(s => s.id === selectedSiteId);
      if (currentSite?.companyName !== company) {
        setSelectedSiteId(null);
      }
    }
  };
  
  // Determine site filter for API
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases", siteId, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) {
        params.set("siteId", siteId);
      }
      if (selectedCompanyId) {
        params.set("entityId", selectedCompanyId);
      }
      const url = params.toString() ? `/api/cases?${params.toString()}` : "/api/cases";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
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
    if (clientHasMultipleSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasMultipleSites]);

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cases", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
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

  const openCases = cases?.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length || 0;
  const resolvedCases = cases?.filter(c => c.status === "resolved" || c.status === "closed").length || 0;
  const urgentCases = cases?.filter(c => {
    if (!c.responseDeadline) return false;
    return isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 7;
  }).length || 0;

  if (isLoading || sitesLoading) {
    return (
      <div className="theme-el">
        <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
          <Skeleton className="h-14 w-96" />
        </div>
        <div className="space-y-6 p-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="theme-el">
      {/* Module Header with tinted background */}
      <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Briefcase className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Case Files</h1>
              <p className="text-muted-foreground">
                Employment law case management
                {currentContextLabel && <span className="font-medium"> - {currentContextLabel}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(isPrivilegedUser || clientHasMultipleSites) && sites && sites.length > 0 && (
              <>
                {isPrivilegedUser && (
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-48"
                    testId="select-company-cases"
                  />
                )}
                <SiteCombobox
                  sites={isPrivilegedUser ? filteredSites : sites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-48"
                  testId="select-site-cases"
                />
              </>
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
      
      <div className="space-y-6 p-8">
      <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-pink-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
              <div className="rounded-full bg-pink-100 dark:bg-pink-900/40 p-2">
                <Briefcase className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{openCases}</div>
              <p className="text-xs text-muted-foreground">Currently being managed</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgent Deadlines</CardTitle>
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{urgentCases}</div>
              <p className="text-xs text-muted-foreground">Deadlines within 7 days</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved Cases</CardTitle>
              <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{resolvedCases}</div>
              <p className="text-xs text-muted-foreground">Successfully completed</p>
            </CardContent>
          </Card>
        </div>

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
                  <SelectItem value="disciplinary">Disciplinary</SelectItem>
                  <SelectItem value="grievance">Grievance</SelectItem>
                  <SelectItem value="tupe">TUPE</SelectItem>
                  <SelectItem value="redundancy">Redundancy</SelectItem>
                  <SelectItem value="tribunal_claim">Tribunal Claim</SelectItem>
                  <SelectItem value="settlement">Settlement</SelectItem>
                  <SelectItem value="appeal">Appeal</SelectItem>
                  <SelectItem value="investigation">Investigation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCases.length > 0 ? (
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
                        {caseItem.caseReference}
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
                      {caseItem.responseDeadline ? (
                        <div className={`flex items-center gap-1 text-sm ${
                          isPast(new Date(caseItem.responseDeadline)) ? "text-red-600" :
                          differenceInDays(new Date(caseItem.responseDeadline), new Date()) <= 7 ? "text-amber-600" :
                          "text-muted-foreground"
                        }`}>
                          <Clock className="h-3 w-3" />
                          {format(new Date(caseItem.responseDeadline), "MMM d")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(caseItem.updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/employment-law/cases/${caseItem.id}`} data-testid={`button-view-case-${caseItem.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
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
    caseReference: "",
    employeeName: "",
    employeeId: "",
    caseType: "disciplinary" as CaseType,
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Case Reference</label>
              <Input
                value={formData.caseReference}
                onChange={(e) => setFormData({ ...formData, caseReference: e.target.value })}
                placeholder="EL-2024-XXX"
                required
                data-testid="input-case-reference"
              />
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
                  <SelectItem value="disciplinary">Disciplinary</SelectItem>
                  <SelectItem value="grievance">Grievance</SelectItem>
                  <SelectItem value="tupe">TUPE</SelectItem>
                  <SelectItem value="redundancy">Redundancy</SelectItem>
                  <SelectItem value="tribunal_claim">Tribunal Claim</SelectItem>
                  <SelectItem value="settlement">Settlement</SelectItem>
                  <SelectItem value="appeal">Appeal</SelectItem>
                  <SelectItem value="investigation">Investigation</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: ["/api/cases", id],
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/cases", id, "documents"],
  });

  const { data: milestones } = useQuery<CaseMilestone[]>({
    queryKey: ["/api/cases", id, "milestones"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/cases", id, "audit"],
  });

  // Fetch company and site details for display
  const { data: company } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/entities", caseData?.entityId],
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
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowStatusDialog(false);
      toast({ title: "Case updated successfully" });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/milestones", { ...data, caseId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      setShowMilestoneDialog(false);
      toast({ title: "Milestone added successfully" });
    },
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("PATCH", `/api/milestones/${milestoneId}`, { isCompleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
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
      toast({ title: "Milestone deleted" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/cases/${id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Upload file to object storage
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
        throw new Error("Failed to upload file");
      }

      const { objectPath } = await uploadRes.json();

      // Create document record
      await apiRequest("POST", `/api/cases/${id}/documents`, {
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
        mimeType: file.type,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "audit"] });
      toast({ title: "Document uploaded successfully" });
    } catch (error) {
      toast({ title: "Failed to upload document", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const [editingMilestone, setEditingMilestone] = useState<CaseMilestone | null>(null);

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
              <div className="space-y-3">
                {milestones?.map((milestone) => (
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
                    <div className="flex-1">
                      <p className={`font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {milestone.title}
                      </p>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                      )}
                      {milestone.dueDate && (
                        <p className={`text-xs mt-1 ${
                          !milestone.isCompleted && isPast(new Date(milestone.dueDate))
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}>
                          Due: {format(new Date(milestone.dueDate), "MMM d, yyyy")}
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
                ))}
                {(!milestones || milestones.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">No milestones yet</p>
                )}
              </div>
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
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border hover-elevate">
                      <FileText className="h-5 w-5 text-pink-600" />
                      <div className="flex-1">
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                      </div>
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
                  ))}
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

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Case Status</DialogTitle>
            <DialogDescription>Change the status of this case</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
            <Button
              onClick={() => updateCaseMutation.mutate({ status: newStatus })}
              disabled={updateCaseMutation.isPending}
              className="bg-pink-600 hover:bg-pink-700"
              data-testid="button-confirm-status"
            >
              {updateCaseMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
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
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </CardContent>
    </Card>
  );
}

// Compliance Score Card for Employment Law
function ELComplianceScoreCard({ score }: { score: number }) {
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
          <span className={`text-5xl font-bold ${getScoreColor(score)}`} data-testid="text-el-compliance-score">
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

// Employment Law Dashboard with company/site filters
function EmploymentLawDashboardView() {
  const { user } = useAuth();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (needed for site name lookup in recent docs/cases)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can filter by site if they have multiple sites
  const clientHasMultipleSites = isClientUser && sites && sites.length > 1;
  
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
  
  // Handle company selection
  const handleCompanyChange = (company: string | null) => {
    setSelectedCompany(company);
    if (selectedSiteId && company && company !== "all") {
      const currentSite = sites?.find(s => s.id === selectedSiteId);
      if (currentSite?.companyName !== company) {
        setSelectedSiteId(null);
      }
    }
  };
  
  // Build current context label
  const currentContextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (isPrivilegedUser) {
      if (selectedCompany && selectedCompany !== "all") {
        return `${selectedCompany} (all sites)`;
      }
      return "All Clients";
    }
    if (clientHasMultipleSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasMultipleSites]);
  
  // Determine site filter for API
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  // Fetch compliance summary for Employment Law
  const { data: summary, isLoading: summaryLoading } = useQuery<ComplianceSummary>({
    queryKey: ["/api/modules/employment_law/summary", siteId, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (selectedCompanyId) params.set("entityId", selectedCompanyId);
      const url = params.toString() ? `/api/modules/employment_law/summary?${params.toString()}` : "/api/modules/employment_law/summary";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  // Fetch cases with site filtering
  const { data: cases, isLoading: casesLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases", siteId, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (selectedCompanyId) params.set("entityId", selectedCompanyId);
      const url = params.toString() ? `/api/cases?${params.toString()}` : "/api/cases";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  // Fetch recent documents for Employment Law
  const { data: recentDocuments } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", "employment_law", siteId, selectedCompanyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (selectedCompanyId) params.set("entityId", selectedCompanyId);
      const url = params.toString() ? `/api/documents/module/employment_law?${params.toString()}` : "/api/documents/module/employment_law";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  const isLoading = summaryLoading || casesLoading || sitesLoading;
  
  const openCases = cases?.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length || 0;
  const urgentCases = cases?.filter(c => {
    if (!c.responseDeadline) return false;
    return isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 7;
  }).length || 0;
  
  // Get recent 5 documents and cases
  const recentDocs = useMemo(() => {
    if (!recentDocuments) return [];
    return [...recentDocuments]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [recentDocuments]);
  
  const recentCases = useMemo(() => {
    if (!cases) return [];
    return [...cases]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [cases]);
  
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

  if (isLoading) {
    return (
      <div className="theme-el">
        <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
          <Skeleton className="h-14 w-96" />
        </div>
        <div className="space-y-8 p-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
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
      </div>
    );
  }

  const complianceScore = summary?.complianceScore || 0;
  
  return (
    <div className="theme-el">
      {/* Module Header with tinted background */}
      <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Scale className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Employment Law</h1>
              <p className="text-muted-foreground">
                Module compliance overview
                {currentContextLabel && <span className="font-medium"> - {currentContextLabel}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(isPrivilegedUser || clientHasMultipleSites) && sites && sites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isPrivilegedUser && (
                  <>
                    <CompanyCombobox
                      sites={sites}
                      value={selectedCompany}
                      onValueChange={handleCompanyChange}
                      className="w-44"
                      testId="select-company-el"
                    />
                    <span className="text-muted-foreground">/</span>
                  </>
                )}
                <SiteCombobox
                  sites={isPrivilegedUser ? filteredSites : sites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-el"
                />
              </div>
            )}
            <Button variant="outline" asChild>
              <Link href={viewDocumentsUrl} data-testid="link-view-documents-el">
                <FileText className="mr-2 h-4 w-4" />
                View Documents
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={viewCasesUrl} data-testid="link-view-cases-el">
                <Briefcase className="mr-2 h-4 w-4" />
                View Cases
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      <div className="space-y-8 p-8">
        {/* Metrics Grid - 5 columns like other module dashboards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <ELComplianceScoreCard score={complianceScore} />
          <ELMetricCard
            title="Total Documents"
            value={summary?.totalDocuments || 0}
            description="In this module"
            icon={FileText}
            testId="card-el-total-documents"
          />
          <ELMetricCard
            title="Compliant"
            value={summary?.compliantDocuments || 0}
            description="Up to date"
            icon={CheckCircle}
            variant="success"
            testId="card-el-compliant"
          />
          <ELMetricCard
            title="Active Cases"
            value={openCases}
            description="Currently being managed"
            icon={Briefcase}
            variant="warning"
            testId="card-el-active-cases"
          />
          <ELMetricCard
            title="Urgent Deadlines"
            value={urgentCases}
            description="Within 7 days"
            icon={AlertTriangle}
            variant="danger"
            testId="card-el-urgent"
          />
        </div>

        {/* Recent Documents and Cases Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Documents */}
          <Card>
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
                    <Link
                      key={doc.id}
                      href={`/employment-law/documents/${doc.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover-elevate"
                      data-testid={`link-document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-pink-600" />
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-document-title-${doc.id}`}>{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {sites?.find(s => s.id === doc.siteId)?.name || "Site"} - {format(new Date(doc.updatedAt), "MMM d, yyyy")}
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
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Cases */}
          <Card>
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
  return (
    <div className="p-6">
      <EmploymentLawDashboardView />
    </div>
  );
}
