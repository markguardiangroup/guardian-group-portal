import { useMemo, useState, useCallback, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Award,
  FileQuestion,
  XCircle,
  X,
  Briefcase,
  ShieldAlert,
} from "lucide-react";
import { format, differenceInDays, isFuture, isPast } from "date-fns";
import { Link, useLocation } from "wouter";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import type { ModuleSummary, ModuleType, SiteWithDetails, SupportRequest, Document, TrainingBooking, Incident, Case } from "@shared/schema";

interface DashboardData {
  moduleSummaries: ModuleSummary[];
}

function ModuleCard({ summary }: { summary: ModuleSummary }) {
  const isHS = summary.module === "health_safety";
  const isEL = summary.module === "employment_law";
  const isSupport = summary.module === "support";
  const isHR = summary.module === "human_resources";

  const Icon = isHS ? HardHat : isEL ? Scale : isSupport ? Headphones : Users;
  const basePath = isHS ? "/health-safety" : isEL ? "/employment-law" : isSupport ? "/support" : "/human-resources";
  const themeClass = isHS ? "theme-hs" : isEL ? "theme-el" : "theme-hr";

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
            <CardDescription>
              <CountUp value={summary.allDocuments ?? summary.totalDocuments} /> documents
            </CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-3xl font-bold ${getScoreColor(summary.complianceScore)}`}>
            <CountUp value={summary.complianceScore} />%
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-lg font-semibold"><CountUp value={summary.compliantDocuments} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Compliant</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-lg font-semibold"><CountUp value={summary.overdueDocuments + (summary.approvalRequired || 0)} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Not Compliant</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
              <FileQuestion className="h-4 w-4" />
              <span className="text-lg font-semibold"><CountUp value={summary.missingRequiredDocuments || 0} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Required Docs Missing</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Document Progress</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border p-2.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xl font-semibold text-foreground"><CountUp value={summary.allDocuments ?? summary.totalDocuments} /></span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xl font-semibold"><CountUp value={summary.allApprovalRequired ?? summary.approvalRequired} /></span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Approval Required</p>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xl font-semibold"><CountUp value={summary.pendingApprovals || 0} /></span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
            </div>
          </div>
        </div>

        <Button className={`w-full mt-auto ${buttonClass}`} variant="outline" asChild>
          <Link href={`${basePath}/sites`} data-testid={`link-module-${summary.module}`}>
            View Sites
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SupportCard({ siteId }: { siteId?: string | null }) {
  const { data: supportRequests = [] } = useQuery<SupportRequest[]>({
    queryKey: ["/api/support-requests", siteId],
    queryFn: async () => {
      const url = siteId ? `/api/support-requests?siteId=${siteId}` : "/api/support-requests";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch support requests");
      return response.json();
    },
  });

  const openRequests = supportRequests.filter(r => r.status === "open" || r.status === "in_progress").length;
  const resolvedRequests = supportRequests.filter(r => r.status === "resolved").length;
  const totalRequests = supportRequests.length;

  return (
    <Card className="hover-elevate border-t-4 border-t-slate-500 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-950/20" data-testid="card-module-support">
      <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 py-8 px-8">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/40">
            <Headphones className="h-8 w-8 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Support</h3>
            <p className="text-muted-foreground text-base">
              Need help with compliance? Our consultants are here to assist.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400">
              <MessageCircle className="h-6 w-6" />
              <span className="text-3xl font-bold"><CountUp value={openRequests} /></span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Open</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="h-6 w-6" />
              <span className="text-3xl font-bold"><CountUp value={resolvedRequests} /></span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Resolved</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400">
              <FileText className="h-6 w-6" />
              <span className="text-3xl font-bold"><CountUp value={totalRequests} /></span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Total</p>
          </div>
        </div>
        <Button size="lg" className="border-slate-500 text-slate-600 dark:text-slate-400 md:w-auto" variant="outline" asChild>
          <Link href="/support" data-testid="link-module-support">
            View Support
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface ActivityCardProps {
  siteId?: string | null;
  selectedCompany?: string | null;
  sites?: SiteWithDetails[];
  scopedSiteIds?: string[] | null;
}

function TrainingCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: ActivityCardProps) {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: trainingBookings = [] } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  const filteredBookings = useMemo(() => {
    if (siteId) return trainingBookings.filter(b => b.siteId === siteId);
    if (selectedCompany && selectedCompany !== "all") {
      const companySiteIds = sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
      return trainingBookings.filter(b => companySiteIds.includes(b.siteId as string));
    }
    if (scopedSiteIds && scopedSiteIds.length > 0) {
      return trainingBookings.filter(b => scopedSiteIds.includes(b.siteId as string));
    }
    return trainingBookings;
  }, [trainingBookings, siteId, selectedCompany, sites, scopedSiteIds]);

  const bookedCount = filteredBookings.filter(b => b.status === "booked").length;
  const completedCount = filteredBookings.filter(b => b.status === "completed").length;
  const certificatesCount = filteredBookings.filter(b => b.certificateId != null).length;
  const totalBookings = filteredBookings.length;

  return (
    <Card className="hover-elevate theme-training border-l-4 border-l-purple-400 bg-white dark:bg-card shadow-sm" data-testid="card-module-training">
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
            <CountUp value={bookedCount} />
          </span>
          <p className="text-xs text-muted-foreground">Booked</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
              <Award className="h-4 w-4" />
              <span className="text-lg font-semibold">{certificatesCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Certificates</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{completedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
        <Button className="w-full border-purple-500 text-purple-600 dark:text-purple-400" variant="outline" asChild>
          <Link href={isPrivilegedUser ? "/training/dashboard" : "/training/my-training"} data-testid="link-module-training">
            {isPrivilegedUser ? "Manage Training" : "View Training"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function IncidentsCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: ActivityCardProps) {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const filteredIncidents = useMemo(() => {
    if (siteId) return incidents.filter(i => i.siteId === siteId);
    if (selectedCompany && selectedCompany !== "all") {
      const companySiteIds = sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
      return incidents.filter(i => companySiteIds.includes(i.siteId as string));
    }
    if (scopedSiteIds && scopedSiteIds.length > 0) {
      return incidents.filter(i => scopedSiteIds.includes(i.siteId as string));
    }
    return incidents;
  }, [incidents, siteId, selectedCompany, sites, scopedSiteIds]);

  const activeCount = filteredIncidents.filter(i => i.status === "reported" || i.status === "under_review").length;
  const riddorCount = filteredIncidents.filter(i => i.riddorReportable).length;
  const openActionsCount = activeCount - riddorCount;
  const totalCount = filteredIncidents.length;

  return (
    <Card className="hover-elevate theme-hs border-l-4 border-l-emerald-400 bg-white dark:bg-card shadow-sm" data-testid="card-module-incidents">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-800/40">
            <ShieldAlert className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Incidents</CardTitle>
            <CardDescription>{totalCount} total · Health & Safety</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            <CountUp value={activeCount} />
          </span>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-semibold">{openActionsCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Open Actions</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-lg font-semibold">{riddorCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">RIDDOR</p>
          </div>
        </div>
        <Button className="w-full border-emerald-500 text-emerald-600 dark:text-emerald-400" variant="outline" asChild>
          <Link href="/health-safety/incidents" data-testid="link-module-incidents">
            {isPrivilegedUser ? "Manage Incidents" : "View Incidents"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CasesCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: ActivityCardProps) {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const filteredCases = useMemo(() => {
    if (siteId) return cases.filter(c => c.siteId === siteId);
    if (selectedCompany && selectedCompany !== "all") {
      const companySiteIds = sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
      return cases.filter(c => companySiteIds.includes(c.siteId as string));
    }
    if (scopedSiteIds && scopedSiteIds.length > 0) {
      return cases.filter(c => scopedSiteIds.includes(c.siteId as string));
    }
    return cases;
  }, [cases, siteId, selectedCompany, sites, scopedSiteIds]);

  const openCount = filteredCases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length;
  const activeCases = filteredCases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled");
  const overdueCount = activeCases.filter(c => {
    if (c.responseDeadline && isPast(new Date(c.responseDeadline))) return true;
    if (c.hearingDate && isPast(new Date(c.hearingDate))) return true;
    if ((c as any).overduesMilestoneDueDate) return true;
    return false;
  }).length;
  const upcomingCount = activeCases.filter(c => {
    if (c.responseDeadline && isFuture(new Date(c.responseDeadline)) && differenceInDays(new Date(c.responseDeadline), new Date()) <= 30) return true;
    if (c.hearingDate && isFuture(new Date(c.hearingDate)) && differenceInDays(new Date(c.hearingDate), new Date()) <= 30) return true;
    if ((c as any).upcomingMilestoneDueDate && isFuture(new Date((c as any).upcomingMilestoneDueDate)) && differenceInDays(new Date((c as any).upcomingMilestoneDueDate), new Date()) <= 30) return true;
    return false;
  }).length;
  const totalCount = filteredCases.length;

  return (
    <Card className="hover-elevate theme-el border-l-4 border-l-pink-400 bg-white dark:bg-card shadow-sm" data-testid="card-module-cases">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-800/40">
            <Briefcase className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Cases</CardTitle>
            <CardDescription>{totalCount} total · Employment Law</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-pink-600 dark:text-pink-400">
            <CountUp value={openCount} />
          </span>
          <p className="text-xs text-muted-foreground">Open</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-lg font-semibold">{overdueCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-lg font-semibold">{upcomingCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </div>
        <Button className="w-full border-pink-500 text-pink-600 dark:text-pink-400" variant="outline" asChild>
          <Link href="/employment-law/cases" data-testid="link-module-cases">
            {isPrivilegedUser ? "Manage Cases" : "View Cases"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface SiteComplianceSummary {
  totalDocuments: number;
  compliantDocuments: number;
  approvalRequired: number;
  overdueDocuments: number;
  missingRequiredDocuments?: number;
  complianceScore: number;
  allDocuments?: number;
  allCompliantDocuments?: number;
  allApprovalRequired?: number;
  allOverdueDocuments?: number;
  pendingApprovals?: number;
  awaitingYourApproval?: number;
  awaitingOthersApproval?: number;
}

function OverallComplianceCard({
  summaries,
  siteComplianceSummary,
  disabledModules,
  isClient,
}: {
  summaries: ModuleSummary[];
  siteComplianceSummary?: SiteComplianceSummary | null;
  disabledModules?: Set<string>;
  isClient?: boolean;
}) {
  const activeSummaries = disabledModules?.size ? summaries.filter(s => !disabledModules.has(s.module)) : summaries;
  const compliantDocs = siteComplianceSummary?.compliantDocuments ?? activeSummaries.reduce((acc, s) => acc + s.compliantDocuments, 0);
  const overdueDocs = siteComplianceSummary?.overdueDocuments ?? activeSummaries.reduce((acc, s) => acc + s.overdueDocuments, 0);
  const approvalRequiredSlots = siteComplianceSummary?.approvalRequired ?? activeSummaries.reduce((acc, s) => acc + (s.approvalRequired || 0), 0);
  const missingDocs = siteComplianceSummary?.missingRequiredDocuments ?? activeSummaries.reduce((acc, s) => acc + (s.missingRequiredDocuments || 0), 0);
  const complianceDenominator = compliantDocs + approvalRequiredSlots + overdueDocs + missingDocs;
  const overallScore = siteComplianceSummary?.complianceScore ?? (complianceDenominator > 0 ? Math.round((compliantDocs / complianceDenominator) * 100) : 0);
  const awaitingYourApproval = siteComplianceSummary?.awaitingYourApproval ?? summaries.reduce((acc, s) => acc + (s.awaitingYourApproval || 0), 0);
  const awaitingOthersApproval = siteComplianceSummary?.awaitingOthersApproval ?? summaries.reduce((acc, s) => acc + (s.awaitingOthersApproval || 0), 0);

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

  const moduleConfig: {
    module: string; label: string; icon: React.ReactNode;
    scoreColor: (s: number) => string; barColor: (s: number) => string;
    leftBorder: string; avatarBg: string; avatarText: string; tileBg: string;
    siteUrl: string; linkColor: string;
  }[] = [
    {
      module: "health_safety",
      label: "Health & Safety",
      icon: <HardHat className="h-4 w-4" />,
      scoreColor: (s) => s >= 90 ? "text-emerald-600 dark:text-emerald-400" : s >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
      barColor: (s) => s >= 90 ? "bg-emerald-500" : s >= 70 ? "bg-amber-500" : "bg-red-500",
      leftBorder: "border-l-4 border-l-emerald-500",
      avatarBg: "bg-emerald-500",
      avatarText: "text-white",
      tileBg: "bg-emerald-50 dark:bg-emerald-950/20",
      siteUrl: "/health-safety/sites",
      linkColor: "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300",
    },
    {
      module: "human_resources",
      label: "Human Resources",
      icon: <Users className="h-4 w-4" />,
      scoreColor: (s) => s >= 90 ? "text-emerald-600 dark:text-emerald-400" : s >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
      barColor: (s) => s >= 90 ? "bg-emerald-500" : s >= 70 ? "bg-amber-500" : "bg-red-500",
      leftBorder: "border-l-4 border-l-blue-500",
      avatarBg: "bg-blue-500",
      avatarText: "text-white",
      tileBg: "bg-blue-50 dark:bg-blue-950/20",
      siteUrl: "/human-resources/sites",
      linkColor: "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
    },
    {
      module: "employment_law",
      label: "Employment Law",
      icon: <Scale className="h-4 w-4" />,
      scoreColor: (s) => s >= 90 ? "text-emerald-600 dark:text-emerald-400" : s >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
      barColor: (s) => s >= 90 ? "bg-emerald-500" : s >= 70 ? "bg-amber-500" : "bg-red-500",
      leftBorder: "border-l-4 border-l-pink-500",
      avatarBg: "bg-pink-500",
      avatarText: "text-white",
      tileBg: "bg-pink-50 dark:bg-pink-950/20",
      siteUrl: "/employment-law/sites",
      linkColor: "text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300",
    },
  ];

  return (
    <Card data-testid="card-overall-compliance" className="border-t-4 border-t-module-accent bg-module-accent-subtle">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Overall Compliance Across All Modules</CardTitle>
            <CardDescription>Based on required documents only</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-end gap-3">
          <span className={`text-6xl font-bold ${getScoreColor(overallScore)}`} data-testid="text-overall-score">
            <CountUp value={Math.round(overallScore)} />%
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

        <div className="grid grid-cols-3 gap-3">
          {moduleConfig.map((mc) => {
            const isDisabled = disabledModules?.has(mc.module);
            if (isDisabled) {
              return (
                <div key={mc.module} className={`rounded-md border border-dashed border-border ${mc.tileBg} p-3 opacity-60`} data-testid={`stat-module-${mc.module}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${mc.avatarBg} opacity-40 ${mc.avatarText} shrink-0`}>
                      {mc.icon}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground leading-tight">{mc.label}</span>
                    <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  </div>
                  <div className="flex items-center justify-center h-12">
                    <p className="text-xs text-muted-foreground text-center">
                      {isClient ? "This module is not enabled" : "This module is not active"}
                    </p>
                  </div>
                </div>
              );
            }
            const summary = summaries.find(s => s.module === mc.module);
            const score = summary?.complianceScore ?? 0;
            const docs = summary?.allDocuments ?? 0;
            return (
              <div key={mc.module} className={`rounded-md border border-border ${mc.leftBorder} ${mc.tileBg} p-3`} data-testid={`stat-module-${mc.module}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-md ${mc.avatarBg} ${mc.avatarText} shrink-0`}>
                    {mc.icon}
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-tight">{mc.label}</span>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <span className={`text-2xl font-bold ${mc.scoreColor(score)}`}>
                    <CountUp value={score} />%
                  </span>
                  <span className="text-xs text-muted-foreground">{docs} doc{docs !== 1 ? "s" : ""}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full transition-all ${mc.barColor(score)}`} style={{ width: `${score}%` }} />
                </div>
                <div className="mt-1.5 text-center">
                  <Link href={mc.siteUrl} className={`text-xs font-medium inline-flex items-center gap-0.5 transition-colors ${mc.linkColor}`} data-testid={`link-module-sites-${mc.module}`}>
                    View Site Documents <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
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

export default function Dashboard2() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter();
  const [, navigate] = useLocation();

  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isProConsultant = user?.role === "consultant" && user?.consultantTier === "pro";
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter } = useCoverageFilter();

  const [staffFilter, setStaffFilter] = useState("my");

  const { data: myStaff = [] } = useQuery<{ id: string; fullName: string }[]>({
    queryKey: ["/api/consultants/my-staff"],
    enabled: isProConsultant,
  });

  const sitesUrl = isProConsultant
    ? staffFilter === "my"
      ? "/api/sites?myAssigned=true"
      : staffFilter === "all"
      ? "/api/sites"
      : `/api/sites?staffId=${staffFilter}`
    : hasCoverage && coverageFilter !== "my"
    ? `/api/sites?staffId=${coverageFilter}`
    : "/api/sites";

  const { data: sites } = useQuery<SiteWithDetails[]>({
    queryKey: isProConsultant
      ? ["/api/sites", staffFilter]
      : coverageFilter !== "my"
      ? ["/api/sites", "coverage", coverageFilter]
      : ["/api/sites", null],
    queryFn: async () => {
      const res = await fetch(sitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sites");
      return res.json();
    },
  });

  const clientHasSites = isClientUser && sites && sites.length > 0;

  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && siteId !== "all" && sites) {
      const site = sites.find(s => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites, setSelectedSiteId, setSelectedCompany]);

  useEffect(() => {
    if (!sites || !selectedSiteId || selectedSiteId === "all" || selectedCompany) return;
    const site = sites.find(s => s.id === selectedSiteId);
    if (site?.companyName) setSelectedCompany(site.companyName);
  }, [sites, selectedSiteId, selectedCompany, setSelectedCompany]);

  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const companySiteIds = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return null;
    return sites.filter(s => s.companyName === selectedCompany).map(s => s.id);
  }, [sites, selectedCompany]);

  const companySiteIdsKey = companySiteIds?.join(",") || null;

  const staffSiteIds = useMemo(() => {
    if (!isProConsultant || staffFilter === "all" || !sites) return null;
    return sites.map(s => s.id);
  }, [isProConsultant, staffFilter, sites]);

  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
  const scopedSiteIds = companySiteIds ?? staffSiteIds;
  const scopedSiteIdsKey = scopedSiteIds?.join(",") || null;

  const { data: moduleSummaries } = useQuery<ModuleSummary[]>({
    queryKey: ["/api/modules/summary", siteId, scopedSiteIdsKey, isClientUser],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let url = "/api/modules/summary";
      if (siteId) {
        url = `/api/modules/summary?siteId=${siteId}`;
      } else if (scopedSiteIds && scopedSiteIds.length > 0) {
        url = `/api/modules/summary?siteIds=${scopedSiteIds.join(",")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents", siteId, scopedSiteIdsKey],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let url = "/api/documents";
      if (siteId) {
        url = `/api/documents?siteId=${siteId}`;
      } else if (scopedSiteIds && scopedSiteIds.length > 0) {
        url = `/api/documents?siteIds=${scopedSiteIds.join(",")}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const renewalMetrics = useMemo(() => {
    if (!allDocuments) return { overdue: 0, due30Days: 0, due60Days: 0, upcomingRenewals: [] as Document[] };

    const now = new Date();
    let overdue = 0;
    let due30Days = 0;
    let due60Days = 0;
    const upcomingRenewals: Document[] = [];

    allDocuments.forEach((doc) => {
      if (doc.isArchived || doc.caseId || (doc as any).incidentId || (doc as any).source === "external") return;

      if (doc.status === "overdue") {
        overdue++;
        upcomingRenewals.push(doc);
        return;
      }

      const trackingDate = doc.renewalDate || doc.expiryDate;
      if (!trackingDate) return;

      const renewalDate = new Date(trackingDate);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 30) {
        due30Days++;
        upcomingRenewals.push(doc);
      } else if (daysUntilRenewal > 30 && daysUntilRenewal <= 60) {
        due60Days++;
        upcomingRenewals.push(doc);
      }
    });

    upcomingRenewals.sort((a, b) => {
      const trackA = a.renewalDate || a.expiryDate;
      const trackB = b.renewalDate || b.expiryDate;
      const dateA = trackA ? new Date(trackA).getTime() : Infinity;
      const dateB = trackB ? new Date(trackB).getTime() : Infinity;
      return dateA - dateB;
    });

    return { overdue, due30Days, due60Days, upcomingRenewals };
  }, [allDocuments]);

  const [renewalMetricDialog, setRenewalMetricDialog] = useState<null | "overdue" | "due30" | "due60">(null);

  const { hasActiveAccess, isHidden } = useModuleAccess();

  const contextCompany = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyName || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    return null;
  }, [selectedSiteId, selectedCompany, sites]);

  const contextSite = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") return "All Sites";
    return "All Sites";
  }, [selectedSiteId, selectedCompany, sites]);

  const selectedSiteComplianceSummary = useMemo(() => {
    if (!siteId || !sites) return null;
    const selectedSite = sites.find(s => s.id === siteId);
    return selectedSite?.complianceSummary || null;
  }, [siteId, sites]);

  const complianceModules: { module: ModuleType; name: string }[] = [
    { module: "health_safety", name: "Health & Safety" },
    { module: "human_resources", name: "Human Resources" },
    { module: "employment_law", name: "Employment Law" },
  ];

  const summaries = moduleSummaries || [];
  const realComplianceSummaries = summaries.filter(s => s.module !== "support" && hasActiveAccess(s.module));
  const lockedModules = complianceModules.filter(m => !hasActiveAccess(m.module));

  const placeholderComplianceSummaries: ModuleSummary[] = useMemo(() => {
    if (moduleSummaries) return [];
    return complianceModules
      .filter(m => hasActiveAccess(m.module))
      .map(m => ({
        module: m.module,
        moduleName: m.name,
        totalDocuments: 0,
        compliantDocuments: 0,
        approvalRequired: 0,
        overdueDocuments: 0,
        missingRequiredDocuments: 0,
        pendingApprovals: 0,
        complianceScore: 0,
        allDocuments: 0,
        allCompliantDocuments: 0,
        allApprovalRequired: 0,
        allOverdueDocuments: 0,
        awaitingYourApproval: 0,
        awaitingOthersApproval: 0,
      } as ModuleSummary));
  }, [moduleSummaries, hasActiveAccess]);

  const complianceSummaries = moduleSummaries ? realComplianceSummaries : placeholderComplianceSummaries;

  // Determine which compliance modules are disabled in the current context.
  // For a specific site: use the site's moduleAccess (covers consultant/admin viewing a client's site).
  // For client users with no site selected: use their own module access from the hook.
  const disabledComplianceModules = useMemo(() => {
    const modules = ["health_safety", "human_resources", "employment_law"];
    if (siteId && sites) {
      const sel = sites.find((s) => s.id === siteId);
      if (sel?.moduleAccess) {
        return new Set(modules.filter(m => (sel.moduleAccess as Record<string, string>)[m] === "hidden"));
      }
    }
    if (isClientUser) {
      return new Set(modules.filter(m => isHidden(m as ModuleType)));
    }
    return new Set<string>();
  }, [siteId, sites, isClientUser, isHidden]);

  const hasSupportAccess = hasActiveAccess("support");
  const isSupportLocked = !hasSupportAccess;
  const showContentSkeleton = isAuthLoading;

  return (
    <div className="theme-dashboard flex flex-col h-full">
      {/* Header */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <Shield className="h-7 w-7 text-white dark:text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Compliance
                <span className="font-normal text-muted-foreground text-2xl"> - Overview</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                {isPrivilegedUser && (
                  <span className="font-semibold text-foreground">{contextCompany || "All Companies"}</span>
                )}
                {!isPrivilegedUser && contextCompany && (
                  <span className="font-semibold text-foreground">{contextCompany}</span>
                )}
                {(isPrivilegedUser || contextCompany) && contextSite && <span> - </span>}
                {contextSite && <span>{contextSite}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isProConsultant && (
              <Select
                value={staffFilter}
                onValueChange={(v) => {
                  setStaffFilter(v);
                  resetFilters();
                }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-staff-filter-dashboard">
                  <span className="truncate pointer-events-none">
                    {staffFilter === "my"
                      ? "My client sites"
                      : staffFilter === "all"
                      ? "All companies"
                      : (myStaff.find((s) => s.id === staffFilter)?.fullName
                          ?? coveringFor.find(c => c.absentConsultantId === staffFilter)?.absentConsultantName
                          ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {myStaff.map(s => (
                    <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-dashboard-${s.id}`}>
                      {s.fullName}'s client sites
                    </SelectItem>
                  ))}
                  {coveringFor
                    .filter(c => !myStaff.some(s => s.id === c.absentConsultantId))
                    .map(c => (
                      <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`staff-filter-dashboard-coverage-${c.absentConsultantId}`}>
                        {c.absentConsultantName}'s client sites
                      </SelectItem>
                    ))}
                  <SelectItem value="all">All companies</SelectItem>
                </SelectContent>
              </Select>
            )}
            {hasCoverage && (
              <Select
                value={coverageFilter}
                onValueChange={(v) => { setCoverageFilter(v); resetFilters(); }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-dashboard">
                  <span className="truncate pointer-events-none">
                    {coverageFilter === "my"
                      ? "My client sites"
                      : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {coveringFor.map(c => (
                    <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-dashboard-${c.absentConsultantId}`}>
                      {c.absentConsultantName}'s client sites
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(isPrivilegedUser || clientHasSites) && sites && sites.length > 0 && (
              <>
                {((selectedCompany && selectedCompany !== "all") || (selectedSiteId && selectedSiteId !== "all")) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    data-testid="button-clear-filters-dashboard"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {isPrivilegedUser && (
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-[205px] text-sm"
                    testId="select-company-dashboard"
                  />
                )}
                <SiteCombobox
                  sites={isPrivilegedUser ? filteredSites : sites}
                  value={selectedSiteId}
                  onValueChange={handleSiteChange}
                  className="w-[205px] text-sm"
                  testId="select-site-dashboard"
                  disabled={isPrivilegedUser && (!selectedCompany || selectedCompany === "all")}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto space-y-8 p-8 dash-animate">
        {showContentSkeleton ? (
          <FetchingOverlay />
        ) : (
          <>
            <OverallComplianceCard
              summaries={complianceSummaries}
              siteComplianceSummary={selectedSiteComplianceSummary}
              disabledModules={disabledComplianceModules}
              isClient={isClientUser}
            />

            {/* Overdue Status Section */}
            <Card data-testid="card-renewal-compliance-overview" className="border-t-4 border-t-module-accent bg-module-accent-subtle">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Overdue Status
                </CardTitle>
                <CardDescription>Documents approaching or past renewal dates across all modules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <button onClick={() => setRenewalMetricDialog("overdue")} className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-overdue">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/20">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-red-600 dark:text-red-400" data-testid="text-overview-renewals-overdue"><CountUp value={renewalMetrics.overdue} /></p>
                      <p className="text-sm text-muted-foreground">Overdue Renewals</p>
                    </div>
                  </button>
                  <button onClick={() => setRenewalMetricDialog("due30")} className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-30days">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/20">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400" data-testid="text-overview-renewals-30days"><CountUp value={renewalMetrics.due30Days} /></p>
                      <p className="text-sm text-muted-foreground">Due in 30 Days</p>
                    </div>
                  </button>
                  <button onClick={() => setRenewalMetricDialog("due60")} className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer text-left" data-testid="button-renewals-60days">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/20">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400" data-testid="text-overview-renewals-60days"><CountUp value={renewalMetrics.due60Days} /></p>
                      <p className="text-sm text-muted-foreground">Due in 60 Days</p>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>

            <Dialog open={renewalMetricDialog !== null} onOpenChange={(open) => { if (!open) setRenewalMetricDialog(null); }}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {renewalMetricDialog === "overdue" && <><AlertTriangle className="h-5 w-5 text-red-600" /> Overdue Renewals</>}
                    {renewalMetricDialog === "due30" && <><Clock className="h-5 w-5 text-amber-600" /> Due in 30 Days</>}
                    {renewalMetricDialog === "due60" && <><Calendar className="h-5 w-5 text-blue-600" /> Due in 60 Days</>}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {(() => {
                    const docs = renewalMetrics.upcomingRenewals.filter(doc => {
                      const trackingDate = doc.renewalDate || doc.expiryDate;
                      const renewalDate = trackingDate ? new Date(trackingDate) : null;
                      const daysUntilRenewal = renewalDate ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

                      if (renewalMetricDialog === "overdue") return doc.status === "overdue";
                      if (renewalMetricDialog === "due30") return daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
                      if (renewalMetricDialog === "due60") return daysUntilRenewal !== null && daysUntilRenewal > 30 && daysUntilRenewal <= 60;
                      return false;
                    });

                    if (docs.length === 0) {
                      return <div className="py-8 text-center text-muted-foreground text-sm">No documents to display.</div>;
                    }

                    return docs.map(doc => {
                      const trackingDate = doc.renewalDate || doc.expiryDate;
                      const renewalDate = trackingDate ? new Date(trackingDate) : null;
                      const daysUntilRenewal = renewalDate
                        ? Math.ceil((renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;

                      const moduleBadgeClass = doc.module === "health_safety" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : doc.module === "employment_law" ? "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
                        : doc.module === "human_resources" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300";

                      const moduleLabel = doc.module === "health_safety" ? "H&S"
                        : doc.module === "employment_law" ? "EL"
                        : doc.module === "human_resources" ? "HR"
                        : "Support";

                      const modulePath = doc.module === "health_safety" ? "/health-safety"
                        : doc.module === "employment_law" ? "/employment-law"
                        : doc.module === "human_resources" ? "/human-resources"
                        : "/support";

                      const docSite = sites?.find(s => s.id === doc.siteId);

                      const statusLabel = daysUntilRenewal !== null && daysUntilRenewal < 0
                        ? `${Math.abs(daysUntilRenewal)}d overdue`
                        : daysUntilRenewal !== null
                        ? `${daysUntilRenewal}d remaining`
                        : null;

                      const statusColor = daysUntilRenewal !== null && daysUntilRenewal < 0
                        ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                        : daysUntilRenewal !== null && daysUntilRenewal <= 30
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";

                      return (
                        <div
                          key={doc.id}
                          className="flex items-start justify-between gap-4 p-3 border rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
                          onClick={() => {
                            setRenewalMetricDialog(null);
                            if (docSite) setSelectedCompany(docSite.companyName || null);
                            navigate(`${modulePath}/documents/${doc.id}`);
                          }}
                          data-testid={`link-renewal-dialog-doc-${doc.id}`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-medium truncate">{doc.title}</p>
                              {docSite && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {docSite.companyName} — {docSite.name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {doc.renewalDate ? "Renewal" : "Expires"}: {renewalDate && format(renewalDate, "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge variant="secondary" className={moduleBadgeClass}>{moduleLabel}</Badge>
                            {statusLabel && (
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${statusColor}`}>
                                {statusLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </DialogContent>
            </Dialog>

            {/* Activity section */}
            <div className="rounded-2xl bg-primary/[0.04] dark:bg-primary/[0.09] border border-primary/20 dark:border-primary/25 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold leading-none">Activity</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Operational data — separate from compliance scoring</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Live</span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {hasActiveAccess("health_safety") ? (
                  <IncidentsCard siteId={siteId} selectedCompany={selectedCompany} sites={sites} scopedSiteIds={scopedSiteIds} />
                ) : (
                  <div />
                )}
                <TrainingCard siteId={siteId} selectedCompany={selectedCompany} sites={sites} scopedSiteIds={scopedSiteIds} />
                {hasActiveAccess("employment_law") ? (
                  <CasesCard siteId={siteId} selectedCompany={selectedCompany} sites={sites} scopedSiteIds={scopedSiteIds} />
                ) : (
                  <div />
                )}
              </div>
            </div>

            {/* Support section */}
            {(hasSupportAccess || isSupportLocked) && (
              <div>
                <h2 className="mb-4 text-xl font-semibold">Support</h2>
                {hasSupportAccess ? (
                  <SupportCard siteId={siteId} />
                ) : (
                  <LockedModuleCard
                    moduleName="Support"
                    module="support"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
