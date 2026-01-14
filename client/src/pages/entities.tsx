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
  FileText,
  Users,
  Phone,
  Mail,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EntityWithSites, Site, ComplianceSummary } from "@shared/schema";

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

function SiteCard({ site, entityId }: { site: Site; entityId: string }) {
  return (
    <div className="rounded-md border p-4 hover-elevate">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-medium">{site.name}</h4>
              {site.address && (
                <p className="mt-0.5 text-sm text-muted-foreground">{site.address}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0">
              Active
            </Badge>
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
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ entity, onManage }: { entity: EntityWithSites; onManage: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex w-full items-start gap-4">
            <CollapsibleTrigger asChild>
              <button className="flex flex-1 items-start gap-4 text-left" data-testid={`entity-${entity.id}`}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{entity.name}</h3>
                      {entity.companyNumber && (
                        <p className="text-sm text-muted-foreground">
                          Company No: {entity.companyNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ComplianceIndicator summary={entity.complianceSummary} />
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {entity.sites && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {entity.sites.length} {entity.sites.length === 1 ? "site" : "sites"}
                    </span>
                  )}
                  {entity.contactEmail && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {entity.contactEmail}
                    </span>
                  )}
                  {entity.contactPhone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {entity.contactPhone}
                    </span>
                  )}
                  </div>
                </div>
              </button>
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManage(entity.id)}
              className="ml-2 shrink-0"
              data-testid={`button-manage-entity-${entity.id}`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {entity.complianceSummary && (
              <div className="mb-6 rounded-md bg-muted/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Compliance Overview</span>
                  <span className="text-sm text-muted-foreground">
                    {entity.complianceSummary.complianceScore}%
                  </span>
                </div>
                <Progress value={entity.complianceSummary.complianceScore} className="h-2" />
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-2xl font-semibold">
                      {entity.complianceSummary.totalDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Documents</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {entity.complianceSummary.compliantDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Compliant</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                      {entity.complianceSummary.reviewRequired}
                    </p>
                    <p className="text-xs text-muted-foreground">Review Required</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                      {entity.complianceSummary.overdueDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Sites</h4>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add Site
                </Button>
              </div>
              {entity.sites && entity.sites.length > 0 ? (
                <div className="space-y-3">
                  {entity.sites.map((site) => (
                    <SiteCard key={site.id} site={site} entityId={entity.id} />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No sites added yet</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add First Site
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function Entities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const [isAddEntityOpen, setIsAddEntityOpen] = useState(false);
  const [newEntity, setNewEntity] = useState({
    name: "",
    companyNumber: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
  });
  const { toast } = useToast();

  const { data: entities, isLoading } = useQuery<EntityWithSites[]>({
    queryKey: ["/api/entities"],
  });

  const createEntityMutation = useMutation({
    mutationFn: async (data: typeof newEntity) => {
      const response = await apiRequest("POST", "/api/entities", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities"] });
      toast({ title: "Entity created successfully" });
      setIsAddEntityOpen(false);
      setNewEntity({
        name: "",
        companyNumber: "",
        address: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
      });
    },
    onError: () => {
      toast({ title: "Failed to create entity", variant: "destructive" });
    },
  });

  const handleManageEntity = (entityId: string) => {
    navigate(`/entities/${entityId}`);
  };

  const handleCreateEntity = () => {
    if (!newEntity.name.trim()) {
      toast({ title: "Entity name is required", variant: "destructive" });
      return;
    }
    createEntityMutation.mutate(newEntity);
  };

  const filteredEntities = entities?.filter((entity) =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.companyNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-3xl font-semibold">Entities & Sites</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your organization structure
          </p>
        </div>
        <Button onClick={() => setIsAddEntityOpen(true)} data-testid="button-add-entity">
          <Plus className="mr-2 h-4 w-4" />
          Add Entity
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-entities"
          />
        </div>
      </div>

      {filteredEntities && filteredEntities.length > 0 ? (
        <div className="space-y-4">
          {filteredEntities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} onManage={handleManageEntity} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No entities found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search"
                : "Add your first entity to get started"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setIsAddEntityOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Entity
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddEntityOpen} onOpenChange={setIsAddEntityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Entity</DialogTitle>
            <DialogDescription>
              Create a new client organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-name">Entity Name *</Label>
              <Input
                id="entity-name"
                placeholder="Enter organization name"
                value={newEntity.name}
                onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                data-testid="input-entity-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-number">Company Number</Label>
              <Input
                id="company-number"
                placeholder="e.g., 12345678"
                value={newEntity.companyNumber}
                onChange={(e) => setNewEntity({ ...newEntity, companyNumber: e.target.value })}
                data-testid="input-company-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter full address"
                value={newEntity.address}
                onChange={(e) => setNewEntity({ ...newEntity, address: e.target.value })}
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
                  value={newEntity.contactEmail}
                  onChange={(e) => setNewEntity({ ...newEntity, contactEmail: e.target.value })}
                  data-testid="input-contact-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Contact Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+44 xxx xxx xxxx"
                  value={newEntity.contactPhone}
                  onChange={(e) => setNewEntity({ ...newEntity, contactPhone: e.target.value })}
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
                value={newEntity.website}
                onChange={(e) => setNewEntity({ ...newEntity, website: e.target.value })}
                data-testid="input-website"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEntityOpen(false)} data-testid="button-cancel-entity">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateEntity} 
              disabled={createEntityMutation.isPending}
              data-testid="button-create-entity"
            >
              {createEntityMutation.isPending ? "Creating..." : "Create Entity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
