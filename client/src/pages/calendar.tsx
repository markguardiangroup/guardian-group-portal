import { useState, useMemo, useRef } from "react";
import { CountUp } from "@/components/ui/count-up";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Users,
  Scale,
  GraduationCap,
  Clock,
  FileText,
  AlertTriangle,
  CheckSquare,
  Flag,
  RotateCcw,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useAuth } from "@/hooks/use-auth";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday } from "date-fns";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  module: string;
  siteId: string;
  url: string;
  isOverdue: boolean;
};

const MODULE_CONFIG: Record<string, { label: string; color: string; badgeClass: string; icon: typeof HardHat }> = {
  health_safety: { label: "H&S", color: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", icon: HardHat },
  human_resources: { label: "HR", color: "bg-blue-500", badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: Users },
  employment_law: { label: "Employment Law", color: "bg-pink-500", badgeClass: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300", icon: Scale },
  training: { label: "Training", color: "bg-purple-500", badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", icon: GraduationCap },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText }> = {
  review_due: { label: "Review Due", icon: FileText },
  expiry: { label: "Expiry", icon: AlertTriangle },
  renewal_due: { label: "Renewal Due", icon: RotateCcw },
  case_deadline: { label: "Case Deadline", icon: Clock },
  milestone_due: { label: "Milestone", icon: CheckSquare },
  action_due: { label: "Action Due", icon: Flag },
  training_renewal: { label: "Training Renewal", icon: GraduationCap },
};

function EventPill({ event }: { event: CalendarEvent }) {
  const mod = MODULE_CONFIG[event.module];
  const pillColor = event.isOverdue ? "bg-red-500" : (mod?.color ?? "bg-gray-500");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`w-full text-left truncate rounded px-1 py-0.5 text-[11px] font-medium text-white leading-tight ${pillColor} hover:opacity-80 transition-opacity`}
          data-testid={`event-pill-${event.id}`}
          title={event.title}
        >
          {event.title}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" data-testid={`event-popover-${event.id}`}>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${pillColor}`} />
            <div>
              <p className="text-sm font-medium leading-snug">{event.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(event.date), "EEEE, d MMMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mod && <Badge className={`text-xs ${mod.badgeClass}`}>{mod.label}</Badge>}
            {EVENT_TYPE_CONFIG[event.type] && (
              <Badge variant="outline" className="text-xs">{EVENT_TYPE_CONFIG[event.type].label}</Badge>
            )}
            {event.isOverdue && (
              <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Overdue</Badge>
            )}
          </div>
          <Button size="sm" className="w-full" asChild data-testid={`event-view-${event.id}`}>
            <Link href={event.url}>View</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CalendarGrid({ events, currentMonth }: { events: CalendarEvent[]; currentMonth: Date }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = gridStart;
  while (day <= gridEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = format(new Date(ev.date), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const dayEvents = eventsByDay[key] ?? [];
          const isCurrentMonth = isSameMonth(d, currentMonth);
          const todayDay = isToday(d);
          const MAX_VISIBLE = 3;
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - MAX_VISIBLE;

          return (
            <div
              key={key}
              data-testid={`calendar-day-${key}`}
              className={`min-h-[100px] border-b border-r p-1 ${!isCurrentMonth ? "bg-muted/30" : ""} ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${todayDay ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {visible.map(ev => <EventPill key={ev.id} event={ev} />)}
                {overflow > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground font-medium">+{overflow} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SortField = "date" | "title" | "module" | "type";
type SortDir = "asc" | "desc";

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (current !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 inline" />;
  return dir === "asc"
    ? <ArrowUp className="ml-1 h-3 w-3 text-foreground inline" />
    : <ArrowDown className="ml-1 h-3 w-3 text-foreground inline" />;
}

type EventTableProps = {
  events: CalendarEvent[];
  sites: any[];
  filteredSites: any[];
  isPrivileged: boolean;
  selectedCompany: string;
  selectedSiteId: string;
  onCompanyChange: (v: string) => void;
  onSiteChange: (v: string) => void;
  moduleFilter: string;
  onModuleChange: (v: string) => void;
};

function EventTable({
  events,
  sites,
  filteredSites,
  isPrivileged,
  selectedCompany,
  selectedSiteId,
  onCompanyChange,
  onSiteChange,
  moduleFilter,
  onModuleChange,
}: EventTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const siteMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of sites) m[s.id] = s.name;
    return m;
  }, [sites]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = [...events];

    if (statusFilter === "overdue") rows = rows.filter(e => e.isOverdue);
    else if (statusFilter === "upcoming") rows = rows.filter(e => !e.isOverdue);

    if (moduleFilter !== "all") rows = rows.filter(e => e.module === moduleFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (MODULE_CONFIG[e.module]?.label ?? e.module).toLowerCase().includes(q) ||
        (EVENT_TYPE_CONFIG[e.type]?.label ?? e.type).toLowerCase().includes(q) ||
        (siteMap[e.siteId] ?? "").toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "module") cmp = (MODULE_CONFIG[a.module]?.label ?? a.module).localeCompare(MODULE_CONFIG[b.module]?.label ?? b.module);
      else if (sortField === "type") cmp = (EVENT_TYPE_CONFIG[a.type]?.label ?? a.type).localeCompare(EVENT_TYPE_CONFIG[b.type]?.label ?? b.type);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [events, statusFilter, moduleFilter, search, sortField, sortDir, siteMap]);

  return (
    <div className="space-y-4">
      {/* Table filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-event-search"
          />
        </div>
        {isPrivileged && (
          <CompanyCombobox
            sites={sites}
            value={selectedCompany}
            onValueChange={onCompanyChange}
            className="w-[180px]"
            testId="select-table-company-filter"
          />
        )}
        <SiteCombobox
          sites={filteredSites}
          value={selectedSiteId}
          onValueChange={onSiteChange}
          className="w-[160px]"
          testId="select-table-site-filter"
          disabled={isPrivileged && (!selectedCompany || selectedCompany === "all")}
        />
        {hasCoverage && (
          <Select
            value={coverageFilter}
            onValueChange={(v) => { setCoverageFilter(v); onCompanyChange(null); onSiteChange("all"); }}
          >
            <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-calendar">
              <span className="truncate pointer-events-none">
                {coverageFilter === "my"
                  ? "My client sites"
                  : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My client sites</SelectItem>
              {coveringFor.map(c => (
                <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-calendar-${c.absentConsultantId}`}>
                  {c.absentConsultantName}'s client sites
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isProConsultant && (
          <Select
            value={proStaffFilter}
            onValueChange={(v) => { setProStaffFilter(v); onCompanyChange(null); onSiteChange("all"); }}
          >
            <SelectTrigger className="w-[205px] text-sm" data-testid="select-pro-staff-filter-calendar">
              <span className="truncate pointer-events-none">
                {proStaffFilter === "my"
                  ? "My client sites"
                  : proStaffFilter === "all"
                    ? "All client sites"
                    : (myStaff.find(s => s.id === proStaffFilter)?.fullName ?? "Staff") + "'s client sites"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="my">My client sites</SelectItem>
              <SelectItem value="all">All client sites</SelectItem>
              {myStaff.map(s => (
                <SelectItem key={s.id} value={s.id} data-testid={`pro-staff-filter-calendar-${s.id}`}>
                  {s.fullName}'s client sites
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={moduleFilter} onValueChange={onModuleChange}>
          <SelectTrigger className="w-[160px]" data-testid="select-table-module-filter">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="health_safety">Health & Safety</SelectItem>
            <SelectItem value="human_resources">Human Resources</SelectItem>
            <SelectItem value="employment_law">Employment Law</SelectItem>
            <SelectItem value="training">Training</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground shrink-0">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No events match your filters</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("title")}
                    data-testid="sort-title"
                  >
                    Event
                    <SortIcon field="title" current={sortField} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("date")}
                    data-testid="sort-date"
                  >
                    Date
                    <SortIcon field="date" current={sortField} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("module")}
                    data-testid="sort-module"
                  >
                    Module
                    <SortIcon field="module" current={sortField} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("type")}
                    data-testid="sort-type"
                  >
                    Type
                    <SortIcon field="type" current={sortField} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ev => {
                const mod = MODULE_CONFIG[ev.module];
                const typeConf = EVENT_TYPE_CONFIG[ev.type];
                const TypeIcon = typeConf?.icon ?? FileText;
                const siteName = siteMap[ev.siteId];

                return (
                  <TableRow
                    key={ev.id}
                    data-testid={`event-row-${ev.id}`}
                    className={ev.isOverdue ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ev.isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"}`}>
                          <TypeIcon className={`h-3.5 w-3.5 ${ev.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
                        </div>
                        <span className="text-sm font-medium truncate" title={ev.title}>{ev.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <span className={ev.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                        {format(new Date(ev.date), "d MMM yyyy")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {mod ? (
                        <Badge className={`text-xs ${mod.badgeClass}`}>{mod.label}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{ev.module}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeConf ? (
                        <Badge variant="outline" className="text-xs whitespace-nowrap">{typeConf.label}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{ev.type}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {siteName ?? <span className="text-xs text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      {ev.isOverdue ? (
                        <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap">
                          Overdue
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 whitespace-nowrap">
                          Upcoming
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild className="h-7 px-2" data-testid={`event-view-${ev.id}`}>
                        <Link href={ev.url}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [metricDialog, setMetricDialog] = useState<null | "total" | "overdue" | "upcoming">(null);
  // Calendar keeps its own remembered company/site filter ("calendar" scope)
  // so it neither affects nor is affected by other pages' filters.
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter("calendar");


  const isPrivileged = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, coverageSitesUrl, coverageQueryKey, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();

  const { data: sites = [] } = useQuery<any[]>({
    queryKey: coverageQueryKey,
    queryFn: coverageSitesUrl !== "/api/sites" ? async () => {
      const res = await fetch(coverageSitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    } : undefined,
  });

  const filteredSitesForCombobox = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return sites;
    return sites.filter((s: any) => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const selectedCompanyId = useMemo(() => {
    if (!selectedCompany || selectedCompany === "all") return null;
    const match = sites.find((s: any) => s.companyName === selectedCompany);
    return match?.companyId ?? null;
  }, [sites, selectedCompany]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const queryParams = new URLSearchParams({
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
  });
  if (selectedSiteId && selectedSiteId !== "all") queryParams.set("siteId", selectedSiteId);
  if (selectedCompanyId) queryParams.set("companyId", selectedCompanyId);
  if (moduleFilter !== "all") queryParams.set("module", moduleFilter);

  const { data: rawEvents = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", monthStart.toISOString(), selectedSiteId, selectedCompanyId, moduleFilter],
    queryFn: () => fetch(`/api/calendar/events?${queryParams.toString()}`, { credentials: "include" }).then(r => r.json()),
  });
  const statsWasLoadingRef = useRef(false);
  if (isLoading) statsWasLoadingRef.current = true;

  const events = useMemo(() => {
    const safeRaw = Array.isArray(rawEvents) ? rawEvents : [];
    if (typeFilter === "all") return safeRaw;
    return safeRaw.filter(e => e.type === typeFilter);
  }, [rawEvents, typeFilter]);

  const stats = useMemo(() => ({
    total: events.length,
    overdue: events.filter(e => e.isOverdue).length,
    upcoming: events.filter(e => !e.isOverdue).length,
  }), [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — title only, filters live in the cards */}
      <div className="dash-header bg-muted/30 border-b border-t-4 border-t-primary px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
              <CalendarDays className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Calendar
                <span className="font-normal text-muted-foreground text-2xl"> — Key dates across all modules</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]" />
            </div>
          </div>
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto space-y-6 p-8 dash-animate">
        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => setMetricDialog("total")}
            data-testid="stat-card-total"
            className="text-left rounded-lg border-l-4 border border-l-primary bg-card shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <span className="text-sm font-medium">This Month</span>
              <div className="rounded-full bg-primary/10 p-2">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="p-6 pt-0">
              <div className="text-2xl font-bold text-primary" data-testid="text-total-events">{isLoading ? "–" : <CountUp value={stats.total} animate={statsWasLoadingRef.current} />}</div>
              <p className="text-xs text-muted-foreground">Total events · click to view</p>
            </div>
          </button>
          <button
            onClick={() => setMetricDialog("overdue")}
            data-testid="stat-card-overdue"
            className={`text-left rounded-lg border-l-4 border bg-card shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-400/40 ${stats.overdue > 0 ? "border-l-red-500 hover:bg-red-50 dark:hover:bg-red-950/20" : "border-l-slate-300"}`}
          >
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <span className="text-sm font-medium">Overdue</span>
              <div className={`rounded-full p-2 ${stats.overdue > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-slate-100 dark:bg-slate-800/40"}`}>
                <AlertTriangle className={`h-4 w-4 ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`} />
              </div>
            </div>
            <div className="p-6 pt-0">
              <div className={`text-2xl font-bold ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} data-testid="text-overdue-events">{isLoading ? "–" : <CountUp value={stats.overdue} animate={statsWasLoadingRef.current} />}</div>
              <p className="text-xs text-muted-foreground">Require attention · click to view</p>
            </div>
          </button>
          <button
            onClick={() => setMetricDialog("upcoming")}
            data-testid="stat-card-upcoming"
            className={`text-left rounded-lg border-l-4 border bg-card shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-400/40 ${stats.upcoming > 0 ? "border-l-green-500 hover:bg-green-50 dark:hover:bg-green-950/20" : "border-l-slate-300"}`}
          >
            <div className="flex flex-row items-center justify-between gap-2 space-y-0 p-6 pb-2">
              <span className="text-sm font-medium">Upcoming</span>
              <div className={`rounded-full p-2 ${stats.upcoming > 0 ? "bg-green-100 dark:bg-green-900/40" : "bg-slate-100 dark:bg-slate-800/40"}`}>
                <Clock className={`h-4 w-4 ${stats.upcoming > 0 ? "text-green-600 dark:text-green-400" : "text-slate-400"}`} />
              </div>
            </div>
            <div className="p-6 pt-0">
              <div className={`text-2xl font-bold ${stats.upcoming > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} data-testid="text-upcoming-events">{isLoading ? "–" : <CountUp value={stats.upcoming} animate={statsWasLoadingRef.current} />}</div>
              <p className="text-xs text-muted-foreground">Scheduled ahead · click to view</p>
            </div>
          </button>
        </div>

        {/* Metric breakdown dialog */}
        <Dialog open={metricDialog !== null} onOpenChange={open => { if (!open) setMetricDialog(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {metricDialog === "total" && <><CalendarDays className="h-5 w-5 text-primary" /> This Month</>}
                {metricDialog === "overdue" && <><AlertTriangle className="h-5 w-5 text-red-500" /> Overdue Events</>}
                {metricDialog === "upcoming" && <><Clock className="h-5 w-5 text-green-500" /> Upcoming Events</>}
              </DialogTitle>
              <DialogDescription>
                {metricDialog === "total" && `All ${stats.total} event${stats.total !== 1 ? "s" : ""} for ${format(currentMonth, "MMMM yyyy")}.`}
                {metricDialog === "overdue" && "Events with a date that has already passed."}
                {metricDialog === "upcoming" && "Events scheduled for a future date."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {(() => {
                const listEvents = metricDialog === "overdue"
                  ? events.filter(e => e.isOverdue)
                  : metricDialog === "upcoming"
                  ? events.filter(e => !e.isOverdue)
                  : events;
                if (listEvents.length === 0) {
                  return <div className="py-8 text-center text-muted-foreground text-sm">No events to display.</div>;
                }
                return [...listEvents]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map(ev => {
                    const cfg = MODULE_CONFIG[ev.module];
                    return (
                      <Link key={ev.id} href={ev.url} onClick={() => setMetricDialog(null)}>
                        <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/60 cursor-pointer transition-colors group">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {cfg && <cfg.icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />}
                              <span className="text-xs font-medium text-muted-foreground">{cfg?.label ?? ev.module}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{ev.type.replace(/_/g, " ")}</span>
                            </div>
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{ev.title}</p>
                          </div>
                          <div className="ml-4 shrink-0 flex items-center gap-2">
                            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${ev.isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-green-100 dark:bg-green-900/40"}`}>
                              <Clock className={`h-3 w-3 ${ev.isOverdue ? "text-red-600" : "text-green-600"}`} />
                              <span className={`text-xs font-semibold ${ev.isOverdue ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                                {format(new Date(ev.date), "MMM d")}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </Link>
                    );
                  });
              })()}
            </div>
          </DialogContent>
        </Dialog>

        {/* Calendar card */}
        <Card>
          <CardHeader>
            {/* Row 1: month nav + company/site + module/type */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="min-w-[160px] text-center text-lg font-semibold" data-testid="text-current-month">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} data-testid="button-today">
                  Today
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {isPrivileged && (
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-[180px]"
                    testId="select-company-calendar"
                  />
                )}
                <SiteCombobox
                  sites={filteredSitesForCombobox}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-[160px]"
                  testId="select-site-calendar"
                  disabled={isPrivileged && (!selectedCompany || selectedCompany === "all")}
                />
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-module-filter">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    <SelectItem value="health_safety">Health & Safety</SelectItem>
                    <SelectItem value="human_resources">Human Resources</SelectItem>
                    <SelectItem value="employment_law">Employment Law</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="review_due">Review Due</SelectItem>
                    <SelectItem value="expiry">Expiry</SelectItem>
                    <SelectItem value="renewal_due">Renewal Due</SelectItem>
                    <SelectItem value="case_deadline">Case Deadline</SelectItem>
                    <SelectItem value="milestone_due">Milestone</SelectItem>
                    <SelectItem value="action_due">Action Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Module legend */}
            <div className="flex flex-wrap gap-3 pt-1">
              {Object.entries(MODULE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${cfg.color}`} />
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Overdue</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <FetchingOverlay />
            ) : (
              <CalendarGrid events={events} currentMonth={currentMonth} />
            )}
          </CardContent>
        </Card>

        {/* Event list table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Event List – {format(currentMonth, "MMMM yyyy")}</CardTitle>
              {!isLoading && (
                <div className="flex gap-2">
                  {stats.overdue > 0 && (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {stats.overdue} overdue
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-muted-foreground">
                    {stats.total} total
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <FetchingOverlay />
            ) : (
              <EventTable
                events={events}
                sites={sites}
                filteredSites={filteredSitesForCombobox}
                isPrivileged={isPrivileged}
                selectedCompany={selectedCompany}
                selectedSiteId={selectedSiteId}
                onCompanyChange={handleCompanyChange}
                onSiteChange={setSelectedSiteId}
                moduleFilter={moduleFilter}
                onModuleChange={setModuleFilter}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
