import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";
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
  Lock,
  Headphones,
  MessageCircle,
  CheckCheck,
  Calendar,
  GraduationCap,
  BookOpen,
  Award,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useAuth } from "@/hooks/use-auth";
import type { ModuleSummary, ModuleType, SiteWithDetails, SupportRequest, Document, TrainingBooking, Case } from "@shared/schema";

interface DashboardData {
  moduleSummaries: ModuleSummary[];
}

function ModuleCard({ summary }: { summary: ModuleSummary }) {
  const isHS = summary.module === "health_safety";
  const isEL = summary.module === "employment_law";
  const isSupport = summary.module === "support";
  const isHR = summary.module === "human_resources";
  
  // Determine icon based on module
  const Icon = isHS ? HardHat : isEL ? Scale : isSupport ? Headphones : Users;
  
  // Determine path based on module
  const basePath = isHS ? "/health-safety" : isEL ? "/employment-law" : isSupport ? "/support" : "/human-resources";
  
  // Determine theme class based on module
  const themeClass = isHS ? "theme-hs" : isEL ? "theme-el" : isSupport ? "theme-support" : "theme-hr";
  
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

  // Module-specific styling - Support gets slate, distinct from blue HR
  const moduleStyles = isHS 
    ? "border-t-4 border-t-emerald-500 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20"
    : isEL 
    ? "border-t-4 border-t-pink-500 bg-gradient-to-br from-pink-50/50 to-transparent dark:from-pink-950/20"
    : isSupport
    ? "border-t-4 border-t-slate-500 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-950/20"
    : "border-t-4 border-t-blue-500 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20";
  
  const iconBgClass = isHS 
    ? "bg-emerald-100 dark:bg-emerald-900/40" 
    : isEL 
    ? "bg-pink-100 dark:bg-pink-900/40"
    : isSupport
    ? "bg-slate-100 dark:bg-slate-800/40"
    : "bg-blue-100 dark:bg-blue-900/40";
  
  const iconColorClass = isHS 
    ? "text-emerald-600 dark:text-emerald-400" 
    : isEL 
    ? "text-pink-600 dark:text-pink-400"
    : isSupport
    ? "text-slate-600 dark:text-slate-400"
    : "text-blue-600 dark:text-blue-400";
  
  const buttonClass = isHS 
    ? "border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30" 
    : isEL 
    ? "border-pink-500 text-pink-600 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-950/30"
    : isSupport
    ? "border-slate-500 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950/30"
    : "border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30";

  return (
    <Card className={`hover-elevate flex flex-col h-full ${themeClass} ${moduleStyles}`} data-testid={`card-module-${summary.module}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgClass}`}>
            <Icon className={`h-6 w-6 ${iconColorClass}`} />
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
      <CardContent className="flex flex-col flex-1 space-y-4">
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

        <Button className={`w-full mt-auto ${buttonClass}`} variant="outline" asChild>
          <Link href={basePath} data-testid={`link-module-${summary.module}`}>
            View Module
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmploymentLawCard({ summary }: { summary: ModuleSummary }) {
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const openCases = cases.filter(c => c.status === "under_investigation" || c.status === "hearing_scheduled").length;
  const resolvedCases = cases.filter(c => c.status === "resolved" || c.status === "closed").length;
  const totalCases = cases.length;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <Card className="hover-elevate flex flex-col h-full theme-el border-t-4 border-t-pink-500 bg-gradient-to-br from-pink-50/50 to-transparent dark:from-pink-950/20" data-testid="card-module-employment_law">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/40">
            <Scale className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Employment Law</CardTitle>
            <CardDescription>{summary.totalDocuments} docs · {totalCases} cases</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${getScoreColor(summary.complianceScore)}`}>
            {summary.complianceScore}%
          </span>
          <p className="text-xs text-muted-foreground">Compliance</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 space-y-4">
        {/* Two metric tiles: Documents and Cases */}
        <div className="grid grid-cols-2 gap-3">
          {/* Documents Tile */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              <span className="text-sm font-medium">Documents</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.compliantDocuments}
                </div>
                <p className="text-xs text-muted-foreground">Compliant</p>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {summary.reviewRequired}
                </div>
                <p className="text-xs text-muted-foreground">Review</p>
              </div>
            </div>
          </div>

          {/* Cases Tile */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-pink-600 dark:text-pink-400" />
              <span className="text-sm font-medium">Cases</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {openCases}
                </div>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {resolvedCases}
                </div>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </div>
        </div>

        <Button className="w-full mt-auto border-pink-500 text-pink-600 dark:text-pink-400" variant="outline" asChild>
          <Link href="/employment-law" data-testid="link-module-employment_law">
            View Module
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SupportCard() {
  const { data: supportRequests = [] } = useQuery<SupportRequest[]>({
    queryKey: ["/api/support-requests"],
  });

  const openRequests = supportRequests.filter(r => r.status === "open" || r.status === "in_progress").length;
  const resolvedRequests = supportRequests.filter(r => r.status === "resolved").length;
  const totalRequests = supportRequests.length;

  return (
    <Card className="hover-elevate theme-support border-t-4 border-t-slate-500 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-950/20" data-testid="card-module-support">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/40">
            <Headphones className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Support</CardTitle>
            <CardDescription>{totalRequests} requests</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-slate-600 dark:text-slate-400">
            {openRequests}
          </span>
          <p className="text-xs text-muted-foreground">Open</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <MessageCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{openRequests}</span>
            </div>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="h-4 w-4" />
              <span className="text-lg font-semibold">{resolvedRequests}</span>
            </div>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </div>
        </div>

        <Button className="w-full border-slate-500 text-slate-600 dark:text-slate-400" variant="outline" asChild>
          <Link href="/support" data-testid="link-module-support">
            View Support
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function TrainingCard() {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  const { data: trainingBookings = [] } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  const bookedCount = trainingBookings.filter(b => b.status === "booked").length;
  const completedCount = trainingBookings.filter(b => b.status === "completed").length;
  const totalBookings = trainingBookings.length;

  return (
    <Card className="hover-elevate theme-training border-t-4 border-t-purple-500 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20" data-testid="card-module-training">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-800/40">
            <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Training</CardTitle>
            <CardDescription>{totalBookings} bookings</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {bookedCount}
          </span>
          <p className="text-xs text-muted-foreground">Booked</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
              <BookOpen className="h-4 w-4" />
              <span className="text-lg font-semibold">{bookedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Booked</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Award className="h-4 w-4" />
              <span className="text-lg font-semibold">{completedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>

        <Button className="w-full border-purple-500 text-purple-600 dark:text-purple-400" variant="outline" asChild>
          <Link href={isPrivilegedUser ? "/training/dashboard" : "/training/my-training"} data-testid="link-module-training">
            {isPrivilegedUser ? "Manage Training" : "My Training"}
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
  const awaitingYourApproval = summaries.reduce((acc, s) => acc + (s.awaitingYourApproval || 0), 0);
  const awaitingOthersApproval = summaries.reduce((acc, s) => acc + (s.awaitingOthersApproval || 0), 0);
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

        {(awaitingYourApproval > 0 || awaitingOthersApproval > 0) && (
          <div className="space-y-2">
            {awaitingYourApproval > 0 && (
              <div className="rounded-md bg-amber-500/10 p-3 text-center">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {awaitingYourApproval} document{awaitingYourApproval > 1 ? "s" : ""} awaiting your review
                </p>
              </div>
            )}
            {awaitingOthersApproval > 0 && (
              <div className="rounded-md bg-blue-500/10 p-3 text-center">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {awaitingOthersApproval} of your document{awaitingOthersApproval > 1 ? "s" : ""} pending approval
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LockedModuleCard({ moduleName, module }: { 
  moduleName: string; 
  module: ModuleType; 
}) {
  const isHS = module === "health_safety";
  const isEL = module === "employment_law";
  const isSupport = module === "support";
  const Icon = isHS ? HardHat : isEL ? Scale : isSupport ? Headphones : Users;
  
  const moduleStyles = isHS 
    ? "border-t-4 border-t-emerald-500/50 bg-gradient-to-br from-emerald-50/30 to-transparent dark:from-emerald-950/10"
    : isEL 
    ? "border-t-4 border-t-pink-500/50 bg-gradient-to-br from-pink-50/30 to-transparent dark:from-pink-950/10"
    : isSupport
    ? "border-t-4 border-t-slate-500/50 bg-gradient-to-br from-slate-50/30 to-transparent dark:from-slate-950/10"
    : "border-t-4 border-t-blue-500/50 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-950/10";
  
  const iconBgClass = isHS 
    ? "bg-emerald-100/50 dark:bg-emerald-900/20" 
    : isEL 
    ? "bg-pink-100/50 dark:bg-pink-900/20"
    : isSupport
    ? "bg-slate-100/50 dark:bg-slate-800/20"
    : "bg-blue-100/50 dark:bg-blue-900/20";
  
  const iconColorClass = isHS 
    ? "text-emerald-600/50 dark:text-emerald-400/50" 
    : isEL 
    ? "text-pink-600/50 dark:text-pink-400/50"
    : isSupport
    ? "text-slate-600/50 dark:text-slate-400/50"
    : "text-blue-600/50 dark:text-blue-400/50";

  return (
    <Card className={`opacity-75 h-full ${moduleStyles}`} data-testid={`card-module-locked-${module}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgClass}`}>
            <Icon className={`h-6 w-6 ${iconColorClass}`} />
          </div>
          <div>
            <CardTitle className="text-lg text-muted-foreground">{moduleName}</CardTitle>
            <CardDescription>Access not active</CardDescription>
          </div>
        </div>
        <Lock className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Contact your administrator to enable this module
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (clients see their accessible sites, admin/consultant see all)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can filter by site if they have multiple sites
  const clientHasMultipleSites = isClientUser && sites && sites.length > 1;
  
  // Filter sites by selected company for the site dropdown
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);
  
  // Get site IDs for the selected company (for API query)
  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany]);
  
  // Create stable string key for company site IDs (avoid nested arrays in query keys)
  const companySiteIdsKey = companySiteIds?.join(",") || null;
  
  // Handle company selection - preserve site if it belongs to new company
  const handleCompanyChange = (company: string | null) => {
    setSelectedCompany(company);
    if (selectedSiteId && company && company !== "all") {
      const currentSite = sites?.find(s => s.id === selectedSiteId);
      if (currentSite?.companyName !== company) {
        setSelectedSiteId(null);
      }
    }
  };
  
  // Determine which site to show data for
  // "all" or null means show data across all accessible sites
  // Clients can now filter by site if they have multiple sites
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  
  const { data: moduleSummaries, isLoading } = useQuery<ModuleSummary[]>({
    queryKey: ["/api/modules/summary", siteId, companySiteIdsKey, isClientUser],
    queryFn: async () => {
      // For client users, the backend will filter by their company from session
      // No need to send companyId from client side (more secure)
      let url = "/api/modules/summary";
      if (siteId) {
        url = `/api/modules/summary?siteId=${siteId}`;
      } else if (companySiteIds && companySiteIds.length > 0) {
        url = `/api/modules/summary?siteIds=${companySiteIds.join(",")}`;
      }
      // Client users get company-scoped data automatically from backend
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  
  // Fetch all documents for renewal compliance tracking
  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents", siteId, companySiteIdsKey],
    queryFn: async () => {
      let url = "/api/documents";
      if (siteId) {
        url = `/api/documents?siteId=${siteId}`;
      } else if (companySiteIds && companySiteIds.length > 0) {
        url = `/api/documents?siteIds=${companySiteIds.join(",")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });
  
  // Calculate renewal metrics across all documents
  const renewalMetrics = useMemo(() => {
    if (!allDocuments) return { overdue: 0, due30Days: 0, due60Days: 0, upcomingRenewals: [] as Document[] };
    
    const now = new Date();
    let overdue = 0;
    let due30Days = 0;
    let due60Days = 0;
    const upcomingRenewals: Document[] = [];
    
    allDocuments.forEach((doc) => {
      if (!doc.renewalDate) return;
      
      const renewalDate = new Date(doc.renewalDate);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilRenewal < 0) {
        overdue++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal <= 30) {
        due30Days++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal <= 60) {
        due60Days++;
        upcomingRenewals.push(doc);
      }
    });
    
    upcomingRenewals.sort((a, b) => {
      const dateA = a.renewalDate ? new Date(a.renewalDate).getTime() : Infinity;
      const dateB = b.renewalDate ? new Date(b.renewalDate).getTime() : Infinity;
      return dateA - dateB;
    });
    
    return { overdue, due30Days, due60Days, upcomingRenewals };
  }, [allDocuments]);
  
  const { hasActiveAccess, isHidden } = useModuleAccess();
  
  // Build current context label
  const currentContextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (isPrivilegedUser) {
      if (selectedCompany && selectedCompany !== "all") {
        return selectedCompany;
      }
      return "All Clients";
    }
    // For clients with multiple sites showing "all"
    if (clientHasMultipleSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasMultipleSites]);

  if (isLoading || isAuthLoading || sitesLoading) {
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

  // Compliance modules (not including support)
  const complianceModules: { module: ModuleType; name: string }[] = [
    { module: "health_safety", name: "Health & Safety" },
    { module: "human_resources", name: "Human Resources" },
    { module: "employment_law", name: "Employment Law" },
  ];

  const summaries = moduleSummaries || [];
  // Filter to only compliance modules (exclude support)
  const complianceSummaries = summaries.filter(s => s.module !== "support" && hasActiveAccess(s.module));
  // Show all non-active modules as locked so clients can see what's available
  const lockedModules = complianceModules.filter(m => !hasActiveAccess(m.module));
  
  // Check if user has access to support
  const hasSupportAccess = hasActiveAccess("support");
  const isSupportLocked = !hasSupportAccess;

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Compliance Overview</h1>
          <p className="mt-1 text-muted-foreground">
            Monitor compliance across all modules
            {currentContextLabel && <span className="font-medium"> - {currentContextLabel}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            href="/support" 
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover-elevate rounded-md px-2 py-1"
            data-testid="link-need-help"
          >
            <Headphones className="h-4 w-4" />
            <span>Need help?</span>
          </Link>
          {/* Company and Site selectors - admin/consultant get both, clients with multiple sites get site selector */}
          {(isPrivilegedUser || clientHasMultipleSites) && sites && sites.length > 0 && (
            <>
              {isPrivilegedUser && (
                <CompanyCombobox
                  sites={sites}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-48"
                  testId="select-company-dashboard"
                />
              )}
              <SiteCombobox
                sites={isPrivilegedUser ? filteredSites : sites}
                value={selectedSiteId}
                onValueChange={setSelectedSiteId}
                className="w-48"
                testId="select-site-dashboard"
              />
            </>
          )}
        </div>
      </div>

      <OverallComplianceCard summaries={complianceSummaries} />

      {/* Renewal Compliance Section */}
      <Card data-testid="card-renewal-compliance-overview">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Renewal Compliance
            </CardTitle>
            <CardDescription>Documents approaching or past renewal dates across all modules</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-overview-renewals-overdue">{renewalMetrics.overdue}</p>
                <p className="text-sm text-muted-foreground">Overdue Renewals</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" data-testid="text-overview-renewals-30days">{renewalMetrics.due30Days}</p>
                <p className="text-sm text-muted-foreground">Due in 30 Days</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="text-overview-renewals-60days">{renewalMetrics.due60Days}</p>
                <p className="text-sm text-muted-foreground">Due in 60 Days</p>
              </div>
            </div>
          </div>
          
          {renewalMetrics.upcomingRenewals.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Documents Requiring Attention</h4>
              <div className="divide-y">
                {renewalMetrics.upcomingRenewals.slice(0, 5).map((doc) => {
                  const renewalDate = doc.renewalDate ? new Date(doc.renewalDate) : null;
                  const daysUntilRenewal = renewalDate 
                    ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  
                  // Determine module path for linking
                  const modulePath = doc.module === "health_safety" ? "/health-safety" 
                    : doc.module === "employment_law" ? "/employment-law" 
                    : doc.module === "human_resources" ? "/human-resources" 
                    : "/support";
                  
                  // Module badge color
                  const moduleBadgeClass = doc.module === "health_safety" 
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : doc.module === "employment_law"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
                    : doc.module === "human_resources"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300";
                  
                  const moduleLabel = doc.module === "health_safety" ? "H&S"
                    : doc.module === "employment_law" ? "EL"
                    : doc.module === "human_resources" ? "HR"
                    : "Support";
                  
                  return (
                    <Link 
                      key={doc.id} 
                      href={`${modulePath}/documents/${doc.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover-elevate rounded-md px-2 -mx-2"
                      data-testid={`link-overview-renewal-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <Badge variant="secondary" className={`text-xs shrink-0 ${moduleBadgeClass}`}>{moduleLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Renewal: {renewalDate && format(renewalDate, "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        daysUntilRenewal !== null && daysUntilRenewal < 0
                          ? "text-red-600 dark:text-red-400" 
                          : daysUntilRenewal !== null && daysUntilRenewal <= 30 
                          ? "text-amber-600 dark:text-amber-400" 
                          : "text-blue-600 dark:text-blue-400"
                      }`}>
                        {daysUntilRenewal !== null && daysUntilRenewal < 0 
                          ? `${Math.abs(daysUntilRenewal)}d overdue` 
                          : `${daysUntilRenewal}d remaining`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Compliance Modules</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {complianceSummaries.map((summary) => (
            summary.module === "employment_law" 
              ? <EmploymentLawCard key={summary.module} summary={summary} />
              : <ModuleCard key={summary.module} summary={summary} />
          ))}
          {lockedModules.map((m) => (
            <LockedModuleCard 
              key={m.module} 
              moduleName={m.name} 
              module={m.module}
            />
          ))}
        </div>
      </div>

      {/* Training section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Training</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <TrainingCard />
        </div>
      </div>

      {/* Support section - separate from compliance modules */}
      {(hasSupportAccess || isSupportLocked) && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Support</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {hasSupportAccess ? (
              <SupportCard />
            ) : (
              <LockedModuleCard 
                moduleName="Support" 
                module="support"
              />
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks across modules</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {hasActiveAccess("health_safety") && (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/health-safety/documents" data-testid="link-hs-documents">
                  <HardHat className="mr-2 h-4 w-4" />
                  H&S Documents
                </Link>
              </Button>
            )}
            {hasActiveAccess("human_resources") && (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/human-resources/documents" data-testid="link-hr-documents">
                  <Users className="mr-2 h-4 w-4" />
                  HR Documents
                </Link>
              </Button>
            )}
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/sites" data-testid="link-sites">
                <FileText className="mr-2 h-4 w-4" />
                Manage Sites
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/reports" data-testid="link-reports">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Reports
              </Link>
            </Button>
            {hasActiveAccess("employment_law") && (
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/employment-law" data-testid="link-el-cases">
                  <Scale className="mr-2 h-4 w-4" />
                  EL Cases
                </Link>
              </Button>
            )}
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
