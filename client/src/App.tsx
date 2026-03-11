import { useState, useEffect, useRef } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { SiteFilterProvider } from "@/hooks/use-site-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, FileText, Loader2, Eye } from "lucide-react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ModuleDashboard from "@/pages/module-dashboard";
import ModuleDocuments from "@/pages/module-documents";
import EmploymentLawPage from "@/pages/employment-law";
import Documents from "@/pages/documents";
import DocumentUpload from "@/pages/document-upload";
import Sites from "@/pages/sites";
import SiteDetail from "@/pages/site-detail";
import Companies from "@/pages/companies";
import CompanyDetail from "@/pages/company-detail";
import Reports from "@/pages/reports";
import AdminReports from "@/pages/admin-reports";
import Support from "@/pages/support";
import Settings from "@/pages/settings";
import UserManagement from "@/pages/user-management";
import TemplateLibrary from "@/pages/template-library";
import TrainingLibrary from "@/pages/training-library";
import Training from "@/pages/training";
import TrainingDashboard from "@/pages/training-dashboard";
import TrainingCertificateUpload from "@/pages/training-certificate-upload";
import TrainingCertificates from "@/pages/training-certificates";
import MyTraining from "@/pages/my-training";
import CreateFromTemplate from "@/pages/create-from-template";
import DevelopmentRoadmap from "@/pages/development-roadmap";
import AdminFeedback from "@/pages/admin-feedback";
import SetPassword from "@/pages/set-password";
import HelpGuide from "@/pages/help-guide";
import HSIncidents from "@/pages/hs-incidents";
import CalendarPage from "@/pages/calendar";
import ClientUploads from "@/pages/client-uploads";
import ToolkitDashboard from "@/pages/toolkit-dashboard";
import ToolkitBrowse from "@/pages/toolkit-browse";
import NotFound from "@/pages/not-found";

function HealthSafetyDashboard() {
  return <ModuleDashboard module="health_safety" />;
}

function HumanResourcesDashboard() {
  return <ModuleDashboard module="human_resources" />;
}

function HealthSafetyDocuments() {
  return <ModuleDocuments module="health_safety" />;
}

function HumanResourcesDocuments() {
  return <ModuleDocuments module="human_resources" />;
}

function EmploymentLawDocuments() {
  return <ModuleDocuments module="employment_law" />;
}

function HSClientUploads() {
  return <ClientUploads module="health_safety" />;
}

function HRClientUploads() {
  return <ClientUploads module="human_resources" />;
}

function ELClientUploads() {
  return <ClientUploads module="employment_law" />;
}


function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      <Route path="/health-safety" component={HealthSafetyDashboard} />
      <Route path="/health-safety/documents" component={HealthSafetyDocuments} />
      <Route path="/health-safety/documents/upload" component={DocumentUpload} />
      <Route path="/health-safety/documents/:id" component={HealthSafetyDocuments} />
      <Route path="/health-safety/incidents" component={HSIncidents} />
      <Route path="/health-safety/incidents/:id" component={HSIncidents} />
      <Route path="/health-safety/cloud-share" component={HSClientUploads} />
      
      <Route path="/human-resources" component={HumanResourcesDashboard} />
      <Route path="/human-resources/documents" component={HumanResourcesDocuments} />
      <Route path="/human-resources/documents/upload" component={DocumentUpload} />
      <Route path="/human-resources/documents/:id" component={HumanResourcesDocuments} />
      <Route path="/human-resources/cloud-share" component={HRClientUploads} />
      
      <Route path="/employment-law" component={EmploymentLawPage} />
      <Route path="/employment-law/documents" component={EmploymentLawDocuments} />
      <Route path="/employment-law/documents/upload" component={DocumentUpload} />
      <Route path="/employment-law/documents/:id" component={EmploymentLawDocuments} />
      <Route path="/employment-law/cases" component={EmploymentLawPage} />
      <Route path="/employment-law/cases/:id" component={EmploymentLawPage} />
      <Route path="/employment-law/cloud-share" component={ELClientUploads} />
      
      <Route path="/documents" component={Documents} />
      <Route path="/documents/upload" component={DocumentUpload} />
      <Route path="/documents/:id" component={Documents} />
      <Route path="/companies" component={Companies} />
      <Route path="/companies/:companyId" component={CompanyDetail} />
      <Route path="/sites" component={Sites} />
      <Route path="/sites/:siteId" component={SiteDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin-reports" component={AdminReports} />
      <Route path="/support" component={Support} />
      <Route path="/settings" component={Settings} />
      <Route path="/users" component={UserManagement} />
      <Route path="/template-library" component={TemplateLibrary} />
      <Route path="/training-library" component={TrainingLibrary} />
      <Route path="/training" component={Training} />
      <Route path="/training/dashboard" component={TrainingDashboard} />
      <Route path="/training/my-training" component={MyTraining} />
      <Route path="/training/certificates" component={TrainingCertificates} />
      <Route path="/training/certificates/upload" component={TrainingCertificateUpload} />
      <Route path="/training/certificates/:id" component={TrainingCertificates} />
      <Route path="/create-from-template" component={CreateFromTemplate} />
      <Route path="/roadmap" component={DevelopmentRoadmap} />
      <Route path="/feedback" component={AdminFeedback} />
      <Route path="/help" component={HelpGuide} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/toolkit" component={ToolkitDashboard} />
      <Route path="/toolkit/browse" component={ToolkitBrowse} />
      <Route component={NotFound} />
    </Switch>
  );
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
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
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
                <object
                  data={`/api/legal-documents/${previewDoc}/view#toolbar=0`}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <p className="mb-4">Unable to display PDF directly in your browser.</p>
                    <Button 
                      onClick={() => window.open(`/api/legal-documents/${previewDoc}/view`, "_blank")}
                    >
                      Open in New Tab
                    </Button>
                  </div>
                </object>
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
      if (!res.ok) return null;
      return res.json();
    };

    const p = (key: unknown[], url: string) =>
      queryClient.prefetchQuery({ queryKey: key, queryFn: () => f(url), staleTime: Infinity, gcTime: Infinity });

    // Core shared data
    p(["/api/sites"], "/api/sites");
    p(["/api/companies"], "/api/companies");
    p(["/api/training-bookings"], "/api/training-bookings");
    p(["/api/support-requests/counts"], "/api/support-requests/counts");

    // Main dashboard – keys include siteId=null, companySiteIdsKey=null, isClientUser
    p(["/api/modules/summary", null, null, isClientUser], "/api/modules/summary");
    p(["/api/documents", null, null], "/api/documents");
    p(["/api/cases", null], "/api/cases");
    p(["/api/support-requests", null], "/api/support-requests");

    // Module dashboards – keys include module, siteId=null, companySiteIdsKey=null
    p(["/api/dashboard", "health_safety", null, null], "/api/dashboard/health_safety");
    p(["/api/dashboard", "human_resources", null, null], "/api/dashboard/human_resources");
    p(["/api/documents/module", "health_safety"], "/api/documents/module/health_safety");
    p(["/api/documents/module", "human_resources"], "/api/documents/module/human_resources");

    // Employment law dashboard – keys include siteId=null, selectedCompanyId=null
    p(["/api/modules/employment_law/summary", null, null], "/api/modules/employment_law/summary");
    p(["/api/cases", null, null], "/api/cases");
    p(["/api/cases", null, null, false], "/api/cases");
    p(["/api/documents/module", "employment_law", null, null], "/api/documents/module/employment_law");

    // Toolkit dashboard + browse – stats key includes activeCompany=null
    p(["/api/toolkit/stats", null], "/api/toolkit/stats");
    p(["/api/toolkit"], "/api/toolkit");
  }, [userId]);

  return null;
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (user?.legalAcceptanceRequired) {
    return <LegalAcceptanceScreen />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SiteFilterProvider>
      <DataPrefetcher userId={user!.id} isClientUser={user!.role === "client"} />
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar user={user} />
          <SidebarInset className="flex flex-1 flex-col overflow-hidden">
            <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <BreadcrumbNav />
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </SiteFilterProvider>
  );
}

function PublicRoutes() {
  return (
    <Switch>
      <Route path="/set-password" component={SetPassword} />
    </Switch>
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
