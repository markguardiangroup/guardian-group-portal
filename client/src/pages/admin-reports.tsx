import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileText,
  Users,
  MapPin,
  ShieldAlert,
  Building2,
  ClipboardList,
  History,
  Mail,
  Search,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Activity,
  CalendarClock,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Company, AcceloSyncLog } from "@shared/schema";
import { TablePagination, type PageSize } from "@/components/table-pagination";

// ── Types ───────────────────────────────────────────────────────────────────

interface UserReportData {
  id: string;
  referenceNumber: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  consultantTier?: string | null;
  status: string;
  companyId: string | null;
  jobTitle?: string | null;
  siteAssignments?: { siteId: string; siteName: string }[];
  keyContactCompanies?: string[];
  keyContactSites?: string[];
}

interface EmailSummary {
  id: string;
  to: string[];
  fromAddress: string;
  subject: string;
  status: string;
  sentAt: string;
  lastEventAt: string | null;
}

interface EmailDetail extends EmailSummary {
  replyTo: string[] | null;
  bcc: string[] | null;
  cc: string[] | null;
  events: { name: string; createdAt: string; reason?: string }[];
  errorReason?: string | null;
}

interface EmailLogsResponse {
  emails: EmailSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  environment: "production" | "development";
  truncated?: boolean;
}

interface EmailDetailResponse {
  email: EmailDetail;
  environment: "production" | "development";
}

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  delivered:  { label: "Delivered",  className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  opened:     { label: "Opened",     className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  bounced:    { label: "Bounced",    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
  complained: { label: "Complained", className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
  sent:       { label: "Sent",       className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800" },
  clicked:    { label: "Clicked",    className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  unsubscribed: { label: "Unsubscribed", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? { label: status ?? "Unknown", className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function safeFormatDate(iso: string | null | undefined, fmt = "dd MMM yyyy, HH:mm") {
  if (!iso) return "—";
  try { return format(parseISO(iso), fmt); } catch { return iso; }
}

// ── Email Detail Sheet ───────────────────────────────────────────────────────

function EmailDetailSheet({
  emailId,
  open,
  onOpenChange,
}: {
  emailId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<EmailDetailResponse>({
    queryKey: ["/api/admin/email-logs", emailId],
    enabled: open && !!emailId,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Always fetch fresh data when the sheet opens for a new email
  useEffect(() => {
    if (open && emailId) refetch();
  }, [open, emailId]);

  const email = data?.email;

  function copyId() {
    if (!email?.id) return;
    navigator.clipboard.writeText(email.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const EVENT_ORDER: Record<string, number> = {
    email_sent: 0, sent: 0,
    email_delivered: 1, delivered: 1,
    email_opened: 2, opened: 2,
    email_clicked: 3, clicked: 3,
    email_bounced: 4, bounced: 4,
    email_complained: 5, complained: 5,
    email_unsubscribed: 6, unsubscribed: 6,
  };

  const sortedEvents = email?.events
    ? [...email.events].sort((a, b) => {
        const oa = EVENT_ORDER[a.name?.toLowerCase()] ?? 99;
        const ob = EVENT_ORDER[b.name?.toLowerCase()] ?? 99;
        if (oa !== ob) return oa - ob;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
    : [];

  function normaliseEventName(name: string) {
    return name.replace(/^email_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-email-detail">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Details
          </SheetTitle>
          <SheetDescription>Full metadata and event timeline for this email.</SheetDescription>
        </SheetHeader>

        {isLoading && <FetchingOverlay />}

        {isError && (
          <div className="mt-6 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">{(error as Error)?.message ?? "Failed to load email details."}</p>
          </div>
        )}

        {email && (
          <div className="mt-6 space-y-6">
            {/* Metadata */}
            <div className="rounded-md border divide-y text-sm">
              {[
                { label: "Subject", value: email.subject },
                { label: "To", value: email.to.join(", ") },
                { label: "From", value: email.fromAddress },
                ...(email.replyTo?.length ? [{ label: "Reply-To", value: email.replyTo.join(", ") }] : []),
                ...(email.cc?.length ? [{ label: "CC", value: email.cc.join(", ") }] : []),
                ...(email.bcc?.length ? [{ label: "BCC", value: email.bcc.join(", ") }] : []),
                { label: "Status", value: <StatusBadge status={email.status} /> },
                { label: "Sent", value: safeFormatDate(email.sentAt) },
                ...(email.lastEventAt ? [{ label: "Last Event", value: safeFormatDate(email.lastEventAt) }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2 px-3 py-2">
                  <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
                  <span className="break-all font-medium">{value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="w-24 shrink-0 text-muted-foreground">Message ID</span>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{email.id}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={copyId}
                  data-testid="button-copy-message-id"
                  title="Copy message ID"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Bounce / complaint error reason */}
            {email.errorReason && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2" data-testid="text-error-reason">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">Delivery Error</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{email.errorReason}</p>
                </div>
              </div>
            )}

            {/* Event Timeline */}
            <div>
              <h4 className="mb-3 font-semibold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Event Timeline
              </h4>
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <ol className="relative border-l border-muted ml-2 space-y-4" data-testid="email-event-timeline">
                  {sortedEvents.map((ev, idx) => {
                    const statusCfg = STATUS_CONFIG[ev.name?.toLowerCase().replace(/^email_/, "")] ?? null;
                    return (
                      <li key={idx} className="ml-4" data-testid={`event-item-${idx}`}>
                        <span className="absolute -left-[5px] mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground bg-background" />
                        <div className="flex items-center gap-2">
                          {statusCfg ? (
                            <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                              {normaliseEventName(ev.name)}
                            </Badge>
                          ) : (
                            <span className="text-sm font-medium capitalize">{normaliseEventName(ev.name)}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{safeFormatDate(ev.createdAt)}</p>
                        {ev.reason && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400 italic" data-testid={`event-reason-${idx}`}>
                            {ev.reason}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Email Delivery Log Dialog ────────────────────────────────────────────────

function EmailDeliveryLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [dateRange, setDateRange] = useState("7d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [dateRange, statusFilter, debouncedSearch, pageSize]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = open
    ? [`/api/admin/email-logs?page=${page}&pageSize=${pageSize}&dateRange=${dateRange}&status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}`]
    : null;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<EmailLogsResponse>({
    queryKey: queryKey ?? ["/api/admin/email-logs-disabled"],
    enabled: open,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch live data whenever the dialog is opened (even if cache exists)
  useEffect(() => {
    if (open) refetch();
  }, [open]);

  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const environment = data?.environment;
  const truncated = data?.truncated ?? false;

  function openDetail(id: string) {
    setSelectedEmailId(id);
    setDetailOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5" />
                  Email Delivery Log
                </DialogTitle>
                {environment && (
                  <Badge
                    variant="outline"
                    className={
                      environment === "production"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                    }
                    data-testid="badge-environment"
                  >
                    {environment === "production" ? "Production" : "Development"}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-email-logs"
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <DialogDescription>
              Transactional emails sent via Resend. Data is fetched live — no email metadata is stored in this app.
            </DialogDescription>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search recipient or subject…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-email-search"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-9 w-[130px]" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="15d">Last 15 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[140px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="complained">Complained</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>

          {/* Table area */}
          <div className="flex-1 overflow-auto relative">
            {isLoading && <FetchingOverlay />}

            {isError && (
              <div className="m-6 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Failed to load email logs</p>
                  <p className="text-sm mt-1 opacity-80">
                    {(() => {
                      const msg = (error as Error)?.message ?? "";
                      if (/restricted_api_key|restricted to only send/i.test(msg)) {
                        return "The Resend API key is a send-only (restricted) key and cannot list emails. Replace RESEND_API_KEY (dev) or RESEND_API_KEY_PROD (production) with a Full access key from the Resend dashboard.";
                      }
                      if (/Resend API/i.test(msg)) {
                        return "The Resend API key may be missing or invalid. Check that RESEND_API_KEY (dev) or RESEND_API_KEY_PROD (production) is set to a Full access key.";
                      }
                      return msg || "An unexpected error occurred.";
                    })()}
                  </p>
                </div>
              </div>
            )}

            {!isLoading && !isError && truncated && (
              <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3" data-testid="banner-truncated">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Results are limited to the most recent 500 emails fetched from Resend.
                  To see older emails, narrow the date range or check the Resend dashboard directly.
                </p>
              </div>
            )}

            {!isLoading && !isError && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Sent</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow key={email.id} data-testid={`row-email-${email.id}`}>
                        <TableCell className="pl-6 whitespace-nowrap text-sm text-muted-foreground">
                          {safeFormatDate(email.sentAt, "dd MMM yy, HH:mm")}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="block truncate text-sm" title={email.to.join(", ")}>
                            {email.to.join(", ")}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="block truncate text-sm" title={email.subject}>
                            {email.subject}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={email.status} />
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(email.id)}
                            data-testid={`button-email-details-${email.id}`}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {emails.length === 0 && !isFetching && (
                  <div className="py-12 text-center text-muted-foreground" data-testid="text-email-empty">
                    <Mail className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    <p className="text-sm">No emails found matching the current filters.</p>
                  </div>
                )}

                <TablePagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                  itemLabel="emails"
                  alwaysShow={total > 0}
                  className="-mx-0 px-6"
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EmailDetailSheet
        emailId={selectedEmailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const { user } = useAuth();
  const [showUsersReport, setShowUsersReport] = useState(false);
  const [showEmailLog, setShowEmailLog] = useState(false);
  const [showActiveUsers, setShowActiveUsers] = useState(false);
  interface ActiveUserEntry {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    companyId: string | null;
    sessionCount: number;
    sessionExpiresAt: string;
  }
  const {
    data: activeUsersData,
    isLoading: activeUsersLoading,
    isFetching: activeUsersFetching,
    refetch: refetchActiveUsers,
    dataUpdatedAt: activeUsersUpdatedAt,
  } = useQuery<{ count: number; generatedAt: string; activeUsers: ActiveUserEntry[] }>({
    queryKey: ["/api/admin/active-users"],
    enabled: showActiveUsers,
    refetchInterval: showActiveUsers ? 30_000 : false,
    refetchIntervalInBackground: false,
  });

  const [showAcceloSyncLog, setShowAcceloSyncLog] = useState(false);
  const { data: acceloSyncLogs = [], isLoading: acceloSyncLogsLoading, refetch: refetchAcceloSyncLogs } = useQuery<AcceloSyncLog[]>({
    queryKey: ["/api/admin/accelo-sync-logs"],
    enabled: showAcceloSyncLog,
    staleTime: 0,
  });

  interface ScheduledTask {
    id: string;
    name: string;
    description: string;
    schedule: string;
    runsIn: "all" | "production";
    lastRunAt: string | null;
  }
  interface ScheduledTasksResponse {
    environment: "production" | "development";
    tasks: ScheduledTask[];
  }
  const [showScheduledTasks, setShowScheduledTasks] = useState(false);
  const { data: scheduledTasksData, isLoading: scheduledTasksLoading, isError: scheduledTasksError, refetch: refetchScheduledTasks } = useQuery<ScheduledTasksResponse>({
    queryKey: ["/api/admin/scheduled-tasks"],
    enabled: showScheduledTasks,
    staleTime: 0,
    gcTime: 0,
  });

  const [showLoginReport, setShowLoginReport] = useState(false);
  type LoginRangePreset = "today" | "3d" | "7d" | "30d" | "custom";
  const [loginReportRange, setLoginReportRange] = useState<LoginRangePreset>("today");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [loginReportFrom, setLoginReportFrom] = useState(todayStr);
  const [loginReportTo, setLoginReportTo] = useState(todayStr);

  // Keep custom from/to in sync with the selected preset so the user can flip
  // to "Custom" and start tweaking from the preset's window.
  useEffect(() => {
    if (loginReportRange === "custom") return;
    const days =
      loginReportRange === "30d" ? 30 :
      loginReportRange === "7d" ? 7 :
      loginReportRange === "3d" ? 3 : 1;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setLoginReportFrom(format(start, "yyyy-MM-dd"));
    setLoginReportTo(format(end, "yyyy-MM-dd"));
  }, [loginReportRange]);

  interface LoginAuditEntry {
    id: string;
    userId: string;
    userName: string;
    details: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }
  const loginReportQs =
    loginReportRange === "custom"
      ? `from=${loginReportFrom}&to=${loginReportTo}`
      : `range=${loginReportRange}`;
  const { data: loginReportData, isLoading: loginReportLoading } = useQuery<{ from: string; to: string; range: string; logins: LoginAuditEntry[] }>({
    queryKey: ["/api/admin/login-report", loginReportRange, loginReportFrom, loginReportTo],
    queryFn: async () => {
      const res = await fetch(`/api/admin/login-report?${loginReportQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch login report");
      return res.json();
    },
    enabled: showLoginReport,
  });

  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({
    queryKey: ["/api/companies?limit=1000"],
  });
  const companies = companiesData?.companies || [];

  const { data: usersData = [], isLoading: usersLoading } = useQuery<UserReportData[]>({
    queryKey: ["/api/users"],
    enabled: showUsersReport,
  });

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    consultant: "Consultant",
    client: "Client",
  };

  const roleColors: Record<UserRole, string> = {
    admin: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    consultant: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    client: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  };

  const proConsultantColor = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800";

  const getUserRoleLabel = (u: UserReportData) =>
    u.role === "consultant" && u.consultantTier === "pro" ? "Pro Consultant" : roleLabels[u.role];

  const getUserRoleColor = (u: UserReportData) =>
    u.role === "consultant" && u.consultantTier === "pro" ? proConsultantColor : roleColors[u.role];

  const downloadUsersCSV = () => {
    const headers = ["Reference", "Full Name", "Email", "Role", "Status", "Company", "Job Title", "Assigned Sites", "Key Contact (Company)", "Key Contact (Site)"];
    const rows = usersData.map(u => {
      const company = companies.find(c => c.id === u.companyId);
      const sites = u.siteAssignments?.map(s => s.siteName).join("; ") || "";
      const kcCompanies = u.keyContactCompanies?.join("; ") || "";
      const kcSites = u.keyContactSites?.join("; ") || "";
      return [
        u.referenceNumber || "",
        u.fullName,
        u.email,
        getUserRoleLabel(u),
        u.status,
        company?.name || "",
        u.jobTitle || "",
        sites,
        kcCompanies,
        kcSites,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `users_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Only administrators can access this page
  if (!user || user.role !== "admin") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This section is restricted to administrators only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-8 w-8" />
            Admin Reports
          </h1>
          <p className="mt-1 text-muted-foreground">
            Confidential reports for administrators only
          </p>
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Confidential Information</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Reports in this section contain sensitive data and are only visible to administrators.
                Do not share this information with unauthorised personnel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Available Admin Reports
          </CardTitle>
          <CardDescription>Generate and download confidential reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Users Report — visible to admins and consultants */}
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowUsersReport(true)}
              data-testid="report-users"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Users Report</p>
                  <p className="text-sm text-muted-foreground">All users with roles and site assignments</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>

            {/* Changelog / Release Notes */}
            <Link href="/admin-reports/changelog">
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                data-testid="report-changelog"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-500/10">
                    <History className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="font-medium">Changelog / Release Notes</p>
                    <p className="text-sm text-muted-foreground">Track software changes and version history</p>
                  </div>
                </div>
                <Badge variant="secondary">Open</Badge>
              </div>
            </Link>

            {/* Active Users Now */}
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowActiveUsers(true)}
              data-testid="report-active-users"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                  <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-medium">Active Users Now</p>
                  <p className="text-sm text-muted-foreground">Users with a current signed-in session</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>

            {/* User Logins Report */}
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowLoginReport(true)}
              data-testid="report-user-logins"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                  <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium">User Logins</p>
                  <p className="text-sm text-muted-foreground">All successful sign-ins, filterable by date</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>

            {/* Email Delivery Log — admin only */}
            {isAdmin && (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                onClick={() => setShowEmailLog(true)}
                data-testid="report-email-delivery-log"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-500/10">
                    <Mail className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-medium">Email Delivery Log</p>
                    <p className="text-sm text-muted-foreground">Live delivery status from Resend</p>
                  </div>
                </div>
                <Badge variant="secondary">View</Badge>
              </div>
            )}

            {/* Accelo Sync Log — admin only */}
            {isAdmin && (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                onClick={() => setShowAcceloSyncLog(true)}
                data-testid="report-accelo-sync-log"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-500/10">
                    <RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-medium">Accelo Sync Log</p>
                    <p className="text-sm text-muted-foreground">History of imports, manual syncs, and scheduled Accelo syncs</p>
                  </div>
                </div>
                <Badge variant="secondary">View</Badge>
              </div>
            )}

            {/* Scheduled Tasks — admin only */}
            {isAdmin && (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                onClick={() => { queryClient.resetQueries({ queryKey: ["/api/admin/scheduled-tasks"] }); setShowScheduledTasks(true); }}
                data-testid="report-scheduled-tasks"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-500/10">
                    <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="font-medium">Scheduled Tasks</p>
                    <p className="text-sm text-muted-foreground">All background jobs — schedule, environment, and last run</p>
                  </div>
                </div>
                <Badge variant="secondary">View</Badge>
              </div>
            )}

            {[
              { title: "Audit Trail Export", description: "Full audit log of all user actions", format: "CSV", icon: ClipboardList },
              { title: "Access Permissions", description: "User access levels across all sites", format: "Excel", icon: ShieldAlert },
              { title: "Company Summary", description: "Detailed breakdown by company", format: "PDF", icon: Building2 },
            ].map((report) => (
              <div key={report.title} className="flex items-center justify-between gap-4 rounded-md border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <report.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">{report.format}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Report Dialog */}
      <Dialog open={showUsersReport} onOpenChange={setShowUsersReport}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users Report
            </DialogTitle>
            <DialogDescription>
              Complete list of all users with their roles and site assignments. Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Roles:</span>
                <Badge variant="outline" className={roleColors.admin}>Administrator</Badge>
                <Badge variant="outline" className={roleColors.consultant}>Consultant</Badge>
                <Badge variant="outline" className={proConsultantColor}>Pro Consultant</Badge>
                <Badge variant="outline" className={roleColors.client}>Client</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={downloadUsersCSV} data-testid="button-download-users-csv">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {usersLoading ? (
              <FetchingOverlay />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Sites</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.map((u) => (
                      <TableRow key={u.id} data-testid={`report-row-user-${u.id}`}>
                        <TableCell>
                          <span className="font-mono text-sm">{u.referenceNumber || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{u.fullName}</div>
                          {u.jobTitle && (
                            <div className="text-xs text-muted-foreground">{u.jobTitle}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getUserRoleColor(u)}>
                            {getUserRoleLabel(u)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.companyId ? (
                            <span className="text-sm">
                              {companies.find(c => c.id === u.companyId)?.name || "-"}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : "secondary"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.siteAssignments && u.siteAssignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.siteAssignments.slice(0, 3).map((site) => (
                                <Badge key={site.siteId} variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {site.siteName}
                                </Badge>
                              ))}
                              {u.siteAssignments.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{u.siteAssignments.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No assignments</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {usersData.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No users found.
                  </div>
                )}

                <div className="mt-6 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium">Summary</h4>
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold">{usersData.length}</p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-purple-600">
                        {usersData.filter(u => u.role === "admin").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Administrators</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-blue-600">
                        {usersData.filter(u => u.role === "consultant" && u.consultantTier !== "pro").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Consultants</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-indigo-600">
                        {usersData.filter(u => u.role === "consultant" && u.consultantTier === "pro").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Pro Consultants</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-emerald-600">
                        {usersData.filter(u => u.role === "client").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Clients</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Delivery Log Dialog — admin only */}
      {isAdmin && (
        <EmailDeliveryLogDialog
          open={showEmailLog}
          onOpenChange={setShowEmailLog}
        />
      )}

      {/* Active Users Now Dialog */}
      <Dialog open={showActiveUsers} onOpenChange={setShowActiveUsers}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto" data-testid="dialog-active-users">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Users Now
            </DialogTitle>
            <DialogDescription>
              Users with at least one current signed-in session. Auto-refreshes every 30 seconds while this window is open.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" data-testid="badge-active-users-count">
                {activeUsersData?.count ?? 0} active user{(activeUsersData?.count ?? 0) === 1 ? "" : "s"}
              </Badge>
              {activeUsersUpdatedAt > 0 && (
                <span className="text-xs text-muted-foreground" data-testid="text-active-users-updated">
                  Updated {format(new Date(activeUsersUpdatedAt), "HH:mm:ss")}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchActiveUsers()}
              disabled={activeUsersFetching}
              data-testid="button-refresh-active-users"
            >
              {activeUsersFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="mt-4 rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Session expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                      Loading active users…
                    </TableCell>
                  </TableRow>
                ) : (activeUsersData?.activeUsers ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No active sessions right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  (activeUsersData?.activeUsers ?? []).map((u) => {
                    const company = companiesData?.companies.find((c) => c.id === u.companyId);
                    return (
                      <TableRow key={u.id} data-testid={`row-active-user-${u.id}`}>
                        <TableCell className="font-medium" data-testid={`text-active-name-${u.id}`}>
                          {u.name ?? "—"}
                        </TableCell>
                        <TableCell data-testid={`text-active-email-${u.id}`}>{u.email ?? "—"}</TableCell>
                        <TableCell>
                          {u.role ? (
                            <Badge variant="outline" data-testid={`badge-active-role-${u.id}`}>{u.role}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell data-testid={`text-active-company-${u.id}`}>
                          {company?.name ?? (u.companyId ? "—" : "—")}
                        </TableCell>
                        <TableCell data-testid={`text-active-expires-${u.id}`}>
                          {format(parseISO(u.sessionExpiresAt), "PP HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Logins Report Dialog */}
      <Dialog open={showLoginReport} onOpenChange={setShowLoginReport}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto" data-testid="dialog-login-report">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              User Logins
            </DialogTitle>
            <DialogDescription>
              Successful sign-ins recorded in the audit log. Defaults to today.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <label className="text-sm text-muted-foreground" htmlFor="login-report-range">Range</label>
            <Select
              value={loginReportRange}
              onValueChange={(v) => setLoginReportRange(v as LoginRangePreset)}
            >
              <SelectTrigger id="login-report-range" className="h-9 w-[170px]" data-testid="select-login-report-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="3d">Last 3 days</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>

            {loginReportRange === "custom" && (
              <>
                <label className="text-sm text-muted-foreground" htmlFor="login-report-from">From</label>
                <Input
                  id="login-report-from"
                  type="date"
                  value={loginReportFrom}
                  onChange={(e) => setLoginReportFrom(e.target.value)}
                  className="h-9 w-[160px]"
                  data-testid="input-login-report-from"
                />
                <label className="text-sm text-muted-foreground" htmlFor="login-report-to">To</label>
                <Input
                  id="login-report-to"
                  type="date"
                  value={loginReportTo}
                  onChange={(e) => setLoginReportTo(e.target.value)}
                  className="h-9 w-[160px]"
                  data-testid="input-login-report-to"
                />
              </>
            )}

            <Badge variant="secondary" data-testid="badge-login-count">
              {loginReportData?.logins.length ?? 0} login{(loginReportData?.logins.length ?? 0) === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="mt-4 rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP / Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginReportLoading && (
                  <TableRow><TableCell colSpan={3}>
                    <FetchingOverlay />
                  </TableCell></TableRow>
                )}
                {!loginReportLoading && (loginReportData?.logins ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground" data-testid="text-no-logins">
                      No logins recorded for this date.
                    </TableCell>
                  </TableRow>
                )}
                {(loginReportData?.logins ?? []).map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-login-${entry.id}`}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {safeFormatDate(entry.createdAt, "HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.ipAddress || entry.details || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accelo Sync Log Dialog */}
      <Dialog open={showAcceloSyncLog} onOpenChange={setShowAcceloSyncLog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-600" />
              Accelo Sync Log
            </DialogTitle>
            <DialogDescription>
              Last 200 import, manual sync, and scheduled Accelo sync events, most recent first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => refetchAcceloSyncLogs()} data-testid="button-refresh-accelo-sync-log">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Time</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Source</TableHead>
                  <TableHead className="whitespace-nowrap">Triggered By</TableHead>
                  <TableHead className="whitespace-nowrap">Company</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Updated / Total</TableHead>
                  <TableHead className="whitespace-nowrap text-center">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acceloSyncLogsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="text-accelo-sync-loading">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!acceloSyncLogsLoading && acceloSyncLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="text-no-accelo-sync-logs">
                      No sync events recorded yet.
                    </TableCell>
                  </TableRow>
                )}
                {acceloSyncLogs.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-accelo-sync-${entry.id}`}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {entry.syncedAt ? new Date(entry.syncedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={entry.syncType === "scheduled"
                          ? "border-sky-300 text-sky-700 dark:text-sky-400"
                          : entry.syncType === "import"
                          ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                          : "border-violet-300 text-violet-700 dark:text-violet-400"}
                        data-testid={`badge-sync-type-${entry.id}`}
                      >
                        {entry.syncType === "scheduled" ? "Scheduled" : entry.syncType === "import" ? "Import" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.sourceCode}</TableCell>
                    <TableCell className="text-sm">{entry.triggeredByName}</TableCell>
                    <TableCell className="text-sm">{entry.companyName || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {entry.companiesUpdated} / {entry.companiesTotal}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.success ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" variant="outline" data-testid={`badge-sync-result-${entry.id}`}>
                          OK
                        </Badge>
                      ) : (
                        <span className="inline-flex flex-col items-start gap-0.5">
                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" variant="outline" data-testid={`badge-sync-result-${entry.id}`}>
                            Error
                          </Badge>
                          {entry.errorMessage && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={entry.errorMessage}>
                              {entry.errorMessage}
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scheduled Tasks Dialog */}
      <Dialog open={showScheduledTasks} onOpenChange={setShowScheduledTasks}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Scheduled Tasks
            </DialogTitle>
            <DialogDescription>
              All background jobs configured on this server. Status reflects the current environment.
            </DialogDescription>
          </DialogHeader>

          {scheduledTasksData && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Environment:</span>
              {scheduledTasksData.environment === "production" ? (
                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" variant="outline">Production</Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" variant="outline">Development</Badge>
              )}
              <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={() => refetchScheduledTasks()} data-testid="button-refresh-scheduled-tasks">
                <RefreshCw className="h-3 w-3 mr-1" />Refresh
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0">
            {scheduledTasksError ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">Failed to load scheduled tasks. <button className="underline" onClick={() => refetchScheduledTasks()}>Try again</button></p>
              </div>
            ) : !scheduledTasksData ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="w-36">Schedule</TableHead>
                    <TableHead className="w-28 text-center">Status</TableHead>
                    <TableHead className="w-40">Last Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(scheduledTasksData?.tasks ?? []).map((task) => {
                    const isProd = scheduledTasksData?.environment === "production";
                    const isLive = task.runsIn === "all" || isProd;
                    return (
                      <TableRow key={task.id} data-testid={`row-scheduled-task-${task.id}`}>
                        <TableCell>
                          <p className="font-medium text-sm">{task.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                          {task.runsIn === "production" && (
                            <Badge variant="outline" className="mt-1 text-[10px] border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400">Production only</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {task.schedule}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium" data-testid={`badge-task-status-${task.id}`}>
                              <PlayCircle className="h-3.5 w-3.5" />
                              Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium" data-testid={`badge-task-status-${task.id}`}>
                              <PauseCircle className="h-3.5 w-3.5" />
                              Paused
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {task.lastRunAt ? safeFormatDate(task.lastRunAt, "dd MMM yyyy, HH:mm") : <span className="text-muted-foreground/60">No record</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
