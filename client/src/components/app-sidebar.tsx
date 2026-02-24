import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Landmark,
  MapPin,
  BarChart3,
  Settings,
  LogOut,
  HardHat,
  Users,
  Scale,
  ChevronDown,
  Lock,
  Headphones,
  BookOpen,
  GraduationCap,
  Lightbulb,
  HelpCircle,
  ShieldAlert,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useModuleAccess } from "@/hooks/use-module-access";
import type { UserRole, ModuleType } from "@shared/schema";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const moduleNavItems: {
  title: string;
  icon: typeof HardHat;
  url: string;
  themeClass: string;
  module: ModuleType;
  subItems: { title: string; url: string; adminOnly?: boolean; clientOnly?: boolean }[];
}[] = [
  {
    title: "Health & Safety",
    icon: HardHat,
    url: "/health-safety",
    themeClass: "theme-hs",
    module: "health_safety",
    subItems: [
      { title: "Dashboard", url: "/health-safety" },
      { title: "Documents", url: "/health-safety/documents" },
    ],
  },
  {
    title: "Human Resources",
    icon: Users,
    url: "/human-resources",
    themeClass: "theme-hr",
    module: "human_resources",
    subItems: [
      { title: "Dashboard", url: "/human-resources" },
      { title: "Documents", url: "/human-resources/documents" },
    ],
  },
  {
    title: "Employment Law",
    icon: Scale,
    url: "/employment-law",
    themeClass: "theme-el",
    module: "employment_law",
    subItems: [
      { title: "Dashboard", url: "/employment-law" },
      { title: "Documents", url: "/employment-law/documents" },
      { title: "Cases", url: "/employment-law/cases" },
    ],
  },
  {
    title: "Training",
    icon: GraduationCap,
    url: "/training",
    themeClass: "theme-training",
    module: "training" as ModuleType,
    subItems: [
      { title: "Dashboard", url: "/training/dashboard", adminOnly: true },
      { title: "Dashboard", url: "/training/my-training", clientOnly: true },
      { title: "Browse Courses", url: "/training" },
      { title: "Certificates", url: "/training/certificates" },
    ],
  },
  {
    title: "Support",
    icon: Headphones,
    url: "/support",
    themeClass: "theme-support",
    module: "support",
    subItems: [
      { title: "Dashboard", url: "/support" },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    url: "/reports",
    themeClass: "theme-reports",
    module: "reports",
    subItems: [
      { title: "Dashboard", url: "/reports" },
    ],
  },
];

const settingsNavItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

const adminNavItems = [
  {
    title: "Companies",
    url: "/companies",
    icon: Landmark,
  },
  {
    title: "Sites",
    url: "/sites",
    icon: MapPin,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "Template Library",
    url: "/template-library",
    icon: BookOpen,
  },
  {
    title: "Training Library",
    url: "/training-library",
    icon: GraduationCap,
  },
  {
    title: "Admin Reports",
    url: "/admin-reports",
    icon: ShieldAlert,
  },
  {
    title: "Help & Training Guide",
    url: "/help",
    icon: HelpCircle,
  },
  {
    title: "Feedback",
    url: "/feedback",
    icon: MessageSquare,
  },
];

const consultantNavItems = [
  {
    title: "Sites",
    url: "/sites",
    icon: MapPin,
  },
  {
    title: "Admin Reports",
    url: "/admin-reports",
    icon: ShieldAlert,
  },
  {
    title: "Help & Training Guide",
    url: "/help",
    icon: HelpCircle,
  },
  {
    title: "Feedback",
    url: "/feedback",
    icon: MessageSquare,
  },
];

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  clientPermissionRole?: string | null;
  referenceNumber?: string | null;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContactMethod?: "email" | "phone" | "mobile" | null;
  notes?: string | null;
}

interface AppSidebarProps {
  user?: AuthUser | null;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  consultant: "Consultant",
  client: "Client",
};

export function AppSidebar({ user }: AppSidebarProps) {
  const [location] = useLocation();
  const { logout, isLoggingOut } = useAuth();
  const { hasActiveAccess, hasVisibleAccess, isHidden } = useModuleAccess();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  // Fetch support request counts for notification badge
  const { data: supportCounts } = useQuery<{ openCount: number }>({
    queryKey: ["/api/support-requests/counts"],
    staleTime: 30000, // Refresh every 30 seconds
    refetchInterval: 60000, // Auto-refresh every minute
  });
  const openSupportCount = supportCounts?.openCount || 0;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Show all modules to clients so they can see what's locked
  // Previously filtered out hidden modules, now show all with locked indicator
  const visibleModules = moduleNavItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <img 
            src={logoIcon} 
            alt="Guardian Group" 
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground">
              Guardian Group
            </span>
            <span className="text-xs text-muted-foreground">
              Compliance Portal
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/"}
                  className={cn(
                    "transition-colors font-semibold",
                    location === "/" 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "bg-sidebar-accent/50"
                  )}
                >
                  <Link href="/" data-testid="nav-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Modules
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleModules.map((item) => {
                const isModuleActive = location.startsWith(item.url);
                const isTrainingModule = item.module === ("training" as ModuleType);
                const hasAccess = isTrainingModule ? true : hasActiveAccess(item.module);
                
                if (!hasAccess) {
                  return (
                    <SidebarMenuItem key={item.title} className={item.themeClass}>
                      <SidebarMenuButton
                        className="cursor-default opacity-60"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <item.icon className="h-4 w-4 text-module-accent" />
                        <span className="flex-1">{item.title}</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          <Lock className="h-3 w-3 mr-1" />
                          Locked
                        </Badge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                
                return (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={isModuleActive}
                    className={cn("group/collapsible", item.themeClass)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className={cn(
                            "transition-colors",
                            isModuleActive && "bg-sidebar-accent font-medium"
                          )}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <item.icon className="h-4 w-4 text-module-accent" />
                          <span className="flex-1">{item.title}</span>
                          {item.module === "support" && openSupportCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="h-5 min-w-5 px-1.5 text-xs font-medium"
                              data-testid="badge-support-notifications"
                            >
                              {openSupportCount}
                            </Badge>
                          )}
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems
                            .filter((subItem) => {
                              // Filter based on role permissions
                              if (subItem.adminOnly && user?.role === "client") return false;
                              if (subItem.clientOnly && (user?.role === "admin" || user?.role === "consultant")) return false;
                              return true;
                            })
                            .map((subItem) => {
                            const isSubActive = location === subItem.url;
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={isSubActive}
                                  className={cn(
                                    "transition-colors",
                                    isSubActive && "bg-sidebar-accent font-medium"
                                  )}
                                >
                                  <Link 
                                    href={subItem.url}
                                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                                  >
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isPrivilegedUser && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {user?.role === "admin" ? "Admin" : "Tools"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(user?.role === "admin" ? adminNavItems : consultantNavItems).map((item) => {
                  const isActive = location === item.url || 
                    (item.url !== "/" && location.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          "transition-colors",
                          isActive && "bg-sidebar-accent font-medium"
                        )}
                      >
                        <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "transition-colors",
                        isActive && "bg-sidebar-accent font-medium"
                      )}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {user ? getInitials(user.fullName) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate text-sm font-semibold leading-tight" data-testid="text-user-name">
                {user?.fullName || "Guest"}
              </span>
              {user?.companyName && (
                <span className="truncate text-xs font-medium leading-tight" data-testid="text-user-company">
                  {user.companyName}
                </span>
              )}
              {user?.role !== "client" && (
                <span className="truncate text-xs text-muted-foreground leading-tight" data-testid="text-user-role">
                  {user ? roleLabels[user.role] : "Not logged in"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                console.log("Logout clicked");
                logout();
              }}
              disabled={isLoggingOut}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover-elevate"
              data-testid="button-logout"
              title="Sign out"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
