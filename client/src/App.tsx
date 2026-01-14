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
import Entities from "@/pages/entities";
import EntityDetail from "@/pages/entity-detail";
import HSChecklists from "@/pages/hs-checklists";
import HSIncidents from "@/pages/hs-incidents";
import Reports from "@/pages/reports";
import Support from "@/pages/support";
import Settings from "@/pages/settings";
import ModuleAccessRequests from "@/pages/module-access-requests";
import EntityModuleAccess from "@/pages/entity-module-access";
import UserManagement from "@/pages/user-management";
import ConsultantManagement from "@/pages/consultant-management";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      
      <Route path="/health-safety" component={HealthSafetyDashboard} />
      <Route path="/health-safety/documents" component={HealthSafetyDocuments} />
      <Route path="/health-safety/documents/:id" component={HealthSafetyDocuments} />
      <Route path="/health-safety/checklists" component={HSChecklists} />
      <Route path="/health-safety/incidents" component={HSIncidents} />
      
      <Route path="/human-resources" component={HumanResourcesDashboard} />
      <Route path="/human-resources/documents" component={HumanResourcesDocuments} />
      <Route path="/human-resources/documents/:id" component={HumanResourcesDocuments} />
      
      <Route path="/employment-law" component={EmploymentLawPage} />
      <Route path="/employment-law/cases/:id" component={EmploymentLawPage} />
      
      <Route path="/documents" component={Documents} />
      <Route path="/documents/upload" component={DocumentUpload} />
      <Route path="/documents/:id" component={Documents} />
      <Route path="/entities" component={Entities} />
      <Route path="/entities/:entityId" component={EntityDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/support" component={Support} />
      <Route path="/settings" component={Settings} />
      <Route path="/access-requests" component={ModuleAccessRequests} />
      <Route path="/entity-access" component={EntityModuleAccess} />
      <Route path="/users" component={UserManagement} />
      <Route path="/consultants" component={ConsultantManagement} />
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
