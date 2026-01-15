import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  MapPin,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Users,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
  Shield,
  Heart,
  Briefcase,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails, ComplianceSummary, SiteModuleAccessSummary } from "@shared/schema";

function ModuleStatusBadges({ moduleAccess }: { moduleAccess?: SiteModuleAccessSummary }) {
  if (!moduleAccess) return null;

  const modules = [
    { key: "health_safety" as const, label: "H&S", icon: Shield },
    { key: "human_resources" as const, label: "HR", icon: Heart },
    { key: "employment_law" as const, label: "EL", icon: Briefcase },
  ];

  const statusColors = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    visible: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    hidden: "bg-muted text-muted-foreground border-muted",
  };

  return (
    <div className="flex items-center gap-1">
      {modules.map(({ key, label, icon: Icon }) => {
        const status = moduleAccess[key];
        return (
          <Badge
            key={key}
            variant="outline"
            className={`${statusColors[status]} px-1.5 py-0 text-xs`}
            title={`${label}: ${status}`}
          >
            <Icon className="mr-0.5 h-3 w-3" />
            {label}
          </Badge>
        );
      })}
    </div>
  );
}

function ComplianceIndicator({ summary }: { summary?: ComplianceSummary }) {
  if (!summary) {
    return <Badge variant="secondary">No data</Badge>;
  }

  const score = summary.complianceScore;

  if (score >= 90) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {score}% Compliant
        </span>
      </div>
    );
  }

  if (score >= 70) {
    return (
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {score}% Compliant
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <XCircle className="h-4 w-4 text-red-500" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">
        {score}% Compliant
      </span>
    </div>
  );
}

function SiteCard({ site, onManage }: { site: SiteWithDetails; onManage: (id: string) => void }) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium">{site.name}</h4>
                {site.address && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{site.address}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ModuleStatusBadges moduleAccess={site.moduleAccess} />
                <ComplianceIndicator summary={site.complianceSummary} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManage(site.id)}
                  data-testid={`button-manage-site-${site.id}`}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {site.siteManager && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {site.siteManager}
                </span>
              )}
              {site.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {site.contactPhone}
                </span>
              )}
              {site.contactEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {site.contactEmail}
                </span>
              )}
              {site.assignedConsultants && site.assignedConsultants.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {site.assignedConsultants.length} consultant{site.assignedConsultants.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CompanyGroup {
  companyName: string;
  companyNumber?: string;
  sites: SiteWithDetails[];
}

function CompanyGroupCard({ group, onManageSite }: { group: CompanyGroup; onManageSite: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  const aggregatedCompliance = group.sites.reduce(
    (acc, site) => {
      if (site.complianceSummary) {
        acc.totalDocuments += site.complianceSummary.totalDocuments;
        acc.compliantDocuments += site.complianceSummary.compliantDocuments;
        acc.reviewRequired += site.complianceSummary.reviewRequired;
        acc.overdueDocuments += site.complianceSummary.overdueDocuments;
      }
      return acc;
    },
    { totalDocuments: 0, compliantDocuments: 0, reviewRequired: 0, overdueDocuments: 0 }
  );

  const complianceScore = aggregatedCompliance.totalDocuments > 0
    ? Math.round((aggregatedCompliance.compliantDocuments / aggregatedCompliance.totalDocuments) * 100)
    : 100;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex w-full items-start gap-4">
            <CollapsibleTrigger asChild>
              <button className="flex flex-1 items-start gap-4 text-left" data-testid={`company-${group.companyName}`}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{group.companyName}</h3>
                      {group.companyNumber && (
                        <p className="text-sm text-muted-foreground">
                          Company No: {group.companyNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ComplianceIndicator summary={{ ...aggregatedCompliance, complianceScore, pendingApprovals: 0 }} />
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {group.sites.length} {group.sites.length === 1 ? "site" : "sites"}
                    </span>
                  </div>
                </div>
              </button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {aggregatedCompliance.totalDocuments > 0 && (
              <div className="mb-6 rounded-md bg-muted/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Company Compliance Overview</span>
                  <span className="text-sm text-muted-foreground">{complianceScore}%</span>
                </div>
                <Progress value={complianceScore} className="h-2" />
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-2xl font-semibold">{aggregatedCompliance.totalDocuments}</p>
                    <p className="text-xs text-muted-foreground">Total Documents</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {aggregatedCompliance.compliantDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Compliant</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                      {aggregatedCompliance.reviewRequired}
                    </p>
                    <p className="text-xs text-muted-foreground">Review Required</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                      {aggregatedCompliance.overdueDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Sites</h4>
              </div>
              <div className="space-y-3">
                {group.sites.map((site) => (
                  <SiteCard key={site.id} site={site} onManage={onManageSite} />
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function Sites() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false);
  const [newSite, setNewSite] = useState({
    name: "",
    companyName: "",
    companyNumber: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    siteManager: "",
  });
  const { toast } = useToast();

  const { data: sites, isLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });

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
        companyName: "",
        companyNumber: "",
        address: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
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
    if (!newSite.companyName.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    createSiteMutation.mutate(newSite);
  };

  const filteredSites = sites?.filter((site) =>
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.companyNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedByCompany: CompanyGroup[] = [];
  if (filteredSites) {
    const companyMap = new Map<string, SiteWithDetails[]>();
    filteredSites.forEach((site) => {
      const companyName = site.companyName || "Unassigned";
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, []);
      }
      companyMap.get(companyName)!.push(site);
    });

    companyMap.forEach((companySites, companyName) => {
      groupedByCompany.push({
        companyName,
        companyNumber: companySites[0]?.companyNumber ?? undefined,
        sites: companySites,
      });
    });

    groupedByCompany.sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Sites</h1>
          <p className="mt-1 text-muted-foreground">
            Manage sites grouped by company
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
            placeholder="Search sites or companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-sites"
          />
        </div>
      </div>

      {groupedByCompany.length > 0 ? (
        <div className="space-y-4">
          {groupedByCompany.map((group) => (
            <CompanyGroupCard key={group.companyName} group={group} onManageSite={handleManageSite} />
          ))}
        </div>
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
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="Enter company name"
                value={newSite.companyName}
                onChange={(e) => setNewSite({ ...newSite, companyName: e.target.value })}
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-number">Company Number</Label>
              <Input
                id="company-number"
                placeholder="e.g., 12345678"
                value={newSite.companyNumber}
                onChange={(e) => setNewSite({ ...newSite, companyNumber: e.target.value })}
                data-testid="input-company-number"
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
                value={newSite.address}
                onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                data-testid="input-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="email@example.com"
                  value={newSite.contactEmail}
                  onChange={(e) => setNewSite({ ...newSite, contactEmail: e.target.value })}
                  data-testid="input-contact-email"
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
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://www.example.com"
                value={newSite.website}
                onChange={(e) => setNewSite({ ...newSite, website: e.target.value })}
                data-testid="input-website"
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
