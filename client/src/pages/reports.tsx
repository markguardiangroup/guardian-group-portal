import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  PieChart,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import type { ComplianceSummary, Entity, EntityWithSites } from "@shared/schema";

interface ReportData {
  summary: ComplianceSummary;
  entities: Entity[];
  monthlyTrend: { month: string; score: number }[];
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variants = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-md ${variants[variant]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-semibold">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ComplianceScoreChart({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 90) return "#10b981";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Overall Compliance Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <div className="relative h-40 w-40">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 150 150">
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-muted"
              />
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={getColor(score)}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold">{score}%</span>
              <span className="text-sm text-muted-foreground">Compliant</span>
            </div>
          </div>
          <div className="mt-6 grid w-full grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <span className="font-semibold">Good</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">90-100%</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">Attention</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">70-89%</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                <Clock className="h-4 w-4" />
                <span className="font-semibold">Critical</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">0-69%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }: { data: { month: string; score: number }[] }) {
  const maxScore = Math.max(...data.map((d) => d.score), 100);
  const minScore = Math.min(...data.map((d) => d.score), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Compliance Trend
        </CardTitle>
        <CardDescription>Monthly compliance score over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-end gap-2">
          {data.map((item, index) => {
            const height = ((item.score - minScore) / (maxScore - minScore)) * 100;
            const getColor = (score: number) => {
              if (score >= 90) return "bg-emerald-500";
              if (score >= 70) return "bg-amber-500";
              return "bg-red-500";
            };

            return (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative w-full">
                  <div
                    className={`mx-auto w-full max-w-8 rounded-t-sm transition-all ${getColor(item.score)}`}
                    style={{ height: `${height}%`, minHeight: "8px" }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">{item.score}%</p>
                  <p className="text-xs text-muted-foreground">{item.month}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [showModuleReport, setShowModuleReport] = useState(false);

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports"],
  });

  const { data: entitiesWithModules = [] } = useQuery<EntityWithSites[]>({
    queryKey: ["/api/entities"],
    enabled: showModuleReport,
  });

  const moduleStatusColors = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    visible: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    hidden: "bg-muted text-muted-foreground border-muted",
  };

  const getModuleStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-3 w-3" />;
      case "visible": return <Eye className="h-3 w-3" />;
      default: return <EyeOff className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
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

  const trend = data?.monthlyTrend || [
    { month: "Jul", score: 72 },
    { month: "Aug", score: 78 },
    { month: "Sep", score: 75 },
    { month: "Oct", score: 82 },
    { month: "Nov", score: 88 },
    { month: "Dec", score: 85 },
  ];

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Compliance analytics and reporting
          </p>
        </div>
        <Button data-testid="button-export-report">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-48" data-testid="select-entity-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {data?.entities?.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>{entity.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40" data-testid="select-period-filter">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Time Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={summary.totalDocuments}
          description="Across all entities and sites"
          icon={FileText}
        />
        <StatCard
          title="Compliant"
          value={summary.compliantDocuments}
          description="Documents up to date"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Review Required"
          value={summary.reviewRequired}
          description="Pending review or approval"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Overdue"
          value={summary.overdueDocuments}
          description="Require immediate attention"
          icon={Clock}
          variant="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ComplianceScoreChart score={summary.complianceScore} />
        <div className="lg:col-span-2">
          <TrendChart data={trend} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Available Reports
          </CardTitle>
          <CardDescription>Generate and download compliance reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowModuleReport(true)}
              data-testid="report-entity-module-status"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Entity Module Status</p>
                  <p className="text-sm text-muted-foreground">Summary of all entities and their module access</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>
            {[
              { title: "Full Compliance Report", description: "Complete overview of all compliance status", format: "PDF" },
              { title: "Document Inventory", description: "List of all documents with status", format: "Excel" },
              { title: "Audit Trail Export", description: "Full audit log of all actions", format: "CSV" },
              { title: "Expiry Report", description: "Documents due for review or expired", format: "PDF" },
              { title: "Entity Summary", description: "Compliance breakdown by entity", format: "PDF" },
              { title: "Monthly Progress", description: "Month-over-month compliance changes", format: "PDF" },
            ].map((report) => (
              <div key={report.title} className="flex items-center justify-between gap-4 rounded-md border p-4">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
                <Badge variant="secondary">{report.format}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModuleReport} onOpenChange={setShowModuleReport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Entity Module Status Report
            </DialogTitle>
            <DialogDescription>
              Summary of all entities and their module access status. Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="mb-4 flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Legend:</span>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={moduleStatusColors.active}>
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={moduleStatusColors.visible}>
                  <Eye className="mr-1 h-3 w-3" />
                  Visible
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={moduleStatusColors.hidden}>
                  <EyeOff className="mr-1 h-3 w-3" />
                  Hidden
                </Badge>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Sites</TableHead>
                  <TableHead className="text-center">Health & Safety</TableHead>
                  <TableHead className="text-center">Human Resources</TableHead>
                  <TableHead className="text-center">Employment Law</TableHead>
                  <TableHead className="text-center">Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitiesWithModules.map((entity) => (
                  <TableRow key={entity.id} data-testid={`report-row-${entity.id}`}>
                    <TableCell>
                      <div className="font-medium">{entity.name}</div>
                      {entity.companyNumber && (
                        <div className="text-xs text-muted-foreground">#{entity.companyNumber}</div>
                      )}
                    </TableCell>
                    <TableCell>{entity.sites?.length || 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={moduleStatusColors[entity.moduleAccess?.health_safety || "hidden"]}
                      >
                        {getModuleStatusIcon(entity.moduleAccess?.health_safety || "hidden")}
                        <span className="ml-1 capitalize">{entity.moduleAccess?.health_safety || "hidden"}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={moduleStatusColors[entity.moduleAccess?.human_resources || "hidden"]}
                      >
                        {getModuleStatusIcon(entity.moduleAccess?.human_resources || "hidden")}
                        <span className="ml-1 capitalize">{entity.moduleAccess?.human_resources || "hidden"}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={moduleStatusColors[entity.moduleAccess?.employment_law || "hidden"]}
                      >
                        {getModuleStatusIcon(entity.moduleAccess?.employment_law || "hidden")}
                        <span className="ml-1 capitalize">{entity.moduleAccess?.employment_law || "hidden"}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-medium ${
                        (entity.complianceSummary?.complianceScore || 0) >= 90 ? "text-emerald-600" :
                        (entity.complianceSummary?.complianceScore || 0) >= 70 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {entity.complianceSummary?.complianceScore || 0}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {entitiesWithModules.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No entities found.
              </div>
            )}

            <div className="mt-6 border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-medium">Summary</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const headers = ["Entity", "Company Number", "Sites", "Health & Safety", "Human Resources", "Employment Law", "Compliance Score"];
                    const rows = entitiesWithModules.map(entity => [
                      entity.name,
                      entity.companyNumber || "",
                      entity.sites?.length || 0,
                      entity.moduleAccess?.health_safety || "hidden",
                      entity.moduleAccess?.human_resources || "hidden",
                      entity.moduleAccess?.employment_law || "hidden",
                      `${entity.complianceSummary?.complianceScore || 0}%`
                    ]);
                    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `entity-module-status-${format(new Date(), "yyyy-MM-dd")}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  data-testid="button-download-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold">{entitiesWithModules.length}</p>
                  <p className="text-sm text-muted-foreground">Total Entities</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold text-emerald-600">
                    {entitiesWithModules.filter(e => e.moduleAccess?.health_safety === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active H&S</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold text-emerald-600">
                    {entitiesWithModules.filter(e => e.moduleAccess?.human_resources === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active HR</p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold text-emerald-600">
                    {entitiesWithModules.filter(e => e.moduleAccess?.employment_law === "active").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active EL</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
