import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Eye,
  MapPinned,
  Trash2,
  AlertTriangle,
  Users,
  RotateCcw,
} from "lucide-react";
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
import { FileText, Info } from "lucide-react";
import type { CompanyWithSiteCount, PaginatedCompaniesResponse, User } from "@shared/schema";

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
  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onView(company.id)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium">{company.name}</h4>
                  {company.referenceNumber && (
                    <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-company-ref-${company.id}`}>
                      {company.referenceNumber}
                    </Badge>
                  )}
                </div>
                {company.companyNumber && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Company No: {company.companyNumber}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid={`badge-site-count-${company.id}`}>
                  {company.siteCount} {company.siteCount === 1 ? "site" : "sites"}
                </Badge>
                <Badge variant={company.status === "active" ? "default" : "secondary"}>
                  {company.status}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Companies() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
    website: "",
    industry: "",
    employeeRange: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
  });
  const [originalCompanyName, setOriginalCompanyName] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  const toTitleCase = (str: string): string => {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [pendingCompanyData, setPendingCompanyData] = useState<typeof formData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyWithSiteCount | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isRequiredDocsOpen, setIsRequiredDocsOpen] = useState(false);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [selectedRequiredIds, setSelectedRequiredIds] = useState<Set<string>>(new Set());
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);
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
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";

  const { data, isLoading } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { page, limit, search: debouncedSearch, status: statusFilter, myAssigned: isProConsultant && myAssignedOnly }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(isProConsultant && myAssignedOnly && { myAssigned: "true" }),
      });
      const response = await fetch(`/api/companies?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  const createCompanyWithSiteMutation = useMutation({
    mutationFn: async (payload: { companyData: typeof formData; siteData: typeof siteData }) => {
      const response = await apiRequest("POST", "/api/companies", {
        ...payload.companyData,
        site: payload.siteData,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Company and site created successfully" });
      setIsSiteModalOpen(false);
      setPendingCompanyData(null);
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
        setCreatedCompanyId(data.id);
        setSelectedRequiredIds(new Set());
        setIsRequiredDocsOpen(true);
      }
    },
    onError: () => {
      toast({ title: "Failed to create company", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await apiRequest("PATCH", `/api/companies/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company updated successfully" });
      setEditingCompany(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update company", variant: "destructive" });
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
    enabled: isRequiredDocsOpen,
  });

  const { data: newCompanyModuleAccess } = useQuery<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean }>({
    queryKey: ["/api/companies", createdCompanyId, "module-access"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${createdCompanyId}/module-access`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch module access");
      return response.json();
    },
    enabled: isRequiredDocsOpen && !!createdCompanyId,
  });

  const saveRequiredDocsMutation = useMutation({
    mutationFn: async ({ companyId, templateIds }: { companyId: string; templateIds: string[] }) => {
      const response = await apiRequest("PUT", `/api/companies/${companyId}/required-templates`, { templateIds });
      return response.json();
    },
    onSuccess: () => {
      const companyId = createdCompanyId;
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "required-templates"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
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

  const resetForm = () => {
    setFormData({
      name: "",
      companyNumber: "",
      website: "",
      industry: "",
      employeeRange: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      county: "",
      postalCode: "",
      country: "",
    });
    setWebsiteError(null);
  };

  const handleEdit = (company: CompanyWithSiteCount) => {
    setFormData({
      name: company.name,
      companyNumber: company.companyNumber || "",
      website: company.website || "",
      industry: (company as any).industry || "",
      employeeRange: company.employeeRange || "",
      addressLine1: company.addressLine1 || "",
      addressLine2: company.addressLine2 || "",
      city: company.city || "",
      county: company.county || "",
      postalCode: company.postalCode || "",
      country: company.country || "",
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
    if (!formData.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
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
  const companies = data?.companies || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const isInitialLoad = isLoading && page === 1 && !debouncedSearch && statusFilter === "all";

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {total === 1 ? "company" : "companies"} {isProConsultant && myAssignedOnly ? "(my assigned)" : "total"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProConsultant && (
            <Button
              variant={myAssignedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setMyAssignedOnly(!myAssignedOnly); setPage(1); }}
              data-testid="button-my-assigned-companies"
            >
              <Building2 className="mr-2 h-4 w-4" />
              My Companies
            </Button>
          )}
          {canCreateCompany && (
            <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-company">
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-companies"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      {isInitialLoad ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : companies.length > 0 ? (
        <>
          <div className="grid gap-4">
            {companies.map((company) => (
              <CompanyCard 
                key={company.id} 
                company={company} 
                onEdit={handleEdit}
                onView={handleView}
                onDelete={(c) => { setDeleteTarget(c); setDeleteConfirmText(""); }}
                isAdmin={isAdmin}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No companies found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search"
                : "Add your first company to get started"}
            </p>
            {!searchQuery && isAdmin && (
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Company
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddOpen || !!editingCompany} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setEditingCompany(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add New Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Update company details" : "Create a new client company"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company Name <span className="text-destructive">*</span></Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="company-name"
                  placeholder="e.g., Acme Manufacturing Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== originalCompanyName) {
                      setOriginalCompanyName(value);
                      const titleCased = toTitleCase(value);
                      if (titleCased !== value) {
                        setFormData({ ...formData, name: titleCased });
                      }
                    }
                  }}
                  data-testid="input-company-name"
                  className="flex-1"
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-number">Company Number</Label>
              <Input
                id="company-number"
                placeholder="e.g., 12345678"
                value={formData.companyNumber}
                onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
                data-testid="input-company-number"
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
        if (!open && pendingCompanyData) {
          handleCancelSiteModal();
          return;
        }
        setIsSiteModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              <h4 className="text-sm font-medium mb-1">Site Address</h4>
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
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Set Required Documents
            </DialogTitle>
            <DialogDescription>
              Select which documents are required for compliance at this company's sites.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3 flex gap-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Any templates ticked here will affect the company's compliance score. You can change these at any time from the company details page.
            </p>
          </div>
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
      </div>
    </div>
  );
}
