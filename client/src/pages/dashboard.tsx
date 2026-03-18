import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Briefcase,
  FileQuestion,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
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

        {/* Compliance stats: Compliant | Not Compliant | Docs Missing */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.compliantDocuments}</span>
            </div>
            <p className="text-xs text-muted-foreground">Compliant</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.overdueDocuments + (summary.reviewRequired || 0)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Not Compliant</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
              <FileQuestion className="h-4 w-4" />
              <span className="text-lg font-semibold">{summary.missingRequiredDocuments || 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">Docs Missing</p>
          </div>
        </div>

        {/* Document Progress */}
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Document Progress</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-sm font-semibold">{summary.allDocuments ?? summary.totalDocuments}</span>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{summary.allReviewRequired ?? summary.reviewRequired}</span>
              <p className="text-xs text-muted-foreground">Review</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-muted-foreground">{summary.pendingApprovals || 0}</span>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
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

function EmploymentLawCard({ summary, siteId }: { summary: ModuleSummary; siteId?: string | null }) {
  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases", siteId],
    queryFn: async () => {
      const url = siteId ? `/api/cases?siteId=${siteId}` : "/api/cases";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch cases");
      return response.json();
    },
  });

  const openCases = cases.filter(c => c.status === "open" || c.status === "under_investigation" || c.status === "hearing_scheduled").length;
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
    <Card className="hover-elevate theme-support border-t-4 border-t-slate-500 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-950/20" data-testid="card-module-support">
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
              <span className="text-3xl font-bold">{openRequests}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Open</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="h-6 w-6" />
              <span className="text-3xl font-bold">{resolvedRequests}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Resolved</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400">
              <FileText className="h-6 w-6" />
              <span className="text-3xl font-bold">{totalRequests}</span>
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
}

function TrainingCard({ siteId, selectedCompany, sites = [] }: TrainingCardProps) {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  const { data: trainingBookings = [] } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  // Filter bookings based on selected site or company
  const filteredBookings = useMemo(() => {
    if (siteId) {
      // Filter by specific site (siteId is a string like "site-1")
      return trainingBookings.filter(b => b.siteId === siteId);
    }
    if (selectedCompany && selectedCompany !== "all") {
      // Filter by company - get all site IDs for this company
      const companySiteIds = sites
        .filter(s => s.companyName === selectedCompany)
        .map(s => s.id);
      return trainingBookings.filter(b => companySiteIds.includes(b.siteId as string));
    }
    // No filter - return all
    return trainingBookings;
  }, [trainingBookings, siteId, selectedCompany, sites]);

  const bookedCount = filteredBookings.filter(b => b.status === "booked").length;
  const completedCount = filteredBookings.filter(b => b.status === "completed").length;
  const totalBookings = filteredBookings.length;

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
            {isPrivilegedUser ? "Manage Training" : "View Training"}
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
  reviewRequired: number;
  overdueDocuments: number;
  missingRequiredDocuments?: number;
  complianceScore: number;
  allDocuments?: number;
  allCompliantDocuments?: number;
  allReviewRequired?: number;
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
}: { 
  summaries: ModuleSummary[];
  siteComplianceSummary?: SiteComplianceSummary | null;
  missingRequiredDetails?: MissingRequiredTemplateDetail[];
  isMissingLoading?: boolean;
  allDocuments?: Document[];
  sites?: Array<{ id: string; name: string; companyName?: string | null }>;
}) {
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [docsDialog, setDocsDialog] = useState<DocsDialogType>(null);
  const [, navigate] = useLocation();
  // Slot-based compliance (required docs)
  const compliantDocs = siteComplianceSummary?.compliantDocuments ?? summaries.reduce((acc, s) => acc + s.compliantDocuments, 0);
  const overdueDocs = siteComplianceSummary?.overdueDocuments ?? summaries.reduce((acc, s) => acc + s.overdueDocuments, 0);
  const reviewRequiredSlots = siteComplianceSummary?.reviewRequired ?? summaries.reduce((acc, s) => acc + (s.reviewRequired || 0), 0);
  const missingDocs = siteComplianceSummary?.missingRequiredDocuments ?? summaries.reduce((acc, s) => acc + (s.missingRequiredDocuments || 0), 0);
  const overallScore = siteComplianceSummary?.complianceScore ?? summaries.reduce((acc, s) => acc + s.complianceScore, 0) / (summaries.length || 1);
  // All-document progress stats
  const allDocs = siteComplianceSummary?.allDocuments ?? summaries.reduce((acc, s) => acc + (s.allDocuments ?? s.totalDocuments), 0);
  const allCompliant = siteComplianceSummary?.allCompliantDocuments ?? summaries.reduce((acc, s) => acc + (s.allCompliantDocuments ?? s.compliantDocuments), 0);
  const reviewDocs = siteComplianceSummary?.allReviewRequired ?? summaries.reduce((acc, s) => acc + (s.allReviewRequired ?? s.reviewRequired), 0);
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
    review_required: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const dialogMeta: Record<NonNullable<DocsDialogType>, { title: string; filter: (d: Document) => boolean }> = {
    compliant: {
      title: "Compliant Required Documents",
      filter: (d) => !!d.isRequired && d.status === "compliant",
    },
    non_compliant: {
      title: "Not Compliant (Required Documents)",
      filter: (d) => !!d.isRequired && (d.status === "overdue" || d.status === "review_required"),
    },
    overdue: {
      title: "Overdue Required Documents",
      filter: (d) => !!d.isRequired && d.status === "overdue",
    },
    total: {
      title: "Required Documents",
      filter: (d) => !!d.isRequired,
    },
    all_compliant: {
      title: "Complete Required Documents",
      filter: (d) => !!d.isRequired && d.status === "compliant",
    },
    all_review: {
      title: "Review Required Documents",
      filter: (d) => !!d.isRequired && d.status === "review_required",
    },
    all_overdue: {
      title: "Overdue Required Documents",
      filter: (d) => !!d.isRequired && d.status === "overdue",
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

        {/* Compliance stats: required docs only */}
        {(() => {
          const nonCompliantDocs = overdueDocs + reviewRequiredSlots;
          return (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => openDocs("compliant")}
                className={`rounded-md border p-3 text-center w-full transition-colors ${allDocuments && allDocuments.length > 0 && compliantDocs > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
                data-testid="button-stat-compliant"
              >
                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-2xl font-semibold">{compliantDocs}</span>
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
                  <span className="text-2xl font-semibold">{nonCompliantDocs}</span>
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
                  <span className="text-2xl font-semibold">{missingDocs}</span>
                </div>
                <p className="text-xs text-muted-foreground">Docs Missing</p>
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
                {docsDialog ? dialogMeta[docsDialog].title : ""} ({docsDialogDocs.length + (docsDialog === "non_compliant" ? (missingRequiredDetails?.length ?? 0) : 0)})
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {docsDialogDocs.length === 0 && (docsDialog !== "non_compliant" || !missingRequiredDetails?.length) ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No documents to display.</p>
              ) : (
                <>
                  {docsDialogDocs.map((doc) => {
                    const site = doc.siteId ? siteNameMap[doc.siteId] : null;
                    const modulePath = modulePathMap[doc.module] || "/";
                    const modLabel = moduleLabels[doc.module] || doc.module;
                    const statusLabel = doc.status === "review_required" ? "Review Required" : doc.status === "overdue" ? "Overdue" : "Compliant";
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-md border p-3 gap-3 hover:bg-muted/40 cursor-pointer"
                        onClick={() => { setDocsDialog(null); navigate(modulePath); }}
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
                        </div>
                      </div>
                    );
                  })}
                  {docsDialog === "non_compliant" && missingRequiredDetails && missingRequiredDetails.length > 0 && (
                    <>
                      {docsDialogDocs.length > 0 && (
                        <div className="pt-1 pb-1 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Not Uploaded</div>
                      )}
                      {missingRequiredDetails.map((item, idx) => (
                        <div
                          key={`missing-${item.templateId}-${item.siteId}-${idx}`}
                          className="flex items-center justify-between rounded-md border p-3 gap-3"
                          data-testid={`row-missing-noncomp-${item.templateId}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.templateName}</p>
                            <p className="text-xs text-muted-foreground truncate">{item.siteName}{item.companyName ? ` — ${item.companyName}` : ""}</p>
                          </div>
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            Not Uploaded
                          </span>
                        </div>
                      ))}
                    </>
                  )}
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
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
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
                    {items.map((item, idx) => (
                      <div
                        key={`${item.templateId}-${item.siteId}-${idx}`}
                        className="flex items-center justify-between rounded-md border p-3"
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
                        </div>
                      </div>
                    ))}
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

    <Card data-testid="card-overall-document-progress">
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
              <span className="text-2xl font-semibold">{allDocs}</span>
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
              <span className="text-2xl font-semibold">{allCompliant}</span>
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
              <span className="text-2xl font-semibold">{reviewDocs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Review Required</p>
          </button>
          <button
            onClick={() => openDocs("all_overdue")}
            className={`text-center rounded-md border p-3 transition-colors ${allDocuments && allDocuments.length > 0 && allOverdue > 0 ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}
            data-testid="button-stat-all-overdue"
          >
            <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-2xl font-semibold">{allOverdue}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </button>
        </div>
      </CardContent>
    </Card>
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

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { selectedCompany, selectedSiteId, setSelectedSiteId, setSelectedCompany, handleCompanyChange } = useSiteFilter();
  const [, navigate] = useLocation();
  
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Fetch sites for all users (clients see their accessible sites, admin/consultant see all)
  const { data: sites, isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });
  
  // Clients can see the site filter to confirm their access (even with single site)
  const clientHasSites = isClientUser && sites && sites.length > 0;
  
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
  
  const { data: missingRequiredDetails = [], isLoading: isMissingLoading } = useQuery<MissingRequiredTemplateDetail[]>({
    queryKey: ["/api/missing-required-templates", siteId, companySiteIdsKey],
    queryFn: async () => {
      let url = "/api/missing-required-templates";
      const params: string[] = [];
      if (siteId) params.push(`siteId=${siteId}`);
      else if (companySiteIds && companySiteIds.length > 0) params.push(`siteIds=${companySiteIds.join(",")}`);
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
        acc.reviewRequired += summary.reviewRequired || 0;
        acc.overdueDocuments += summary.overdueDocuments || 0;
        acc.missingRequiredDocuments += (summary as any).missingRequiredDocuments || 0;
        acc.pendingApprovals += summary.pendingApprovals || 0;
      }
      return acc;
    }, { 
      totalDocuments: 0, 
      compliantDocuments: 0, 
      reviewRequired: 0, 
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
    <div className="space-y-8 p-8 dash-animate">
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
            className="flex items-center gap-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover-elevate rounded-md px-3 py-1.5 border border-slate-200 dark:border-slate-700"
            data-testid="link-need-help"
          >
            <Headphones className="h-4 w-4" />
            <span>Need support?</span>
          </Link>
          {/* Company and Site selectors - admin/consultant get both, clients with multiple sites get site selector */}
          {(isPrivilegedUser || clientHasSites) && sites && sites.length > 0 && (
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

      <OverallComplianceCard 
        summaries={complianceSummaries} 
        siteComplianceSummary={selectedSiteComplianceSummary || aggregatedComplianceSummary}
        missingRequiredDetails={missingRequiredDetails}
        isMissingLoading={isMissingLoading}
        allDocuments={allDocuments}
        sites={sites}
      />

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

      <div>
        <h2 className="mb-4 text-xl font-semibold">Compliance Modules</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {complianceSummaries.map((summary) => (
            summary.module === "employment_law" 
              ? <EmploymentLawCard key={summary.module} summary={summary} siteId={siteId} />
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
          <TrainingCard siteId={siteId} selectedCompany={selectedCompany} sites={sites} />
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
    </div>
  );
}
