import { useState, useEffect } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails, ComplianceSummary, Company, User } from "@shared/schema";
import { TablePagination, type PageSize } from "@/components/table-pagination";
import { Users } from "lucide-react";

function ComplianceBadge({ summary }: { summary?: ComplianceSummary }) {
  if (!summary) {
    return <Badge variant="secondary">No data</Badge>;
  }

  const score = summary.complianceScore;

  if (score >= 90) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="mr-1 h-3 w-3" />
        {score}%
      </Badge>
    );
  }

  if (score >= 70) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {score}%
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
      <XCircle className="mr-1 h-3 w-3" />
      {score}%
    </Badge>
  );
}

// Persists across component mounts within a session — animation plays only on first load
let _sitesShown = false;

export default function Sites() {
  const { user } = useAuth();
  const [localSelectedCompany, setLocalSelectedCompany] = useState<string | null>(null);
  const handleCompanyChange = (val: string | null) => setLocalSelectedCompany(val);
  const companyFilter = localSelectedCompany || "all";
  const setCompanyFilter = (val: string) => setLocalSelectedCompany(val === "all" ? null : val);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("my");
  const [, navigate] = useLocation();
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  
  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";
  const canCreateSite = user?.role === "admin" || isProConsultant;
  const { coveringFor } = useCoverageFilter();

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
  const [newSite, setNewSite] = useState({
    name: "",
    companyId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    additionalUserIds: [] as string[],
  });
  const { toast } = useToast();

  const sitesUrl = !isProConsultant ? "/api/sites"
    : staffFilter === "my" ? "/api/sites?myAssigned=true"
    : staffFilter !== "all" ? `/api/sites?staffId=${staffFilter}`
    : "/api/sites";
  const { data: sites, isLoading } = useQuery<SiteWithDetails[]>({
    queryKey: [sitesUrl],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await fetch(sitesUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sites");
      return response.json();
    },
  });

  const { data: companiesResponse } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies?limit=1000"],
  });
  const companies = companiesResponse?.companies;

  // Fetch all users to filter for company users
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filter to get only client users from the selected company
  const companyUsers = newSite.companyId 
    ? allUsers.filter(
        (u) => u.role === "client" && u.companyId === newSite.companyId && u.status !== "inactive"
      )
    : [];

  // Derive selected company for primary contact display
  const selectedCompany = companies?.find(c => c.id === newSite.companyId) ?? null;

  const createSiteMutation = useMutation({
    mutationFn: async (data: typeof newSite) => {
      const response = await apiRequest("POST", "/api/sites", data);
      const site = await response.json();
      for (const userId of data.additionalUserIds) {
        try {
          await apiRequest("POST", `/api/sites/${site.id}/client-assignments`, { clientId: userId });
        } catch {}
      }
      return site;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Site created successfully" });
      setIsAddSiteOpen(false);
      setNewSite({
        name: "",
        companyId: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postalCode: "",
        country: "",
        additionalUserIds: [],
      });
    },
    onError: () => {
      toast({ title: "Failed to create site", variant: "destructive" });
    },
  });

  const handleManageSite = (siteId: string) => {
    navigate(`/sites/${siteId}`);
  };

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

  const handleCreateSite = () => {
    if (!newSite.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (!newSite.companyId) {
      toast({ title: "Please select a company", variant: "destructive" });
      return;
    }
    if (!newSite.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!newSite.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!newSite.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!newSite.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!newSite.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(newSite.postalCode, newSite.country)) {
      toast({ title: getPostcodeError(newSite.country), variant: "destructive" });
      return;
    }
    createSiteMutation.mutate(newSite);
  };

  const [sortBy, setSortBy] = useState<"name" | "company" | "compliance">("company");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const handleSortSites = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const filteredSites = sites?.filter((site) => {
    const matchesSearch = 
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.addressLine1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.referenceNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCompany = companyFilter === "all" || site.companyId === companyFilter;
    
    let matchesCompliance = true;
    if (complianceFilter !== "all" && site.complianceSummary) {
      const score = site.complianceSummary.complianceScore;
      if (complianceFilter === "high") matchesCompliance = score >= 90;
      else if (complianceFilter === "medium") matchesCompliance = score >= 70 && score < 90;
      else if (complianceFilter === "low") matchesCompliance = score < 70;
    } else if (complianceFilter !== "all" && !site.complianceSummary) {
      matchesCompliance = complianceFilter === "none";
    }
    
    return matchesSearch && matchesCompany && matchesCompliance;
  })?.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortBy === "name") return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    if (sortBy === "company") {
      const compA = (a.companyName || "").toLowerCase();
      const compB = (b.companyName || "").toLowerCase();
      if (compA !== compB) return dir * compA.localeCompare(compB);
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    if (sortBy === "compliance") {
      const scoreA = a.complianceSummary?.complianceScore ?? -1;
      const scoreB = b.complianceSummary?.complianceScore ?? -1;
      return dir * (scoreA - scoreB);
    }
    return 0;
  });

  const totalSites = filteredSites?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalSites / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  useEffect(() => {
    setPage(1);
  }, [searchQuery, companyFilter, complianceFilter, staffFilter, pageSize]);
  const paginatedSites = filteredSites?.slice((page - 1) * pageSize, page * pageSize);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alreadyShown] = useState(() => _sitesShown);
  useEffect(() => {
    if (!isLoading && filteredSites && filteredSites.length > 0) _sitesShown = true;
  }, [isLoading, filteredSites?.length]);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/companies?limit=1000"] }),
    ]);
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Sites</h1>
          <p className="mt-1 text-muted-foreground">
            {filteredSites?.length || 0} site{filteredSites?.length !== 1 ? "s" : ""}{isProConsultant ? (staffFilter === "my" ? " (my client sites)" : staffFilter !== "all" ? ` (${myStaff.find(s => s.id === staffFilter)?.fullName?.split(" ")[0] || "staff"}'s client sites)` : "") : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateSite && (
            <Button size="sm" className="w-32" onClick={() => setIsAddSiteOpen(true)} data-testid="button-add-site">
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          )}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pt-6 space-y-6 dash-animate">

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites, companies, addresses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-sites"
          />
        </div>
        {isProConsultant && (
          <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-staff-filter-sites">
              <SelectValue placeholder={
                staffFilter === "my" ? "My client sites"
                : staffFilter === "all" ? "All client sites"
                : (myStaff.find(s => s.id === staffFilter)?.fullName
                    ?? coveringFor.find(c => c.absentConsultantId === staffFilter)?.absentConsultantName
                    ?? "") + "'s clients"
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My client sites</SelectItem>
              {myStaff.map(s => (
                <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-sites-${s.id}`}>{s.fullName}'s clients</SelectItem>
              ))}
              {coveringFor
                .filter(c => !myStaff.some(s => s.id === c.absentConsultantId))
                .map(c => (
                  <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`staff-filter-sites-coverage-${c.absentConsultantId}`}>
                    {c.absentConsultantName}'s clients
                  </SelectItem>
                ))}
              <SelectItem value="all">All client sites</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-company-filter">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies?.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={complianceFilter} onValueChange={setComplianceFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-compliance-filter">
            <SelectValue placeholder="All Compliance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Compliance</SelectItem>
            <SelectItem value="high">High (90%+)</SelectItem>
            <SelectItem value="medium">At Risk (70-89%)</SelectItem>
            <SelectItem value="low">Low (&lt;70%)</SelectItem>
            <SelectItem value="none">No Data</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh"
          data-testid="button-refresh-sites"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card>
        <Table wrapperClassName="overflow-visible" className="sticky-table-header">
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSortSites("name")} className="cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Site Name {sortBy === "name" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead onClick={() => handleSortSites("company")} className="cursor-pointer select-none whitespace-nowrap min-w-[180px]">
                <div className="flex items-center gap-1">Company {sortBy === "company" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="hidden md:table-cell">Address</TableHead>
              <TableHead className="hidden lg:table-cell">Primary Contact</TableHead>
              <TableHead onClick={() => handleSortSites("compliance")} className="cursor-pointer select-none whitespace-nowrap">
                <div className="flex items-center gap-1">Compliance {sortBy === "compliance" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}</div>
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={isLoading ? "loading" : "loaded"} className={!alreadyShown && !isLoading && paginatedSites && paginatedSites.length > 0 ? "table-rows-animate" : ""}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <FetchingOverlay />
                </TableCell>
              </TableRow>
            ) : !paginatedSites || paginatedSites.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {searchQuery || companyFilter !== "all" || complianceFilter !== "all"
                    ? "No sites match your filters."
                    : "No sites found. Add your first site to get started."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSites.map((site) => (
                <TableRow 
                  key={site.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleManageSite(site.id)}
                  data-testid={`row-site-${site.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="font-medium">{site.name}</span>
                        {site.referenceNumber && (
                          <span className="block text-xs text-muted-foreground font-mono mt-0.5">
                            {site.referenceNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{site.companyName || "—"}</span>
                    {site.companySources && site.companySources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {site.companySources.map((code) => (
                          <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-site-company-source-${site.id}-${code}`}>
                            {code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {[site.addressLine1, site.city, site.postalCode].filter(Boolean).join(", ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm">{site.contactName || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <ComplianceBadge summary={site.complianceSummary} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageSite(site.id);
                      }}
                      data-testid={`button-manage-site-${site.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
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
          totalItems={totalSites}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="sites"
        />
      )}

      <Dialog open={isAddSiteOpen} onOpenChange={setIsAddSiteOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Create a new site for a company
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company">Company <span className="text-destructive">*</span></Label>
              <Select
                value={newSite.companyId}
                onValueChange={(value) => setNewSite({ ...newSite, companyId: value })}
              >
                <SelectTrigger data-testid="select-company">
                  <SelectValue placeholder="Select a company" />
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
            <div className="grid gap-2">
              <Label htmlFor="site-name">Site Name <span className="text-destructive">*</span></Label>
              <Input
                id="site-name"
                placeholder="e.g., Main Factory, Head Office"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                  setNewSite({ ...newSite, name: v });
                }}
                data-testid="input-site-name"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="address-line1"
                    value={newSite.addressLine1}
                    onChange={(e) => setNewSite({ ...newSite, addressLine1: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                      setNewSite({ ...newSite, addressLine1: v });
                    }}
                    placeholder="Street address"
                    data-testid="input-address-line1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address-line2">Address Line 2</Label>
                  <Input
                    id="address-line2"
                    value={newSite.addressLine2}
                    onChange={(e) => setNewSite({ ...newSite, addressLine2: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                      setNewSite({ ...newSite, addressLine2: v });
                    }}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="city"
                      value={newSite.city}
                      onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                      onBlur={(e) => {
                        const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                        setNewSite({ ...newSite, city: v });
                      }}
                      placeholder="City"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={newSite.country || ""}
                      onValueChange={(value) => setNewSite({ ...newSite, country: value, county: "" })}
                    >
                      <SelectTrigger id="country" data-testid="select-country">
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
                      value={newSite.county || ""}
                      onValueChange={(value) => setNewSite({ ...newSite, county: value })}
                      disabled={!newSite.country}
                    >
                      <SelectTrigger id="county" data-testid="select-county">
                        <SelectValue placeholder={newSite.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[newSite.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postal-code">Postal Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="postal-code"
                      value={newSite.postalCode}
                      onChange={(e) => setNewSite({ ...newSite, postalCode: e.target.value.toUpperCase() })}
                      placeholder={newSite.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">Site Management</h4>
              <p className="text-sm text-muted-foreground mb-3">
                The company's primary contact is automatically assigned. You can also add other users to manage this site.
              </p>

              {!newSite.companyId ? (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Please select a company first to see available contacts.
                  </p>
                </div>
              ) : (
                <>
                  {/* Company primary contact — read-only */}
                  {(() => {
                    const linkedUser = selectedCompany?.contactUserId ? allUsers.find(u => u.id === selectedCompany.contactUserId) : null;
                    const displayName = selectedCompany?.contactName || linkedUser?.fullName;
                    const displayPosition = selectedCompany?.contactPosition || linkedUser?.jobTitle;
                    const displayEmail = selectedCompany?.contactEmail || linkedUser?.email;
                    const displayPhone = selectedCompany?.contactPhone || linkedUser?.phone || linkedUser?.mobile;
                    return (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Company Primary Contact</p>
                        {displayName ? (
                          <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-start gap-3">
                            <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{displayName}</p>
                              {displayPosition && <p className="text-muted-foreground text-xs">{displayPosition}</p>}
                              <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-muted-foreground">
                                {displayEmail && <span>{displayEmail}</span>}
                                {displayPhone && <span>{displayPhone}</span>}
                              </div>
                              <p className="text-xs text-primary mt-1">Will be automatically assigned to this site</p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                            No primary contact set for this company.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Additional users */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Additional Users</p>
                    {companyUsers.filter(u => u.id !== selectedCompany?.contactUserId).length > 0 ? (
                      <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                        {companyUsers
                          .filter(u => u.id !== selectedCompany?.contactUserId)
                          .map((u) => {
                            const checked = newSite.additionalUserIds.includes(u.id);
                            return (
                              <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  checked={checked}
                                  data-testid={`checkbox-site-user-${u.id}`}
                                  onChange={() => {
                                    setNewSite(prev => ({
                                      ...prev,
                                      additionalUserIds: checked
                                        ? prev.additionalUserIds.filter(id => id !== u.id)
                                        : [...prev.additionalUserIds, u.id],
                                    }));
                                  }}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-tight">{u.fullName}</p>
                                  {u.jobTitle && <p className="text-xs text-muted-foreground">{u.jobTitle}</p>}
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No other users in this company.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSiteOpen(false)} data-testid="button-cancel-site">
              Cancel
            </Button>
            <Button
              onClick={handleCreateSite}
              disabled={createSiteMutation.isPending}
              data-testid="button-create-site"
            >
              {createSiteMutation.isPending ? "Creating..." : "Create Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
