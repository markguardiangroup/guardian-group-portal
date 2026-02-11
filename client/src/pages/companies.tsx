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
import type { CompanyWithSiteCount, PaginatedCompaniesResponse, User } from "@shared/schema";

function CompanyCard({ 
  company, 
  onEdit, 
  onView 
}: { 
  company: CompanyWithSiteCount; 
  onEdit: (company: CompanyWithSiteCount) => void;
  onView: (companyId: string) => void;
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
  const [formData, setFormData] = useState({
    name: "",
    companyNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
  });
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [pendingCompanyData, setPendingCompanyData] = useState<typeof formData | null>(null);
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

  const { data, isLoading } = useQuery<PaginatedCompaniesResponse>({
    queryKey: ["/api/companies", { page, limit, search: debouncedSearch, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
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
    onSuccess: () => {
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

  const resetForm = () => {
    setFormData({
      name: "",
      companyNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      county: "",
      postalCode: "",
      country: "",
    });
  };

  const handleEdit = (company: CompanyWithSiteCount) => {
    setFormData({
      name: company.name,
      companyNumber: company.companyNumber || "",
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

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data: formData });
    } else {
      setPendingCompanyData({ ...formData });
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
  const companies = data?.companies || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  if (isLoading && page === 1) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            {total} {total === 1 ? "company" : "companies"} total
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-company">
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        )}
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

      {companies.length > 0 ? (
        <>
          <div className="grid gap-4">
            {companies.map((company) => (
              <CompanyCard 
                key={company.id} 
                company={company} 
                onEdit={handleEdit}
                onView={handleView}
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
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="e.g., Acme Manufacturing Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-company-name"
              />
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

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">Company Address</h4>
              <p className="text-xs text-muted-foreground mb-3">The registered or head office address for this company.</p>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="address-line1">Address Line 1</Label>
                  <Input
                    id="address-line1"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
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
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-company-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-company-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-company-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postal-code">Postal Code</Label>
                    <Input
                      id="postal-code"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="Postal code"
                      data-testid="input-company-postal-code"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-company-country"
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
              <Label htmlFor="new-site-name">Site Name *</Label>
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
                  <Label htmlFor="site-address-line1">Address Line 1</Label>
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
                    <Label htmlFor="site-city">City</Label>
                    <Input
                      id="site-city"
                      value={siteData.city}
                      onChange={(e) => setSiteData({ ...siteData, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-site-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-county">County</Label>
                    <Input
                      id="site-county"
                      value={siteData.county}
                      onChange={(e) => setSiteData({ ...siteData, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-site-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-postal-code">Postal Code</Label>
                    <Input
                      id="site-postal-code"
                      value={siteData.postalCode}
                      onChange={(e) => setSiteData({ ...siteData, postalCode: e.target.value })}
                      placeholder="Postal code"
                      data-testid="input-site-postal-code"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-country">Country</Label>
                    <Input
                      id="site-country"
                      value={siteData.country}
                      onChange={(e) => setSiteData({ ...siteData, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-site-country"
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
    </div>
  );
}
