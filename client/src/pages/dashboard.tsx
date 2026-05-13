import { useMemo, useState, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ModuleSummary, ModuleType, SiteWithDetails, SupportRequest, Document, TrainingBooking, Incident, Case } from "@shared/schema";

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

        {/* Compliance stats: Compliant | Not Compliant | Docs Missing */}
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

        {/* Document Progress — styled to match the overall document progress tile */}
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
        {/* Left: Icon and title */}
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

        {/* Center: Metrics */}
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

        {/* Right: Button */}
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

interface TrainingCardProps {
  siteId?: string | null;
  selectedCompany?: string | null;
  sites?: SiteWithDetails[];
  scopedSiteIds?: string[] | null;
}

function TrainingCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: TrainingCardProps) {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  const { data: trainingBookings = [] } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  // Filter bookings based on selected site or company
  const filteredBookings = useMemo(() => {
    if (siteId) {
      return trainingBookings.filter(b => b.siteId === siteId);
    }
    if (selectedCompany && selectedCompany !== "all") {
      const companySiteIds = sites
        .filter(s => s.companyName === selectedCompany)
        .map(s => s.id);
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

function IncidentsCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: TrainingCardProps) {
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

function CasesCard({ siteId, selectedCompany, sites = [], scopedSiteIds }: TrainingCardProps) {
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

interface MissingRequiredTemplateDetail {
  templateId: string;
  templateName: string;
  module: string;
  requiresApproval: boolean;
  siteId: string;
  siteName: string;
  companyId: string;
  documentId?: string;
  documentStatus?: string;
  kind?: "template_slot" | "required_document";
  companyName: string;
}

type DocsDialogType = "compliant" | "non_compliant" | "overdue" | "total" | "all_compliant" | "all_review" | "all_overdue" | null;

function OverallComplianceCard({ 
  summaries, 
  siteComplianceSummary,
  missingRequiredDetails,
  isMissingLoading,
  allDocuments,
  sites,
  variant,
}: { 
  summaries: ModuleSummary[];
  siteComplianceSummary?: SiteComplianceSummary | null;
  missingRequiredDetails?: MissingRequiredTemplateDetail[];
  isMissingLoading?: boolean;
  allDocuments?: Document[];
  sites?: Array<{ id: string; name: string; companyName?: string | null }>;
  variant?: "modules";
}) {
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [docsDialog, setDocsDialog] = useState<DocsDialogType>(null);
  const [, navigate] = useLocation();
  // Slot-based compliance (required docs)
  const compliantDocs = siteComplianceSummary?.compliantDocuments ?? summaries.reduce((acc, s) => acc + s.compliantDocuments, 0);
  const overdueDocs = siteComplianceSummary?.overdueDocuments ?? summaries.reduce((acc, s) => acc + s.overdueDocuments, 0);
  const approvalRequiredSlots = siteComplianceSummary?.approvalRequired ?? summaries.reduce((acc, s) => acc + (s.approvalRequired || 0), 0);
  const missingDocs = siteComplianceSummary?.missingRequiredDocuments ?? summaries.reduce((acc, s) => acc + (s.missingRequiredDocuments || 0), 0);
  const complianceDenominator = compliantDocs + approvalRequiredSlots + overdueDocs + missingDocs;
  const overallScore = siteComplianceSummary?.complianceScore ?? (complianceDenominator > 0 ? Math.round((compliantDocs / complianceDenominator) * 100) : 0);
  // All-document progress stats
  const allDocs = siteComplianceSummary?.allDocuments ?? summaries.reduce((acc, s) => acc + (s.allDocuments ?? s.totalDocuments), 0);
  const allCompliant = siteComplianceSummary?.allCompliantDocuments ?? summaries.reduce((acc, s) => acc + (s.allCompliantDocuments ?? s.compliantDocuments), 0);
  const reviewDocs = siteComplianceSummary?.allApprovalRequired ?? summaries.reduce((acc, s) => acc + (s.allApprovalRequired ?? s.approvalRequired), 0);
  const allOverdue = siteComplianceSummary?.allOverdueDocuments ?? summaries.reduce((acc, s) => acc + (s.allOverdueDocuments ?? s.overdueDocuments), 0);
  const pendingApprovals = siteComplianceSummary?.pendingApprovals ?? summaries.reduce((acc, s) => acc + s.pendingApprovals, 0);
  const awaitingYourApproval = siteComplianceSummary?.awaitingYourApproval ?? summaries.reduce((acc, s) => acc + (s.awaitingYourApproval || 0), 0);
  const awaitingOthersApproval = siteComplianceSummary?.awaitingOthersApproval ?? summaries.reduce((acc, s) => acc + (s.awaitingOthersApproval || 0), 0);

  const moduleLabels: Record<string, string> = {
    health_safety: "Health & Safety",
    human_resources: "Human Resources",
    employment_law: "Employment Law",
  };

  const groupedMissing = useMemo(() => {
    if (!missingRequiredDetails) return {};
    const groups: Record<string, MissingRequiredTemplateDetail[]> = {};
    for (const item of missingRequiredDetails) {
      if (!groups[item.module]) groups[item.module] = [];
      groups[item.module].push(item);
    }
    return groups;
  }, [missingRequiredDetails]);

  const siteNameMap = useMemo(() => {
    const map: Record<string, { name: string; companyName?: string | null }> = {};
    if (sites) sites.forEach(s => { map[s.id] = { name: s.name, companyName: s.companyName }; });
    return map;
  }, [sites]);

  const modulePathMap: Record<string, string> = {
    health_safety: "/health-safety",
    human_resources: "/human-resources",
    employment_law: "/employment-law",
    training: "/training",
    support: "/support",
  };

  const moduleColorMap: Record<string, string> = {
    health_safety: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    human_resources: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    employment_law: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    training: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    support: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  const statusColorMap: Record<string, string> = {
    compliant: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    approval_required: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  // The compliance boxes (Compliant / Not Compliant) count only docs from the
  // three compliance modules, excluding archived and case documents — this must
  // match what computeSlotBasedCompliance does on the server.
  const COMPLIANCE_MODULES = ["health_safety", "human_resources", "employment_law"];
  const isComplianceDoc = (d: Document) =>
    !d.isArchived && !d.caseId && COMPLIANCE_MODULES.includes(d.module as string);

  // The Document Progress card counts regular module folder documents only.
  // Excludes: archived, case docs (EL), incident docs (H&S), cloud share (external uploads).
  const isProgressDoc = (d: Document) => !d.isArchived && !d.caseId && !d.incidentId && d.source !== "external";

  const dialogMeta: Record<NonNullable<DocsDialogType>, { title: string; filter: (d: Document) => boolean }> = {
    compliant: {
      title: "Compliant Required Documents",
      filter: (d) => isComplianceDoc(d) && !!d.isRequired && d.status === "compliant",
    },
    non_compliant: {
      title: "Not Compliant (Required Documents)",
      filter: (d) => isComplianceDoc(d) && !!d.isRequired && (d.status === "overdue" || d.status === "approval_required"),
    },
    overdue: {
      title: "Overdue Required Documents",
      filter: (d) => isComplianceDoc(d) && !!d.isRequired && d.status === "overdue",
    },
    total: {
      title: "All Documents",
      filter: (d) => isProgressDoc(d),
    },
    all_compliant: {
      title: "Complete Documents",
      filter: (d) => {
        if (!isProgressDoc(d) || d.status !== "compliant") return false;
        const now = new Date();
        if (d.expiryDate && new Date(d.expiryDate) < now) return false;
        return true;
      },
    },
    all_review: {
      title: "Approval Required Documents",
      filter: (d) => {
        if (!isProgressDoc(d) || d.status !== "approval_required") return false;
        const now = new Date();
        if (d.expiryDate && new Date(d.expiryDate) < now) return false;
        return true;
      },
    },
    all_overdue: {
      title: "Overdue Documents",
      filter: (d) => {
        if (!isProgressDoc(d)) return false;
        if (d.status === "overdue") return true;
        const now = new Date();
        if (d.expiryDate && new Date(d.expiryDate) < now) return true;
        return false;
      },
    },
  };

  const docsDialogDocs = useMemo(() => {
    if (!docsDialog || !allDocuments) return [];
    return allDocuments.filter(dialogMeta[docsDialog].filter);
  }, [docsDialog, allDocuments]);

  function openDocs(type: DocsDialogType) {
    if (!allDocuments || allDocuments.length === 0) return;
    setDocsDialog(type);
  }

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
    <>
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

        {/* Compliance stats: required docs only */}
        {variant === "modules" ? (() => {
          const moduleConfig: { module: string; label: string; shortLabel: string; icon: React.ReactNode; scoreColor: (s: number) => string; barColor: (s: number) => string; leftBorder: string; avatarBg: string; avatarText: string; tileBg: string; siteUrl: string; linkColor: string }[] = [
            {
              module: "health_safety",
              label: "Health & Safety",
              shortLabel: "H&S",
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
              shortLabel: "HR",
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
              shortLabel: "EL",
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
            <div className="grid grid-cols-3 gap-3">
              {moduleConfig.map((mc) => {
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
          );
        })() : (() => {
          const nonCompliantDocs = overdueDocs + approvalRequiredSlots;
          return (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => openDocs("compliant")}
                className={`rounded-md border p-3 text-center w-full transition-colors ${allDocuments && allDocuments.length > 0 && compliantDocs > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                data-testid="button-stat-compliant"
              >
                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-2xl font-semibold"><CountUp value={compliantDocs} /></span>
                </div>
                <p className="text-xs text-muted-foreground">Compliant</p>
                {compliantDocs > 0 && <p className="text-xs text-emerald-500/70 mt-0.5">Click to view</p>}
              </button>
              <button
                onClick={() => nonCompliantDocs > 0 && openDocs("non_compliant")}
                className={`rounded-md border p-3 text-center w-full transition-colors ${allDocuments && allDocuments.length > 0 && nonCompliantDocs > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                data-testid="button-stat-non-compliant"
              >
                <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-2xl font-semibold"><CountUp value={nonCompliantDocs} /></span>
                </div>
                <p className="text-xs text-muted-foreground">Not Compliant</p>
                {nonCompliantDocs > 0 && <p className="text-xs text-red-500/70 mt-0.5">Click to view</p>}
              </button>
              <button
                onClick={() => missingDocs > 0 && setShowMissingDialog(true)}
                className={`rounded-md border p-3 text-center w-full transition-colors ${missingDocs > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                data-testid="button-stat-docs-missing"
              >
                <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                  <FileQuestion className="h-4 w-4" />
                  <span className="text-2xl font-semibold"><CountUp value={missingDocs} /></span>
                </div>
                <p className="text-xs text-muted-foreground">Required Docs Missing</p>
                {missingDocs > 0 && <p className="text-xs text-orange-500/70 mt-0.5">Click to view</p>}
              </button>
            </div>
          );
        })()}

        {/* Shared document-list dialog */}
        <Dialog open={docsDialog !== null} onOpenChange={(open) => { if (!open) setDocsDialog(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="dialog-docs-list">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {docsDialog ? dialogMeta[docsDialog].title : ""} ({docsDialogDocs.length})
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {docsDialogDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No documents to display.</p>
              ) : (
                <>
                  {docsDialogDocs.map((doc) => {
                    const site = doc.siteId ? siteNameMap[doc.siteId] : null;
                    const modulePath = modulePathMap[doc.module] || "/";
                    const modLabel = moduleLabels[doc.module] || doc.module;
                    const statusLabel = doc.status === "approval_required" ? "Approval Required" : doc.status === "overdue" ? "Overdue" : "Compliant";
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-md border p-3 gap-3 hover:bg-muted/40 cursor-pointer"
                        onClick={() => { setDocsDialog(null); navigate(`${modulePath}/documents/${doc.id}`); }}
                        data-testid={`row-doc-${doc.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {site ? `${site.name}${site.companyName ? ` — ${site.companyName}` : ""}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${moduleColorMap[doc.module] || "bg-muted text-muted-foreground"}`}>
                            {modLabel}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColorMap[doc.status] || "bg-muted text-muted-foreground"}`}>
                            {statusLabel}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showMissingDialog} onOpenChange={setShowMissingDialog}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-missing-required">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5 text-orange-500" />
                Missing Required Documents
              </DialogTitle>
            </DialogHeader>
            {isMissingLoading ? (
              <FetchingOverlay />
            ) : Object.keys(groupedMissing).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No missing required documents found.</p>
            ) : (
              <Tabs defaultValue={Object.keys(groupedMissing)[0]} className="w-full">
                <TabsList className="w-full">
                  {Object.keys(groupedMissing).map(mod => (
                    <TabsTrigger key={mod} value={mod} className="flex-1 text-xs" data-testid={`tab-missing-${mod}`}>
                      {moduleLabels[mod] || mod} ({groupedMissing[mod].length})
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(groupedMissing).map(([mod, items]) => (
                  <TabsContent key={mod} value={mod} className="mt-4 space-y-2">
                    {items.map((item, idx) => {
                      const modPath = modulePathMap[mod] || "/";
                      const destPath = item.documentId
                        ? `${modPath}/documents/${item.documentId}`
                        : `${modPath}/documents`;
                      return (
                        <div
                          key={`${item.templateId}-${item.siteId}-${idx}`}
                          className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 cursor-pointer"
                          onClick={() => { setShowMissingDialog(false); navigate(destPath); }}
                          data-testid={`row-missing-${item.templateId}-${item.siteId}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.templateName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.siteName} — {item.companyName}
                            </p>
                          </div>
                          <div className="ml-2 shrink-0 flex items-center gap-1.5">
                            {item.kind === "required_document" ? (
                              <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 capitalize">
                                {item.documentStatus?.replace("_", " ") || "Not Compliant"}
                              </Badge>
                            ) : item.requiresApproval ? (
                              <Badge variant="outline" className="text-xs">Approval Required</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Not Uploaded</Badge>
                            )}
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

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

    {variant !== "modules" && <Card data-testid="card-overall-document-progress" className="border-t-4 border-t-module-accent bg-module-accent-subtle">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Document Progress
        </CardTitle>
        <CardDescription>All documents across all modules</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            onClick={() => openDocs("total")}
            className={`text-center rounded-md border p-3 transition-colors ${allDocuments && allDocuments.length > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
            data-testid="button-stat-total"
          >
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-semibold"><CountUp value={allDocs} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
          </button>
          <button
            onClick={() => openDocs("all_compliant")}
            className={`text-center rounded-md border p-3 transition-colors ${allDocuments && allDocuments.length > 0 && allCompliant > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
            data-testid="button-stat-all-compliant"
          >
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-2xl font-semibold"><CountUp value={allCompliant} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Complete</p>
          </button>
          <button
            onClick={() => openDocs("all_review")}
            className={`text-center rounded-md border p-3 transition-colors ${allDocuments && allDocuments.length > 0 && reviewDocs > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
            data-testid="button-stat-review"
          >
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-2xl font-semibold"><CountUp value={reviewDocs} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Approval Required</p>
          </button>
          <button
            onClick={() => openDocs("all_overdue")}
            className={`text-center rounded-md border p-3 transition-colors ${allDocuments && allDocuments.length > 0 && allOverdue > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
            data-testid="button-stat-all-overdue"
          >
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-2xl font-semibold"><CountUp value={allOverdue} /></span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </button>
        </div>
      </CardContent>
    </Card>}
    </>
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

export default function Dashboard({ overallComplianceVariant }: { overallComplianceVariant?: "modules" } = {}) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter();
  const [, navigate] = useLocation();
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isProConsultant = user?.role === "consultant" && user?.consultantTier === "pro";

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
    : "/api/sites";

  // Fetch sites for all users (clients see their accessible sites, admin/consultant see all)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites", isProConsultant ? staffFilter : null],
    queryFn: async () => {
      const res = await fetch(sitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sites");
      return res.json();
    },
  });
  
  // Clients can see the site filter to confirm their access (even with single site)
  const clientHasSites = isClientUser && sites && sites.length > 0;

  // When selecting a site also sync the company dropdown
  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && siteId !== "all" && sites) {
      const site = sites.find(s => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites, setSelectedSiteId, setSelectedCompany]);

  // If a site is already selected (e.g. navigated from documents page) but the
  // company filter is not yet set, sync it once sites data has loaded.
  useEffect(() => {
    if (!sites || !selectedSiteId || selectedSiteId === "all" || selectedCompany) return;
    const site = sites.find(s => s.id === selectedSiteId);
    if (site?.companyName) setSelectedCompany(site.companyName);
  }, [sites, selectedSiteId, selectedCompany, setSelectedCompany]);

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

  // When a pro consultant has a staff filter active, scope all data queries to
  // the visible site IDs so that document progress, module cards, and activity
  // all update together with the filter.
  const staffSiteIds = useMemo(() => {
    if (!isProConsultant || staffFilter === "all" || !sites) return null;
    return sites.map(s => s.id);
  }, [isProConsultant, staffFilter, sites]);
  
  // Determine which site to show data for
  // "all" or null means show data across all accessible sites
  // Clients can now filter by site if they have multiple sites
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);

  // Build the siteIds param used when no single site is selected.
  // companySiteIds takes priority (user explicitly picked a company);
  // staffSiteIds is the fallback for the staff scope filter.
  const scopedSiteIds = companySiteIds ?? staffSiteIds;
  const scopedSiteIdsKey = scopedSiteIds?.join(",") || null;
  
  const { data: moduleSummaries, isLoading } = useQuery<ModuleSummary[]>({
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
  
  // Fetch all documents for renewal compliance tracking
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
  
  const { data: missingRequiredDetails = [], isLoading: isMissingLoading } = useQuery<MissingRequiredTemplateDetail[]>({
    queryKey: ["/api/missing-required-templates", siteId, scopedSiteIdsKey],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let url = "/api/missing-required-templates";
      const params: string[] = [];
      if (siteId) params.push(`siteId=${siteId}`);
      else if (scopedSiteIds && scopedSiteIds.length > 0) params.push(`siteIds=${scopedSiteIds.join(",")}`);
      if (params.length > 0) url += `?${params.join("&")}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch missing required templates");
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
      // Use renewalDate if set, otherwise fall back to expiryDate
      const trackingDate = doc.renewalDate || doc.expiryDate;
      if (!trackingDate) return;
      
      const renewalDate = new Date(trackingDate);
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
    if (clientHasSites && !selectedSiteId) {
      return "All Sites";
    }
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivilegedUser, clientHasSites]);

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

  // Get site compliance summary for accurate overall score (includes ALL document types)
  // This is used when a specific site is selected to ensure consistency with sites list
  const selectedSiteComplianceSummary = useMemo(() => {
    if (!siteId || !sites) return null;
    const selectedSite = sites.find(s => s.id === siteId);
    return selectedSite?.complianceSummary || null;
  }, [siteId, sites]);
  
  // For company-wide or all-sites view, aggregate from all visible sites
  const aggregatedComplianceSummary = useMemo(() => {
    if (siteId) return null; // Use site-specific summary instead
    if (!sites || sites.length === 0) return null;
    
    // Filter sites based on selected company
    const relevantSites = selectedCompany && selectedCompany !== "all"
      ? sites.filter(s => s.companyName === selectedCompany)
      : sites;
    
    const totals = relevantSites.reduce((acc, site) => {
      const summary = site.complianceSummary;
      if (summary) {
        acc.totalDocuments += summary.totalDocuments || 0;
        acc.compliantDocuments += summary.compliantDocuments || 0;
        acc.approvalRequired += summary.approvalRequired || 0;
        acc.overdueDocuments += summary.overdueDocuments || 0;
        acc.missingRequiredDocuments += (summary as any).missingRequiredDocuments || 0;
        acc.pendingApprovals += summary.pendingApprovals || 0;
      }
      return acc;
    }, { 
      totalDocuments: 0, 
      compliantDocuments: 0, 
      approvalRequired: 0, 
      overdueDocuments: 0, 
      missingRequiredDocuments: 0,
      pendingApprovals: 0,
      complianceScore: 0,
    });
    
    totals.complianceScore = totals.totalDocuments > 0 
      ? Math.round((totals.compliantDocuments / totals.totalDocuments) * 100) 
      : 0;
    
    return totals;
  }, [siteId, sites, selectedCompany]);

  // Compliance modules (not including support)
  const complianceModules: { module: ModuleType; name: string }[] = [
    { module: "health_safety", name: "Health & Safety" },
    { module: "human_resources", name: "Human Resources" },
    { module: "employment_law", name: "Employment Law" },
  ];

  const summaries = moduleSummaries || [];
  // Filter to only compliance modules (exclude support)
  const realComplianceSummaries = summaries.filter(s => s.module !== "support" && hasActiveAccess(s.module));
  // Show all non-active modules as locked so clients can see what's available
  const lockedModules = complianceModules.filter(m => !hasActiveAccess(m.module));

  // While module summaries are loading, render placeholder cards with zeros for
  // each compliance module the user has access to. CountUp then animates from
  // 0 → real values when the data lands, instead of flashing an empty layout.
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

  const complianceSummaries = moduleSummaries
    ? realComplianceSummaries
    : placeholderComplianceSummaries;

  // Check if user has access to support
  const hasSupportAccess = hasActiveAccess("support");
  const isSupportLocked = !hasSupportAccess;

  // Only block the layout while we don't yet know who the user is. Numeric
  // values render as 0 until data lands and then animate up via CountUp.
  const showContentSkeleton = isAuthLoading;

  return (
    <div className="theme-dashboard flex flex-col h-full">
      {/* Dashboard Header */}
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
                      : (myStaff.find((s) => s.id === staffFilter)?.fullName ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {myStaff.map(s => (
                    <SelectItem key={s.id} value={s.id} data-testid={`staff-filter-dashboard-${s.id}`}>
                      {s.fullName}'s client sites
                    </SelectItem>
                  ))}
                  <SelectItem value="all">All companies</SelectItem>
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
        missingRequiredDetails={missingRequiredDetails}
        isMissingLoading={isMissingLoading}
        allDocuments={allDocuments}
        sites={sites}
        variant={overallComplianceVariant}
      />

      {/* Renewal Status Section */}
      <Card data-testid="card-renewal-compliance-overview" className="border-t-4 border-t-module-accent bg-module-accent-subtle">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Renewal Status
            </CardTitle>
            <CardDescription>Documents approaching or past renewal dates across all modules</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
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
          
          {renewalMetrics.upcomingRenewals.length > 0 && overallComplianceVariant !== "modules" && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Documents Requiring Attention</h4>
              <div className="divide-y">
                {renewalMetrics.upcomingRenewals.slice(0, 5).map((doc) => {
                  const trackingDate = doc.renewalDate || doc.expiryDate;
                  const renewalDate = trackingDate ? new Date(trackingDate) : null;
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
                    <div 
                      key={doc.id} 
                      onClick={() => {
                        const docSite = sites?.find(s => s.id === doc.siteId);
                        if (docSite) {
                          setSelectedCompany(docSite.companyName || null);
                          setSelectedSiteId(docSite.id);
                        }
                        navigate(`${modulePath}/documents/${doc.id}`);
                      }}
                      className="flex items-center justify-between gap-4 py-3 hover-elevate rounded-md px-2 -mx-2 cursor-pointer"
                      data-testid={`link-overview-renewal-doc-${doc.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{doc.title}</p>
                            <Badge variant="secondary" className={`text-xs shrink-0 ${moduleBadgeClass}`}>{moduleLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {(() => {
                              const docSite = sites?.find(s => s.id === doc.siteId);
                              return docSite ? `${docSite.companyName} - ${docSite.name}` : null;
                            })()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.renewalDate ? "Renewal" : "Expires"}: {renewalDate && format(renewalDate, "MMM d, yyyy")}
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                
                if (renewalMetricDialog === "overdue") return daysUntilRenewal !== null && daysUntilRenewal < 0;
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

      {overallComplianceVariant !== "modules" && (
      <div>
        <h2 className="mb-4 text-xl font-semibold">Compliance Modules</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {complianceSummaries.map((summary) => (
            <ModuleCard key={summary.module} summary={summary} />
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
      )}

      {/* Activity section — Incidents | Training | Cases aligned under their parent modules */}
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

      {/* Support section - separate from compliance modules, full width */}
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
