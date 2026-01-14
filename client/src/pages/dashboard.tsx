import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  ArrowRight,
  HardHat,
  Users,
  TrendingUp,
  Shield,
  Scale,
  Briefcase,
} from "lucide-react";
import { Link } from "wouter";
import type { ModuleSummary, Case } from "@shared/schema";

interface DashboardData {
  moduleSummaries: ModuleSummary[];
}

function ModuleCard({ summary }: { summary: ModuleSummary }) {
  const isHS = summary.module === "health_safety";
  const Icon = isHS ? HardHat : Users;
  const basePath = isHS ? "/health-safety" : "/human-resources";
  const themeClass = isHS ? "theme-hs" : "theme-hr";
  
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

  // Module-specific styling
  const moduleStyles = isHS 
    ? "border-t-4 border-t-emerald-500 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20"
    : "border-t-4 border-t-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20";

  return (
    <Card className={`hover-elevate ${themeClass} ${moduleStyles}`} data-testid={`card-module-${summary.module}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isHS ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-blue-100 dark:bg-blue-900/40"}`}>
            <Icon className={`h-6 w-6 ${isHS ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`} />
          </div>
          <div>
            <CardTitle className="text-lg">{summary.moduleName}</CardTitle>
            <CardDescription>{summary.totalDocuments} documents</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${getScoreColor(summary.complianceScore)}`}>
            {summary.complianceScore}%
          </span>
          <p className="text-xs text-muted-foreground">Compliance</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={`h-full transition-all ${getScoreBg(summary.complianceScore)}`}
            style={{ width: `${summary.complianceScore}%` }}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.compliantDocuments}</span>
            </div>
            <p className="text-xs text-muted-foreground">Compliant</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.reviewRequired}</span>
            </div>
            <p className="text-xs text-muted-foreground">Review</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.overdueDocuments}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>

        <Button className={`w-full ${isHS ? "border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" : "border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"}`} variant="outline" asChild>
          <Link href={basePath} data-testid={`link-module-${summary.module}`}>
            View Module
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmploymentLawCard({ cases }: { cases: Case[] }) {
  const activeCases = cases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length;
  const resolvedCases = cases.filter(c => c.status === "resolved" || c.status === "closed").length;
  const totalCases = cases.length;

  return (
    <Card className="hover-elevate theme-el border-t-4 border-t-pink-500 bg-gradient-to-br from-pink-50/50 to-transparent dark:from-pink-950/20" data-testid="card-module-employment_law">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/40">
            <Scale className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Employment Law</CardTitle>
            <CardDescription>{totalCases} cases</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-pink-600 dark:text-pink-400">
            {activeCases}
          </span>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-pink-600 dark:text-pink-400">
              <Briefcase className="h-4 w-4" />
              <span className="text-lg font-semibold">{activeCases}</span>
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{resolvedCases}</span>
            </div>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-lg font-semibold">{totalCases}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>

        <Button className="w-full border-pink-500 text-pink-600 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-950/30" variant="outline" asChild>
          <Link href="/employment-law" data-testid="link-module-employment_law">
            View Module
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OverallComplianceCard({ summaries }: { summaries: ModuleSummary[] }) {
  const totalDocs = summaries.reduce((acc, s) => acc + s.totalDocuments, 0);
  const compliantDocs = summaries.reduce((acc, s) => acc + s.compliantDocuments, 0);
  const reviewDocs = summaries.reduce((acc, s) => acc + s.reviewRequired, 0);
  const overdueDocs = summaries.reduce((acc, s) => acc + s.overdueDocuments, 0);
  const pendingApprovals = summaries.reduce((acc, s) => acc + s.pendingApprovals, 0);
  const overallScore = totalDocs > 0 ? Math.round((compliantDocs / totalDocs) * 100) : 100;

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
    <Card data-testid="card-overall-compliance">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Overall Compliance</CardTitle>
            <CardDescription>Across all modules</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-3">
          <span className={`text-6xl font-bold ${getScoreColor(overallScore)}`} data-testid="text-overall-score">
            {overallScore}%
          </span>
          <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span>+5% from last month</span>
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={`h-full transition-all ${getScoreBg(overallScore)}`}
            style={{ width: `${overallScore}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-md border p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold">{totalDocs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-2xl font-semibold">{compliantDocs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Compliant</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-2xl font-semibold">{reviewDocs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Review Required</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-2xl font-semibold">{overdueDocs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
        </div>

        {pendingApprovals > 0 && (
          <div className="rounded-md bg-amber-500/10 p-3 text-center">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {pendingApprovals} document{pendingApprovals > 1 ? "s" : ""} pending approval
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: moduleSummaries, isLoading: isLoadingSummaries } = useQuery<ModuleSummary[]>({
    queryKey: ["/api/modules/summary"],
  });

  const { data: cases, isLoading: isLoadingCases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const isLoading = isLoadingSummaries || isLoadingCases;

  if (isLoading) {
    return (
      <div className="space-y-8 p-8">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const summaries = moduleSummaries || [];
  const caseList = cases || [];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Compliance Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor compliance across all modules
        </p>
      </div>

      <OverallComplianceCard summaries={summaries} />

      <div>
        <h2 className="mb-4 text-xl font-semibold">Modules</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {summaries.map((summary) => (
            <ModuleCard key={summary.module} summary={summary} />
          ))}
          <EmploymentLawCard cases={caseList} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks across modules</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/health-safety/documents" data-testid="link-hs-documents">
                <HardHat className="mr-2 h-4 w-4" />
                H&S Documents
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/human-resources/documents" data-testid="link-hr-documents">
                <Users className="mr-2 h-4 w-4" />
                HR Documents
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/entities" data-testid="link-entities">
                <FileText className="mr-2 h-4 w-4" />
                Manage Entities
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/reports" data-testid="link-reports">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/employment-law" data-testid="link-el-cases">
                <Scale className="mr-2 h-4 w-4" />
                EL Cases
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Support</CardTitle>
            <CardDescription>Need help with compliance?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Our consultants are here to help you maintain compliance across all areas of Health & Safety and Human Resources.
            </p>
            <Button asChild>
              <Link href="/support" data-testid="link-support">
                Contact Support
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
