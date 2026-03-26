import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSiteFilter } from "@/hooks/use-site-filter";
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
  BarChart3,
  FileText,
  Calendar,
  TrendingUp,
  PieChart,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  Building2,
} from "lucide-react";
import type { ComplianceSummary, Site, Company } from "@shared/schema";

interface ReportData {
  summary: ComplianceSummary;
  sites: Site[];
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
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();
  const companyFilter = selectedCompany || "all";
  const siteFilter = selectedSiteId || "all";
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const setSiteFilter = (val: string) => setSelectedSiteId(val === "all" ? null : val);
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  // Build query params for filtering
  const queryParams = new URLSearchParams();
  if (companyFilter !== "all") queryParams.set("companyId", companyFilter);
  if (siteFilter !== "all") queryParams.set("siteId", siteFilter);
  const queryString = queryParams.toString();
  const reportsUrl = queryString ? `/api/reports?${queryString}` : "/api/reports";

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", { companyId: companyFilter, siteId: siteFilter }],
    queryFn: async () => {
      const response = await fetch(reportsUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
  });

  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesData?.companies || [];

  const { data: allSites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const filteredSites = companyFilter === "all" 
    ? allSites 
    : allSites.filter(site => site.companyId === companyFilter);

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
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
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

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      <div className="flex flex-wrap gap-3">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-48" data-testid="select-company-filter">
            <Building2 className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-48" data-testid="select-site-filter">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {filteredSites.map((site) => (
              <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
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
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : (
          <>
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
          </>
        )}
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
      </div>
    </div>
  );
}
