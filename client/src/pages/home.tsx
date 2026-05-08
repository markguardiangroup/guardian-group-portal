import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
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
  Pin,
  Megaphone,
  Newspaper,
  BookOpen,
  GraduationCap,
  FileCheck,
  UserCheck,
  KeyRound,
  ExternalLink,
  Building2,
  TrendingUp,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
  UserCog,
} from "lucide-react";

interface HomeSummary {
  urgentActions: {
    overdueDocuments: number;
    reviewRequiredDocuments: number;
    pendingApprovals: number;
    openIncidents: number;
    pendingSignOffs: number;
    pendingAccessRequests: number;
    openCases: number;
  };
  assignedConsultants?: { id: string; fullName: string; consultantTier: string | null; sources: string[] | null }[];
  portfolio:
    | {
        assignedCompanies: { name: string; siteCount: number }[];
        assignedSites: { id: string; name: string; companyName?: string; isPrimary?: boolean }[];
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
    ctaType: string | null;
    ctaUrl: string | null;
    ctaLabel: string | null;
  }[];
}

interface SummaryItem {
  id: string;
  label: string;
  subLabel: string | null;
  href: string;
  badge: string | null;
  badgeColor: string | null;
}

interface ItemsResponse {
  type: string;
  items: SummaryItem[];
}

const messageTypeConfig: Record<string, {
  label: string;
  icon: typeof Megaphone;
  color: string;
  gradient: string;
  accentText: string;
  cardTop: string;
}> = {
  update: {
    label: "Update",
    icon: Megaphone,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    gradient: "from-blue-600 to-blue-800",
    accentText: "text-blue-200",
    cardTop: "from-blue-500 to-blue-700",
  },
  feature: {
    label: "New Feature",
    icon: Sparkles,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    gradient: "from-purple-600 to-violet-700",
    accentText: "text-purple-200",
    cardTop: "from-purple-500 to-violet-600",
  },
  training: {
    label: "Training",
    icon: GraduationCap,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    gradient: "from-teal-600 to-emerald-700",
    accentText: "text-teal-200",
    cardTop: "from-teal-500 to-emerald-600",
  },
  guidance: {
    label: "Guidance",
    icon: BookOpen,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    gradient: "from-amber-500 to-orange-600",
    accentText: "text-amber-200",
    cardTop: "from-amber-400 to-orange-500",
  },
  news: {
    label: "News",
    icon: Newspaper,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    gradient: "from-slate-600 to-slate-800",
    accentText: "text-slate-300",
    cardTop: "from-slate-500 to-slate-700",
  },
};

const actionTypeConfig: Record<string, { label: string; listLabel: string; navHref: string }> = {
  overdue_documents: { label: "Overdue Documents", listLabel: "overdue documents", navHref: "/documents" },
  review_required: { label: "Review Required", listLabel: "documents requiring review", navHref: "/documents" },
  pending_approvals: { label: "Pending Approvals", listLabel: "pending approvals", navHref: "/documents" },
  open_incidents: { label: "Open Incidents", listLabel: "open incidents", navHref: "/health-safety/incidents" },
  pending_sign_offs: { label: "Pending Sign-offs", listLabel: "documents awaiting your sign-off", navHref: "/documents" },
  access_requests: { label: "Access Requests", listLabel: "pending access requests", navHref: "/companies" },
  open_cases: { label: "Open Cases", listLabel: "open cases", navHref: "/employment-law/cases" },
};

const badgeColorClass: Record<string, string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};

function UrgentActionsPanel({
  actions,
  role,
  onActionClick,
}: {
  actions: HomeSummary["urgentActions"];
  role: string;
  onActionClick: (type: string) => void;
}) {
  const isAdmin = role === "admin";
  const isPrivileged = role === "admin" || role === "consultant";

  const items = [
    {
      show: true,
      count: actions.overdueDocuments,
      type: "overdue_documents",
      label: "Overdue Documents",
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-800",
      severity: "high",
    },
    {
      show: true,
      count: actions.reviewRequiredDocuments,
      type: "review_required",
      label: "Review Required",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      severity: "medium",
    },
    {
      show: isPrivileged,
      count: actions.pendingApprovals,
      type: "pending_approvals",
      label: "Pending Approvals",
      icon: FileCheck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800",
      severity: "medium",
    },
    {
      show: true,
      count: actions.openIncidents,
      type: "open_incidents",
      label: "Open Incidents",
      icon: ShieldAlert,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      border: "border-orange-200 dark:border-orange-800",
      severity: "high",
    },
    {
      show: role === "client",
      count: actions.pendingSignOffs,
      type: "pending_sign_offs",
      label: "Pending Sign-offs",
      icon: UserCheck,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-violet-200 dark:border-violet-800",
      severity: "medium",
    },
    {
      show: isAdmin,
      count: actions.pendingAccessRequests ?? 0,
      type: "access_requests",
      label: "Access Requests",
      icon: KeyRound,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      border: "border-indigo-200 dark:border-indigo-800",
      severity: "medium",
    },
    {
      show: isPrivileged,
      count: actions.openCases ?? 0,
      type: "open_cases",
      label: "Open Cases",
      icon: Briefcase,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/20",
      border: "border-teal-200 dark:border-teal-800",
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
          const clickable = item.count > 0;
          return (
            <button
              key={item.type}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onActionClick(item.type)}
              className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors text-left
                ${item.bg} ${item.border}
                ${clickable ? "cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none" : "cursor-default opacity-70"}`}
              data-testid={`action-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${item.color}`}>{item.count}</span>
                {clickable && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            </button>
          );
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

const PORTFOLIO_INITIAL_ROWS = 4;

function PortfolioPanel({ portfolio, role }: { portfolio: HomeSummary["portfolio"]; role: string }) {
  const isPrivileged = role === "admin" || role === "consultant";
  const [expanded, setExpanded] = useState(false);

  if (!portfolio) return null;

  if (isPrivileged) {
    const p = portfolio as {
      assignedCompanies: { name: string; siteCount: number }[];
      assignedSites: { id: string; name: string; companyName?: string; isPrimary?: boolean }[];
      sources: string[];
    };

    const totalCompanies = p.assignedCompanies.length;
    const totalSites = p.assignedSites.length;
    const hasMore = totalCompanies > PORTFOLIO_INITIAL_ROWS;
    const visibleCompanies = expanded ? p.assignedCompanies : p.assignedCompanies.slice(0, PORTFOLIO_INITIAL_ROWS);

    return (
      <Card data-testid="card-portfolio">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            My Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-center" data-testid="stat-companies">
              <p className="text-xl font-bold tabular-nums">{totalCompanies}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Landmark className="h-3 w-3" />
                {totalCompanies === 1 ? "Company" : "Companies"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-center" data-testid="stat-sites">
              <p className="text-xl font-bold tabular-nums">{totalSites}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" />
                {totalSites === 1 ? "Site" : "Sites"}
              </p>
            </div>
          </div>

          {/* Client list */}
          {totalCompanies > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Clients
              </p>
              <div className="space-y-1">
                {visibleCompanies.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-muted/60 transition-colors"
                    data-testid={`company-portfolio-${c.name}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{c.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums">
                      {c.siteCount} {c.siteCount === 1 ? "site" : "sites"}
                    </span>
                  </div>
                ))}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  data-testid="button-toggle-companies"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      {totalCompanies - PORTFOLIO_INITIAL_ROWS} more {totalCompanies - PORTFOLIO_INITIAL_ROWS === 1 ? "client" : "clients"}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {totalCompanies === 0 && (
            <div className="flex items-center justify-center text-center py-4">
              <p className="text-sm text-muted-foreground">No clients assigned yet.</p>
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/companies" data-testid="link-view-all-companies">
              View All Clients
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Client view ──────────────────────────────────────────────────────────────
  const p = portfolio as {
    site: { id: string; name: string } | null;
    primaryConsultant: { id: string; name: string } | null;
  };

  return (
    <Card data-testid="card-portfolio" className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Your Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 divide-y divide-border">
        {p.site && (
          <div className="flex items-center gap-3 py-3" data-testid="portfolio-organisation">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Organisation</p>
              <p className="text-sm font-semibold">{p.site.name}</p>
            </div>
          </div>
        )}

        {p.primaryConsultant && (
          <div className="flex items-center gap-3 py-3" data-testid="portfolio-consultant">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your Consultant</p>
              <p className="text-sm font-semibold">{p.primaryConsultant.name}</p>
            </div>
          </div>
        )}

        {!p.site && !p.primaryConsultant && (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Contact support to set up your account.</p>
          </div>
        )}

        <div className="flex gap-2 pt-3">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/documents" data-testid="link-client-documents">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Documents
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/health-safety/incidents" data-testid="link-client-incidents">
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              Incidents
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignedConsultantsPanel({
  consultants,
}: {
  consultants: NonNullable<HomeSummary["assignedConsultants"]>;
}) {
  return (
    <Card data-testid="card-assigned-consultants">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          My Assigned Consultants
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-center">
          <p className="text-xl font-bold tabular-nums">{consultants.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <Users className="h-3 w-3" />
            {consultants.length === 1 ? "Consultant" : "Consultants"}
          </p>
        </div>
        <div className="space-y-1">
          {consultants.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-muted/60 transition-colors"
              data-testid={`assigned-consultant-${c.id}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserCog className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm font-medium truncate">{c.fullName}</span>
              </div>
              {c.consultantTier === "pro" && (
                <span className="shrink-0 ml-2 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  Pro
                </span>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/user-management" data-testid="link-view-all-consultants">
            View All Users
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

type PortalMessage = HomeSummary["portalMessages"][0];

function PortalMessageModal({
  message,
  onClose,
}: {
  message: PortalMessage | null;
  onClose: () => void;
}) {
  if (!message) return null;
  const config = messageTypeConfig[message.type] ?? messageTypeConfig.update;
  const Icon = config.icon;

  return (
    <Dialog open={!!message} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden" data-testid="modal-portal-message">
        {/* Gradient header */}
        <div className={`relative overflow-hidden bg-gradient-to-br ${config.gradient} px-6 pt-6 pb-5 text-white`}>
          <Icon className="absolute -right-4 -top-4 h-28 w-28 opacity-[0.08] rotate-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className={`text-xs font-semibold uppercase tracking-widest ${config.accentText}`}>
                {config.label}
              </span>
              {message.pinned && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                  Featured
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug pr-8">{message.title}</h2>
            {message.publishedAt && (
              <p className={`text-xs mt-1 ${config.accentText}`}>
                {format(new Date(message.publishedAt), "d MMMM yyyy")}
              </p>
            )}
          </div>
        </div>

        {/* Full body */}
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
            {message.body}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-5 pt-1 border-t">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="modal-message-close">
            Close
          </Button>
          {message.ctaType && message.ctaType !== "none" && (() => {
            const defaultLabels: Record<string, string> = {
              make_enquiry: "Make an Enquiry",
              navigate_to_link: "Learn More",
              book_now: "Book Now",
              contact_consultant: "Contact Your Consultant",
              download: "Download Now",
            };
            const label = message.ctaLabel || defaultLabels[message.ctaType] || "Find Out More";
            const href =
              message.ctaType === "make_enquiry" || message.ctaType === "contact_consultant"
                ? (message.ctaUrl || "/support")
                : (message.ctaUrl || "#");
            const isExternal = href.startsWith("http");
            return (
              <Button
                size="sm"
                className={`bg-gradient-to-r ${config.gradient} text-white border-0 hover:opacity-90`}
                asChild
                data-testid="modal-message-cta"
              >
                <a href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} onClick={onClose}>
                  {label}
                </a>
              </Button>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PortalMessagesPanel({ messages }: { messages: HomeSummary["portalMessages"] }) {
  const [selectedMessage, setSelectedMessage] = useState<PortalMessage | null>(null);

  if (messages.length === 0) return null;

  const pinned = messages.filter((m) => m.pinned);
  const rest = messages.filter((m) => !m.pinned);

  return (
    <div className="space-y-4" data-testid="panel-portal-messages">

      {/* ── Featured / pinned messages — hero banner ───────────────────────── */}
      {pinned.map((msg) => {
        const config = messageTypeConfig[msg.type] ?? messageTypeConfig.update;
        const Icon = config.icon;
        return (
          <div
            key={msg.id}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${config.gradient} p-6 text-white shadow-md`}
            data-testid={`message-${msg.id}`}
          >
            {/* Decorative background icon */}
            <Icon className="absolute -right-5 -top-5 h-36 w-36 opacity-[0.08] rotate-12" />

            <div className="relative">
              {/* Type label + featured badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className={`text-xs font-semibold uppercase tracking-widest ${config.accentText}`}>
                  {config.label}
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                  Featured
                </span>
              </div>

              <h3 className="text-xl font-bold leading-snug mb-2 max-w-xl">{msg.title}</h3>
              <p className="text-sm text-white/80 leading-relaxed max-w-2xl line-clamp-3">{msg.body}</p>

              <div className="flex items-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setSelectedMessage(msg)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors"
                  data-testid={`message-cta-${msg.id}`}
                >
                  Find out more
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {msg.publishedAt && (
                  <span className={`text-xs ${config.accentText}`}>
                    {format(new Date(msg.publishedAt), "d MMM yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Regular messages — promotional card grid ───────────────────────── */}
      {rest.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((msg) => {
            const config = messageTypeConfig[msg.type] ?? messageTypeConfig.update;
            const Icon = config.icon;
            return (
              <div
                key={msg.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow"
                data-testid={`message-${msg.id}`}
              >
                {/* Coloured top strip with icon */}
                <div className={`flex items-center gap-3 bg-gradient-to-r ${config.cardTop} px-4 py-3`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    {config.label}
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                  <h4 className="text-sm font-bold leading-snug mb-1.5">{msg.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 flex-1">
                    {msg.body}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setSelectedMessage(msg)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      data-testid={`message-cta-${msg.id}`}
                    >
                      Find out more
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    {msg.publishedAt && (
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(msg.publishedAt), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-content modal */}
      <PortalMessageModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />
    </div>
  );
}

function UrgentActionsModal({
  open,
  onClose,
  actionType,
}: {
  open: boolean;
  onClose: () => void;
  actionType: string | null;
}) {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<ItemsResponse>({
    queryKey: [`/api/home-summary/items?type=${actionType}`],
    enabled: !!actionType && open,
    staleTime: 30000,
  });

  const config = actionType ? actionTypeConfig[actionType] : null;
  const items = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col" data-testid="modal-urgent-action">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">
            {config?.label ?? "Items"}
            {!isLoading && items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-1">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Nothing to show right now.</p>
            </div>
          ) : (
            <div className="space-y-1.5 py-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  data-testid={`modal-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.subLabel && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subLabel}</p>
                    )}
                    {item.badge && (
                      <Badge
                        variant="secondary"
                        className={`mt-1 text-[10px] px-1.5 py-0 capitalize ${item.badgeColor ? badgeColorClass[item.badgeColor] ?? "" : ""}`}
                      >
                        {item.badge.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-7 px-2 text-xs"
                    onClick={() => {
                      onClose();
                      navigate(item.href);
                    }}
                    data-testid={`modal-item-view-${item.id}`}
                  >
                    View
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {config && (
          <div className="shrink-0 pt-3 border-t flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Showing all {config.listLabel}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                navigate(config.navHref);
              }}
              data-testid="modal-nav-all"
            >
              Go to {config.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [activeActionType, setActiveActionType] = useState<string | null>(null);

  const { data, isLoading } = useQuery<HomeSummary>({
    queryKey: ["/api/home-summary"],
    staleTime: 60000,
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || user?.username || "";
  const todayLabel = format(now, "EEEE, d MMMM yyyy");

  const isProConsultant = user?.role === "consultant" && user?.consultantTier === "pro";
  const assignedConsultants = data?.assignedConsultants ?? [];
  const showThirdTile = isProConsultant && assignedConsultants.length > 0;
  console.log("[home] role:", user?.role, "tier:", user?.consultantTier, "isPro:", isProConsultant, "assignedCount:", assignedConsultants.length, "showThird:", showThirdTile);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" id="page-content">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-home-greeting">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {todayLabel} · Here's what's happening across the portal.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
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
        <>
          <div className={`grid gap-6 items-start ${showThirdTile ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {/* Urgent Actions */}
            {data && (
              <UrgentActionsPanel
                actions={data.urgentActions}
                role={user?.role ?? "client"}
                onActionClick={setActiveActionType}
              />
            )}

            {/* Portfolio */}
            {data?.portfolio && (
              <PortfolioPanel portfolio={data.portfolio} role={user?.role ?? "client"} />
            )}

            {/* My Assigned Consultants — pro consultants only, only if staff exist */}
            {showThirdTile && (
              <AssignedConsultantsPanel consultants={assignedConsultants} />
            )}
          </div>

          {/* Portal Messages — full width below */}
          {data?.portalMessages && data.portalMessages.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  From Guardian Group
                </h2>
              </div>
              <PortalMessagesPanel messages={data.portalMessages} />
            </div>
          )}
        </>
      )}

      {/* Urgent Actions drill-down modal */}
      <UrgentActionsModal
        open={!!activeActionType}
        onClose={() => setActiveActionType(null)}
        actionType={activeActionType}
      />
    </div>
  );
}
