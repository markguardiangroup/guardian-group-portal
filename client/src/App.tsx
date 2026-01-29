import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
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
import HSIncidents from "@/pages/hs-incidents";
import Reports from "@/pages/reports";
import Support from "@/pages/support";
import Settings from "@/pages/settings";
import UserManagement from "@/pages/user-management";
import TemplateLibrary from "@/pages/template-library";
import TrainingLibrary from "@/pages/training-library";
import Training from "@/pages/training";
import CreateFromTemplate from "@/pages/create-from-template";
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


function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      <Route path="/health-safety" component={HealthSafetyDashboard} />
      <Route path="/health-safety/documents" component={HealthSafetyDocuments} />
      <Route path="/health-safety/documents/upload" component={DocumentUpload} />
      <Route path="/health-safety/documents/:id" component={HealthSafetyDocuments} />
      <Route path="/health-safety/incidents" component={HSIncidents} />
      
      <Route path="/human-resources" component={HumanResourcesDashboard} />
      <Route path="/human-resources/documents" component={HumanResourcesDocuments} />
      <Route path="/human-resources/documents/upload" component={DocumentUpload} />
      <Route path="/human-resources/documents/:id" component={HumanResourcesDocuments} />
      
      <Route path="/employment-law" component={EmploymentLawPage} />
      <Route path="/employment-law/documents" component={EmploymentLawDocuments} />
      <Route path="/employment-law/documents/upload" component={DocumentUpload} />
      <Route path="/employment-law/documents/:id" component={EmploymentLawDocuments} />
      <Route path="/employment-law/cases" component={EmploymentLawPage} />
      <Route path="/employment-law/cases/:id" component={EmploymentLawPage} />
      
      <Route path="/documents" component={Documents} />
      <Route path="/documents/upload" component={DocumentUpload} />
      <Route path="/documents/:id" component={Documents} />
      <Route path="/companies" component={Companies} />
      <Route path="/companies/:companyId" component={CompanyDetail} />
      <Route path="/sites" component={Sites} />
      <Route path="/sites/:siteId" component={SiteDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/support" component={Support} />
      <Route path="/settings" component={Settings} />
      <Route path="/users" component={UserManagement} />
      <Route path="/template-library" component={TemplateLibrary} />
      <Route path="/training-library" component={TrainingLibrary} />
      <Route path="/training" component={Training} />
      <Route path="/create-from-template" component={CreateFromTemplate} />
      <Route component={NotFound} />
    </Switch>
  );
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

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar user={user} />
        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="guardian-theme">
        <TooltipProvider>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
