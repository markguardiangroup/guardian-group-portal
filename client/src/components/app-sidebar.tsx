import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FileText,
  Building2,
  ClipboardCheck,
  BarChart3,
  HelpCircle,
  Settings,
  LogOut,
  HardHat,
  Users,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@shared/schema";
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

const moduleNavItems = [
  {
    title: "Health & Safety",
    icon: HardHat,
    url: "/health-safety",
    themeClass: "theme-hs",
    subItems: [
      { title: "Dashboard", url: "/health-safety" },
      { title: "Documents", url: "/health-safety/documents" },
      { title: "Assessments", url: "/health-safety/assessments" },
    ],
  },
  {
    title: "Human Resources",
    icon: Users,
    url: "/human-resources",
    themeClass: "theme-hr",
    subItems: [
      { title: "Dashboard", url: "/human-resources" },
      { title: "Documents", url: "/human-resources/documents" },
      { title: "Records", url: "/human-resources/records" },
    ],
  },
];

const sharedNavItems = [
  {
    title: "Entities & Sites",
    url: "/entities",
    icon: Building2,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Support",
    url: "/support",
    icon: HelpCircle,
    badge: 1,
  },
];

const settingsNavItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  entityId: string | null;
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
                    "transition-colors",
                    location === "/" && "bg-sidebar-accent font-medium"
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
              {moduleNavItems.map((item) => {
                const isModuleActive = location.startsWith(item.url);
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
                          <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => {
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
                                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}-${subItem.title.toLowerCase()}`}
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shared
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sharedNavItems.map((item) => {
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
                        {item.badge && (
                          <Badge variant="secondary" className="h-5 min-w-5 justify-center text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-sm font-medium">
              {user ? getInitials(user.fullName) : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium" data-testid="text-user-name">
              {user?.fullName || "Guest"}
            </span>
            <span className="truncate text-xs text-muted-foreground" data-testid="text-user-role">
              {user ? roleLabels[user.role] : "Not logged in"}
            </span>
          </div>
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover-elevate"
            data-testid="button-logout"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
