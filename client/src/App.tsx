import { useState, useEffect, useRef, lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useServerEvents } from "@/hooks/use-server-events";
import { useModuleAccess } from "@/hooks/use-module-access";
import type { ModuleType } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { PdfViewer } from "@/components/pdf-viewer";
import { SiteFilterProvider } from "@/hooks/use-site-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, FileText, Loader2, Eye, Lock, CloudUpload } from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";

// Eager pages — loaded in the initial bundle so login + home page appear instantly.
import Login from "@/pages/login";
import HomePage from "@/pages/home";
import NotFound from "@/pages/not-found";
import SetPassword from "@/pages/set-password";

// Lazy pages — downloaded on-demand or via permission-aware background prefetch.
type Loader<T extends ComponentType<any>> = () => Promise<{ default: T }>;
type LazyPage<T extends ComponentType<any>> = ReturnType<typeof lazy<T>> & { preload: Loader<T> };
function lazyPage<T extends ComponentType<any>>(loader: Loader<T>): LazyPage<T> {
  const Component = lazy(loader) as LazyPage<T>;
  Component.preload = loader;
  return Component;
}

const ModuleDashboard = lazyPage(() => import("@/pages/module-dashboard"));
const ModuleDocuments = lazyPage(() => import("@/pages/module-documents"));
const ModuleSites = lazyPage(() => import("@/pages/module-sites"));
const ElCasesPage = lazyPage(() => import("@/pages/el-cases"));
const Documents = lazyPage(() => import("@/pages/documents"));
const DocumentUpload = lazyPage(() => import("@/pages/document-upload"));
const Sites = lazyPage(() => import("@/pages/sites"));
const SiteDetail = lazyPage(() => import("@/pages/site-detail"));
const Companies = lazyPage(() => import("@/pages/companies"));
const CompanyDetail = lazyPage(() => import("@/pages/company-detail"));
const Reports = lazyPage(() => import("@/pages/reports"));
const AdminReports = lazyPage(() => import("@/pages/admin-reports"));
const AdminChangelog = lazyPage(() => import("@/pages/admin-changelog"));
const Support = lazyPage(() => import("@/pages/support"));
const Settings = lazyPage(() => import("@/pages/settings"));
const UserManagement = lazyPage(() => import("@/pages/user-management"));
const TemplateLibrary = lazyPage(() => import("@/pages/template-library"));
const TrainingLibrary = lazyPage(() => import("@/pages/training-library"));
const Training = lazyPage(() => import("@/pages/training"));
const TrainingDashboard = lazyPage(() => import("@/pages/training-dashboard"));
const TrainingCertificateUpload = lazyPage(() => import("@/pages/training-certificate-upload"));
const TrainingCertificates = lazyPage(() => import("@/pages/training-certificates"));
const MyTraining = lazyPage(() => import("@/pages/my-training"));
const CreateFromTemplate = lazyPage(() => import("@/pages/create-from-template"));
const DevelopmentRoadmap = lazyPage(() => import("@/pages/development-roadmap"));
const AdminFeedback = lazyPage(() => import("@/pages/admin-feedback"));
const HelpGuide = lazyPage(() => import("@/pages/help-guide"));
const HSIncidents = lazyPage(() => import("@/pages/hs-incidents"));
const CalendarPage = lazyPage(() => import("@/pages/calendar"));
const ClientUploads = lazyPage(() => import("@/pages/client-uploads"));
const ToolkitDashboard = lazyPage(() => import("@/pages/toolkit-dashboard"));
const ToolkitBrowse = lazyPage(() => import("@/pages/toolkit-browse"));
const AdminPathways = lazyPage(() => import("@/pages/admin-pathways"));
const AdminSources = lazyPage(() => import("@/pages/admin-sources"));
const AdminServices = lazyPage(() => import("@/pages/admin-services"));
const Dashboard2 = lazyPage(() => import("@/pages/dashboard2"));
const AdminPortalMessages = lazyPage(() => import("@/pages/admin-portal-messages"));
const AdminAccelo = lazyPage(() => import("@/pages/admin-accelo"));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo(0, 0);
    document.getElementById("page-content")?.scrollTo(0, 0);
  }, [location]);
  return null;
}

function CanonicalTag() {
  const [location] = useLocation();
  useEffect(() => {
    const href = `https://www.guardiangroup.ai${location}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", href);
  }, [location]);
  return null;
}

function HealthSafetyDashboard() {
  return <ModuleGuard module="health_safety"><ModuleDashboard module="health_safety" /></ModuleGuard>;
}

function HumanResourcesDashboard() {
  return <ModuleGuard module="human_resources"><ModuleDashboard module="human_resources" /></ModuleGuard>;
}

function EmploymentLawDashboard() {
  return <ModuleGuard module="employment_law"><ModuleDashboard module="employment_law" /></ModuleGuard>;
}

function HealthSafetyDocuments() {
  return <ModuleGuard module="health_safety"><ModuleDocuments module="health_safety" /></ModuleGuard>;
}

function HumanResourcesDocuments() {
  return <ModuleGuard module="human_resources"><ModuleDocuments module="human_resources" /></ModuleGuard>;
}

function EmploymentLawDocuments() {
  return <ModuleGuard module="employment_law"><ModuleDocuments module="employment_law" /></ModuleGuard>;
}

function HealthSafetySites() {
  return <ModuleGuard module="health_safety"><ModuleSites module="health_safety" /></ModuleGuard>;
}

function HumanResourcesSites() {
  return <ModuleGuard module="human_resources"><ModuleSites module="human_resources" /></ModuleGuard>;
}

function EmploymentLawSites() {
  return <ModuleGuard module="employment_law"><ModuleSites module="employment_law" /></ModuleGuard>;
}

function HSClientUploads() {
  return (
    <Suspense fallback={<CloudShareSkeleton module="health_safety" />}>
      <ModuleGuard module="health_safety"><ClientUploads module="health_safety" /></ModuleGuard>
    </Suspense>
  );
}

function HRClientUploads() {
  return (
    <Suspense fallback={<CloudShareSkeleton module="human_resources" />}>
      <ModuleGuard module="human_resources"><ClientUploads module="human_resources" /></ModuleGuard>
    </Suspense>
  );
}

function ELClientUploads() {
  return (
    <Suspense fallback={<CloudShareSkeleton module="employment_law" />}>
      <ModuleGuard module="employment_law"><ClientUploads module="employment_law" /></ModuleGuard>
    </Suspense>
  );
}

function HSIncidentsGuarded() {
  return <ModuleGuard module="health_safety"><HSIncidents /></ModuleGuard>;
}

function ElCasesGuarded() {
  return <ModuleGuard module="employment_law"><ElCasesPage /></ModuleGuard>;
}


function RouteFallback() {
  return <FetchingOverlay />;
}

const MODULE_CLOUD_SHARE_LABELS = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
} as const;

function CloudShareSkeleton({ module }: { module: "health_safety" | "human_resources" | "employment_law" }) {
  const themeClass = module === "health_safety" ? "theme-hs" : module === "human_resources" ? "theme-hr" : "theme-el";
  return (
    <div className={`${themeClass} flex flex-col h-full`}>
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent shrink-0">
              <CloudUpload className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {MODULE_CLOUD_SHARE_LABELS[module]}
                <span className="font-normal text-muted-foreground text-2xl"> - Cloud Share</span>
              </h1>
              <div className="h-5 mt-1" />
            </div>
          </div>
          <Skeleton className="h-10 w-40 shrink-0" />
        </div>
      </div>
      <div id="page-content" className="flex-1 overflow-auto p-6">
        <FetchingOverlay />
      </div>
    </div>
  );
}

type GuardUser = { role: string; consultantPermissions?: { templateLibrary?: boolean; trainingLibrary?: boolean } | null } | null | undefined;

const ADMIN_ONLY     = (u: GuardUser) => u?.role === "admin";
const NOT_CLIENT     = (u: GuardUser) => u?.role === "admin" || u?.role === "consultant";
const TEMPLATE_LIB   = (u: GuardUser) => u?.role === "admin" || (u?.role === "consultant" && u?.consultantPermissions?.templateLibrary === true);
const TRAINING_LIB   = (u: GuardUser) => u?.role === "admin" || (u?.role === "consultant" && u?.consultantPermissions?.trainingLibrary === true);

function AccessGuard({ component: Component, allow }: { component: ComponentType<any>; allow: (u: GuardUser) => boolean }) {
  const { user } = useAuth();
  if (!allow(user)) return <Redirect to="/home" />;
  return <Component />;
}

function ModuleGuard({ module, children }: { module: ModuleType; children: React.ReactNode }) {
  const { isHidden, isLoading } = useModuleAccess();
  if (isLoading) return null;
  if (isHidden(module)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-muted p-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">This module is not enabled</h2>
          <p className="text-muted-foreground max-w-sm">
            For more information about this service, please contact your advisor.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Router() {
  return (
    <>
    <ScrollToTop />
    <CanonicalTag />
    <Suspense fallback={<RouteFallback />}>
    <Switch>
      <Route path="/">{() => <Redirect to="/home" />}</Route>
      <Route path="/home" component={HomePage} />
      <Route path="/dashboard" component={Dashboard2} />
      
      <Route path="/health-safety" component={HealthSafetyDashboard} />
      <Route path="/health-safety/sites" component={HealthSafetySites} />
      <Route path="/health-safety/documents" component={HealthSafetyDocuments} />
      <Route path="/health-safety/documents/upload" component={DocumentUpload} />
      <Route path="/health-safety/documents/:id" component={HealthSafetyDocuments} />
      <Route path="/health-safety/incidents" component={HSIncidentsGuarded} />
      <Route path="/health-safety/incidents/:id" component={HSIncidentsGuarded} />
      <Route path="/health-safety/cloud-share" component={HSClientUploads} />
      
      <Route path="/human-resources" component={HumanResourcesDashboard} />
      <Route path="/human-resources/sites" component={HumanResourcesSites} />
      <Route path="/human-resources/documents" component={HumanResourcesDocuments} />
      <Route path="/human-resources/documents/upload" component={DocumentUpload} />
      <Route path="/human-resources/documents/:id" component={HumanResourcesDocuments} />
      <Route path="/human-resources/cloud-share" component={HRClientUploads} />
      
      <Route path="/employment-law" component={EmploymentLawDashboard} />
      <Route path="/employment-law/sites" component={EmploymentLawSites} />
      <Route path="/employment-law/documents" component={EmploymentLawDocuments} />
      <Route path="/employment-law/documents/upload" component={DocumentUpload} />
      <Route path="/employment-law/documents/:id" component={EmploymentLawDocuments} />
      <Route path="/employment-law/cases" component={ElCasesGuarded} />
      <Route path="/employment-law/cases/:id" component={ElCasesGuarded} />
      <Route path="/employment-law/cloud-share" component={ELClientUploads} />
      
      <Route path="/documents" component={Documents} />
      <Route path="/documents/upload" component={DocumentUpload} />
      <Route path="/documents/:id" component={Documents} />
      <Route path="/companies">{() => <AccessGuard component={Companies} allow={NOT_CLIENT} />}</Route>
      <Route path="/companies/:companyId">{() => <AccessGuard component={CompanyDetail} allow={NOT_CLIENT} />}</Route>
      <Route path="/sites">{() => <AccessGuard component={Sites} allow={NOT_CLIENT} />}</Route>
      <Route path="/sites/:siteId">{() => <AccessGuard component={SiteDetail} allow={NOT_CLIENT} />}</Route>
      <Route path="/reports">{() => <ModuleGuard module="reports"><Reports /></ModuleGuard>}</Route>
      <Route path="/admin-reports">{() => <AccessGuard component={AdminReports} allow={ADMIN_ONLY} />}</Route>
      <Route path="/admin-reports/changelog">{() => <AccessGuard component={AdminChangelog} allow={ADMIN_ONLY} />}</Route>
      <Route path="/support">{() => <ModuleGuard module="support"><Support /></ModuleGuard>}</Route>
      <Route path="/settings" component={Settings} />
      <Route path="/users">{() => <AccessGuard component={UserManagement} allow={NOT_CLIENT} />}</Route>
      <Route path="/template-library">{() => <AccessGuard component={TemplateLibrary} allow={TEMPLATE_LIB} />}</Route>
      <Route path="/training-library">{() => <AccessGuard component={TrainingLibrary} allow={TRAINING_LIB} />}</Route>
      <Route path="/training">{() => <ModuleGuard module="training"><Training /></ModuleGuard>}</Route>
      <Route path="/training/dashboard">{() => <AccessGuard component={TrainingDashboard} allow={NOT_CLIENT} />}</Route>
      <Route path="/training/my-training">{() => <ModuleGuard module="training"><MyTraining /></ModuleGuard>}</Route>
      <Route path="/training/certificates">{() => <AccessGuard component={TrainingCertificates} allow={NOT_CLIENT} />}</Route>
      <Route path="/training/certificates/upload">{() => <AccessGuard component={TrainingCertificateUpload} allow={NOT_CLIENT} />}</Route>
      <Route path="/training/certificates/:id">{() => <AccessGuard component={TrainingCertificates} allow={NOT_CLIENT} />}</Route>
      <Route path="/create-from-template">{() => <AccessGuard component={CreateFromTemplate} allow={NOT_CLIENT} />}</Route>
      <Route path="/roadmap">{() => <AccessGuard component={DevelopmentRoadmap} allow={NOT_CLIENT} />}</Route>
      <Route path="/feedback">{() => <AccessGuard component={AdminFeedback} allow={NOT_CLIENT} />}</Route>
      <Route path="/help" component={HelpGuide} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/toolkit">{() => <ModuleGuard module="toolkit"><ToolkitDashboard /></ModuleGuard>}</Route>
      <Route path="/toolkit/browse">{() => <ModuleGuard module="toolkit"><ToolkitBrowse /></ModuleGuard>}</Route>
      <Route path="/admin/pathways">{() => <AccessGuard component={AdminPathways} allow={ADMIN_ONLY} />}</Route>
      <Route path="/admin/sources">{() => <AccessGuard component={AdminSources} allow={ADMIN_ONLY} />}</Route>
      <Route path="/admin/services">{() => <AccessGuard component={AdminServices} allow={NOT_CLIENT} />}</Route>
      <Route path="/admin/portal-messages">{() => <AccessGuard component={AdminPortalMessages} allow={ADMIN_ONLY} />}</Route>
      <Route path="/admin/integrations/accelo">{() => <AccessGuard component={AdminAccelo} allow={ADMIN_ONLY} />}</Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </>
  );
}

/**
 * Runs in the background for every authenticated dev session.
 * Polls the live production server's published-patch endpoint every 60 s.
 * When prod's patch has reached dev's current patch (i.e. a new deploy just
 * shipped), it calls the bump endpoint so dev advances to the next patch number.
 */
function ProdPublishWatcher() {
  const isDev = import.meta.env.DEV;
  const prodUrl = (import.meta.env.VITE_PROD_URL as string | undefined)?.replace(/\/$/, "");

  const bumpMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/changelog/bump-after-publish"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/changelog"] }),
  });

  useQuery<{ major: number; minor: number; patch: number }>({
    queryKey: ["prod-published-patch-global", prodUrl],
    enabled: isDev && !!prodUrl,
    refetchInterval: 60_000,
    staleTime: 55_000,
    queryFn: async () => {
      const res = await fetch(`${prodUrl}/api/changelog/published-patch`, { credentials: "omit" });
      if (!res.ok) throw new Error("prod fetch failed");
      const data = await res.json() as { major: number; minor: number; patch: number };
      // Fetch current dev changelog to compare
      const clRes = await fetch("/api/changelog");
      if (!clRes.ok) return data;
      const cl = await clRes.json() as { activeVersionId: string; versions: Array<{ id: string; major: number; minor: number; patch: number; publishedPatch?: number }> };
      const active = cl.versions.find((v: any) => v.id === cl.activeVersionId);
      // Fire when prod's recorded publishedPatch exceeds dev's last known publishedPatch —
      // meaning a new deployment has shipped code that dev hasn't yet accounted for.
      if (
        active &&
        data.major === active.major &&
        data.minor === active.minor &&
        data.patch > (active.publishedPatch ?? -1) &&
        !bumpMutation.isPending
      ) {
        bumpMutation.mutate();
      }
      return data;
    },
  });

  return null;
}

function RoutePrefetcher({
  userId,
  role,
  consultantPermissions,
}: {
  userId: string;
  role: string;
  consultantPermissions?: { caseAdvocate?: boolean; trainingLibrary?: boolean; templateLibrary?: boolean } | null;
}) {
  const startedRef = useRef(false);
  const immediateRef = useRef(false);
  const { isLoading, hasVisibleAccess } = useModuleAccess();

  // Fire immediately on first mount — no auth or idle wait needed for these
  // bundles since they're the same chunk regardless of role/module access.
  useEffect(() => {
    if (immediateRef.current) return;
    immediateRef.current = true;
    ModuleDocuments.preload();
    ModuleSites.preload();
    ModuleDashboard.preload();
    Dashboard2.preload();
    CalendarPage.preload();
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    if (isLoading) return; // wait until we know which modules to prefetch
    startedRef.current = true;

    const isAdmin = role === "admin";
    const isConsultant = role === "consultant";
    const isPrivileged = isAdmin || isConsultant;
    const canAccess = (m: ModuleType) => hasVisibleAccess(m);
    const hasConsultantPerm = (key: "caseAdvocate" | "trainingLibrary" | "templateLibrary") =>
      consultantPermissions?.[key] === true;
    const canSeeTemplateLibrary = isAdmin || (isConsultant && hasConsultantPerm("templateLibrary"));
    const canSeeTrainingLibrary = isAdmin || (isConsultant && hasConsultantPerm("trainingLibrary"));

    // Wait until the browser is idle so prefetches don't compete with the dashboard's first paint.
    const schedule = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(cb);
      else setTimeout(cb, 800);
    };

    schedule(() => {
      // Pages everyone with an account can reach.
      Settings.preload();
      Documents.preload();
      DocumentUpload.preload();
      Support.preload();
      CalendarPage.preload();
      Dashboard2.preload();

      // Module-gated pages — only fetch chunks for modules the user can access.
      if (canAccess("health_safety")) {
        ModuleDashboard.preload();
        ModuleDocuments.preload();
        ModuleSites.preload();
        HSIncidents.preload();
        ClientUploads.preload();
      }
      if (canAccess("human_resources")) {
        ModuleDashboard.preload();
        ModuleDocuments.preload();
        ModuleSites.preload();
        ClientUploads.preload();
      }
      if (canAccess("employment_law")) {
        ModuleDashboard.preload();
        ElCasesPage.preload();
        ModuleDocuments.preload();
        ModuleSites.preload();
        ClientUploads.preload();
      }
      if (canAccess("training")) {
        Training.preload();
        TrainingDashboard.preload();
        MyTraining.preload();
      }
      if (canAccess("toolkit")) {
        ToolkitDashboard.preload();
        ToolkitBrowse.preload();
      }

      // Admin / consultant only — never download these for client users.
      if (isPrivileged) {
        Sites.preload();
        SiteDetail.preload();
        Companies.preload();
        CompanyDetail.preload();
        UserManagement.preload();
        AdminFeedback.preload();
        CreateFromTemplate.preload();
      }
      // Library pages — admins always; consultants only with the matching permission.
      if (canSeeTemplateLibrary) TemplateLibrary.preload();
      if (canSeeTrainingLibrary) TrainingLibrary.preload();
      if (isAdmin) {
        AdminPathways.preload();
        AdminSources.preload();
        AdminServices.preload();
        AdminPortalMessages.preload();
      }

    });
  }, [userId, role, isLoading, hasVisibleAccess, consultantPermissions]);

  return null;
}

function LegalAcceptanceScreen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<"terms" | "privacy" | null>(null);

  const { data: termsInfo } = useQuery<{ exists: boolean; revisionDate?: string }>({
    queryKey: ["/api/legal-documents/terms/info"],
  });

  const { data: privacyInfo } = useQuery<{ exists: boolean; revisionDate?: string }>({
    queryKey: ["/api/legal-documents/privacy/info"],
  });

  const termsAvailable = termsInfo?.exists === true;
  const privacyAvailable = privacyInfo?.exists === true;
  const allAccepted = (!termsAvailable || acceptedTerms) && (!privacyAvailable || acceptedPrivacy);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/legal-documents/accept");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Documents accepted",
        description: "Thank you for accepting the updated legal documents.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept documents",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">Guardian Group</span>
          </div>
          <p className="text-sm text-muted-foreground">H&S Compliance Portal</p>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Updated Legal Documents</CardTitle>
            <CardDescription>
              Our legal documents have been updated since your last acceptance. Please review and accept the updated documents to continue using the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-md border p-4">
              {termsAvailable && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="reaccept-terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    data-testid="checkbox-reaccept-terms"
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reaccept-terms" className="text-sm leading-relaxed cursor-pointer">
                      I have read and agree to the Terms & Conditions
                    </label>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary justify-start"
                      onClick={() => setPreviewDoc("terms")}
                      data-testid="button-preview-terms"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Terms & Conditions
                    </Button>
                  </div>
                </div>
              )}
              {privacyAvailable && (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="reaccept-privacy"
                    checked={acceptedPrivacy}
                    onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                    data-testid="checkbox-reaccept-privacy"
                  />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="reaccept-privacy" className="text-sm leading-relaxed cursor-pointer">
                      I have read and acknowledge the Privacy Policy
                    </label>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-primary justify-start"
                      onClick={() => setPreviewDoc("privacy")}
                      data-testid="button-preview-privacy"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Privacy Policy
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!allAccepted || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate()}
              data-testid="button-accept-legal"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept & Continue"
              )}
            </Button>
          </CardContent>
        </Card>

        <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>
                {previewDoc === "terms" ? "Terms & Conditions" : "Privacy Policy"}
              </DialogTitle>
              <DialogDescription>
                Please review the {previewDoc === "terms" ? "Terms & Conditions" : "Privacy Policy"} below.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 w-full bg-white min-h-0 relative">
              {previewDoc && (
                <PdfViewer url={`/api/legal-documents/${previewDoc}/view`} />
              )}
            </div>
            <DialogFooter className="p-4 border-t">
              <Button onClick={() => setPreviewDoc(null)}>Close Preview</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function DataPrefetcher({ userId, isClientUser }: { userId: string; isClientUser: boolean }) {
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    const f = async (url: string) => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Prefetch failed: ${res.status}`);
      return res.json();
    };

    const p = (key: unknown[], url: string) =>
      queryClient.prefetchQuery({ queryKey: key, queryFn: () => f(url), staleTime: Infinity, gcTime: Infinity });

    const run = async () => {
      // Navigation data – used across sidebar/header on every page
      p(["/api/sites"], "/api/sites");
      p(["/api/companies"], "/api/companies");
      // Users list – prefetch so user-management page hits cache on first visit
      if (!isClientUser) p(["/api/users"], "/api/users");
      p(["/api/support-requests/counts"], "/api/support-requests/counts");

      // Home page panels – prefetch so they're instant on first landing
      p(["/api/home-summary"], "/api/home-summary");
      p(["/api/my-actions"], "/api/my-actions");

      // Main dashboard – all queries used by the overview page (no site/company filter)
      p(["/api/modules/summary", null, null, isClientUser], "/api/modules/summary");
      p(["/api/documents", null, null], "/api/documents");
      p(["/api/missing-required-templates", null, null], "/api/missing-required-templates");

      // Dashboard widgets
      p(["/api/support-requests", null], "/api/support-requests");
      p(["/api/training-bookings"], "/api/training-bookings");
      p(["/api/incidents"], "/api/incidents");
      p(["/api/cases"], "/api/cases");

      // Fetch module access first — skip prefetching dashboards for locked modules
      let moduleAccess: Record<string, string> = {};
      try {
        moduleAccess = await f("/api/user/module-access");
        queryClient.setQueryData(["/api/user/module-access"], moduleAccess);
      } catch { /* fall through — all modules will be skipped safely */ }

      const unlocked = (module: string) => moduleAccess[module] && moduleAccess[module] !== "locked";

      // Site Documents pages — preload documents and missing-required-templates for each enabled module
      for (const module of ["health_safety", "human_resources", "employment_law"] as const) {
        if (unlocked(module)) {
          p(["/api/documents/module", module], `/api/documents/module/${module}`);
          p(["/api/missing-required-templates", module], `/api/missing-required-templates?module=${module}`);
        }
      }
    };

    run();

    // All other pages (cases, incidents, training, support, toolkit, reports)
    // load their own data on first visit and show skeleton states while fetching.
  }, [userId]);

  return null;
}


function SidebarExpandHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadySeen = localStorage.getItem("sidebar_hint_seen") === "true";
    if (alreadySeen) return;

    // Read collapsed state from the sidebar DOM attribute — avoids cross-module context issues
    const t = setTimeout(() => {
      const sidebar = document.querySelector('[data-sidebar="sidebar"]');
      if (sidebar?.getAttribute("data-state") === "collapsed") {
        setVisible(true);
        const hideTimer = setTimeout(() => {
          setVisible(false);
          localStorage.setItem("sidebar_hint_seen", "true");
        }, 5000);
        return () => clearTimeout(hideTimer);
      }
    }, 150);

    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute left-10 top-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-left-1 duration-200">
      <div className="relative bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-md shadow-lg whitespace-nowrap">
        <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-b-[5px] border-r-[6px] border-t-transparent border-b-transparent border-r-primary" />
        Click to expand the sidebar
      </div>
    </div>
  );
}

function SseConnector() {
  useServerEvents();
  return null;
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [splashFading, setSplashFading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const transitionStarted = useRef(false);
  // Only show splash when navigating here immediately after a successful login
  const isFreshLogin = useRef(sessionStorage.getItem("freshLogin") === "1");

  useEffect(() => {
    if (!isLoading && isAuthenticated && !transitionStarted.current && isFreshLogin.current) {
      transitionStarted.current = true;
      sessionStorage.removeItem("freshLogin");
      const fadeTimer = setTimeout(() => setSplashFading(true), 400);
      const hideTimer = setTimeout(() => setSplashDone(true), 750);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img
            src={logoIcon}
            alt="Guardian Group"
            className="h-16 w-16 rounded-full object-cover shadow-md"
          />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const showSplash = isFreshLogin.current && (isAuthenticated && !splashDone);

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
      {showSplash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
          style={{
            opacity: splashFading ? 0 : 1,
            transition: "opacity 350ms ease",
            pointerEvents: splashFading ? "none" : "auto",
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <img
              src={logoIcon}
              alt="Guardian Group"
              className="h-16 w-16 rounded-full object-cover shadow-md"
            />
            <p className="text-sm font-medium text-muted-foreground">Signing you in…</p>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      )}
      {isAuthenticated && (
        user?.legalAcceptanceRequired ? (
          <LegalAcceptanceScreen />
        ) : (
          <SiteFilterProvider>
            <ProdPublishWatcher />
            <DataPrefetcher userId={user!.id} isClientUser={user!.role === "client"} />
            <RoutePrefetcher
              userId={user!.id}
              role={user!.role}
              consultantPermissions={user!.consultantPermissions}
            />
            <SseConnector />
            <SidebarProvider defaultOpen={false} style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar user={user} />
                <SidebarInset className="flex flex-1 flex-col overflow-hidden">
                  <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1 relative">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <SidebarExpandHint />
                      <BreadcrumbNav />
                    </div>
                    <ThemeToggle />
                  </header>
                  <main id="main-content" className="flex-1 overflow-auto">
                    <Router />
                  </main>
                </SidebarInset>
              </div>
            </SidebarProvider>
          </SiteFilterProvider>
        )
      )}
    </>
  );
}

function PublicRoutes() {
  return (
    <>
      <CanonicalTag />
      <Switch>
        <Route path="/set-password" component={SetPassword} />
      </Switch>
    </>
  );
}

function AppRouter() {
  // Check if on public route first
  const publicPaths = ['/set-password'];
  const isPublicRoute = publicPaths.some(path => 
    window.location.pathname.startsWith(path)
  );

  if (isPublicRoute) {
    return <PublicRoutes />;
  }

  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function App() {
  useEffect(() => {
    const el = document.getElementById("nav-loader");
    if (el) el.classList.remove("visible");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="guardian-theme">
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
