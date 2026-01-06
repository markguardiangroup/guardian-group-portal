import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RAGBadge, ApprovalBadge } from "@/components/rag-badge";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Calendar,
  Plus,
  Upload,
  Eye,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import type { ComplianceSummary, Document, AuditLog } from "@shared/schema";

interface DashboardData {
  summary: ComplianceSummary;
  recentDocuments: Document[];
  recentActivity: AuditLog[];
  upcomingReviews: Document[];
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  testId,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
  testId?: string;
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${variantStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold" data-testid={testId ? `${testId}-value` : undefined}>{value}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{description}</span>
          {trend && (
            <span className={`flex items-center gap-0.5 ${trend.isPositive ? "text-emerald-600" : "text-red-600"}`}>
              <TrendingUp className={`h-3 w-3 ${!trend.isPositive && "rotate-180"}`} />
              {trend.value}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceScoreCard({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Card data-testid="card-compliance-score">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Compliance Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold ${getScoreColor(score)}`} data-testid="text-compliance-score">
            {score}%
          </span>
          <span className="mb-1 text-sm text-muted-foreground">Overall</span>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full transition-all ${getScoreBg(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {score >= 90 
            ? "Excellent compliance status" 
            : score >= 70 
            ? "Some items require attention" 
            : "Urgent action required"}
        </p>
      </CardContent>
    </Card>
  );
}

function RecentActivityItem({ log }: { log: AuditLog }) {
  const actionConfig: Record<string, { icon: React.ElementType; color: string }> = {
    document_uploaded: { icon: Upload, color: "text-blue-500" },
    document_viewed: { icon: Eye, color: "text-slate-500" },
    document_approved: { icon: CheckCircle, color: "text-emerald-500" },
    document_rejected: { icon: AlertTriangle, color: "text-red-500" },
    document_updated: { icon: FileText, color: "text-amber-500" },
    document_archived: { icon: FileText, color: "text-slate-400" },
    changes_requested: { icon: AlertTriangle, color: "text-amber-500" },
    comment_added: { icon: FileText, color: "text-blue-400" },
    support_request_created: { icon: Plus, color: "text-purple-500" },
    support_request_resolved: { icon: CheckCircle, color: "text-emerald-500" },
  };

  const config = actionConfig[log.action] || { icon: FileText, color: "text-slate-500" };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{log.userName}</span>{" "}
          <span className="text-muted-foreground">
            {log.action.replace(/_/g, " ")}
          </span>
        </p>
        {log.details && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {log.details}
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : "Just now"}
        </p>
      </div>
    </div>
  );
}

function UpcomingReviewItem({ document }: { document: Document }) {
  const daysUntilReview = document.reviewDate 
    ? Math.ceil((new Date(document.reviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{document.title}</p>
        <p className="text-xs text-muted-foreground">
          {document.reviewDate && format(new Date(document.reviewDate), "MMM d, yyyy")}
        </p>
      </div>
      {daysUntilReview !== null && (
        <span className={`text-xs font-medium ${
          daysUntilReview <= 7 
            ? "text-red-600 dark:text-red-400" 
            : daysUntilReview <= 14 
            ? "text-amber-600 dark:text-amber-400" 
            : "text-muted-foreground"
        }`}>
          {daysUntilReview <= 0 ? "Overdue" : `${daysUntilReview}d`}
        </span>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-8 p-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-2 h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalDocuments: 0,
    compliantDocuments: 0,
    reviewRequired: 0,
    overdueDocuments: 0,
    pendingApprovals: 0,
    complianceScore: 0,
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Your compliance overview at a glance
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/reports" data-testid="link-view-reports">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Reports
            </Link>
          </Button>
          <Button asChild>
            <Link href="/documents/upload" data-testid="link-upload-document">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <ComplianceScoreCard score={summary.complianceScore} />
        <MetricCard
          title="Total Documents"
          value={summary.totalDocuments}
          description="Across all entities"
          icon={FileText}
          testId="card-total-documents"
        />
        <MetricCard
          title="Compliant"
          value={summary.compliantDocuments}
          description="Up to date"
          icon={CheckCircle}
          variant="success"
          testId="card-compliant-documents"
        />
        <MetricCard
          title="Review Required"
          value={summary.reviewRequired}
          description="Pending review"
          icon={Clock}
          variant="warning"
          testId="card-review-required"
        />
        <MetricCard
          title="Overdue"
          value={summary.overdueDocuments}
          description="Action needed"
          icon={AlertTriangle}
          variant="danger"
          testId="card-overdue-documents"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Recent Documents</CardTitle>
              <CardDescription>Latest document activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents" data-testid="link-view-all-documents">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data?.recentDocuments && data.recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {data.recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.title}</p>
                        <p className="text-sm text-muted-foreground">
                          v{doc.version} • {doc.type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RAGBadge status={doc.status} />
                      <ApprovalBadge status={doc.approvalStatus} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-medium">No documents yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload your first document to get started
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/documents/upload">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Upcoming Reviews</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {data?.upcomingReviews && data.upcomingReviews.length > 0 ? (
                <div className="divide-y">
                  {data.upcomingReviews.slice(0, 5).map((doc) => (
                    <UpcomingReviewItem key={doc.id} document={doc} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No upcoming reviews
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="divide-y">
                  {data.recentActivity.slice(0, 5).map((log) => (
                    <RecentActivityItem key={log.id} log={log} />
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No recent activity
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
