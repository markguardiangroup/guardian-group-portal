import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Users,
  Settings,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  Heart,
  Briefcase,
} from "lucide-react";
import type { Company, SiteWithDetails, ComplianceSummary, SiteModuleAccessSummary } from "@shared/schema";

type CompanyWithSites = Company & {
  sites: SiteWithDetails[];
};

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

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const [, navigate] = useLocation();

  const { data: company, isLoading, error } = useQuery<CompanyWithSites>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch company");
      return response.json();
    },
    enabled: !!companyId,
  });

  const handleManageSite = (siteId: string) => {
    navigate(`/sites/${siteId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Company not found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The company you're looking for doesn't exist or you don't have access.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/companies")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Companies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sites = company.sites || [];
  
  const aggregatedCompliance = sites.reduce(
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
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/companies")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{company.name}</h1>
              {company.companyNumber && (
                <p className="text-sm text-muted-foreground">Company No: {company.companyNumber}</p>
              )}
            </div>
          </div>
        </div>
        <Badge variant={company.status === "active" ? "default" : "secondary"}>
          {company.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{company.address}</span>
              </div>
            )}
            {company.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{company.contactPhone}</span>
              </div>
            )}
            {company.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{company.contactEmail}</span>
              </div>
            )}
            {!company.address && !company.contactPhone && !company.contactEmail && (
              <p className="text-sm text-muted-foreground">No contact details available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {aggregatedCompliance.totalDocuments > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Compliance</span>
                  <span className="text-sm text-muted-foreground">{complianceScore}%</span>
                </div>
                <Progress value={complianceScore} className="h-2 mb-4" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xl font-semibold">{aggregatedCompliance.totalDocuments}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {aggregatedCompliance.compliantDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Compliant</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {aggregatedCompliance.reviewRequired}
                    </p>
                    <p className="text-xs text-muted-foreground">Review</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                      {aggregatedCompliance.overdueDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No compliance data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sites ({sites.length})</h2>
        </div>
        
        {sites.length > 0 ? (
          <div className="space-y-3">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} onManage={handleManageSite} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-base font-medium">No sites</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This company doesn't have any sites yet
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
