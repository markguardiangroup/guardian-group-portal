import { useState, useEffect, useCallback, useRef } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAddressSync } from "@/hooks/use-address-sync";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Edit,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  MapPinned,
  Trash2,
  AlertTriangle,
  Users,
  RotateCcw,
  HardHat,
  Scale,
  GraduationCap,
  BookOpen,
  HelpCircle,
  BarChart2,
  RefreshCw,
  MoreHorizontal,
  Download,
  Loader2,
  UserPlus,
  UserX,
  CheckSquare,
  Star,
  Key,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Info, Copy, Hash } from "lucide-react";
import type { CompanyWithSiteCount, PaginatedCompaniesResponse, User } from "@shared/schema";
import { TablePagination, type PageSize } from "@/components/table-pagination";

function CompanyCard({ 
  company, 
  onEdit, 
  onView,
  onDelete,
  isAdmin,
}: { 
  company: CompanyWithSiteCount; 
  onEdit: (company: CompanyWithSiteCount) => void;
  onView: (companyId: string) => void;
  onDelete: (company: CompanyWithSiteCount) => void;
  isAdmin: boolean;
}) {
  const formatStatusDisplay = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onView(company.id)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{company.name}</h4>
                  {company.internalCompanyNumber && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0" data-testid={`text-internal-no-${company.id}`}>
                      <Hash className="h-2.5 w-2.5" />{company.internalCompanyNumber}
                    </span>
                  )}
                </div>
                {(company.isGroupOwner || company.groupOwnerName) && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {company.isGroupOwner && (
                      <Badge variant="outline" className="text-xs py-0 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700" data-testid={`badge-go-${company.id}`}>
                        Group Owner
                      </Badge>
                    )}
                    {company.groupOwnerName && (
                      <Badge variant="outline" className="text-xs py-0 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700" data-testid={`badge-member-${company.id}`}>
                        Member of {company.groupOwnerName}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid={`badge-site-count-${company.id}`}>
                  {company.siteCount} {company.siteCount === 1 ? "site" : "sites"}
                </Badge>
                <Badge 
                  variant={company.status === "on_hold" ? "secondary" : (company.status === "active" ? "default" : "secondary")} 
                  className={company.status === "on_hold" ? "bg-yellow-100 hover:bg-yellow-100 text-yellow-900" : ""}
                  data-testid={`badge-status-${company.id}`}
                >
                  {formatStatusDisplay(company.status)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" data-testid={`button-company-menu-${company.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onView(company.id); }} 
                      data-testid={`button-view-company-${company.id}`}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Sites
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onEdit(company); }} 
                      data-testid={`button-edit-company-${company.id}`}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onDelete(company); }} 
                        className="text-destructive"
                        data-testid={`button-delete-company-${company.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Company
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {(company.addressLine1 || company.city) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {[company.addressLine1, company.city, company.postalCode].filter(Boolean).join(", ")}
                </span>
              )}
              {company.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {company.contactPhone}
                </span>
              )}
              {company.contactEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {company.contactEmail}
                </span>
              )}
              {company.employeeRange && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {company.employeeRange} employees
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {company.sources && company.sources.length > 0 ? (
                company.sources.map((code) => (
                  <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-source-${company.id}-${code}`}>
                    {code}
                  </Badge>
                ))
              ) : (
                <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" data-testid={`badge-no-source-${company.id}`}>
                  No source assigned
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Persists across component mounts within a session — animation plays only on first load
let _companiesShown = false;

export default function Companies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithSiteCount | null>(null);
  const EMPLOYEE_RANGES = ["1-4", "5-9", "10-24", "25-49", "50-99", "100-249", "250-999", "1000+"];

  const INDUSTRY_OPTIONS = [
    "Agriculture & Forestry",
    "Communication",
    "Construction",
    "Education",
    "Financial Services",
    "Government",
    "Healthcare & Social Care",
    "Hospitality",
    "Leisure",
    "Manufacturing",
    "Mining & Quarrying",
    "Office & Professional Services",
    "Public Services",
    "Real Estate",
    "Retail",
    "Technology",
    "Transport & Logistics",
    "Utilities",
    "Wholesale & Distribution",
  ];

  const [formData, setFormData] = useState({
    name: "",
    companyNumber: "",
    internalCompanyNumber: "",
    website: "",
    contactPhone: "",
    industry: "",
    employeeRange: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    sources: [] as string[],
  });
  const [originalCompanyName, setOriginalCompanyName] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [companyNameError, setCompanyNameError] = useState<string | null>(null);

  const toTitleCase = (str: string): string => {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };
  const [moduleAccessData, setModuleAccessData] = useState({
    healthSafety: false,
    humanResources: false,
    employmentLaw: false,
    training: false,
    toolkit: false,
    support: false,
    reports: false,
  });
  const [pendingModuleAccess, setPendingModuleAccess] = useState<typeof moduleAccessData | null>(null);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [pendingCompanyData, setPendingCompanyData] = useState<typeof formData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyWithSiteCount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isRequiredDocsOpen, setIsRequiredDocsOpen] = useState(false);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [selectedRequiredIds, setSelectedRequiredIds] = useState<Set<string>>(new Set());

  // Accelo import state
  const [isAcceloSearchOpen, setIsAcceloSearchOpen] = useState(false);
  const [acceloSearchQuery, setAcceloSearchQuery] = useState("");
  const [acceloSearchResults, setAcceloSearchResults] = useState<any[]>([]);
  const [acceloSearching, setAcceloSearching] = useState(false);
  const [acceloSearchError, setAcceloSearchError] = useState<string | null>(null);
  const [acceloSearched, setAcceloSearched] = useState(false);
  const [acceloImportContext, setAcceloImportContext] = useState<{ acceloCompanyId: string } | null>(null);
  const acceloImportContextRef = useRef<{ acceloCompanyId: string } | null>(null);
  useEffect(() => { acceloImportContextRef.current = acceloImportContext; }, [acceloImportContext]);
  const [isAcceloContactsOpen, setIsAcceloContactsOpen] = useState(false);
  const [acceloContacts, setAcceloContacts] = useState<any[]>([]);
  const [acceloContactsLoading, setAcceloContactsLoading] = useState(false);
  interface ContactRowState { selected: boolean; primary: boolean; keyContact: boolean; addToSite: boolean; }
  interface AcceloImportResult { acceloId: string; name: string; success: boolean; error?: string; }
  const [contactRows, setContactRows] = useState<Record<string, ContactRowState>>({});
  const [acceloImportingContacts, setAcceloImportingContacts] = useState(false);
  const [acceloImportResults, setAcceloImportResults] = useState<AcceloImportResult[] | null>(null);
  const [pendingCreatedCompanyId, setPendingCreatedCompanyId] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState<string>("my");
  const [sortBy, setSortBy] = useState<"name" | "city" | "industry" | "siteCount" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleSortCompanies = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const { captureSnapshot, onCompanyUpdated, AddressSyncDialog } = useAddressSync();

  const [siteData, setSiteData] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const [limit, setLimit] = useState<PageSize>(20);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";

  type StaffConsultant = { id: string; fullName: string; consultantTier?: string | null };
  const { data: myStaff = [] } = useQuery<StaffConsultant[]>({
    queryKey: ["/api/consultants/my-staff"],
    queryFn: async () => {
      const res = await fetch("/api/consultants/my-staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isProConsultant,
  });

  type Source = { id: string; code: string; label: string; isActive: boolean };
  const { data: availableSources = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { page, limit, search: debouncedSearch, status: statusFilter, staffFilter: isProConsultant ? staffFilter : undefined, groupFilter }],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(isProConsultant && staffFilter === "my" && { myAssigned: "true" }),
        ...(isProConsultant && staffFilter !== "my" && staffFilter !== "all" && { staffId: staffFilter }),
        ...(groupFilter !== "all" && { groupFilter }),
      });
      const response = await fetch(`/api/companies?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  // Fetch all companies (large limit) to derive available group owners for the filter dropdown
  const { data: allCompaniesData } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { limit: 1000 }],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch("/api/companies?limit=1000", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  const groupOwners = (allCompaniesData?.companies ?? []).filter(c => c.isGroupOwner);

  const createCompanyWithSiteMutation = useMutation({
    mutationFn: async (payload: { companyData: typeof formData; siteData: typeof siteData }) => {
      const response = await apiRequest("POST", "/api/companies", {
        ...payload.companyData,
        site: payload.siteData,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      if (data?.id && pendingModuleAccess) {
        const hasAnyEnabled = Object.values(pendingModuleAccess).some(Boolean);
        if (hasAnyEnabled) {
          try {
            await apiRequest("POST", `/api/companies/${data.id}/module-access`, pendingModuleAccess);
            queryClient.invalidateQueries({ queryKey: ["/api/companies", data.id, "module-access"] });
          } catch {
            // Non-fatal: company was created, module access can be set on the detail page
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Company and site created successfully" });
      setIsSiteModalOpen(false);
      setPendingCompanyData(null);
      setPendingModuleAccess(null);
      const ctx = acceloImportContextRef.current;
      resetForm();
      setSiteData({
        name: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postalCode: "",
        country: "",
      });
      if (data?.id) {
        if (ctx) {
          // Accelo import flow: show contacts dialog before required docs
          setPendingCreatedCompanyId(data.id);
          setAcceloContactsLoading(true);
          setIsAcceloContactsOpen(true);
          try {
            const res = await fetch(`/api/integrations/accelo/companies/${ctx.acceloCompanyId}/contacts`, { credentials: "include" });
            const contacts = await res.json();
            const loaded = Array.isArray(contacts) ? contacts : [];
            setAcceloContacts(loaded);
            const initialRows: Record<string, ContactRowState> = {};
            loaded.forEach((c: any) => {
              initialRows[String(c.id)] = { selected: false, primary: false, keyContact: false, addToSite: true };
            });
            setContactRows(initialRows);
            setAcceloImportResults(null);
          } catch {
            setAcceloContacts([]);
            setContactRows({});
          } finally {
            setAcceloContactsLoading(false);
          }
        } else {
          setCreatedCompanyId(data.id);
          setSelectedRequiredIds(new Set());
          setIsRequiredDocsOpen(true);
        }
      }
    },
    onError: (error: Error) => {
      let message = "Failed to create company. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+: /, "")).error || message; } catch {}
      toast({ title: "Failed to create company", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest("PATCH", `/api/companies/${id}`, data);
      return response.json();
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated successfully" });
      setEditingCompany(null);
      resetForm();

      const newAddr = {
        addressLine1: variables.data.addressLine1, addressLine2: variables.data.addressLine2,
        city: variables.data.city, county: variables.data.county,
        postalCode: variables.data.postalCode, country: variables.data.country,
      };
      await onCompanyUpdated(variables.id, newAddr);
    },
    onError: (error: Error) => {
      let message = "Failed to update company. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+: /, "")).error || message; } catch {}
      toast({ title: "Failed to update company", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await apiRequest("DELETE", `/api/companies/${companyId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Company and all associated data deleted successfully" });
      setDeleteTarget(null);
      setDeleteConfirmText("");
    },
    onError: () => {
      toast({ title: "Failed to delete company", variant: "destructive" });
    },
  });

  interface DocumentTemplate {
    id: string;
    name: string;
    module: string;
    visibility: "public" | "private";
    isActive: boolean;
    requiresApproval?: boolean;
  }

  const { data: allTemplates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
    enabled: !!createdCompanyId,
  });

  const { data: acceloStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/integrations/accelo/status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/accelo/status", { credentials: "include" });
      if (!res.ok) return { connected: false };
      return res.json();
    },
    enabled: user?.role === "admin",
    staleTime: 5 * 60 * 1000,
  });

  const { data: newCompanyModuleAccess } = useQuery<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean }>({
    queryKey: ["/api/companies", createdCompanyId, "module-access"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${createdCompanyId}/module-access`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch module access");
      return response.json();
    },
    enabled: !!createdCompanyId,
  });

  const saveRequiredDocsMutation = useMutation({
    mutationFn: async ({ companyId, templateIds }: { companyId: string; templateIds: string[] }) => {
      const response = await apiRequest("PUT", `/api/companies/${companyId}/required-templates`, { templateIds });
      return response.json();
    },
    onSuccess: () => {
      const companyId = createdCompanyId;
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "required-templates"], refetchType: "all" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/companies"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"], refetchType: "all" });
      toast({ title: "Required documents saved" });
      setIsRequiredDocsOpen(false);
      setCreatedCompanyId(null);
      setSelectedRequiredIds(new Set());
      if (companyId) navigate(`/companies/${companyId}`);
    },
    onError: () => {
      toast({ title: "Failed to save required documents", variant: "destructive" });
    },
  });

  const handleSkipRequiredDocs = () => {
    const companyId = createdCompanyId;
    setIsRequiredDocsOpen(false);
    setCreatedCompanyId(null);
    setSelectedRequiredIds(new Set());
    if (companyId) navigate(`/companies/${companyId}`);
  };

  const handleSaveRequiredDocs = () => {
    if (!createdCompanyId) return;
    saveRequiredDocsMutation.mutate({
      companyId: createdCompanyId,
      templateIds: Array.from(selectedRequiredIds),
    });
  };

  const MODULE_MAP: Record<string, { key: "healthSafety" | "humanResources" | "employmentLaw"; label: string }> = {
    health_safety: { key: "healthSafety", label: "Health & Safety" },
    human_resources: { key: "humanResources", label: "Human Resources" },
    employment_law: { key: "employmentLaw", label: "Employment Law" },
  };

  const mapAcceloCountry = (country: string): string => {
    if (!country) return "";
    const c = country.trim().toLowerCase();
    if (c.includes("northern ireland")) return "Northern Ireland";
    if (c.includes("ireland")) return "Ireland";
    if (c.includes("scotland")) return "Scotland";
    if (c.includes("wales")) return "Wales";
    if (c.includes("england") || c.includes("united kingdom") || c === "uk" || c === "gb") return "England";
    return "";
  };

  const ACCELO_COUNTY_LOOKUP: Record<string, { county: string; country: string }> = {
    "BKM": { county: "Buckinghamshire", country: "England" },
    "CRF": { county: "Cardiff", country: "Wales" },
    "DEV": { county: "Devon", country: "England" },
    "ESX": { county: "Essex", country: "England" },
    "GLS": { county: "Gloucestershire", country: "England" },
    "HAM": { county: "Hampshire", country: "England" },
    "KEN": { county: "Kent", country: "England" },
    "LAN": { county: "Lancashire", country: "England" },
    "LEC": { county: "Leicestershire", country: "England" },
    "LIN": { county: "Lincolnshire", country: "England" },
    "LND": { county: "Greater London", country: "England" },
    "MAN": { county: "Greater Manchester", country: "England" },
    "NTT": { county: "Nottinghamshire", country: "England" },
    "RFW": { county: "Renfrewshire", country: "Scotland" },
    "SHR": { county: "Shropshire", country: "England" },
    "SOM": { county: "Somerset", country: "England" },
    "SRY": { county: "Surrey", country: "England" },
    "STS": { county: "Staffordshire", country: "England" },
    "WAR": { county: "Warwickshire", country: "England" },
    "WOR": { county: "Worcestershire", country: "England" },
    "WSX": { county: "West Sussex", country: "England" },
  };

  const parseAcceloAddress = (full: string | null | undefined, city: string | null | undefined) => {
    const empty = { addressLine1: "", addressLine2: "", postcode: "", county: "", country: "" };
    if (!full) return empty;
    const cityStr = (city || "").trim();
    const cityIdx = cityStr ? full.indexOf(cityStr) : -1;
    const beforeCity = cityIdx > 0 ? full.substring(0, cityIdx) : full;
    const afterCity  = cityIdx > 0 ? full.substring(cityIdx + cityStr.length) : "";
    const addrParts = beforeCity.split(",").map(p => p.trim()).filter(Boolean);
    const addressLine1 = addrParts[0] || "";
    const addressLine2 = addrParts.slice(1).join(", ");
    const afterParts = afterCity.split(",").map(p => p.trim()).filter(Boolean);
    const postcode    = afterParts[0] || "";
    const countyCode  = (afterParts[1] || "").toUpperCase();
    const lookup      = ACCELO_COUNTY_LOOKUP[countyCode];
    return {
      addressLine1,
      addressLine2,
      postcode,
      county:  lookup?.county  || "",
      country: lookup?.country || "",
    };
  };

  const resetForm = () => {
    setFormData({
      name: "",
      companyNumber: "",
      internalCompanyNumber: "",
      website: "",
      contactPhone: "",
      industry: "",
      employeeRange: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      county: "",
      postalCode: "",
      country: "",
      sources: [],
    });
    setModuleAccessData({
      healthSafety: false,
      humanResources: false,
      employmentLaw: false,
      training: false,
      toolkit: false,
      support: false,
      reports: false,
    });
    setPendingModuleAccess(null);
    setWebsiteError(null);
    setCompanyNameError(null);
    setAcceloImportContext(null);
  };

  const proceedToRequiredDocs = (companyId: string) => {
    setIsAcceloContactsOpen(false);
    setAcceloContacts([]);
    setContactRows({});
    setAcceloImportResults(null);
    setAcceloImportContext(null);
    setPendingCreatedCompanyId(null);
    setCreatedCompanyId(companyId);
    setSelectedRequiredIds(new Set());
    setIsRequiredDocsOpen(true);
  };

  const handleImportAcceloContacts = async () => {
    if (!pendingCreatedCompanyId) return;
    setAcceloImportingContacts(true);

    let firstSiteId: string | null = null;
    try {
      const sitesRes = await fetch(`/api/sites?companyId=${pendingCreatedCompanyId}`, { credentials: "include" });
      const sitesData = await sitesRes.json();
      const sites = Array.isArray(sitesData) ? sitesData : (sitesData?.sites || []);
      firstSiteId = sites[0]?.id || null;
    } catch {}

    const toImport = acceloContacts
      .filter(c => contactRows[String(c.id)]?.selected && c.email)
      .map(c => {
        const row = contactRows[String(c.id)];
        return {
          acceloId: String(c.id),
          firstname: c.firstname || "",
          lastname: c.lastname || "",
          email: c.email,
          phone: c.phone || "",
          mobile: c.mobile || "",
          setAsPrimary: row.primary,
          setAsKeyContact: row.keyContact,
          addToSite: row.addToSite,
        };
      });

    try {
      const res = await apiRequest("POST", "/api/integrations/accelo/import-contacts", {
        companyId: pendingCreatedCompanyId,
        siteId: firstSiteId,
        contacts: toImport,
      });
      const data = await res.json();
      const results: AcceloImportResult[] = (data.results || []).map((r: any) => {
        const contact = acceloContacts.find(c => String(c.id) === r.acceloId);
        const name = contact
          ? [contact.firstname, contact.lastname].filter(Boolean).join(" ") || contact.email
          : r.acceloId;
        return { acceloId: r.acceloId, name, success: r.success, error: r.error };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAcceloImportResults(results);
      const succeeded = results.filter(r => r.success).length;
      toast({
        title: succeeded > 0 ? "Contacts imported" : "No contacts imported",
        description: `${succeeded} of ${results.length} contact(s) imported successfully.`,
        variant: succeeded === 0 ? "destructive" : "default",
      });
    } catch {
      toast({ title: "Import failed", description: "Could not import contacts. Please try again.", variant: "destructive" });
    }
    setAcceloImportingContacts(false);
  };

  const handleEdit = (company: CompanyWithSiteCount) => {
    captureSnapshot(company);
    // For pro consultants, strip any out-of-scope sources from the form state on open
    // to prevent them silently blocking save due to legacy data.
    const allowedSources = isProConsultant && user?.sources ? user.sources : null;
    const initialSources = allowedSources
      ? (company.sources || []).filter((s) => allowedSources.includes(s))
      : company.sources || [];
    setFormData({
      name: company.name,
      companyNumber: company.companyNumber || "",
      internalCompanyNumber: (company as any).internalCompanyNumber || "",
      website: company.website || "",
      contactPhone: (company as any).contactPhone || "",
      industry: (company as any).industry || "",
      employeeRange: company.employeeRange || "",
      addressLine1: company.addressLine1 || "",
      addressLine2: company.addressLine2 || "",
      city: company.city || "",
      county: company.county || "",
      postalCode: company.postalCode || "",
      country: company.country || "",
      sources: initialSources,
    });
    setEditingCompany(company);
  };

  const handleView = useCallback((companyId: string) => {
    navigate(`/companies/${companyId}`);
  }, [navigate]);

  const validateUKPostcode = (postcode: string): boolean => {
    const regex = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
    return regex.test(postcode.trim());
  };

  const validateEircode = (postcode: string): boolean => {
    const regex = /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i;
    return regex.test(postcode.trim());
  };

  const validatePostcode = (postcode: string, country: string): boolean => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return validateUKPostcode(postcode);
    if (country === "Ireland") return validateEircode(postcode);
    return postcode.trim().length > 0;
  };

  const getPostcodeError = (country: string): string => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return "Please enter a valid UK postcode (e.g., BT1 1AA, SW1A 1AA)";
    if (country === "Ireland") return "Please enter a valid Eircode (e.g., D02 AF30)";
    return "Please enter a valid postal code";
  };

  const COUNTRY_OPTIONS = [
    "England",
    "Ireland",
    "Northern Ireland",
    "Scotland",
    "Wales",
  ];

  const COUNTY_MAP: Record<string, string[]> = {
    "England": [
      "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire",
      "Cheshire", "City of London", "Cornwall", "County Durham", "Cumbria",
      "Derbyshire", "Devon", "Dorset", "East Riding of Yorkshire", "East Sussex",
      "Essex", "Gloucestershire", "Greater London", "Greater Manchester",
      "Hampshire", "Herefordshire", "Hertfordshire", "Isle of Wight", "Kent",
      "Lancashire", "Leicestershire", "Lincolnshire", "Merseyside", "Norfolk",
      "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire",
      "Oxfordshire", "Rutland", "Shropshire", "Somerset", "South Yorkshire",
      "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear", "Warwickshire",
      "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
    ],
    "Ireland": [
      "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
      "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick",
      "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly",
      "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
      "Wexford", "Wicklow",
    ],
    "Northern Ireland": [
      "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
    ],
    "Scotland": [
      "Aberdeen City", "Aberdeenshire", "Angus", "Argyll and Bute",
      "Clackmannanshire", "Dumfries and Galloway", "Dundee City",
      "East Ayrshire", "East Dunbartonshire", "East Lothian", "East Renfrewshire",
      "Edinburgh", "Falkirk", "Fife", "Glasgow City", "Highland",
      "Inverclyde", "Midlothian", "Moray", "North Ayrshire",
      "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
      "Renfrewshire", "Scottish Borders", "Shetland Islands",
      "South Ayrshire", "South Lanarkshire", "Stirling",
      "West Dunbartonshire", "West Lothian", "Western Isles",
    ],
    "Wales": [
      "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire",
      "Ceredigion", "Conwy", "Denbighshire", "Flintshire", "Gwynedd",
      "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot",
      "Newport", "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea",
      "Torfaen", "Vale of Glamorgan", "Wrexham",
    ],
  };

  const handleSubmit = () => {
    setCompanyNameError(null);
    if (!formData.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    if (!editingCompany) {
      const duplicate = (data?.companies || []).find(
        (c) => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
      );
      if (duplicate) {
        setCompanyNameError("A company with this name already exists");
        return;
      }
    }
    if (!formData.industry) {
      toast({ title: "Industry is required", variant: "destructive" });
      return;
    }
    if (!formData.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!formData.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!formData.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!formData.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!formData.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(formData.postalCode, formData.country)) {
      toast({ title: getPostcodeError(formData.country), variant: "destructive" });
      return;
    }
    if (!formData.sources || formData.sources.length === 0) {
      toast({ title: "At least one source is required", variant: "destructive" });
      return;
    }
    const submittedData = { ...formData };
    if (submittedData.website.trim()) {
      let websiteValue = submittedData.website.trim();
      if (!/^https?:\/\//i.test(websiteValue)) {
        websiteValue = "https://" + websiteValue;
      }
      try {
        const url = new URL(websiteValue);
        const hostParts = url.hostname.split(".");
        const tld = hostParts[hostParts.length - 1];
        const validTld = /^[a-zA-Z]{2,6}$/.test(tld);
        if (!validTld && hostParts.length < 3) throw new Error("Invalid hostname");
        submittedData.website = websiteValue;
        setFormData(prev => ({ ...prev, website: websiteValue }));
      } catch {
        toast({ title: "Please enter a valid website URL (e.g. https://www.example.com)", variant: "destructive" });
        return;
      }
    }
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: submittedData });
    } else {
      setPendingCompanyData({ ...submittedData });
      setPendingModuleAccess({ ...moduleAccessData });
      setIsAddOpen(false);
      setSiteData({
        name: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postalCode: "",
        country: "",
      });
      setIsSiteModalOpen(true);
    }
  };

  const handleCreateSite = () => {
    if (!siteData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (!siteData.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!siteData.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!siteData.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!siteData.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!siteData.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(siteData.postalCode, siteData.country)) {
      toast({ title: getPostcodeError(siteData.country), variant: "destructive" });
      return;
    }
    if (!pendingCompanyData) return;
    createCompanyWithSiteMutation.mutate({
      companyData: pendingCompanyData,
      siteData: siteData,
    });
  };

  const handleCancelSiteModal = () => {
    setIsSiteModalOpen(false);
    setPendingCompanyData(null);
    setIsAddOpen(true);
  };

  const isAdmin = user?.role === "admin";
  const canCreateCompany = isAdmin || isProConsultant;
  const companiesRaw = data?.companies || [];
  const companies = [...companiesRaw].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (sortBy === "city") return dir * (a.city || "").toLowerCase().localeCompare((b.city || "").toLowerCase());
    if (sortBy === "industry") return dir * (a.industry || "").toLowerCase().localeCompare((b.industry || "").toLowerCase());
    if (sortBy === "siteCount") return dir * ((a.siteCount ?? 0) - (b.siteCount ?? 0));
    if (sortBy === "status") return dir * (a.status || "").localeCompare(b.status || "");
    return 0;
  });
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alreadyShown] = useState(() => _companiesShown);
  useEffect(() => {
    if (!isLoading && companies.length > 0) _companiesShown = true;
  }, [isLoading, companies.length]);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    setIsRefreshing(false);
  };


  const formatStatusDisplay = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {total === 1 ? "company" : "companies"}{isProConsultant ? (staffFilter === "my" ? " (my clients)" : staffFilter !== "all" ? ` (${myStaff.find(s => s.id === staffFilter)?.fullName?.split(" ")[0] || "staff"}'s clients)` : "") : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && acceloStatus?.connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAcceloSearchQuery("");
                setAcceloSearchResults([]);
                setAcceloSearchError(null);
                setIsAcceloSearchOpen(true);
              }}
              data-testid="button-import-from-accelo"
            >
              <Download className="mr-2 h-4 w-4" />
              Import from Accelo
            </Button>
          )}
          {canCreateCompany && (
            <Button size="sm" className="w-36" onClick={() => setIsAddOpen(true)} data-testid="button-add-company">
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          )}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pt-6 space-y-6 dash-animate">

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-companies"
          />
        </div>
        {isProConsultant && (
          <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-staff-filter-companies">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My clients</SelectItem>
              {myStaff.map(s => (
                <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-${s.id}`}>{s.fullName}'s clients</SelectItem>
              ))}
              <SelectItem value="all">All clients</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {groupOwners.length > 0 && (
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-group-filter">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {groupOwners.sort((a, b) => a.name.localeCompare(b.name)).map(go => (
                <SelectItem key={go.id} value={go.id} data-testid={`group-filter-option-${go.id}`}>
                  {go.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh"
          data-testid="button-refresh-companies"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <Table wrapperClassName="overflow-visible" className="sticky-table-header">
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSortCompanies("name")} className="cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Company {sortBy === "name" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("city")} className="cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Location {sortBy === "city" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("industry")} className="cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Industry {sortBy === "industry" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="hidden lg:table-cell">Sources</TableHead>
              <TableHead onClick={() => handleSortCompanies("siteCount")} className="w-20 cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Sites {sortBy === "siteCount" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortCompanies("status")} className="w-28 cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Status {sortBy === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={isLoading ? "loading" : "loaded"} className={!alreadyShown && !isLoading && companies.length > 0 ? "table-rows-animate" : ""}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <FetchingOverlay />
                </TableCell>
              </TableRow>
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {debouncedSearch || statusFilter !== "all"
                    ? "No companies match your filters."
                    : "No companies found. Add your first company to get started."}
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer"
                  onClick={() => handleView(company.id)}
                  data-testid={`row-company-${company.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{company.name}</span>
                          {company.internalCompanyNumber && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0" data-testid={`text-internal-no-table-${company.id}`}>
                              <Hash className="h-2.5 w-2.5" />{company.internalCompanyNumber}
                            </span>
                          )}
                        </div>
                        {(company.isGroupOwner || company.groupOwnerName) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {company.isGroupOwner && (
                              <Badge variant="outline" className="text-xs py-0 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700" data-testid={`badge-go-table-${company.id}`}>
                                Group Owner
                              </Badge>
                            )}
                            {company.groupOwnerName && (
                              <Badge variant="outline" className="text-xs py-0 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700" data-testid={`badge-member-table-${company.id}`}>
                                Member of {company.groupOwnerName}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(company.city || company.county) ? (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[company.city, company.county].filter(Boolean).join(", ")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {(company as any).industry || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {company.sources && company.sources.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {company.sources.map((code) => (
                          <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-table-source-${company.id}-${code}`}>
                            {code}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" data-testid={`badge-table-no-source-${company.id}`}>
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`badge-site-count-${company.id}`}>
                      {company.siteCount} {company.siteCount === 1 ? "site" : "sites"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={company.status === "on_hold" ? "secondary" : (company.status === "active" ? "default" : "secondary")}
                      className={company.status === "on_hold" ? "bg-yellow-100 hover:bg-yellow-100 text-yellow-900" : ""}
                      data-testid={`badge-status-${company.id}`}
                    >
                      {formatStatusDisplay(company.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-company-menu-${company.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleView(company.id); }}
                          data-testid={`button-view-company-${company.id}`}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Sites
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleEdit(company); }}
                          data-testid={`button-edit-company-${company.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(company); setDeleteConfirmText(""); }}
                            className="text-destructive"
                            data-testid={`button-delete-company-${company.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Company
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
          itemLabel="companies"
        />
      )}

      <Dialog open={isAddOpen || !!editingCompany} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingCompany(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Update company details" : "Create a new client company"}
            </DialogDescription>
            {!editingCompany && acceloImportContext && (
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary bg-primary/5 py-0.5">
                  <ExternalLink className="h-3 w-3" />
                  Pre-filled from Accelo
                </Badge>
              </div>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="company-name"
                  placeholder="e.g., Acme Manufacturing Ltd"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (companyNameError) setCompanyNameError(null);
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== originalCompanyName) {
                      setOriginalCompanyName(value);
                      const titleCased = toTitleCase(value);
                      if (titleCased !== value) {
                        setFormData({ ...formData, name: titleCased });
                      }
                    }
                    if (!editingCompany && value) {
                      const duplicate = (data?.companies || []).find(
                        (c) => c.name.trim().toLowerCase() === value.toLowerCase()
                      );
                      setCompanyNameError(duplicate ? "A company with this name already exists" : null);
                    }
                  }}
                  data-testid="input-company-name"
                  className={`flex-1 ${companyNameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {formData.name && originalCompanyName && toTitleCase(originalCompanyName) !== originalCompanyName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...formData, name: originalCompanyName });
                      setOriginalCompanyName("");
                    }}
                    className="h-9 w-9 p-0"
                    title="Undo capitalization"
                    data-testid="button-undo-company-name"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {companyNameError && (
                <p className="text-sm text-destructive">{companyNameError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-number">Registered Company Number</Label>
              <Input
                id="company-number"
                placeholder="e.g., 12345678"
                value={formData.companyNumber}
                onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                data-testid="input-company-number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="internal-company-number">Internal Company Number</Label>
              <Input
                id="internal-company-number"
                placeholder="e.g., INT-001"
                value={formData.internalCompanyNumber}
                onChange={(e) => setFormData({ ...formData, internalCompanyNumber: e.target.value })}
                data-testid="input-internal-company-number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                placeholder="e.g., www.example.com"
                value={formData.website}
                onChange={(e) => {
                  setFormData({ ...formData, website: e.target.value });
                  if (websiteError) setWebsiteError(null);
                }}
                onBlur={() => {
                  const value = formData.website.trim();
                  if (!value) { setWebsiteError(null); return; }
                  let normalised = value;
                  if (!/^https?:\/\//i.test(normalised)) normalised = "https://" + normalised;
                  try {
                    const url = new URL(normalised);
                    const hostParts = url.hostname.split(".");
                    const tld = hostParts[hostParts.length - 1];
                    const validTld = /^[a-zA-Z]{2,6}$/.test(tld);
                    if (!validTld && hostParts.length < 3) throw new Error();
                    setWebsiteError(null);
                  } catch {
                    setWebsiteError("Please enter a valid website URL (e.g. www.example.com)");
                  }
                }}
                className={websiteError ? "border-destructive focus-visible:ring-destructive" : ""}
                data-testid="input-company-website"
              />
              {websiteError && (
                <p className="text-sm text-destructive">{websiteError}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-contact-phone">Main Phone Number</Label>
              <Input
                id="company-contact-phone"
                placeholder="e.g., 028 9012 3456"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                data-testid="input-company-contact-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-industry">Industry <span className="text-destructive">*</span></Label>
              <Select
                value={formData.industry || undefined}
                onValueChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}
              >
                <SelectTrigger id="company-industry" data-testid="select-company-industry">
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-employee-range">Number of Employees</Label>
              <Select
                value={formData.employeeRange || undefined}
                onValueChange={(v) => setFormData(prev => ({ ...prev, employeeRange: v }))}
              >
                <SelectTrigger id="company-employee-range" data-testid="select-company-employee-range">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">Company Address</h4>
              <p className="text-xs text-muted-foreground mb-3">The registered or head office address for this company.</p>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="address-line1"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value) {
                        setFormData({ ...formData, addressLine1: toTitleCase(value) });
                      }
                    }}
                    placeholder="Street address"
                    data-testid="input-company-address-line1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address-line2">Address Line 2</Label>
                  <Input
                    id="address-line2"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value) {
                        setFormData({ ...formData, addressLine2: toTitleCase(value) });
                      }
                    }}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-company-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value) {
                          setFormData({ ...formData, city: toTitleCase(value) });
                        }
                      }}
                      placeholder="City"
                      data-testid="input-company-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.country || ""}
                      onValueChange={(value) => setFormData({ ...formData, country: value, county: "" })}
                    >
                      <SelectTrigger id="country" data-testid="select-company-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.county || ""}
                      onValueChange={(value) => setFormData({ ...formData, county: value })}
                      disabled={!formData.country}
                    >
                      <SelectTrigger id="county" data-testid="select-company-county">
                        <SelectValue placeholder={formData.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[formData.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postal-code">Post Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.toUpperCase() })}
                      onBlur={(e) => {
                        const value = e.target.value.trim().toUpperCase();
                        if (value) {
                          setFormData({ ...formData, postalCode: value });
                        }
                      }}
                      placeholder={formData.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-company-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

            {availableSources.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-1">Sources <span className="text-destructive">*</span></h4>
                <p className="text-xs text-muted-foreground mb-3">Select which brand sources are associated with this company. At least one source is required.</p>
                <div className="flex flex-wrap gap-2">
                  {availableSources.filter(s => s.isActive && (!isProConsultant || user?.sources?.includes(s.code))).map((source) => {
                    const selected = formData.sources.includes(source.code);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => {
                          const updated = selected
                            ? formData.sources.filter((c) => c !== source.code)
                            : [...formData.sources, source.code];
                          setFormData({ ...formData, sources: updated });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                        data-testid={`button-source-${source.code}`}
                      >
                        {source.code}
                        <span className="text-[10px] opacity-70">{source.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!editingCompany && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium">Module Access</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      const allEnabled = Object.values(moduleAccessData).every(Boolean);
                      const newValue = !allEnabled;
                      setModuleAccessData({
                        healthSafety: newValue,
                        humanResources: newValue,
                        employmentLaw: newValue,
                        training: newValue,
                        toolkit: newValue,
                        support: newValue,
                        reports: newValue,
                      });
                    }}
                    data-testid="button-toggle-all-modules"
                  >
                    {Object.values(moduleAccessData).every(Boolean) ? "Disable All" : "Enable All"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Select which modules this company can access.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "healthSafety", label: "Health & Safety", icon: HardHat, iconClass: "text-emerald-700 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-950/30" },
                    { key: "humanResources", label: "Human Resources", icon: Users, iconClass: "text-blue-700 dark:text-blue-400", bgClass: "bg-blue-50 dark:bg-blue-950/30" },
                    { key: "employmentLaw", label: "Employment Law", icon: Scale, iconClass: "text-pink-700 dark:text-pink-400", bgClass: "bg-pink-50 dark:bg-pink-950/30" },
                    { key: "training", label: "Training", icon: GraduationCap, iconClass: "text-purple-700 dark:text-purple-400", bgClass: "bg-purple-50 dark:bg-purple-950/30" },
                    { key: "toolkit", label: "Toolkit", icon: BookOpen, iconClass: "text-amber-700 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/30" },
                    { key: "support", label: "Support", icon: HelpCircle, iconClass: "text-cyan-700 dark:text-cyan-400", bgClass: "bg-cyan-50 dark:bg-cyan-950/30" },
                    { key: "reports", label: "Reports", icon: BarChart2, iconClass: "text-indigo-700 dark:text-indigo-400", bgClass: "bg-indigo-50 dark:bg-indigo-950/30" },
                  ].map(({ key, label, icon: Icon, iconClass, bgClass }) => {
                    const enabled = moduleAccessData[key as keyof typeof moduleAccessData];
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition-opacity ${enabled ? "" : "opacity-60"}`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${bgClass}`}>
                          <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                        </div>
                        <Label htmlFor={`new-module-${key}`} className="text-xs font-medium flex-1 cursor-pointer truncate">{label}</Label>
                        <Switch
                          id={`new-module-${key}`}
                          checked={enabled}
                          onCheckedChange={(checked) => setModuleAccessData(prev => ({ ...prev, [key]: checked }))}
                          data-testid={`switch-new-module-${key}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddOpen(false);
                setEditingCompany(null);
                resetForm();
              }}
              data-testid="button-cancel-company"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              data-testid="button-submit-company"
            >
              {updateMutation.isPending 
                ? "Saving..." 
                : editingCompany ? "Update Company" : "Next: Add Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSiteModalOpen} onOpenChange={(open) => {
        if (!open) {
          // X button — just close everything without re-opening the company form
          setIsSiteModalOpen(false);
          setPendingCompanyData(null);
          return;
        }
        setIsSiteModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5" />
              Add First Site
            </DialogTitle>
            <DialogDescription>
              Every company needs at least one site. Fill in the details for this company's first site — you can add more sites later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-site-name">Site Name <span className="text-destructive">*</span></Label>
              <Input
                id="new-site-name"
                placeholder="e.g., Head Office, Main Factory"
                value={siteData.name}
                onChange={(e) => setSiteData({ ...siteData, name: e.target.value })}
                data-testid="input-new-site-name"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium">Site Address</h4>
                {pendingCompanyData && (pendingCompanyData.addressLine1 || pendingCompanyData.city) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                    onClick={() => setSiteData(prev => ({
                      ...prev,
                      addressLine1: pendingCompanyData.addressLine1,
                      addressLine2: pendingCompanyData.addressLine2,
                      city: pendingCompanyData.city,
                      county: pendingCompanyData.county,
                      postalCode: pendingCompanyData.postalCode,
                      country: pendingCompanyData.country,
                    }))}
                    data-testid="button-copy-company-address"
                  >
                    <Copy className="h-3 w-3" />
                    Copy company address
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">The physical location of this site.</p>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="site-address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="site-address-line1"
                    value={siteData.addressLine1}
                    onChange={(e) => setSiteData({ ...siteData, addressLine1: e.target.value })}
                    placeholder="Street address"
                    data-testid="input-site-address-line1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="site-address-line2">Address Line 2</Label>
                  <Input
                    id="site-address-line2"
                    value={siteData.addressLine2}
                    onChange={(e) => setSiteData({ ...siteData, addressLine2: e.target.value })}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-site-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="site-city"
                      value={siteData.city}
                      onChange={(e) => setSiteData({ ...siteData, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-site-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={siteData.country || ""}
                      onValueChange={(value) => setSiteData({ ...siteData, country: value, county: "" })}
                    >
                      <SelectTrigger id="site-country" data-testid="select-site-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={siteData.county || ""}
                      onValueChange={(value) => setSiteData({ ...siteData, county: value })}
                      disabled={!siteData.country}
                    >
                      <SelectTrigger id="site-county" data-testid="select-site-county">
                        <SelectValue placeholder={siteData.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[siteData.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-postal-code">Postal Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="site-postal-code"
                      value={siteData.postalCode}
                      onChange={(e) => setSiteData({ ...siteData, postalCode: e.target.value })}
                      placeholder={siteData.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-site-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelSiteModal} data-testid="button-back-to-company">
              Back
            </Button>
            <Button
              onClick={handleCreateSite}
              disabled={createCompanyWithSiteMutation.isPending}
              data-testid="button-create-first-site"
            >
              {createCompanyWithSiteMutation.isPending ? "Creating..." : "Create Company & Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRequiredDocsOpen} onOpenChange={(open) => {
        if (!open) handleSkipRequiredDocs();
      }}>
        <DialogContent className="sm:max-w-[500px] h-[680px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
          <div className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Set Required Documents
              </DialogTitle>
              <DialogDescription>
                Select which documents are required for compliance at this company's sites.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted/50 p-3 flex gap-2 mt-4">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Any templates ticked here will affect the company's compliance score. You can change these at any time from the company details page.
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {(() => {
              const privateTemplates = allTemplates.filter(t => t.visibility === "private" && t.isActive);
              const allModulesDisabled = newCompanyModuleAccess && !newCompanyModuleAccess.healthSafety && !newCompanyModuleAccess.humanResources && !newCompanyModuleAccess.employmentLaw;
              const enabledModules = Object.entries(MODULE_MAP).filter(([, { key }]) => 
                !newCompanyModuleAccess || allModulesDisabled || newCompanyModuleAccess[key]
              );
              if (enabledModules.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground py-4">No modules are enabled for this company.</p>
                );
              }
              const defaultTab = enabledModules[0]?.[0] ?? "health_safety";
              return (
                <Tabs defaultValue={defaultTab}>
                  <TabsList className="mb-4">
                    {enabledModules.map(([mod, { label }]) => (
                      <TabsTrigger key={mod} value={mod} data-testid={`tab-wizard-required-${mod}`}>{label}</TabsTrigger>
                    ))}
                  </TabsList>
                  {enabledModules.map(([mod, { label }]) => {
                    const moduleTemplates = privateTemplates.filter(t => t.module === mod);
                    return (
                      <TabsContent key={mod} value={mod}>
                        {moduleTemplates.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">
                            No private templates available for {label}.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {moduleTemplates.map(template => (
                              <div key={template.id} className="flex items-center gap-3">
                                <Checkbox
                                  id={`wizard-req-${template.id}`}
                                  checked={selectedRequiredIds.has(template.id)}
                                  onCheckedChange={(checked) => {
                                    const newIds = new Set(selectedRequiredIds);
                                    if (checked) { newIds.add(template.id); } else { newIds.delete(template.id); }
                                    setSelectedRequiredIds(newIds);
                                  }}
                                  data-testid={`checkbox-wizard-required-${template.id}`}
                                />
                                <label
                                  htmlFor={`wizard-req-${template.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                                >
                                  {template.name}
                                  {template.requiresApproval && (
                                    <Badge variant="outline" className="text-xs">Approval Required</Badge>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              );
            })()}
          </div>
          <div className="px-6 py-4 shrink-0 border-t">
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleSkipRequiredDocs} data-testid="button-skip-required-docs">
                Skip
              </Button>
              <Button
                onClick={handleSaveRequiredDocs}
                disabled={saveRequiredDocsMutation.isPending}
                data-testid="button-save-required-docs"
              >
                {saveRequiredDocsMutation.isPending ? "Saving..." : "Save & Finish"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Company
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium mb-2">
                  You are about to permanently delete:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Company: <strong>{deleteTarget.name}</strong></li>
                  <li>{deleteTarget.siteCount} {deleteTarget.siteCount === 1 ? "site" : "sites"} and all site data</li>
                  <li>All documents, cases, and document versions</li>
                  <li>All user accounts belonging to this company</li>
                  <li>All support requests, training bookings, and audit logs</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong className="text-destructive">DELETE</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteConfirmText !== "DELETE" || deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {AddressSyncDialog}

      {/* ── Accelo Search Dialog ──────────────────────────────────────────── */}
      <Dialog open={isAcceloSearchOpen} onOpenChange={(open) => { if (!open) { setIsAcceloSearchOpen(false); setAcceloSearched(false); setAcceloSearchResults([]); setAcceloSearchQuery(""); setAcceloSearchError(null); } }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Import from Accelo
              </DialogTitle>
              <DialogDescription>
                Search for a company in Accelo by name. Selecting a match will open the company wizard pre-filled with their details.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Company name…"
                  value={acceloSearchQuery}
                  onChange={(e) => { setAcceloSearchQuery(e.target.value); setAcceloSearched(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && acceloSearchQuery.trim()) {
                      setAcceloSearchError(null);
                      setAcceloSearching(true);
                      setAcceloSearchResults([]);
                      fetch(`/api/integrations/accelo/search?q=${encodeURIComponent(acceloSearchQuery.trim())}`, { credentials: "include" })
                        .then(r => r.json())
                        .then(d => {
                          if (Array.isArray(d)) setAcceloSearchResults(d);
                          else setAcceloSearchError(d?.error || "Search failed");
                        })
                        .catch(() => setAcceloSearchError("Search failed"))
                        .finally(() => { setAcceloSearching(false); setAcceloSearched(true); });
                    }
                  }}
                  data-testid="input-accelo-search"
                />
              </div>
              <Button
                onClick={() => {
                  if (!acceloSearchQuery.trim()) return;
                  setAcceloSearchError(null);
                  setAcceloSearching(true);
                  setAcceloSearchResults([]);
                  fetch(`/api/integrations/accelo/search?q=${encodeURIComponent(acceloSearchQuery.trim())}`, { credentials: "include" })
                    .then(r => r.json())
                    .then(d => {
                      if (Array.isArray(d)) setAcceloSearchResults(d);
                      else setAcceloSearchError(d?.error || "Search failed");
                    })
                    .catch(() => setAcceloSearchError("Search failed"))
                    .finally(() => { setAcceloSearching(false); setAcceloSearched(true); });
                }}
                disabled={!acceloSearchQuery.trim() || acceloSearching}
                data-testid="button-accelo-search"
              >
                {acceloSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {acceloSearchError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="error-accelo-search">
                {acceloSearchError}
              </div>
            )}

            {!acceloSearching && acceloSearched && acceloSearchResults.length === 0 && !acceloSearchError && (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-accelo-no-results">
                No companies found. Try a different name or client number.
              </p>
            )}

            {acceloSearchResults.length > 0 && (
              <div className="space-y-2" data-testid="list-accelo-results">
                {acceloSearchResults.map((result: any) => (
                  <button
                    key={result.id}
                    type="button"
                    className="w-full text-left rounded-md border px-4 py-3 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => {
                      const addr = parseAcceloAddress(result.postal_address?.full, result.postal_address?.city);
                      setFormData({
                        name: result.name || "",
                        companyNumber: "",
                        internalCompanyNumber: result.custom_id || "",
                        website: result.website || "",
                        contactPhone: result.phone || "",
                        industry: "",
                        employeeRange: "",
                        addressLine1: addr.addressLine1,
                        addressLine2: addr.addressLine2,
                        city: result.postal_address?.city || "",
                        county: addr.county,
                        postalCode: addr.postcode,
                        country: addr.country,
                        sources: [],
                      });
                      setAcceloImportContext({ acceloCompanyId: String(result.id) });
                      setIsAcceloSearchOpen(false);
                      setIsAddOpen(true);
                    }}
                    data-testid={`button-accelo-result-${result.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{result.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {result.custom_id ? `#${result.custom_id}` : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-6 py-4 shrink-0 border-t">
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAcceloSearchOpen(false)} data-testid="button-accelo-search-cancel">
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import Contacts Dialog (step between site creation and required docs) ── */}
      <Dialog open={isAcceloContactsOpen} onOpenChange={(open) => {
        if (!open && pendingCreatedCompanyId) proceedToRequiredDocs(pendingCreatedCompanyId);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
          <div className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {acceloImportResults ? "Import Complete" : "Import Contacts"}
              </DialogTitle>
              <DialogDescription>
                {acceloImportResults
                  ? `${acceloImportResults.filter(r => r.success).length} of ${acceloImportResults.length} contact(s) imported successfully.`
                  : "Select contacts to import. For each contact, choose whether to set them as primary, a key contact, or assign them to the site."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Loading */}
            {acceloContactsLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground" data-testid="loading-accelo-contacts">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading contacts…</span>
              </div>
            )}
            {/* Results phase */}
            {!acceloContactsLoading && acceloImportResults && (
              <div className="space-y-2" data-testid="list-import-results">
                {acceloImportResults.map((result) => (
                  <div
                    key={result.acceloId}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2.5 ${result.success ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900" : "border-destructive/30 bg-destructive/5"}`}
                    data-testid={`result-contact-${result.acceloId}`}
                  >
                    {result.success
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{result.name}</p>
                      {!result.success && result.error && (
                        <p className="text-xs text-destructive">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Empty state */}
            {!acceloContactsLoading && !acceloImportResults && acceloContacts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground" data-testid="empty-accelo-contacts">
                <UserX className="h-8 w-8 opacity-40" />
                <p className="text-sm">No contacts found in Accelo for this company.</p>
              </div>
            )}
            {/* Selection phase */}
            {!acceloContactsLoading && !acceloImportResults && acceloContacts.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">{acceloContacts.length} contact{acceloContacts.length !== 1 ? "s" : ""} found</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() => {
                      const selectable = acceloContacts.filter(c => c.email).map(c => String(c.id));
                      const allSelected = selectable.length > 0 && selectable.every(id => contactRows[id]?.selected);
                      setContactRows(prev => {
                        const next = { ...prev };
                        selectable.forEach(id => {
                          const cur = next[id] || { selected: false, primary: false, keyContact: false, addToSite: true };
                          next[id] = allSelected
                            ? { ...cur, selected: false, primary: false, keyContact: false }
                            : { ...cur, selected: true };
                        });
                        return next;
                      });
                    }}
                    data-testid="button-toggle-all-contacts"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {acceloContacts.filter(c => c.email).length > 0 &&
                     acceloContacts.filter(c => c.email).every(c => contactRows[String(c.id)]?.selected)
                      ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                {acceloContacts.map((contact: any) => {
                  const hasEmail = !!contact.email;
                  const contactId = String(contact.id);
                  const row = contactRows[contactId] || { selected: false, primary: false, keyContact: false, addToSite: true };
                  const fullName = [contact.firstname, contact.lastname].filter(Boolean).join(" ") || "Unknown";
                  return (
                    <div key={contactId} data-testid={`item-accelo-contact-${contactId}`}>
                      {/* Main row */}
                      <div
                        className={`flex items-start gap-3 px-3 py-2.5 transition-colors border ${row.selected ? "border-b-0 rounded-t-md border-primary/40 bg-primary/5" : "rounded-md"} ${!hasEmail ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}
                        onClick={() => {
                          if (!hasEmail) return;
                          setContactRows(prev => {
                            const cur = prev[contactId] || { selected: false, primary: false, keyContact: false, addToSite: true };
                            const nowSelected = !cur.selected;
                            return {
                              ...prev,
                              [contactId]: {
                                ...cur,
                                selected: nowSelected,
                                primary: nowSelected ? cur.primary : false,
                                keyContact: nowSelected ? cur.keyContact : false,
                              },
                            };
                          });
                        }}
                      >
                        <Checkbox
                          checked={row.selected}
                          disabled={!hasEmail}
                          onCheckedChange={(checked) => {
                            if (!hasEmail) return;
                            setContactRows(prev => {
                              const cur = prev[contactId] || { selected: false, primary: false, keyContact: false, addToSite: true };
                              const nowSelected = !!checked;
                              return {
                                ...prev,
                                [contactId]: {
                                  ...cur,
                                  selected: nowSelected,
                                  primary: nowSelected ? cur.primary : false,
                                  keyContact: nowSelected ? cur.keyContact : false,
                                },
                              };
                            });
                          }}
                          className="mt-0.5"
                          data-testid={`checkbox-accelo-contact-${contactId}`}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{fullName}</p>
                          {contact.email
                            ? <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                            : <p className="text-xs text-destructive">No email — cannot import</p>
                          }
                          {(contact.phone || contact.mobile) && (
                            <p className="text-xs text-muted-foreground">
                              {[contact.phone, contact.mobile].filter(Boolean).join(" / ")}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Per-contact options strip (visible when selected) */}
                      {row.selected && hasEmail && (
                        <div className="flex items-center gap-2 flex-wrap border border-primary/40 border-t-0 rounded-b-md bg-primary/5 px-3 py-1.5">
                          {/* Primary contact toggle — single-select; mutually exclusive with Key Contact */}
                          <button
                            type="button"
                            onClick={() => {
                              const makePrimary = !row.primary;
                              setContactRows(prev => {
                                const next: Record<string, ContactRowState> = {};
                                Object.keys(prev).forEach(id => {
                                  next[id] = { ...prev[id], primary: false };
                                });
                                if (makePrimary) {
                                  next[contactId] = { ...next[contactId], primary: true, keyContact: false };
                                }
                                return next;
                              });
                            }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${row.primary ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground"}`}
                            data-testid={`button-primary-${contactId}`}
                            title="Set as primary contact (only one allowed)"
                          >
                            <Star className={`h-3 w-3 ${row.primary ? "fill-amber-500 text-amber-500" : ""}`} />
                            Primary
                          </button>
                          {/* Key contact toggle — mutually exclusive with Primary */}
                          <button
                            type="button"
                            onClick={() => {
                              const makeKey = !row.keyContact;
                              setContactRows(prev => ({
                                ...prev,
                                [contactId]: {
                                  ...prev[contactId],
                                  keyContact: makeKey,
                                  primary: makeKey ? false : prev[contactId].primary,
                                },
                              }));
                            }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${row.keyContact ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400" : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground"}`}
                            data-testid={`button-key-contact-${contactId}`}
                            title="Mark as key contact"
                          >
                            <Key className={`h-3 w-3 ${row.keyContact ? "text-violet-500" : ""}`} />
                            Key Contact
                          </button>
                          {/* Add to site toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              setContactRows(prev => ({
                                ...prev,
                                [contactId]: { ...prev[contactId], addToSite: !row.addToSite },
                              }));
                            }}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${row.addToSite ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground"}`}
                            data-testid={`button-add-to-site-${contactId}`}
                            title="Assign to the company's first site"
                          >
                            <Building2 className="h-3 w-3" />
                            Add to site
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-6 py-4 shrink-0 border-t">
            <DialogFooter className="gap-2">
              {acceloImportResults ? (
                <Button
                  onClick={() => pendingCreatedCompanyId && proceedToRequiredDocs(pendingCreatedCompanyId)}
                  data-testid="button-import-done"
                >
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => pendingCreatedCompanyId && proceedToRequiredDocs(pendingCreatedCompanyId)}
                    disabled={acceloImportingContacts}
                    data-testid="button-skip-contacts"
                  >
                    Skip
                  </Button>
                  <Button
                    onClick={handleImportAcceloContacts}
                    disabled={!Object.values(contactRows).some(r => r.selected) || acceloImportingContacts || acceloContactsLoading}
                    data-testid="button-import-contacts"
                  >
                    {acceloImportingContacts ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
                    ) : (() => {
                      const n = Object.values(contactRows).filter(r => r.selected).length;
                      return <>Import {n > 0 ? `${n} ` : ""}Contact{n !== 1 ? "s" : ""}</>;
                    })()}
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
