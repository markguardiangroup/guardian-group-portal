import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  FileText,
  Users,
  Landmark,
  MapPin,
  Briefcase,
  MessageSquare,
  Pin,
  Megaphone,
  Newspaper,
  BookOpen,
  GraduationCap,
  FileCheck,
  UserCheck,
} from "lucide-react";

interface HomeSummary {
  urgentActions: {
    overdueDocuments: number;
    reviewRequiredDocuments: number;
    pendingApprovals: number;
    openIncidents: number;
    pendingSignOffs: number;
  };
  portfolio:
    | {
        assignedCompanies: { name: string; siteCount: number }[];
        assignedSites: { id: string; name: string; companyName?: string; isPrimary?: boolean }[];
        assignedCases: { id: string; reference: string; employeeName: string; companyName: string; status: string }[];
        sources: string[];
      }
    | {
        site: { id: string; name: string; companyName?: string } | null;
        primaryConsultant: { id: string; name: string } | null;
      }
    | null;
  portalMessages: {
    id: string;
    title: string;
    body: string;
    type: string;
    pinned: boolean;
    publishedAt: string | null;
  }[];
}

const messageTypeConfig: Record<string, { label: string; icon: typeof Megaphone; color: string }> = {
  update: { label: "Update", icon: Megaphone, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  feature: { label: "New Feature", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  training: { label: "Training", icon: GraduationCap, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  guidance: { label: "Guidance", icon: BookOpen, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  news: { label: "News", icon: Newspaper, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

function UrgentActionsPanel({
  actions,
  role,
}: {
  actions: HomeSummary["urgentActions"];
  role: string;
}) {
  const isPrivileged = role === "admin" || role === "consultant";
  const items = [
    {
      show: true,
      count: actions.overdueDocuments,
      label: "Overdue Documents",
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-800",
      href: isPrivileged ? "/documents" : null,
      severity: "high",
    },
    {
      show: true,
      count: actions.reviewRequiredDocuments,
      label: "Review Required",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      href: isPrivileged ? "/documents" : null,
      severity: "medium",
    },
    {
      show: isPrivileged,
      count: actions.pendingApprovals,
      label: "Pending Approvals",
      icon: FileCheck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800",
      href: "/documents",
      severity: "medium",
    },
    {
      show: true,
      count: actions.openIncidents,
      label: "Open Incidents",
      icon: ShieldAlert,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      border: "border-orange-200 dark:border-orange-800",
      href: "/health-safety/incidents",
      severity: "high",
    },
    {
      show: role === "client",
      count: actions.pendingSignOffs,
      label: "Pending Sign-offs",
      icon: UserCheck,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-violet-200 dark:border-violet-800",
      href: null,
      severity: "medium",
    },
  ].filter((i) => i.show);

  const totalUrgent = items.filter((i) => i.severity === "high").reduce((s, i) => s + i.count, 0);

  return (
    <Card data-testid="card-urgent-actions">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Urgent Actions
          </CardTitle>
          {totalUrgent > 0 && (
            <Badge variant="destructive" className="text-xs" data-testid="badge-urgent-count">
              {totalUrgent} urgent
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${item.bg} ${item.border} ${item.href ? "cursor-pointer hover:opacity-90" : ""}`}
              data-testid={`action-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${item.color}`}>{item.count}</span>
                {item.href && item.count > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </div>
          );
          if (item.href && item.count > 0) {
            return (
              <Link key={item.label} href={item.href}>
                {content}
              </Link>
            );
          }
          return <div key={item.label}>{content}</div>;
        })}
        {items.every((i) => i.count === 0) && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear — no urgent actions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PortfolioPanel({ portfolio, role }: { portfolio: HomeSummary["portfolio"]; role: string }) {
  const isPrivileged = role === "admin" || role === "consultant";

  if (!portfolio) return null;

  if (isPrivileged) {
    const p = portfolio as {
      assignedCompanies: { name: string; siteCount: number }[];
      assignedSites: { id: string; name: string; companyName?: string; isPrimary?: boolean }[];
      assignedCases: { id: string; reference: string; employeeName: string; companyName: string; status: string }[];
      sources: string[];
    };

    return (
      <Card data-testid="card-portfolio">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            My Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Companies */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5" /> Companies ({p.assignedCompanies.length})
            </p>
            {p.assignedCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No companies assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {p.assignedCompanies.slice(0, 6).map((c) => (
                  <Badge key={c.name} variant="secondary" className="text-xs" data-testid={`badge-company-${c.name}`}>
                    {c.name}
                    <span className="ml-1 opacity-60">·{c.siteCount}</span>
                  </Badge>
                ))}
                {p.assignedCompanies.length > 6 && (
                  <Badge variant="outline" className="text-xs">+{p.assignedCompanies.length - 6} more</Badge>
                )}
              </div>
            )}
          </div>

          {/* Sites */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Sites ({p.assignedSites.length})
            </p>
            {p.assignedSites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sites assigned</p>
            ) : (
              <div className="space-y-1">
                {p.assignedSites.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm" data-testid={`site-portfolio-${s.id}`}>
                    <span className="truncate">{s.name}</span>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {s.companyName && <span className="text-xs text-muted-foreground">{s.companyName}</span>}
                      {s.isPrimary && (
                        <Badge className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/20">Primary</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {p.assignedSites.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{p.assignedSites.length - 5} more</p>
                )}
              </div>
            )}
          </div>

          {/* Cases */}
          {p.assignedCases.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Active Cases ({p.assignedCases.length})
              </p>
              <div className="space-y-1">
                {p.assignedCases.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm" data-testid={`case-portfolio-${c.id}`}>
                    <span className="font-mono text-xs">{c.reference}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{c.employeeName}</span>
                  </div>
                ))}
                {p.assignedCases.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{p.assignedCases.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {/* Sources */}
          {p.sources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Sources</p>
              <div className="flex flex-wrap gap-1">
                {p.sources.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full mt-1" asChild>
            <Link href="/companies" data-testid="link-view-all-companies">
              View All Clients
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Client view
  const p = portfolio as {
    site: { id: string; name: string } | null;
    primaryConsultant: { id: string; name: string } | null;
  };

  return (
    <Card data-testid="card-portfolio">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Your Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {p.site && (
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Organisation</p>
              <p className="text-sm font-medium">{p.site.name}</p>
            </div>
          </div>
        )}
        {p.primaryConsultant && (
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Your Consultant</p>
              <p className="text-sm font-medium">{p.primaryConsultant.name}</p>
            </div>
          </div>
        )}
        {!p.site && !p.primaryConsultant && (
          <p className="text-sm text-muted-foreground">Contact support to set up your account.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PortalMessagesPanel({ messages }: { messages: HomeSummary["portalMessages"] }) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="panel-portal-messages">
      {messages.slice(0, 5).map((msg) => {
        const config = messageTypeConfig[msg.type] ?? messageTypeConfig.update;
        const Icon = config.icon;
        return (
          <Card key={msg.id} className={msg.pinned ? "border-primary/40 ring-1 ring-primary/20" : ""} data-testid={`message-${msg.id}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {msg.pinned && <Pin className="h-3 w-3 text-primary" />}
                    <span className="text-sm font-semibold">{msg.title}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config.color}`}>{config.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{msg.body}</p>
                  {msg.publishedAt && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {format(new Date(msg.publishedAt), "d MMM yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data, isLoading } = useQuery<HomeSummary>({
    queryKey: ["/api/home-summary"],
    staleTime: 60000,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || user?.username || "";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" id="page-content">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-home-greeting">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Here's what's happening across the portal today.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Left column: Urgent Actions */}
          <div className="md:col-span-1">
            {data && <UrgentActionsPanel actions={data.urgentActions} role={user?.role ?? "client"} />}
          </div>

          {/* Middle column: Portfolio */}
          <div className="md:col-span-1">
            {data?.portfolio && <PortfolioPanel portfolio={data.portfolio} role={user?.role ?? "client"} />}
          </div>

          {/* Right column: Quick links */}
          <div className="md:col-span-1 space-y-4">
            <Card data-testid="card-quick-links">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {[
                  { label: "Documents", href: "/documents", icon: FileText },
                  ...(isPrivileged ? [{ label: "Companies", href: "/companies", icon: Landmark }] : []),
                  { label: "Incidents", href: "/health-safety/incidents", icon: ShieldAlert },
                  { label: "Employment Cases", href: "/employment-law/cases", icon: Briefcase },
                  { label: "Support", href: "/support", icon: MessageSquare },
                  { label: "Calendar", href: "/calendar", icon: Clock },
                ].map(({ label, href, icon: Icon }) => (
                  <Button key={label} variant="ghost" size="sm" className="w-full justify-start gap-2" asChild>
                    <Link href={href} data-testid={`quicklink-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Portal Messages — full width row if any */}
          {data && data.portalMessages.length > 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  Portal Messages
                </h2>
                {user?.role === "admin" && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/portal-messages" data-testid="link-manage-portal-messages">
                      Manage
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.portalMessages.slice(0, 3).map((msg) => {
                  const config = messageTypeConfig[msg.type] ?? messageTypeConfig.update;
                  const Icon = config.icon;
                  return (
                    <Card
                      key={msg.id}
                      className={msg.pinned ? "border-primary/40 ring-1 ring-primary/20" : ""}
                      data-testid={`message-${msg.id}`}
                    >
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {msg.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                              <span className="text-sm font-semibold truncate">{msg.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{msg.body}</p>
                            {msg.publishedAt && (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                {format(new Date(msg.publishedAt), "d MMM yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          {user?.role === "admin" && data && data.portalMessages.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                <div className="flex items-center gap-3">
                  <Megaphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">No portal messages published</p>
                    <p className="text-xs text-muted-foreground">Create messages to broadcast updates to all users.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/portal-messages" data-testid="link-create-portal-message">
                    Create Message
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
