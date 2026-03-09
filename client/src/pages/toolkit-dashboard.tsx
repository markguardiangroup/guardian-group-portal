import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, DownloadCloud, TrendingUp, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";

interface Site {
  id: string;
  name: string;
  companyId: string;
  companyName?: string;
}

interface DownloadStats {
  totalDownloads: number;
  downloadsLast30Days: number;
  recentDownloads: {
    id: string;
    templateName: string;
    templateId: string;
    downloadedAt: string;
    downloadedBy: string;
    companyName: string | null;
    siteName: string | null;
  }[];
}

export default function ToolkitDashboard() {
  const { user } = useAuth();
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: isPrivilegedUser,
  });

  // Filter sites by selected company
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  // Determine site IDs for query
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    if (siteId) return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany, siteId]);
  const companySiteIdsKey = companySiteIds?.join(",") || null;

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    else if (companySiteIds?.length) params.set("siteIds", companySiteIds.join(","));
    return params.toString();
  }, [siteId, companySiteIds]);

  const { data: stats, isLoading } = useQuery<DownloadStats>({
    queryKey: ["/api/toolkit/stats", siteId, companySiteIdsKey],
    queryFn: async () => {
      const url = queryParams ? `/api/toolkit/stats?${queryParams}` : "/api/toolkit/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Determine context label
  const contextName = siteId
    ? sites?.find(s => s.id === siteId)?.name
    : selectedCompany && selectedCompany !== "all"
    ? selectedCompany
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <BookMarked className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Toolkit</h1>
              <p className="text-muted-foreground">Template download overview</p>
            </div>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-10 w-20" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-toolkit">
      {/* Module Header */}
      <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <BookMarked className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Toolkit</h1>
              <p className="text-muted-foreground">
                Template download overview
                {contextName && <span className="font-medium"> - {contextName}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Company / Site filter — admin and consultant only */}
            {isPrivilegedUser && sites && sites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CompanyCombobox
                  sites={sites}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-44"
                  testId="select-company-toolkit"
                />
                <span className="text-muted-foreground">/</span>
                <SiteCombobox
                  sites={filteredSites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-toolkit"
                />
              </div>
            )}
            <Button asChild className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground">
              <Link href="/toolkit/browse" data-testid="link-browse-templates">
                Browse Templates
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-total-downloads">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
              <DownloadCloud className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-downloads">
                {stats?.totalDownloads ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {contextName ? `For ${contextName}` : "All time, all companies"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-downloads-30days">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-downloads-30days">
                {stats?.downloadsLast30Days ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
            </CardContent>
          </Card>
        </div>

        {/* Recently Downloaded */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Downloaded</CardTitle>
            <CardDescription>
              The 10 most recently downloaded templates
              {contextName && ` for ${contextName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentDownloads && stats.recentDownloads.length > 0 ? (
              <div className="space-y-2">
                {stats.recentDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    data-testid={`row-recent-download-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" data-testid={`text-template-name-${item.templateId}`}>
                        {item.templateName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.downloadedBy} · {format(new Date(item.downloadedAt), "d MMM yyyy, HH:mm")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.companyName && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-company-${item.id}`}>
                          {item.companyName}
                        </Badge>
                      )}
                      {item.siteName && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-site-${item.id}`}>
                          {item.siteName}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {contextName
                  ? `No downloads recorded for ${contextName} yet.`
                  : "No downloads recorded yet. Downloads will appear here once templates are downloaded from the Browse page."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
