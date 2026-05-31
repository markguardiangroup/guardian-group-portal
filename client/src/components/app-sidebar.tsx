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
  BookMarked,
  GraduationCap,
  Lightbulb,
  HelpCircle,
  ShieldAlert,
  MessageSquare,
  CalendarDays,
  Compass,
  Briefcase,
  Cloud,
  Award,
  Tag,
  Home,
  Megaphone,
  Plug,
  PackageOpen,
  type LucideIcon,
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  basePath?: string;
  themeClass: string;
  module: ModuleType;
  noColor?: boolean;
  directLink?: boolean;
  subItems: { title: string; url: string; icon?: LucideIcon; adminOnly?: boolean; clientOnly?: boolean }[];
}[] = [
  {
    title: "Health & Safety",
    icon: HardHat,
    url: "/health-safety/sites",
    basePath: "/health-safety",
    themeClass: "theme-hs",
    module: "health_safety",
    subItems: [
      { title: "Site Documents", url: "/health-safety/sites", icon: MapPin },
      { title: "Incidents", url: "/health-safety/incidents", icon: ShieldAlert },
      { title: "Cloud Share", url: "/health-safety/cloud-share", icon: Cloud },
    ],
  },
  {
    title: "Human Resources",
    icon: Users,
    url: "/human-resources/sites",
    basePath: "/human-resources",
    themeClass: "theme-hr",
    module: "human_resources",
    subItems: [
      { title: "Site Documents", url: "/human-resources/sites", icon: MapPin },
      { title: "Cloud Share", url: "/human-resources/cloud-share", icon: Cloud },
    ],
  },
  {
    title: "Employment Law",
    icon: Scale,
    url: "/employment-law/sites",
    basePath: "/employment-law",
    themeClass: "theme-el",
    module: "employment_law",
    subItems: [
      { title: "Site Documents", url: "/employment-law/sites", icon: MapPin },
      { title: "Cases", url: "/employment-law/cases", icon: Briefcase },
      { title: "Cloud Share", url: "/employment-law/cloud-share", icon: Cloud },
    ],
  },
  {
    title: "Toolkit",
    icon: BookMarked,
    url: "/toolkit",
    themeClass: "theme-toolkit",
    module: "toolkit" as ModuleType,
    subItems: [
      { title: "Dashboard", url: "/toolkit", icon: LayoutDashboard },
      { title: "Browse Templates", url: "/toolkit/browse", icon: BookOpen },
    ],
  },
  {
    title: "Training",
    icon: GraduationCap,
    url: "/training",
    themeClass: "theme-training",
    module: "training" as ModuleType,
    subItems: [
      { title: "Dashboard", url: "/training/dashboard", icon: LayoutDashboard, adminOnly: true },
      { title: "Dashboard", url: "/training/my-training", icon: LayoutDashboard, clientOnly: true },
      { title: "Browse Courses", url: "/training", icon: GraduationCap },
      { title: "Certificates", url: "/training/certificates", icon: Award, adminOnly: true },
    ],
  },
  {
    title: "Reports",
    icon: BarChart3,
    url: "/reports",
    themeClass: "theme-reports",
    module: "reports",
    directLink: true,
    subItems: [],
  },
];

const settingsNavItems = [
  {
    title: "Help & Training Guide",
    url: "/help",
    icon: HelpCircle,
  },
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
    title: "Manage Pathways",
    url: "/admin/pathways",
    icon: Compass,
  },
  {
    title: "Sources",
    url: "/admin/sources",
    icon: Tag,
  },
  {
    title: "Services",
    url: "/admin/services",
    icon: PackageOpen,
  },
  {
    title: "Portal Messages",
    url: "/admin/portal-messages",
    icon: Megaphone,
  },
  {
    title: "Accelo Integration",
    url: "/admin/integrations/accelo",
    icon: Plug,
  },
  {
    title: "Admin Reports",
    url: "/admin-reports",
    icon: ShieldAlert,
  },
  {
    title: "Feedback",
    url: "/feedback",
    icon: MessageSquare,
  },
  {
    title: "Roadmap",
    url: "/roadmap",
    icon: Lightbulb,
    devOnly: true,
  },
];

const consultantNavItems = [
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
    permission: "templateLibrary" as const,
  },
  {
    title: "Training Library",
    url: "/training-library",
    icon: GraduationCap,
    permission: "trainingLibrary" as const,
  },
  {
    title: "Services",
    url: "/admin/services",
    icon: PackageOpen,
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
  companyName?: string | null;
  consultantTier?: string | null;
  consultantPermissions?: { caseAdvocate?: boolean; trainingLibrary?: boolean; templateLibrary?: boolean } | null;
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

type ModuleNavItem = (typeof moduleNavItems)[number];

function NavItemWithFlyout({
  item,
  user,
  sidebarState,
  isModuleActive,
  openSupportCount = 0,
  noColor,
}: {
  item: ModuleNavItem;
  user: AppSidebarProps["user"];
  sidebarState: "expanded" | "collapsed";
  isModuleActive: boolean;
  openSupportCount?: number;
  noColor?: boolean;
}) {
  const [location] = useLocation();

  const filteredSubItems = item.subItems.filter((subItem) => {
    if (subItem.adminOnly && user?.role === "client") return false;
    if (subItem.clientOnly && (user?.role === "admin" || user?.role === "consultant")) return false;
    return true;
  });

  const testId = `nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`;

  if (sidebarState === "collapsed" && filteredSubItems.length > 0) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid={testId}
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              data-active={isModuleActive}
              className={cn(
                "peer/menu-button flex w-8 h-8 items-center justify-center rounded-md p-2 outline-hidden ring-sidebar-ring transition-colors duration-150 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
                !noColor && item.themeClass,
                !noColor && "nav-module-btn",
                isModuleActive && (!noColor ? "nav-module-active" : "bg-sidebar-accent font-medium")
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", noColor ? "text-muted-foreground" : "text-module-accent")} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={4} className="w-48">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1">
              {item.title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filteredSubItems.map((subItem) => {
              const isSubActive = location === subItem.url;
              return (
                <DropdownMenuItem
                  key={subItem.title}
                  asChild
                  className={cn("cursor-pointer gap-2", isSubActive && "bg-sidebar-accent font-medium")}
                >
                  <Link
                    href={subItem.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {subItem.icon && <subItem.icon className="h-4 w-4" />}
                    <span>{subItem.title}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible
      asChild
      defaultOpen={isModuleActive}
      className={cn("group/collapsible", !noColor && item.themeClass)}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn(
              "transition-colors",
              !noColor && "nav-module-btn",
              isModuleActive && (!noColor ? "nav-module-active" : "bg-sidebar-accent font-medium")
            )}
            data-testid={testId}
          >
            <item.icon className={cn("h-4 w-4", noColor ? "text-muted-foreground" : "text-module-accent")} />
            <span className={cn("flex-1", !noColor && "nav-module-label")}>{item.title}</span>
            {item.module === "support" && openSupportCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium" data-testid="badge-support-notifications">
                {openSupportCount}
              </Badge>
            )}
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180", !noColor && "text-module-accent opacity-70")} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {filteredSubItems.map((subItem) => {
              const isSubActive = location === subItem.url;
              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isSubActive}
                    className={cn("transition-colors", isSubActive && "bg-sidebar-accent font-medium")}
                  >
                    <Link
                      href={subItem.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {subItem.icon && <subItem.icon className="h-3.5 w-3.5 shrink-0" />}
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
  const { state: sidebarState } = useSidebar();
  const { logout, isLoggingOut } = useAuth();
  const { hasActiveAccess, hasVisibleAccess, isHidden, isLoading: moduleAccessLoading } = useModuleAccess();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  // Fetch support request counts for notification badge
  // Badge is kept fresh via SSE 'support-request-created' / 'support-request-updated' events
  const { data: supportCounts } = useQuery<{ openCount: number }>({
    queryKey: ["/api/support-requests/counts"],
    staleTime: 30000,
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

  const consultantNavItemsWithPro = consultantNavItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <Link href="/" className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <img 
            src={logoIcon} 
            alt="Guardian Group" 
            className="h-10 w-10 rounded-full object-cover shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
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
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/" || location === "/home"}
                  className={cn(
                    "transition-colors",
                    (location === "/" || location === "/home")
                      ? "bg-sidebar-accent font-medium"
                      : ""
                  )}
                >
                  <Link href="/home" data-testid="nav-home">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard"}
                  className={cn(
                    "transition-colors",
                    location === "/dashboard"
                      ? "bg-sidebar-accent font-medium"
                      : ""
                  )}
                >
                  <Link href="/dashboard" data-testid="nav-dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/calendar" || location.startsWith("/calendar/")}
                  className={cn(
                    "transition-colors",
                    (location === "/calendar" || location.startsWith("/calendar/"))
                      ? "bg-sidebar-accent font-medium"
                      : ""
                  )}
                >
                  <Link href="/calendar" data-testid="nav-calendar">
                    <CalendarDays className="h-4 w-4" />
                    <span>Calendar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                {(!import.meta.env.PROD && (moduleAccessLoading || hasActiveAccess("support"))) ? (
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/support" || location.startsWith("/support/")}
                    className={cn(
                      "transition-colors",
                      (location === "/support" || location.startsWith("/support/"))
                        ? "bg-sidebar-accent font-medium"
                        : ""
                    )}
                    data-testid="nav-support"
                  >
                    <Link href="/support">
                      <Headphones className="h-4 w-4" />
                      <span className="flex-1">Support</span>
                      {openSupportCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-5 min-w-5 px-1.5 text-xs font-medium"
                          data-testid="badge-support-notifications"
                        >
                          {openSupportCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    className="cursor-default opacity-60"
                    data-testid="nav-support"
                  >
                    <Headphones className="h-4 w-4" />
                    <span className="flex-1">Support</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  </SidebarMenuButton>
                )}
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
              {visibleModules.slice(0, 4).map((item) => {
                const isModuleActive = location.startsWith(item.basePath ?? item.url);
                const hasAccess = moduleAccessLoading || hasActiveAccess(item.module);
                
                if (!hasAccess) {
                  return (
                    <SidebarMenuItem key={item.title} className={item.themeClass}>
                      <SidebarMenuButton
                        asChild
                        className="opacity-60 nav-module-btn"
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Link href={item.basePath ?? item.url}>
                          <item.icon className="h-4 w-4 text-module-accent" />
                          <span className="flex-1 nav-module-label">{item.title}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                
                return (
                  <NavItemWithFlyout
                    key={item.title}
                    item={item}
                    user={user}
                    sidebarState={sidebarState}
                    isModuleActive={isModuleActive}
                    openSupportCount={openSupportCount}
                  />
                );
              })}

              {visibleModules.slice(4).map((item) => {
                const isModuleActive = location.startsWith(item.basePath ?? item.url);
                const hasAccess = moduleAccessLoading || hasActiveAccess(item.module);
                const testId = `nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`;
                
                if (!hasAccess) {
                  return (
                    <SidebarMenuItem key={item.title} className={item.noColor ? undefined : item.themeClass}>
                      <SidebarMenuButton
                        asChild
                        className={cn("opacity-60", !item.noColor && "nav-module-btn")}
                        data-testid={testId}
                      >
                        <Link href={item.basePath ?? item.url}>
                          <item.icon className={cn("h-4 w-4", item.noColor ? "text-muted-foreground" : "text-module-accent")} />
                          <span className={cn("flex-1", !item.noColor && "nav-module-label")}>{item.title}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Direct link — no collapsible sub-menu
                if (item.directLink) {
                  return (
                    <SidebarMenuItem key={item.title} className={item.noColor ? undefined : item.themeClass}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          "transition-colors",
                          !item.noColor && "nav-module-btn",
                          isModuleActive && (item.noColor ? "bg-sidebar-accent font-medium" : "nav-module-active")
                        )}
                        data-testid={testId}
                      >
                        <Link href={item.url}>
                          <item.icon className={cn("h-4 w-4", item.noColor ? "text-muted-foreground" : "text-module-accent")} />
                          <span className={cn("flex-1", !item.noColor && "nav-module-label")}>{item.title}</span>
                          {item.module === "support" && openSupportCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="h-5 min-w-5 px-1.5 text-xs font-medium"
                              data-testid="badge-support-notifications"
                            >
                              {openSupportCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                
                return (
                  <NavItemWithFlyout
                    key={item.title}
                    item={item}
                    user={user}
                    sidebarState={sidebarState}
                    isModuleActive={isModuleActive}
                    openSupportCount={openSupportCount}
                    noColor={item.noColor}
                  />
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
                {(user?.role === "admin" ? adminNavItems : consultantNavItemsWithPro)
                  .filter((item) => !((item as any).devOnly && import.meta.env.PROD))
                  .filter((item) => {
                    const perm = (item as any).permission as keyof NonNullable<AuthUser["consultantPermissions"]> | undefined;
                    if (user?.role === "consultant" && perm) {
                      return user.consultantPermissions?.[perm] === true;
                    }
                    return true;
                  })
                  .map((item) => {
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

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1 group-data-[collapsible=icon]:bg-transparent">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            {sidebarState === "collapsed" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    data-testid="button-user-avatar-collapsed"
                  >
                    <Avatar className="h-8 w-8 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {user ? getInitials(user.fullName) : "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-52">
                  <DropdownMenuLabel className="font-normal pb-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm leading-tight">{user?.fullName || "Guest"}</span>
                      {user?.companyName && (
                        <span className="text-xs text-muted-foreground leading-tight">{user.companyName}</span>
                      )}
                      {user?.role !== "client" && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground leading-tight">
                          {user ? roleLabels[user.role] : ""}
                          {user?.role === "consultant" && user?.consultantTier === "pro" && (
                            <span className="inline-flex items-center rounded px-1 py-0 text-[10px] font-bold tracking-wide bg-amber-100 text-amber-700 leading-4">PRO</span>
                          )}
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    className="text-destructive focus:text-destructive cursor-pointer"
                    data-testid="button-logout-collapsed"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {user ? getInitials(user.fullName) : "?"}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold leading-tight" data-testid="text-user-name">
                {user?.fullName || "Guest"}
              </span>
              {user?.companyName && (
                <span className="truncate text-xs font-medium leading-tight" data-testid="text-user-company">
                  {user.companyName}
                </span>
              )}
              {user?.role !== "client" && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground leading-tight" data-testid="text-user-role">
                  {user ? roleLabels[user.role] : "Not logged in"}
                  {user?.role === "consultant" && user?.consultantTier === "pro" && (
                    <span className="inline-flex items-center rounded px-1 py-0 text-[10px] font-bold tracking-wide bg-amber-100 text-amber-700 leading-4">
                      PRO
                    </span>
                  )}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => logout()}
              disabled={isLoggingOut}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover-elevate group-data-[collapsible=icon]:hidden"
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
