import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
} from "lucide-react";
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

function EntityCard({ entity }: { entity: EntityWithSites }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-start gap-4 text-left" data-testid={`entity-${entity.id}`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{entity.name}</CardTitle>
                    {entity.companyNumber && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Company No: {entity.companyNumber}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <ComplianceIndicator summary={entity.complianceSummary} />
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {entity.sites?.length || 0} site{entity.sites?.length !== 1 ? "s" : ""}
                  </span>
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

  const { data: entities, isLoading } = useQuery<EntityWithSites[]>({
    queryKey: ["/api/entities"],
  });

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
        <Button data-testid="button-add-entity">
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
            <EntityCard key={entity.id} entity={entity} />
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
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Entity
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
