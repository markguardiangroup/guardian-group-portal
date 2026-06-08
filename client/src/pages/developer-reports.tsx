import { useState, useEffect } from "react";
import { ArrangeCoverDialog } from "@/pages/home";
import { Link } from "wouter";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { statusCounts, isCountableDoc } from "@/lib/doc-stats";
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
  RefreshCw,
  Clock,
  CalendarClock,
  PlayCircle,
  PauseCircle,
  UserCog,
  UserPlus,
  UserCheck,
  UserMinus,
  UserRoundCog,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
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

export default function DeveloperReports() {
  const { user } = useAuth();
  const [showUsersReport, setShowUsersReport] = useState(false);
  const [showCountAudit, setShowCountAudit] = useState(false);
  const [showEmailLog, setShowEmailLog] = useState(false);
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
  const [scheduledTasksData, setScheduledTasksData] = useState<ScheduledTasksResponse | null>(null);
  const [scheduledTasksLoading, setScheduledTasksLoading] = useState(false);
  const [scheduledTasksError, setScheduledTasksError] = useState(false);
  async function loadScheduledTasks() {
    setScheduledTasksLoading(true);
    setScheduledTasksError(false);
    setScheduledTasksData(null);
    try {
      const res = await fetch("/api/admin/scheduled-tasks", { credentials: "include" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(`${res.status}`);
      setScheduledTasksData(await res.json());
    } catch {
      setScheduledTasksError(true);
    } finally {
      setScheduledTasksLoading(false);
    }
  }
  function refetchScheduledTasks() { loadScheduledTasks(); }

  const [showLoginReport, setShowLoginReport] = useState(false);

  // Coverage report
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [includeExpiredCoverage, setIncludeExpiredCoverage] = useState(false);
  const [arrangeCoverOpen, setArrangeCoverOpen] = useState(false);
  interface AdminCoverageEntry {
    id: string;
    absentConsultantId: string;
    coveringConsultantId: string;
    startDate: string;
    endDate: string;
    createdBy: string;
    createdAt: string;
    absentConsultantName: string;
    coveringConsultantName: string;
    createdByName: string;
    status: "active" | "upcoming" | "expired";
  }
  const { data: coverageEntries = [], isLoading: coverageLoading } = useQuery<AdminCoverageEntry[]>({
    queryKey: ["/api/admin/consultant-coverage", includeExpiredCoverage],
    queryFn: () =>
      fetch(`/api/admin/consultant-coverage?includeExpired=${includeExpiredCoverage}`, { credentials: "include" }).then(r => r.json()),
    enabled: showCoverageReport,
    staleTime: 0,
  });
  const cancelCoverageMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/consultant-coverage/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/consultant-coverage"] }),
  });
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

  // ── Document Count Audit ────────────────────────────────────────────────
  // Reconciliation report: shows the canonical status-based document counts
  // (the single source of truth in @/lib/doc-stats) for every module, broken
  // down by site, so admins can confirm the dashboards, sites and documents
  // pages all agree on the numbers.
  const auditModules = [
    { key: "health_safety", label: "Health & Safety" },
    { key: "human_resources", label: "Human Resources" },
    { key: "employment_law", label: "Employment Law" },
  ] as const;

  // Always fetch fresh ground-truth when the dialog opens, so the audit can
  // never show stale numbers while the live pages have already refreshed.
  const auditDocResults = useQueries({
    queries: auditModules.map((m) => ({
      queryKey: [`/api/documents/module/${m.key}`],
      enabled: showCountAudit,
      staleTime: 0,
      refetchOnMount: "always" as const,
    })),
  });
  const auditMissingResults = useQueries({
    queries: auditModules.map((m) => ({
      queryKey: [`/api/missing-required-templates?module=${m.key}`],
      enabled: showCountAudit,
      staleTime: 0,
      refetchOnMount: "always" as const,
    })),
  });
  // Company-level missing (no per-site exclusions) — drives the Company rows,
  // exactly like the company cards on the module sites page.
  const auditCompanyMissingResults = useQueries({
    queries: auditModules.map((m) => ({
      queryKey: [`/api/missing-required-templates/by-company?module=${m.key}`],
      enabled: showCountAudit,
      staleTime: 0,
      refetchOnMount: "always" as const,
    })),
  });
  const { data: auditSites = [], isLoading: auditSitesLoading, isError: auditSitesError } = useQuery<
    {
      id: string;
      name: string;
      companyId: string;
      companyName?: string | null;
      moduleAccess?: Partial<Record<string, string>> | null;
    }[]
  >({
    queryKey: ["/api/sites"],
    enabled: showCountAudit,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const auditLoading =
    auditSitesLoading ||
    auditDocResults.some((r) => r.isLoading) ||
    auditMissingResults.some((r) => r.isLoading) ||
    auditCompanyMissingResults.some((r) => r.isLoading);

  const auditError =
    auditSitesError ||
    auditDocResults.some((r) => r.isError) ||
    auditMissingResults.some((r) => r.isError) ||
    auditCompanyMissingResults.some((r) => r.isError);

  type AuditDoc = {
    id?: string;
    status?: string | null;
    siteId?: string | null;
    entityId?: string | null;
    scope?: string | null;
    sharedWithSiteIds?: string[] | null;
    sharedWithCompanyIds?: string[] | null;
    isArchived?: boolean | null;
    caseId?: string | null;
    incidentId?: string | null;
    source?: string | null;
    isMandatory?: boolean | null;
  };
  type AuditMissing = { siteId?: string; companyId?: string; templateId?: string; module?: string };

  // Per-row metrics — mirror the site cards / dashboard exactly so the audit
  // reconciles with them. Total / Approval Req. / Overdue count every countable
  // document by its `status`; Compliant counts only MANDATORY approved docs;
  // Non-Compliant = mandatory docs not approved (overdue + awaiting approval)
  // plus missing required slots. A doc shared to several places is counted under
  // each (mirroring the cards), so subtotals reflect every place it is used.
  type RowMetrics = { total: number; compliant: number; approvalRequired: number; overdue: number; missing: number; nonCompliant: number };
  const emptyAgg = (): RowMetrics => ({ total: 0, compliant: 0, approvalRequired: 0, overdue: 0, missing: 0, nonCompliant: 0 });
  const addAgg = (a: RowMetrics, b: RowMetrics): RowMetrics => ({
    total: a.total + b.total,
    compliant: a.compliant + b.compliant,
    approvalRequired: a.approvalRequired + b.approvalRequired,
    overdue: a.overdue + b.overdue,
    missing: a.missing + b.missing,
    nonCompliant: a.nonCompliant + b.nonCompliant,
  });
  // Compute the displayed metrics for an already-scoped, already-countable list.
  const rowMetrics = (docs: AuditDoc[], miss: number): RowMetrics => {
    const counts = statusCounts(docs);
    const mandatory = docs.filter((d) => d.isMandatory);
    const mCompliant = mandatory.filter((d) => d.status === "compliant").length;
    const mOverdue = mandatory.filter((d) => d.status === "overdue").length;
    const mApprovalReq = mandatory.filter((d) => d.status === "approval_required").length;
    return {
      total: counts.total,
      compliant: mCompliant,
      approvalRequired: counts.approvalRequired,
      overdue: counts.overdue,
      missing: miss,
      nonCompliant: mOverdue + mApprovalReq + miss,
    };
  };

  // A company is a Group Owner when at least one other company references it.
  const groupOwnerIds = new Set<string>();
  companies.forEach((c) => {
    if (c.groupOwnerId) groupOwnerIds.add(c.groupOwnerId);
  });

  const auditData = auditModules.map((m, i) => {
    const docs = (auditDocResults[i]?.data as AuditDoc[] | undefined) ?? [];
    const missing = (auditMissingResults[i]?.data as AuditMissing[] | undefined) ?? [];
    const companyMissing = (auditCompanyMissingResults[i]?.data as AuditMissing[] | undefined) ?? [];

    // Mirror module-sites.tsx exactly: only sites that have this module
    // active/visible are shown. This keeps the audit in lock-step with the
    // cards admins actually see.
    const moduleActiveSites = auditSites.filter((s) => {
      const access = s.moduleAccess?.[m.key];
      return access === "active" || access === "visible";
    });

    // ── Per-site rows (one per module-active site, incl. empty ones) ─────
    // Each site's own docs plus group/company-scoped docs shared to or
    // cascaded into the site — the exact predicate the site tiles use.
    const siteRows = moduleActiveSites
      .map((site) => {
        const sid = site.id;
        const siteCompanyId = site.companyId;
        const siteDocs = docs.filter(
          (d) =>
            isCountableDoc(d) &&
            // A scoped doc counts for this site when shared to it, shared to its
            // company, or owned by its company. Group-scoped docs owned by this
            // company only count if at least one share record exists — unshared
            // group docs must not inflate the site total.
            (d.siteId === sid ||
              (d.siteId == null &&
                ((d.sharedWithSiteIds?.includes(sid) ?? false) ||
                  (d.sharedWithCompanyIds?.includes(siteCompanyId) ?? false) ||
                  (d.entityId === siteCompanyId &&
                    (d.scope !== "group" ||
                      ((d.sharedWithSiteIds?.length ?? 0) + (d.sharedWithCompanyIds?.length ?? 0)) > 0))))),
        );
        const miss = missing.filter((mm) => mm.siteId === sid).length;
        return {
          id: sid,
          name: site.name ?? "(unknown site)",
          companyName: site.companyName ?? "",
          metrics: rowMetrics(siteDocs, miss),
        };
      })
      .sort((a, b) =>
        a.companyName.localeCompare(b.companyName) || a.name.localeCompare(b.name),
      );

    // ── Group rows (mirror each Group card) ──────────────────────────────
    // Native group-scoped documents owned by each Group Owner company.
    const groupRows = Array.from(groupOwnerIds)
      .map((gid) => {
        const owner = companies.find((c) => c.id === gid);
        const groupDocs = docs.filter(
          (d) => isCountableDoc(d) && d.scope === "group" && d.entityId === gid,
        );
        const templateIds = new Set<string>();
        missing.forEach((mm) => {
          if (mm.companyId === gid && mm.templateId) templateIds.add(mm.templateId);
        });
        return {
          id: gid,
          name: owner?.name ?? "(unknown group)",
          metrics: rowMetrics(groupDocs, templateIds.size),
        };
      })
      .filter((r) => r.metrics.total > 0 || r.metrics.missing > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // ── Company rows (mirror each Company card) ──────────────────────────
    // Native company-scoped docs plus group/company docs shared to the company.
    const companyRows = companies
      .map((c) => {
        const companyDocs = docs.filter(
          (d) =>
            isCountableDoc(d) &&
            ((d.scope === "company" && d.entityId === c.id) ||
              (d.sharedWithCompanyIds?.includes(c.id) ?? false)),
        );
        const templateIds = new Set<string>();
        companyMissing.forEach((mm) => {
          if (mm.companyId === c.id && mm.templateId) templateIds.add(mm.templateId);
        });
        return {
          id: c.id,
          name: c.name,
          metrics: rowMetrics(companyDocs, templateIds.size),
        };
      })
      .filter((r) => r.metrics.total > 0 || r.metrics.missing > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    // ── Subtotals & grand total ──────────────────────────────────────────
    let sitesSubtotal = emptyAgg();
    siteRows.forEach((r) => { sitesSubtotal = addAgg(sitesSubtotal, r.metrics); });
    let geSubtotal = emptyAgg();
    groupRows.forEach((r) => { geSubtotal = addAgg(geSubtotal, r.metrics); });
    companyRows.forEach((r) => { geSubtotal = addAgg(geSubtotal, r.metrics); });
    const grandTotal = addAgg(sitesSubtotal, geSubtotal);

    return {
      ...m,
      siteRows,
      sitesSubtotal,
      groupRows,
      companyRows,
      geSubtotal,
      grandTotal,
    };
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

  const downloadCountAuditCSV = () => {
    const headers = ["Module", "Scope", "Company", "Total", "Compliant", "Approval Required", "Overdue", "Missing", "Non-Compliant"];
    const rows: string[][] = [];
    const aggRow = (label: string, scope: string, company: string, a: { total: number; compliant: number; approvalRequired: number; overdue: number; missing: number; nonCompliant: number }) => [
      label, scope, company,
      String(a.total), String(a.compliant), String(a.approvalRequired),
      String(a.overdue), String(a.missing),
      String(a.nonCompliant),
    ];
    auditData.forEach((m) => {
      m.siteRows.forEach((r) => {
        rows.push([
          m.label, `Site: ${r.name}`, r.companyName,
          String(r.metrics.total), String(r.metrics.compliant),
          String(r.metrics.approvalRequired), String(r.metrics.overdue),
          String(r.metrics.missing), String(r.metrics.nonCompliant),
        ]);
      });
      rows.push(aggRow(m.label, "SITES SUBTOTAL", "", m.sitesSubtotal));
      m.groupRows.forEach((r) => {
        rows.push([
          m.label, `Group: ${r.name}`, "",
          String(r.metrics.total), String(r.metrics.compliant),
          String(r.metrics.approvalRequired), String(r.metrics.overdue),
          String(r.metrics.missing), String(r.metrics.nonCompliant),
        ]);
      });
      m.companyRows.forEach((r) => {
        rows.push([
          m.label, `Company: ${r.name}`, "",
          String(r.metrics.total), String(r.metrics.compliant),
          String(r.metrics.approvalRequired), String(r.metrics.overdue),
          String(r.metrics.missing), String(r.metrics.nonCompliant),
        ]);
      });
      rows.push(aggRow(m.label, "GROUPS & COMPANIES SUBTOTAL", "", m.geSubtotal));
      rows.push(aggRow(m.label, "GRAND TOTAL", "", m.grandTotal));
    });
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `document_count_audit_${format(new Date(), "yyyy-MM-dd")}.csv`);
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
            Developer Reports
          </h1>
          <p className="mt-1 text-muted-foreground">
            Confidential reports for developers only
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
            Available Developer Reports
          </CardTitle>
          <CardDescription>Generate and download confidential reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Document Count Audit — reconcile counts across dashboards, sites & documents */}
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowCountAudit(true)}
              data-testid="report-count-audit"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                  <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium">Document Count Audit</p>
                  <p className="text-sm text-muted-foreground">Compare document counts across dashboards, sites &amp; documents</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>

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
            <Link href="/developer-reports/changelog">
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

            {/* Consultant Coverage — admin only */}
            {isAdmin && (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                onClick={() => setShowCoverageReport(true)}
                data-testid="report-consultant-coverage"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
                    <UserCog className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium">Consultant Coverage</p>
                    <p className="text-sm text-muted-foreground">Active and historical client cover arrangements</p>
                  </div>
                </div>
                <Badge variant="secondary">View</Badge>
              </div>
            )}

            {/* Scheduled Tasks — admin only */}
            {isAdmin && (
              <div
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
                onClick={() => { setShowScheduledTasks(true); loadScheduledTasks(); }}
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

      {/* Document Count Audit Dialog */}
      <Dialog open={showCountAudit} onOpenChange={setShowCountAudit}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Document Count Audit
            </DialogTitle>
            <DialogDescription>
              The live document counts used across the portal. The dashboards, sites cards and documents
              pages all use these same figures, so the numbers here should match what you see on those
              pages. Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Each row matches the matching card across the portal (a site, a group, or a company). A
              document shared to several places is counted in each place it appears, just like the cards,
              so the Sites, Groups and Companies subtotals add up to the Grand total.
            </p>
            <Button variant="outline" size="sm" onClick={downloadCountAuditCSV} disabled={auditLoading || auditError} data-testid="button-download-count-audit-csv">
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {auditLoading ? (
            <FetchingOverlay />
          ) : auditError ? (
            <div className="mt-6 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm" data-testid="audit-error">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>Couldn't load the counts. Please close this and try again.</span>
            </div>
          ) : (
            <div className="mt-4 space-y-8">
              {auditData.map((m) => (
                <div key={m.key} data-testid={`audit-module-${m.key}`}>
                  <h4 className="mb-2 font-semibold">{m.label}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site / Group / Company</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Compliant</TableHead>
                        <TableHead className="text-right">Approval Req.</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Missing</TableHead>
                        <TableHead className="text-right">Non-Compliant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sites</TableCell>
                      </TableRow>
                      {m.siteRows.map((r) => (
                        <TableRow key={`site-${r.id}`} data-testid={`audit-row-${m.key}-${r.id}`}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.companyName || "-"}</TableCell>
                          <TableCell className="text-right">{r.metrics.total}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{r.metrics.compliant}</TableCell>
                          <TableCell className="text-right text-amber-600 dark:text-amber-400">{r.metrics.approvalRequired}</TableCell>
                          <TableCell className="text-right text-orange-600 dark:text-orange-400">{r.metrics.overdue}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">{r.metrics.missing}</TableCell>
                          <TableCell className="text-right font-medium">{r.metrics.nonCompliant}</TableCell>
                        </TableRow>
                      ))}
                      {m.siteRows.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="py-2 text-sm text-muted-foreground">No sites for this module.</TableCell></TableRow>
                      )}
                      <TableRow className="border-y-2 font-semibold bg-muted/40" data-testid={`audit-subtotal-sites-${m.key}`}>
                        <TableCell>Sites subtotal</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{m.sitesSubtotal.total}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{m.sitesSubtotal.compliant}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{m.sitesSubtotal.approvalRequired}</TableCell>
                        <TableCell className="text-right text-orange-600 dark:text-orange-400">{m.sitesSubtotal.overdue}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">{m.sitesSubtotal.missing}</TableCell>
                        <TableCell className="text-right">{m.sitesSubtotal.nonCompliant}</TableCell>
                      </TableRow>

                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={8} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups &amp; Companies</TableCell>
                      </TableRow>
                      {m.groupRows.map((r) => (
                        <TableRow key={`group-${r.id}`} data-testid={`audit-grouprow-${m.key}-${r.id}`}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-xs"><span className="rounded bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Group</span></TableCell>
                          <TableCell className="text-right">{r.metrics.total}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{r.metrics.compliant}</TableCell>
                          <TableCell className="text-right text-amber-600 dark:text-amber-400">{r.metrics.approvalRequired}</TableCell>
                          <TableCell className="text-right text-orange-600 dark:text-orange-400">{r.metrics.overdue}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">{r.metrics.missing}</TableCell>
                          <TableCell className="text-right font-medium">{r.metrics.nonCompliant}</TableCell>
                        </TableRow>
                      ))}
                      {m.companyRows.map((r) => (
                        <TableRow key={`company-${r.id}`} data-testid={`audit-companyrow-${m.key}-${r.id}`}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-xs"><span className="rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">Company</span></TableCell>
                          <TableCell className="text-right">{r.metrics.total}</TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{r.metrics.compliant}</TableCell>
                          <TableCell className="text-right text-amber-600 dark:text-amber-400">{r.metrics.approvalRequired}</TableCell>
                          <TableCell className="text-right text-orange-600 dark:text-orange-400">{r.metrics.overdue}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">{r.metrics.missing}</TableCell>
                          <TableCell className="text-right font-medium">{r.metrics.nonCompliant}</TableCell>
                        </TableRow>
                      ))}
                      {m.groupRows.length === 0 && m.companyRows.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="py-2 text-sm text-muted-foreground">No group or company documents for this module.</TableCell></TableRow>
                      )}
                      <TableRow className="border-y-2 font-semibold bg-muted/40" data-testid={`audit-subtotal-ge-${m.key}`}>
                        <TableCell>Groups &amp; companies subtotal</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{m.geSubtotal.total}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{m.geSubtotal.compliant}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{m.geSubtotal.approvalRequired}</TableCell>
                        <TableCell className="text-right text-orange-600 dark:text-orange-400">{m.geSubtotal.overdue}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">{m.geSubtotal.missing}</TableCell>
                        <TableCell className="text-right">{m.geSubtotal.nonCompliant}</TableCell>
                      </TableRow>

                      <TableRow className="border-t-2 border-foreground/30 font-bold bg-muted/60" data-testid={`audit-grandtotal-${m.key}`}>
                        <TableCell>GRAND TOTAL</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">{m.grandTotal.total}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{m.grandTotal.compliant}</TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{m.grandTotal.approvalRequired}</TableCell>
                        <TableCell className="text-right text-orange-600 dark:text-orange-400">{m.grandTotal.overdue}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">{m.grandTotal.missing}</TableCell>
                        <TableCell className="text-right">{m.grandTotal.nonCompliant}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                      <img src={logoIcon} alt="" className="h-4 w-4 inline mr-2 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />Loading…
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
                <img src={logoIcon} alt="" className="h-4 w-4 mr-2 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />Loading…
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

      {/* Consultant Coverage Dialog */}
      <Dialog open={showCoverageReport} onOpenChange={setShowCoverageReport}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto" data-testid="dialog-coverage-report">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Consultant Coverage
            </DialogTitle>
            <DialogDescription>
              Client cover arrangements — consultants delegating their clients to a covering consultant.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="include-expired"
                  checked={includeExpiredCoverage}
                  onCheckedChange={setIncludeExpiredCoverage}
                  data-testid="switch-include-expired-coverage"
                />
                <Label htmlFor="include-expired" className="text-sm cursor-pointer">Show expired arrangements</Label>
              </div>
              <Button
                size="sm"
                onClick={() => setArrangeCoverOpen(true)}
                data-testid="button-arrange-cover-admin"
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Arrange Cover
              </Button>
            </div>

            {coverageLoading ? (
              <FetchingOverlay />
            ) : coverageEntries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <UserCog className="h-8 w-8 opacity-40" />
                <p className="text-sm">No coverage arrangements found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Absent Consultant</TableHead>
                    <TableHead>Covering Consultant</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverageEntries.map(e => (
                    <TableRow key={e.id} data-testid={`coverage-row-${e.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <UserMinus className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {e.absentConsultantName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          {e.coveringConsultantName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{e.startDate}</TableCell>
                      <TableCell className="text-sm">{e.endDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            e.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : e.status === "upcoming"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                              : "bg-muted text-muted-foreground"
                          }
                          data-testid={`badge-coverage-status-${e.id}`}
                        >
                          {e.status === "active" ? "Active" : e.status === "upcoming" ? "Upcoming" : "Expired"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.createdByName}</TableCell>
                      <TableCell>
                        {e.status !== "expired" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => cancelCoverageMutation.mutate(e.id)}
                            disabled={cancelCoverageMutation.isPending}
                            data-testid={`button-cancel-coverage-admin-${e.id}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>

      {user?.id && (
        <ArrangeCoverDialog
          open={arrangeCoverOpen}
          onOpenChange={setArrangeCoverOpen}
          isAdmin
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
