import { useState } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [complianceFilter, setComplianceFilter] = useState<string>("all");
  const [, navigate] = useLocation();
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  const [newSite, setNewSite] = useState({
    name: "",
    companyId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    contactUserId: "",
  });
  const { toast } = useToast();

  const { data: sites, isLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
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

  // Handler to select a user as site contact
  const handleSelectContactUser = (userId: string) => {
    if (userId === "none") {
      setNewSite({
        ...newSite,
        contactUserId: "",
        contactName: "",
        contactPosition: "",
        contactPhone: "",
        contactEmail: "",
      });
      return;
    }
    
    const selectedUser = companyUsers.find((u) => u.id === userId);
    if (selectedUser) {
      setNewSite({
        ...newSite,
        contactUserId: userId,
        contactName: selectedUser.fullName || "",
        contactPosition: selectedUser.jobTitle || "",
        contactPhone: selectedUser.phone || selectedUser.mobile || "",
        contactEmail: selectedUser.email || "",
      });
    }
  };

  const createSiteMutation = useMutation({
    mutationFn: async (data: typeof newSite) => {
      const response = await apiRequest("POST", "/api/sites", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
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
        contactName: "",
        contactPosition: "",
        contactPhone: "",
        contactEmail: "",
        contactUserId: "",
      });
    },
    onError: () => {
      toast({ title: "Failed to create site", variant: "destructive" });
    },
  });

  const handleManageSite = (siteId: string) => {
    navigate(`/sites/${siteId}`);
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Sites</h1>
          <p className="mt-1 text-muted-foreground">
            {filteredSites?.length || 0} sites total
          </p>
        </div>
        <Button onClick={() => setIsAddSiteOpen(true)} data-testid="button-add-site">
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

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

      {filteredSites && filteredSites.length > 0 ? (
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Create a new site for a company
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="company">Company *</Label>
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
              <Label htmlFor="site-name">Site Name *</Label>
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
                  <Label htmlFor="address-line1">Address Line 1</Label>
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
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={newSite.city}
                      onChange={(e) => setNewSite({ ...newSite, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      value={newSite.county}
                      onChange={(e) => setNewSite({ ...newSite, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postal-code">Postal Code</Label>
                    <Input
                      id="postal-code"
                      value={newSite.postalCode}
                      onChange={(e) => setNewSite({ ...newSite, postalCode: e.target.value })}
                      placeholder="Postal code"
                      data-testid="input-postal-code"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={newSite.country}
                      onChange={(e) => setNewSite({ ...newSite, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-country"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Primary Site Contact (Optional)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Select a registered user from the company to be the primary contact for this site.
              </p>
              
              {!newSite.companyId ? (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Please select a company first to see available contacts.
                  </p>
                </div>
              ) : companyUsers.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-contact-user">Select Contact</Label>
                    <Select
                      value={newSite.contactUserId || "none"}
                      onValueChange={handleSelectContactUser}
                    >
                      <SelectTrigger id="site-contact-user" data-testid="select-site-contact-user">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact selected</SelectItem>
                        {companyUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName} {u.jobTitle ? `- ${u.jobTitle}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newSite.contactUserId && (
                    <div className="rounded-md border p-3 bg-muted/50">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">Contact Details (from user profile)</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          <span className="font-medium">{newSite.contactName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>{" "}
                          <span className="font-medium">{newSite.contactPosition || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>{" "}
                          <span className="font-medium">{newSite.contactPhone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium">{newSite.contactEmail || "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No users available in this company yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can add users in the <strong>Users</strong> section and then assign them as site contacts.
                  </p>
                </div>
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
  );
}
