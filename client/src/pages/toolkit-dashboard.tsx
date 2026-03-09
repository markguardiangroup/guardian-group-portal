import { useQuery } from "@tanstack/react-query";
import { BookMarked, DownloadCloud, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface DownloadStats {
  totalDownloads: number;
  downloadsLast30Days: number;
  recentDownloads: {
    id: string;
    templateName: string;
    templateId: string;
    downloadedAt: string;
    downloadedBy: string;
  }[];
}

export default function ToolkitDashboard() {
  const { data: stats, isLoading } = useQuery<DownloadStats>({
    queryKey: ["/api/toolkit/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <BookMarked className="h-7 w-7 text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Toolkit</h1>
            <p className="text-muted-foreground text-sm">Document template downloads and activity.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <BookMarked className="h-7 w-7 text-primary mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Toolkit</h1>
          <p className="text-muted-foreground text-sm">Document template downloads and activity.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <DownloadCloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalDownloads ?? 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.downloadsLast30Days ?? 0}</div>
            <p className="text-xs text-muted-foreground">Recent activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Recently Downloaded */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Downloaded</CardTitle>
          <CardDescription>The 10 most recently downloaded templates</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentDownloads && stats.recentDownloads.length > 0 ? (
            <div className="space-y-3">
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
                    <p className="text-xs text-muted-foreground">
                      {item.downloadedBy} • {format(new Date(item.downloadedAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No downloads yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
