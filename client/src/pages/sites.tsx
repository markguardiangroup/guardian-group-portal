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
import type { SiteWithDetails, ComplianceSummary, Company } from "@shared/schema";

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
  const [, navigate] = useLocation();
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  const [newSite, setNewSite] = useState({
    name: "",
    companyId: "",
    addressLine1: "",
    contactPhone: "",
    siteManager: "",
  });
  const { toast } = useToast();

  const { data: sites, isLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });

  const { data: companiesResponse } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesResponse?.companies;

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
        contactPhone: "",
        siteManager: "",
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

  const filteredSites = sites?.filter((site) =>
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.addressLine1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.contactName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites, companies, addresses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-sites"
          />
        </div>
      </div>

      {filteredSites && filteredSites.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
                <TableHead className="hidden lg:table-cell">Site Manager</TableHead>
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
          <div className="space-y-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="site-name">Site Name *</Label>
              <Input
                id="site-name"
                placeholder="e.g., Main Factory, Head Office"
                value={newSite.name}
                onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                data-testid="input-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-manager">Site Manager</Label>
              <Input
                id="site-manager"
                placeholder="Enter site manager name"
                value={newSite.siteManager}
                onChange={(e) => setNewSite({ ...newSite, siteManager: e.target.value })}
                data-testid="input-site-manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter full address"
                value={newSite.addressLine1}
                onChange={(e) => setNewSite({ ...newSite, addressLine1: e.target.value })}
                data-testid="input-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Contact Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+44 xxx xxx xxxx"
                value={newSite.contactPhone}
                onChange={(e) => setNewSite({ ...newSite, contactPhone: e.target.value })}
                data-testid="input-contact-phone"
              />
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
