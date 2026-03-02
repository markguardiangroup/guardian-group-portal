import { useState, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useAuth } from "@/hooks/use-auth";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, isPast } from "date-fns";

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

function EventPill({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const mod = MODULE_CONFIG[event.module];
  const isOverdue = event.isOverdue;
  const pillColor = isOverdue ? "bg-red-500" : (mod?.color ?? "bg-gray-500");

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
            {mod && (
              <Badge className={`text-xs ${mod.badgeClass}`}>{mod.label}</Badge>
            )}
            {EVENT_TYPE_CONFIG[event.type] && (
              <Badge variant="outline" className="text-xs">
                {EVENT_TYPE_CONFIG[event.type].label}
              </Badge>
            )}
            {isOverdue && (
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
                {visible.map(ev => (
                  <EventPill key={ev.id} event={ev} />
                ))}
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

function UpcomingList({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const upcoming = events
    .filter(e => new Date(e.date) >= now || isSameDay(new Date(e.date), now))
    .slice(0, 20);

  const overdue = events.filter(e => e.isOverdue);

  if (upcoming.length === 0 && overdue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No upcoming events this month</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {overdue.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 uppercase tracking-wide">Overdue</p>
          {overdue.map(ev => <UpcomingRow key={ev.id} event={ev} />)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Upcoming</p>
          {upcoming.map(ev => <UpcomingRow key={ev.id} event={ev} />)}
        </div>
      )}
    </div>
  );
}

function UpcomingRow({ event }: { event: CalendarEvent }) {
  const mod = MODULE_CONFIG[event.module];
  const typeConf = EVENT_TYPE_CONFIG[event.type];
  const TypeIcon = typeConf?.icon ?? FileText;
  const isOverdue = event.isOverdue;

  return (
    <Link href={event.url} data-testid={`upcoming-row-${event.id}`}>
      <div className={`flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50 transition-colors cursor-pointer mb-1.5 ${isOverdue ? "border-red-200 dark:border-red-800" : ""}`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"}`}>
          <TypeIcon className={`h-4 w-4 ${isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{event.title}</p>
          <p className={`text-xs ${isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            {format(new Date(event.date), "d MMM yyyy")}
          </p>
        </div>
        {mod && (
          <Badge className={`text-xs shrink-0 ${mod.badgeClass}`}>{mod.label}</Badge>
        )}
      </div>
    </Link>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();

  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data: sites = [] } = useQuery<any[]>({ queryKey: ["/api/sites"] });

  const filteredSitesForCombobox = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return sites;
    return sites.filter((s: any) => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const { data: companiesData } = useQuery<any>({
    queryKey: ["/api/companies"],
    enabled: isPrivileged,
  });
  const companies = companiesData?.companies ?? [];

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

  const events = useMemo(() => {
    let filtered = rawEvents;
    if (typeFilter !== "all") filtered = filtered.filter(e => e.type === typeFilter);
    return filtered;
  }, [rawEvents, typeFilter]);

  const stats = useMemo(() => ({
    total: events.length,
    overdue: events.filter(e => e.isOverdue).length,
    upcoming: events.filter(e => !e.isOverdue).length,
  }), [events]);

  const contextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return sites.find((s: any) => s.id === selectedSiteId)?.name;
    if (isPrivileged) return selectedCompany && selectedCompany !== "all" ? selectedCompany : "All Clients";
    return null;
  }, [selectedSiteId, selectedCompany, sites, isPrivileged]);

  return (
    <div>
      {/* Header */}
      <div className="bg-muted/30 border-b border-t-4 border-t-primary px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
              <CalendarDays className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Calendar</h1>
              <p className="text-muted-foreground">
                Key dates across all modules
                {contextLabel && <span className="font-medium"> – {contextLabel}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isPrivileged && (
              <>
                <CompanyCombobox
                  sites={sites}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-48"
                  testId="select-company-calendar"
                />
                <SiteCombobox
                  sites={filteredSitesForCombobox}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-48"
                  testId="select-site-calendar"
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <div className="rounded-full bg-primary/10 p-2">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="text-total-events">{isLoading ? "–" : stats.total}</div>
              <p className="text-xs text-muted-foreground">Total events</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <div className="rounded-full bg-red-100 dark:bg-red-900/40 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-overdue-events">{isLoading ? "–" : stats.overdue}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2">
                <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-upcoming-events">{isLoading ? "–" : stats.upcoming}</div>
              <p className="text-xs text-muted-foreground">Scheduled ahead</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex flex-wrap gap-2">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-[170px]" data-testid="select-module-filter">
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
                  <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
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
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CalendarGrid events={events} currentMonth={currentMonth} />
            )}
          </CardContent>
        </Card>

        {/* Upcoming / overdue list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event List – {format(currentMonth, "MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UpcomingList events={events} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
