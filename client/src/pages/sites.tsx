import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails, ComplianceSummary, Company, User } from "@shared/schema";
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

export default function Sites() {
  const { user } = useAuth();
  const [localSelectedCompany, setLocalSelectedCompany] = useState<string | null>(null);
  const handleCompanyChange = (val: string | null) => setLocalSelectedCompany(val);
  const companyFilter = localSelectedCompany || "all";
  const setCompanyFilter = (val: string) => setLocalSelectedCompany(val === "all" ? null : val);
  const [searchQuery, setSearchQuery] = useState("");
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);
  const [, navigate] = useLocation();
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  
  const isProConsultant = user?.role === "consultant" && (user as any)?.consultantTier === "pro";
  const canCreateSite = user?.role === "admin" || isProConsultant;
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

  const { data: sites, isLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites", { myAssigned: isProConsultant && myAssignedOnly }],
    queryFn: async () => {
      const url = isProConsultant && myAssignedOnly ? "/api/sites?myAssigned=true" : "/api/sites";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sites");
      return response.json();
    },
  });

  const { data: companiesResponse } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
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
      queryClient.refetchQueries({ queryKey: ["/api/sites"] });
      queryClient.refetchQueries({ queryKey: ["/api/users"] });
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
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/sites"] }),
      queryClient.refetchQueries({ queryKey: ["/api/companies"] }),
    ]);
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Sites</h1>
          <p className="mt-1 text-muted-foreground">
            {filteredSites?.length || 0} site{filteredSites?.length !== 1 ? "s" : ""} {isProConsultant && myAssignedOnly ? "(my assigned)" : "total"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isProConsultant && (
            <Button
              variant={myAssignedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setMyAssignedOnly(!myAssignedOnly)}
              data-testid="button-my-assigned-filter"
            >
              <Users className="h-4 w-4 mr-2" />
              My Sites
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="button-refresh-sites"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canCreateSite && (
            <Button size="sm" className="w-32" onClick={() => setIsAddSiteOpen(true)} data-testid="button-add-site">
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          )}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites, companies, addresses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-sites"
          />
        </div>
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
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredSites && filteredSites.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
                <TableHead className="hidden lg:table-cell">Primary Contact</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSites.map((site) => (
                <TableRow 
                  key={site.id} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleManageSite(site.id)}
                  data-testid={`row-site-${site.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{site.name}</span>
                      {site.referenceNumber && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {site.referenceNumber}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{site.companyName || "—"}</span>
                    {site.companyNumber && (
                      <span className="block text-xs text-muted-foreground">
                        #{site.companyNumber}
                      </span>
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
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No sites found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search"
                : "Add your first site to get started"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setIsAddSiteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Site
              </Button>
            )}
          </CardContent>
        </Card>
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
                      onChange={(e) => setNewSite({ ...newSite, postalCode: e.target.value })}
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
