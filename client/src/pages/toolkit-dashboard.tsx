import { useMemo, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookMarked, DownloadCloud, TrendingUp, Building2, Download, FolderOpen, HardHat, Briefcase, Scale } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { CompanyCombobox } from "@/components/company-combobox";

interface Site {
  id: string;
  name: string;
  companyId: string;
  companyName?: string;
}

interface DownloadStats {
  totalDownloads: number;
  downloadsLast30Days: number;
  downloadsByModule: {
    health_safety: number;
    human_resources: number;
    employment_law: number;
  };
  recentDownloads: {
    id: string;
    templateName: string;
    templateId: string;
    folderName: string | null;
    fileUrl: string | null;
    fileName: string | null;
    downloadedAt: string;
    downloadedBy: string;
    companyName: string | null;
    siteName: string | null;
  }[];
}

function TickerNumber({ value, className }: { value: number; className?: string }) {
  const [animKey, setAnimKey] = useState(0);
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (prevRef.current === value) return;
    prevRef.current = value;
    setDisplayed(value);
    setAnimKey(k => k + 1);
  }, [value]);

  return (
    <span
      key={animKey}
      className={className}
      style={{
        display: "inline-block",
        animation: animKey > 0 ? "tickerUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both" : "none",
      }}
      data-testid="ticker-number"
    >
      {displayed}
    </span>
  );
}

export default function ToolkitDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectedCompany, handleCompanyChange } = useSiteFilter();

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isClient = user?.role === "client";

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: isPrivilegedUser,
  });

  const activeCompany = selectedCompany && selectedCompany !== "all" ? selectedCompany : null;

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (activeCompany) params.set("companyName", activeCompany);
    return params.toString();
  }, [activeCompany]);

  const statsQueryKey = ["/api/toolkit/stats", activeCompany];

  const { data: stats, isLoading } = useQuery<DownloadStats>({
    queryKey: statsQueryKey,
    queryFn: async () => {
      const url = queryParams ? `/api/toolkit/stats?${queryParams}` : "/api/toolkit/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const contextName = activeCompany ?? null;

  async function handleRedownload(templateId: string, fileUrl: string, fileName: string) {
    try {
      await fetch("/api/toolkit/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ templateId }),
      });
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
      const response = await fetch(fileUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, "_blank");
    }
  }

  return (
    <div className="theme-toolkit">
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
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

      <div className="p-8 space-y-6 dash-animate">
        {/* Total summary cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-total-downloads">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
              <DownloadCloud className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-downloads">
                {isLoading ? <Skeleton className="h-9 w-16" /> : <TickerNumber value={stats?.totalDownloads ?? 0} />}
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
                {isLoading ? <Skeleton className="h-9 w-16" /> : <TickerNumber value={stats?.downloadsLast30Days ?? 0} />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Recent activity</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-module breakdown */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              key: "health_safety" as const,
              label: "Health & Safety",
              Icon: HardHat,
              iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
              iconColor: "text-emerald-600 dark:text-emerald-400",
              countColor: "text-emerald-700 dark:text-emerald-300",
              borderTop: "border-t-emerald-500",
            },
            {
              key: "human_resources" as const,
              label: "Human Resources",
              Icon: Briefcase,
              iconBg: "bg-blue-100 dark:bg-blue-900/40",
              iconColor: "text-blue-600 dark:text-blue-400",
              countColor: "text-blue-700 dark:text-blue-300",
              borderTop: "border-t-blue-500",
            },
            {
              key: "employment_law" as const,
              label: "Employment Law",
              Icon: Scale,
              iconBg: "bg-pink-100 dark:bg-pink-900/40",
              iconColor: "text-pink-600 dark:text-pink-400",
              countColor: "text-pink-700 dark:text-pink-300",
              borderTop: "border-t-pink-500",
            },
          ].map(({ key, label, Icon, iconBg, iconColor, countColor, borderTop }) => (
            <Card key={key} className={`border-t-4 ${borderTop}`} data-testid={`card-module-downloads-${key}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <div className={`p-1.5 rounded-md ${iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${countColor}`} data-testid={`text-module-downloads-${key}`}>
                  {isLoading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    <TickerNumber value={stats?.downloadsByModule?.[key] ?? 0} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total downloads</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recently Downloaded</CardTitle>
            <CardDescription>
              The 10 most recently downloaded templates
              {contextName && ` for ${contextName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : stats?.recentDownloads && stats.recentDownloads.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.recentDownloads.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                    data-testid={`row-recent-download-${item.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate" data-testid={`text-template-name-${item.templateId}`}>
                        {item.templateName}
                      </p>
                      {item.folderName && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.folderName}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {!isClient && <>{item.downloadedBy} · </>}
                        {format(new Date(item.downloadedAt), "d MMM yyyy, HH:mm")}
                      </p>
                      {!isClient && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.companyName && (
                            <Badge variant="outline" className="text-xs py-0 h-4" data-testid={`badge-company-${item.id}`}>
                              {item.companyName}
                            </Badge>
                          )}
                          {item.siteName && (
                            <Badge variant="secondary" className="text-xs py-0 h-4" data-testid={`badge-site-${item.id}`}>
                              {item.siteName}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {item.fileUrl && item.fileName && (
                      <button
                        type="button"
                        onClick={() => handleRedownload(item.templateId, item.fileUrl!, item.fileName!)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Re-download"
                        data-testid={`button-redownload-${item.id}`}
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    )}
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
