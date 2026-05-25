import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CountUp } from "@/components/ui/count-up";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  ClipboardList,
  ListChecks,
  X,
  UserPlus,
  UserMinus,
} from "lucide-react";

interface HomeSummary {
  urgentActions: {
    overdueDocuments: number;
    approvalRequiredDocuments: number;
    pendingApprovals: number;
    openIncidents: number;
    pendingSignOffs: number;
    pendingAccessRequests: number;
    openCases: number;
  };
  bannerMessages: {
    id: string;
    title: string;
    body: string;
    ctaType: string | null;
    ctaUrl: string | null;
    ctaLabel: string | null;
  }[];
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
  banner: {
    label: "Announcement",
    icon: Megaphone,
    color: "bg-primary/10 text-primary",
    gradient: "from-primary to-primary/80",
    accentText: "text-primary-foreground/80",
    cardTop: "from-primary to-primary/80",
  },
};

const actionTypeConfig: Record<string, { label: string; listLabel: string; navHref: string }> = {
  overdue_documents: { label: "Overdue Documents", listLabel: "overdue documents", navHref: "/documents" },
  approval_required: { label: "Approval Required", listLabel: "documents requiring approval", navHref: "/documents" },
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
  scopeLabel,
  animate,
  onActionClick,
}: {
  actions: HomeSummary["urgentActions"];
  role: string;
  scopeLabel: string;
  animate: boolean;
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
      count: actions.approvalRequiredDocuments,
      type: "approval_required",
      label: "Approval Required",
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
    <Card data-testid="card-urgent-actions" className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Urgent Actions
          </CardTitle>
          {totalUrgent > 0 && (
            <Badge variant="destructive" className="text-xs tabular-nums" data-testid="badge-urgent-count">
              {totalUrgent} urgent
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs mt-0.5">{scopeLabel}</CardDescription>
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
                <span className={`text-lg font-bold ${item.color}`}>
                  <CountUp value={item.count} animate={animate} />
                </span>
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

type BannerMessage = HomeSummary["bannerMessages"][number];

function HomepageBanner({ banners }: { banners: BannerMessage[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("dismissed_banners");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem("dismissed_banners", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const active = banners.find((b) => !dismissed.has(b.id));
  if (!active) return null;

  const ctaLabels: Record<string, string> = {
    make_enquiry: "Make an Enquiry",
    navigate_to_link: "Learn More",
    book_now: "Book Now",
    contact_consultant: "Contact Consultant",
    download: "Download",
  };

  const hasCta = active.ctaType && active.ctaType !== "none";
  const ctaLabel = active.ctaLabel || (active.ctaType ? ctaLabels[active.ctaType] : null) || "Find Out More";
  const ctaHref = active.ctaType === "make_enquiry" || active.ctaType === "contact_consultant"
    ? (active.ctaUrl || "/support")
    : (active.ctaUrl || "#");
  const isExternal = ctaHref.startsWith("http");

  return (
    <div
      className="relative flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden pl-5 pr-4 py-3.5 animate-in slide-in-from-top-2 duration-300"
      data-testid={`banner-message-${active.id}`}
    >
      {/* Left accent stripe */}
      <div className="absolute inset-y-0 left-0 w-1 bg-primary rounded-l-xl" />

      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
        <Megaphone className="h-4 w-4 text-primary-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug text-foreground">{active.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{active.body}</p>
      </div>

      {/* CTA + close */}
      <div className="flex items-center gap-2 shrink-0">
        {hasCta && (
          <Button size="sm" className="h-8 text-xs rounded-lg px-4 shadow-sm" asChild>
            <a
              href={ctaHref}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
              data-testid="button-banner-cta"
            >
              {ctaLabel}
            </a>
          </Button>
        )}
        <button
          onClick={() => dismiss(active.id)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
          aria-label="Dismiss banner"
          data-testid="button-banner-dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface MyActionsData {
  assignedDocs: { count: number; items: { id: string; title: string; site_id: string | null; module: string | null; status: string; renewal_date: string | null; expiry_date: string | null }[] };
  pendingApprovals: { count: number; items: { id: string; title: string; site_id: string | null; module: string | null }[] };
  myIncidents: { count: number; items: { id: string; incident_reference: string; title: string; site_id: string; severity: string; status: string }[] };
  myCases: { count: number; items: { id: string; case_reference: string; case_name: string; employee_name: string; site_id: string; status: string }[] };
  canViewCases: boolean;
  mySupportRequests: { count: number; items: { id: string; subject: string; status: string }[] };
}

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
};

const MODULE_DOC_PATHS: Record<string, string> = {
  health_safety: "/health-safety/documents",
  human_resources: "/human-resources/documents",
  employment_law: "/employment-law/documents",
};

const MODULE_BADGE_CONFIG: Record<string, { label: string; cls: string }> = {
  health_safety:  { label: "H&S", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  human_resources: { label: "HR",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  employment_law:  { label: "EL",  cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

const ACTION_BADGE_CLS: Record<string, string> = {
  overdue:          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "due soon":       "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "pending approval": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  open:             "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  in_progress:      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  critical:         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  high:             "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

function docHref(module: string | null | undefined, docId?: string | null, siteId?: string | null): string {
  const base = MODULE_DOC_PATHS[module ?? ""] ?? "/documents";
  if (docId) return `${base}/${docId}`;
  return siteId ? `${base}?siteId=${siteId}` : base;
}

const STATUS_LABELS: Record<string, string> = {
  overdue: "Overdue",
  approval_required: "Approval Required",
  pending: "Pending",
  compliant: "Compliant",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

function formatLabel(s: string | null | undefined) {
  if (!s) return "";
  return STATUS_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface MyActionItem {
  id: string;
  label: string;
  siteLabel: string | null;
  subLabel: string | null;
  badge: string | null;
  module: string | null;
  href: string;
}

type SiteMap = Map<string, { name: string; companyName?: string }>;

function resolveSiteLabel(siteId: string | null | undefined, siteMap: SiteMap): string | null {
  if (!siteId) return null;
  const s = siteMap.get(siteId);
  if (!s) return null;
  return s.companyName ? `${s.companyName} — ${s.name}` : s.name;
}

function getMyActionItems(key: string, data: MyActionsData, siteMap: SiteMap): MyActionItem[] {
  switch (key) {
    case "assignedDocs":
      return data.assignedDocs.items.map((d) => ({
        id: d.id,
        label: d.title,
        siteLabel: resolveSiteLabel(d.site_id, siteMap),
        subLabel: formatLabel(d.status),
        badge: d.status === "overdue" ? "overdue" : d.renewal_date ? "due soon" : null,
        module: d.module ?? null,
        href: docHref(d.module, d.id, d.site_id),
      }));
    case "pendingApprovals":
      return data.pendingApprovals.items.map((d) => ({
        id: d.id,
        label: d.title,
        siteLabel: resolveSiteLabel(d.site_id, siteMap),
        subLabel: null,
        badge: "pending approval",
        module: d.module ?? null,
        href: docHref(d.module, d.id, d.site_id),
      }));
    case "myIncidents":
      return data.myIncidents.items.map((i) => ({
        id: i.id,
        label: i.incident_reference ? `${i.incident_reference} — ${i.title}` : i.title,
        siteLabel: resolveSiteLabel(i.site_id, siteMap),
        subLabel: formatLabel(i.status),
        badge: i.severity,
        module: "health_safety",
        href: "/health-safety/incidents",
      }));
    case "myCases":
      return data.myCases.items.map((c) => ({
        id: c.id,
        label: c.case_reference ? `${c.case_reference}${c.case_name ? ` — ${c.case_name}` : ""}` : c.case_name,
        siteLabel: resolveSiteLabel(c.site_id, siteMap),
        subLabel: c.employee_name || formatLabel(c.status),
        badge: c.status,
        module: "employment_law",
        href: "/employment-law/cases",
      }));
    case "mySupportRequests":
      return data.mySupportRequests.items.map((s) => ({
        id: s.id,
        label: s.subject,
        siteLabel: null,
        subLabel: null,
        badge: s.status,
        module: null,
        href: "/support",
      }));
    default:
      return [];
  }
}

function MyActionsPanel({ role }: { role: string }) {
  const [, navigate] = useLocation();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<MyActionsData>({
    queryKey: ["/api/my-actions"],
    staleTime: 60000,
  });

  const isPrivileged = role === "admin" || role === "consultant";

  const tiles = [
    {
      key: "assignedDocs",
      label: "Assigned Documents",
      sublabel: "Overdue or due in 14 days",
      count: data?.assignedDocs.count ?? 0,
      icon: FileText,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/20",
      border: "border-red-200 dark:border-red-800",
      href: "/documents",
      show: true,
    },
    {
      key: "pendingApprovals",
      label: isPrivileged ? "Awaiting My Approval" : "Awaiting My Sign-off",
      sublabel: isPrivileged ? "Client has signed off" : "Uploaded for your review",
      count: data?.pendingApprovals.count ?? 0,
      icon: FileCheck,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-800",
      href: "/documents",
      show: true,
    },
    {
      key: "myIncidents",
      label: "My Open Incidents",
      sublabel: "Assigned to you",
      count: data?.myIncidents.count ?? 0,
      icon: ShieldAlert,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/20",
      border: "border-orange-200 dark:border-orange-800",
      href: "/health-safety/incidents",
      show: isPrivileged,
    },
    {
      key: "myCases",
      label: "My Open Cases",
      sublabel: "Assigned to you",
      count: data?.myCases.count ?? 0,
      icon: Briefcase,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/20",
      border: "border-teal-200 dark:border-teal-800",
      href: "/employment-law/cases",
      show: isPrivileged && (data?.canViewCases ?? false),
    },
    {
      key: "mySupportRequests",
      label: "My Support Requests",
      sublabel: "Assigned to you",
      count: data?.mySupportRequests.count ?? 0,
      icon: Users,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/20",
      border: "border-violet-200 dark:border-violet-800",
      href: "/support",
      show: isPrivileged,
    },
  ].filter((t) => t.show);

  const totalActions = tiles.reduce((s, t) => s + t.count, 0);
  const allClear = !isLoading && totalActions === 0;

  const { data: homeSummary } = useQuery<HomeSummary>({
    queryKey: ["/api/home-summary"],
    staleTime: 60000,
  });

  const siteMap = useMemo<SiteMap>(() => {
    const map: SiteMap = new Map();
    const p = homeSummary?.portfolio;
    if (!p) return map;
    if ("assignedSites" in p) {
      for (const s of p.assignedSites) map.set(s.id, { name: s.name, companyName: s.companyName });
    } else if ("site" in p && p.site) {
      map.set(p.site.id, { name: p.site.name, companyName: p.site.companyName });
    }
    return map;
  }, [homeSummary]);

  const activeTile = tiles.find((t) => t.key === activeKey) ?? null;
  const modalItems = data && activeKey ? getMyActionItems(activeKey, data, siteMap) : [];

  return (
    <>
      <Card data-testid="card-my-actions" className="border-t-4 border-t-amber-500">
        <CardHeader className="pb-3 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
                <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              My Actions
            </CardTitle>
            {!isLoading && totalActions > 0 && (
              <Badge className="bg-amber-500 text-white text-xs tabular-nums" data-testid="badge-my-actions-count">
                {totalActions} pending
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Actions assigned directly to you — overdue or due within 14 days</p>
        </CardHeader>
        <CardContent className="pt-3">
          {isLoading ? (
            <div className="h-16 flex items-center justify-center">
              <FetchingOverlay />
            </div>
          ) : allClear ? (
            <div className="flex items-center gap-3 py-3 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">You're all caught up</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">No actions assigned to you right now</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map((tile) => {
                const Icon = tile.icon;
                const hasItems = tile.count > 0;
                return (
                  <button
                    key={tile.key}
                    onClick={() => { if (hasItems) setActiveKey(tile.key); }}
                    disabled={!hasItems}
                    className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all ${hasItems ? "hover:shadow-sm hover:scale-[1.02] cursor-pointer" : "opacity-50 cursor-default"} ${tile.bg} ${tile.border}`}
                    data-testid={`button-my-action-${tile.key}`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={`h-4 w-4 ${tile.color}`} />
                      <span className={`text-xl font-bold tabular-nums ${hasItems ? tile.color : "text-muted-foreground"}`}>
                        {tile.count}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground leading-tight">{tile.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{tile.sublabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Actions detail modal */}
      <Dialog open={!!activeKey} onOpenChange={(v) => !v && setActiveKey(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col" data-testid="modal-my-action">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base flex items-center gap-2">
              {activeTile && (() => { const Icon = activeTile.icon; return <Icon className={`h-4 w-4 ${activeTile.color}`} />; })()}
              {activeTile?.label ?? "Items"}
              {modalItems.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">({modalItems.length})</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-1">
            {modalItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <p className="text-sm text-muted-foreground">Nothing to show right now.</p>
              </div>
            ) : (
              <div className="space-y-2 py-1">
                {modalItems.map((item) => {
                  const modBadge = item.module ? MODULE_BADGE_CONFIG[item.module] : null;
                  const badgeCls = item.badge ? (ACTION_BADGE_CLS[item.badge] ?? ACTION_BADGE_CLS[item.badge.toLowerCase()] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300") : null;
                  const TileIcon = activeTile?.icon ?? FileText;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveKey(null); navigate(item.href); }}
                      className="w-full flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/50 hover:border-border/80 transition-colors group"
                      data-testid={`my-action-item-${item.id}`}
                    >
                      {/* Left icon */}
                      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 group-hover:bg-muted">
                        <TileIcon className={`h-4 w-4 ${activeTile?.color ?? "text-muted-foreground"}`} />
                      </div>

                      {/* Title + site + subLabel */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug truncate">{item.label}</p>
                        {item.siteLabel && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.siteLabel}</p>
                        )}
                        {item.subLabel && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.subLabel}</p>
                        )}
                      </div>

                      {/* Right badges */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {modBadge && (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${modBadge.cls}`}>
                            {modBadge.label}
                          </span>
                        )}
                        {item.badge && badgeCls && (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${badgeCls}`}>
                            {item.badge.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}

const PORTFOLIO_INITIAL_ROWS = 4;

function PortfolioPanel({ portfolio, role, animate }: { portfolio: HomeSummary["portfolio"]; role: string; animate: boolean }) {
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
      <Card data-testid="card-portfolio" className="h-full border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-transparent">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            My Portfolio
          </CardTitle>
          <p className="text-xs text-muted-foreground">Your assigned clients &amp; sites</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-center" data-testid="stat-companies">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Landmark className="h-3.5 w-3.5 text-primary" />
                <p className="text-2xl font-bold tabular-nums text-primary"><CountUp value={totalCompanies} animate={animate} /></p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {totalCompanies === 1 ? "Company" : "Companies"}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-center" data-testid="stat-sites">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <p className="text-2xl font-bold tabular-nums text-primary"><CountUp value={totalSites} animate={animate} /></p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">
                {totalSites === 1 ? "Site" : "Sites"}
              </p>
            </div>
          </div>

          {/* Client list */}
          {totalCompanies > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-0.5">
                Clients
              </p>
              <div className="space-y-0.5">
                {visibleCompanies.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all group"
                    data-testid={`company-portfolio-${c.name}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm truncate font-medium">{c.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2 tabular-nums bg-muted rounded px-1.5 py-0.5">
                      {c.siteCount} {c.siteCount === 1 ? "site" : "sites"}
                    </span>
                  </div>
                ))}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1.5 rounded-md hover:bg-primary/5"
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

          <Button size="sm" className="w-full mt-auto" asChild>
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
  animate,
}: {
  consultants: NonNullable<HomeSummary["assignedConsultants"]>;
  animate: boolean;
}) {
  return (
    <Card data-testid="card-assigned-consultants" className="h-full border-t-4 border-t-primary overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-transparent">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <UserCog className="h-4 w-4 text-primary" />
          </div>
          My Assigned Consultants
        </CardTitle>
        <p className="text-xs text-muted-foreground">Your assigned H&amp;S consultants</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-center" data-testid="stat-consultants">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            <p className="text-2xl font-bold tabular-nums text-primary"><CountUp value={consultants.length} animate={animate} /></p>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {consultants.length === 1 ? "Consultant" : "Consultants"}
          </p>
        </div>

        {consultants.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-0.5">
              Consultants
            </p>
            <div className="space-y-0.5">
              {consultants.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all group"
                  data-testid={`assigned-consultant-${c.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                      {c.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm truncate font-medium">{c.fullName}</span>
                  </div>
                  {c.consultantTier === "pro" && (
                    <span className="shrink-0 ml-2 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                      Pro
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {consultants.length === 0 && (
          <div className="flex items-center justify-center text-center py-4">
            <p className="text-sm text-muted-foreground">No consultants assigned yet.</p>
          </div>
        )}

        <Button size="sm" className="w-full mt-auto" asChild>
          <Link href="/users?staffFilter=my_staff" data-testid="link-view-all-consultants">
            View All Consultants
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
            <FetchingOverlay />
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

      </DialogContent>
    </Dialog>
  );
}

// ── Consultant Coverage ───────────────────────────────────────────────────────

interface CoverageEntry {
  id: string;
  absentConsultantId: string;
  coveringConsultantId: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  createdAt: string;
}

interface MyCoverageResponse {
  coveringFor: (CoverageEntry & { absentConsultantName: string })[];
  beingCoveredBy: (CoverageEntry & { coveringConsultantName: string })[];
}

interface EligibleConsultant {
  id: string;
  fullName: string;
  consultantTier?: string;
}

function ArrangeCoverDialog({ open, onClose, defaultAbsentId }: { open: boolean; onClose: () => void; defaultAbsentId: string }) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedCoveringIds, setSelectedCoveringIds] = useState<string[]>([]);

  const { data: eligible = [], isLoading: loadingEligible } = useQuery<EligibleConsultant[]>({
    queryKey: ["/api/consultant-coverage/eligible-consultants", defaultAbsentId],
    queryFn: () =>
      fetch(`/api/consultant-coverage/eligible-consultants?absentConsultantId=${encodeURIComponent(defaultAbsentId)}`, { credentials: "include" }).then(r => r.json()),
    enabled: open && !!defaultAbsentId,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/consultant-coverage", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-coverage/my-active"] });
      toast({ description: "Cover arranged successfully." });
      setSelectedCoveringIds([]);
      onClose();
    },
    onError: () => toast({ variant: "destructive", description: "Failed to arrange cover." }),
  });

  const toggleCovering = (id: string) => {
    setSelectedCoveringIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    if (!startDate || !endDate || selectedCoveringIds.length === 0) return;
    mutation.mutate({ absentConsultantId: defaultAbsentId, coveringConsultantIds: selectedCoveringIds, startDate, endDate });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-arrange-cover">
        <DialogHeader>
          <DialogTitle>Arrange Cover</DialogTitle>
          <DialogDescription>
            Selected consultants will temporarily see all of your assigned clients.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} data-testid="input-cover-start" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} data-testid="input-cover-end" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Covering consultants</Label>
            {loadingEligible ? (
              <p className="text-sm text-muted-foreground py-2">Loading…</p>
            ) : eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No eligible consultants found.</p>
            ) : (
              <div className="rounded-md border max-h-48 overflow-y-auto divide-y">
                {eligible.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40" data-testid={`cover-consultant-${c.id}`}>
                    <Checkbox
                      checked={selectedCoveringIds.includes(c.id)}
                      onCheckedChange={() => toggleCovering(c.id)}
                    />
                    <span className="text-sm flex-1">{c.fullName}</span>
                    {c.consultantTier === "pro" && (
                      <Badge variant="secondary" className="text-[10px]">Pro</Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-cover">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || selectedCoveringIds.length === 0 || !startDate || !endDate || startDate > endDate}
            data-testid="button-confirm-cover"
          >
            {mutation.isPending ? "Saving…" : "Arrange Cover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsultantCoveragePanel({ userId }: { userId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<MyCoverageResponse>({
    queryKey: ["/api/consultant-coverage/my-active"],
    staleTime: 30000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/consultant-coverage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-coverage/my-active"] });
      toast({ description: "Coverage arrangement removed." });
    },
    onError: () => toast({ variant: "destructive", description: "Failed to remove coverage." }),
  });

  const coveringFor = data?.coveringFor ?? [];
  const beingCoveredBy = data?.beingCoveredBy ?? [];
  const hasAny = coveringFor.length > 0 || beingCoveredBy.length > 0;

  return (
    <>
      <Card data-testid="panel-consultant-coverage">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Client Cover</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(true)}
              data-testid="button-arrange-cover"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Arrange Cover
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <FetchingOverlay />
          ) : !hasAny ? (
            <p className="text-sm text-muted-foreground">
              No active cover arrangements. Use <strong>Arrange Cover</strong> to delegate your clients while you're away.
            </p>
          ) : (
            <div className="space-y-4">
              {beingCoveredBy.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Being covered by</p>
                  <div className="space-y-1.5">
                    {beingCoveredBy.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2" data-testid={`coverage-covered-by-${e.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="text-sm truncate">{e.coveringConsultantName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{e.startDate} – {e.endDate}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => cancelMutation.mutate(e.id)}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-coverage-${e.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {coveringFor.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Covering for</p>
                  <div className="space-y-1.5">
                    {coveringFor.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2" data-testid={`coverage-covering-for-${e.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <UserMinus className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="text-sm truncate">{e.absentConsultantName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{e.startDate} – {e.endDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ArrangeCoverDialog open={dialogOpen} onClose={() => setDialogOpen(false)} defaultAbsentId={userId} />
    </>
  );
}

const EMPTY_URGENT_ACTIONS: HomeSummary["urgentActions"] = {
  overdueDocuments: 0,
  approvalRequiredDocuments: 0,
  pendingApprovals: 0,
  openIncidents: 0,
  pendingSignOffs: 0,
  pendingAccessRequests: 0,
  openCases: 0,
};

export default function HomePage() {
  const { user } = useAuth();
  const [activeActionType, setActiveActionType] = useState<string | null>(null);
  const wasLoadingRef = useRef(false);

  const { data, isLoading } = useQuery<HomeSummary>({
    queryKey: ["/api/home-summary"],
    staleTime: 60000,
  });

  if (isLoading) wasLoadingRef.current = true;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName || user?.fullName?.split(" ")[0] || user?.username || "";
  const todayLabel = format(now, "EEEE, d MMMM yyyy");

  const urgentActions = data?.urgentActions ?? EMPTY_URGENT_ACTIONS;
  const isProConsultant = user?.role === "consultant" && user?.consultantTier === "pro";
  const assignedConsultants = data?.assignedConsultants ?? [];
  const showThirdTile = isProConsultant && assignedConsultants.length > 0;
  const animate = wasLoadingRef.current;

  const urgentScopeLabel = (() => {
    const role = user?.role;
    if (role === "admin") return "Across all companies and sites";
    if (role === "consultant") return "Across your assigned sites";
    const portfolio = data?.portfolio as { site?: { name: string } | null } | null;
    const companyName = portfolio?.site?.name;
    return companyName ? `For ${companyName}` : "For your accessible sites";
  })();

  const bannerMessages = data?.bannerMessages ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto dash-animate" id="page-content">
      {/* Homepage Banner */}
      {bannerMessages.length > 0 && (
        <HomepageBanner banners={bannerMessages} />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-home-greeting">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {todayLabel} · Here's what's happening across the portal.
        </p>
      </div>

      <div className="grid gap-6 items-stretch md:grid-cols-2">
        {/* Portfolio — slot 1 */}
        {isLoading ? (
          <Card className="h-full">
            <CardContent className="p-6 h-full">
              <FetchingOverlay />
            </CardContent>
          </Card>
        ) : data?.portfolio ? (
          <PortfolioPanel portfolio={data.portfolio} role={user?.role ?? "client"} animate={animate} />
        ) : null}

        {/* My Assigned Consultants — slot 2, pro consultants only; empty div keeps portfolio width when not shown */}
        {showThirdTile
          ? <AssignedConsultantsPanel consultants={assignedConsultants} animate={animate} />
          : <div />
        }
      </div>

      {/* Client Cover — consultants only */}
      {user?.role === "consultant" && user?.id && (
        <ConsultantCoveragePanel userId={user.id} />
      )}

      {/* My Actions — full width, between portfolio and messages */}
      <MyActionsPanel role={user?.role ?? "client"} />

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

      {/* Urgent Actions drill-down modal — hidden while panel is hidden */}
    </div>
  );
}
