import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Search,
  Plus,
  Calendar,
  Building2,
  User,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  AlertOctagon,
  ShieldAlert,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";

type IncidentSeverity = "minor" | "moderate" | "major" | "critical";
type IncidentStatus = "reported" | "under_review" | "resolved" | "closed";

interface Incident {
  id: string;
  title: string;
  description: string;
  type: string;
  severity: IncidentSeverity;
  siteId: string;
  companyName: string;
  siteName?: string;
  reportedBy: string;
  reportedByName: string;
  status: IncidentStatus;
  incidentDate: string;
  reportedAt: string;
  resolvedAt?: string;
  injuriesReported: boolean;
  riddorReportable: boolean;
}

const mockIncidents: Incident[] = [
  {
    id: "1",
    title: "Slip hazard in warehouse area B",
    description: "Water leak from roof caused wet floor conditions in warehouse area B",
    type: "Slip/Trip/Fall Hazard",
    severity: "moderate",
    siteId: "2",
    companyName: "Acme Corporation",
    siteName: "Warehouse",
    reportedBy: "user2",
    reportedByName: "Sarah Jones",
    status: "under_review",
    incidentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reportedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    injuriesReported: false,
    riddorReportable: false,
  },
  {
    id: "2",
    title: "Near miss - forklift incident",
    description: "Forklift nearly struck a pedestrian in loading bay due to poor visibility",
    type: "Near Miss",
    severity: "major",
    siteId: "2",
    companyName: "Acme Corporation",
    siteName: "Warehouse",
    reportedBy: "user1",
    reportedByName: "John Smith",
    status: "reported",
    incidentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    reportedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    injuriesReported: false,
    riddorReportable: false,
  },
  {
    id: "3",
    title: "Minor cut from broken equipment",
    description: "Employee sustained minor cut while handling damaged shelving unit",
    type: "Injury",
    severity: "minor",
    siteId: "3",
    companyName: "TechStart Ltd",
    reportedBy: "user3",
    reportedByName: "Mike Wilson",
    status: "resolved",
    incidentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    reportedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    injuriesReported: true,
    riddorReportable: false,
  },
  {
    id: "4",
    title: "Chemical spill in production area",
    description: "Accidental spill of cleaning chemicals requiring emergency response",
    type: "Hazardous Substance",
    severity: "critical",
    siteId: "1",
    companyName: "Acme Corporation",
    siteName: "Head Office",
    reportedBy: "user1",
    reportedByName: "John Smith",
    status: "closed",
    incidentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    reportedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    injuriesReported: false,
    riddorReportable: true,
  },
];

const severityConfig: Record<IncidentSeverity, { label: string; className: string }> = {
  minor: { label: "Minor", className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" },
  moderate: { label: "Moderate", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  major: { label: "Major", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  critical: { label: "Critical", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
};

const statusConfig: Record<IncidentStatus, { label: string; icon: typeof AlertTriangle; className: string }> = {
  reported: { label: "Reported", icon: AlertTriangle, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  under_review: { label: "Under Review", icon: Clock, className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  resolved: { label: "Resolved", icon: CheckCircle, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  closed: { label: "Closed", icon: XCircle, className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" },
};

function IncidentCard({ incident, onViewDetails }: { incident: Incident; onViewDetails: (incident: Incident) => void }) {
  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];
  const StatusIcon = status.icon;

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${
              incident.severity === "critical" ? "bg-red-500/10" :
              incident.severity === "major" ? "bg-orange-500/10" :
              "bg-module-accent/10"
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                incident.severity === "critical" ? "text-red-500" :
                incident.severity === "major" ? "text-orange-500" :
                "text-module-accent"
              }`} />
            </div>
            <div>
              <h3 className="font-semibold">{incident.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{incident.type}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {incident.companyName}
                  {incident.siteName && ` - ${incident.siteName}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {incident.reportedByName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={severity.className}>
              {severity.label}
            </Badge>
            <Badge variant="outline" className={status.className}>
              <StatusIcon className="mr-1.5 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </div>

        {(incident.injuriesReported || incident.riddorReportable) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {incident.injuriesReported && (
              <Badge variant="destructive" className="text-xs">
                Injuries Reported
              </Badge>
            )}
            {incident.riddorReportable && (
              <Badge variant="destructive" className="text-xs">
                RIDDOR Reportable
              </Badge>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Incident: {format(new Date(incident.incidentDate), "MMM d, yyyy")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-module-accent hover:text-module-accent"
            onClick={() => onViewDetails(incident)}
            data-testid={`button-view-details-${incident.id}`}
          >
            View Details
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentDetailDialog({ incident, open, onClose }: { incident: Incident | null; open: boolean; onClose: () => void }) {
  if (!incident) return null;

  const severity = severityConfig[incident.severity];
  const status = statusConfig[incident.status];
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-3 pr-6">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
              incident.severity === "critical" ? "bg-red-500/10" :
              incident.severity === "major" ? "bg-orange-500/10" :
              "bg-module-accent/10"
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                incident.severity === "critical" ? "text-red-500" :
                incident.severity === "major" ? "text-orange-500" :
                "text-module-accent"
              }`} />
            </div>
            <span>{incident.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={severity.className}>
              {severity.label}
            </Badge>
            <Badge variant="outline" className={status.className}>
              <StatusIcon className="mr-1.5 h-3 w-3" />
              {status.label}
            </Badge>
            {incident.injuriesReported && (
              <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>
            )}
            {incident.riddorReportable && (
              <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <ClipboardList className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Incident Type</p>
                <p className="font-medium">{incident.type}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Company</p>
                <p className="font-medium">{incident.companyName}</p>
              </div>
            </div>
            {incident.siteName && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground">Site</p>
                  <p className="font-medium">{incident.siteName}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Reported By</p>
                <p className="font-medium">{incident.reportedByName}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Incident Date</p>
                <p className="font-medium">{format(new Date(incident.incidentDate), "d MMM yyyy")}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Reported At</p>
                <p className="font-medium">{format(new Date(incident.reportedAt), "d MMM yyyy, HH:mm")}</p>
              </div>
            </div>
            {incident.resolvedAt && (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-muted-foreground">Resolved At</p>
                  <p className="font-medium">{format(new Date(incident.resolvedAt), "d MMM yyyy, HH:mm")}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-sm text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{incident.description}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HSIncidents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const incidents = mockIncidents;

  const filteredIncidents = incidents?.filter((incident) => {
    const matchesSearch = incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: incidents?.length || 0,
    reported: incidents?.filter((i) => i.status === "reported").length || 0,
    underReview: incidents?.filter((i) => i.status === "under_review").length || 0,
    resolved: incidents?.filter((i) => i.status === "resolved" || i.status === "closed").length || 0,
  };

  return (
    <div className="theme-hs">
      <div className="border-t-4 border-t-module-accent bg-module-accent-subtle">
        <div className="p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-module-accent/20">
                <ShieldAlert className="h-6 w-6 text-module-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Incidents</h1>
                <p className="text-muted-foreground">
                  Report, review, and record workplace incidents
                </p>
              </div>
            </div>
            <Button className="bg-module-accent hover:bg-module-accent/90" data-testid="button-report-incident">
              <Plus className="mr-2 h-4 w-4" />
              Report Incident
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-module-accent/10">
                <AlertTriangle className="h-5 w-5 text-module-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-total-incidents">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertOctagon className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-reported">{stats.reported}</p>
                <p className="text-sm text-muted-foreground">New Reports</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-under-review">{stats.underReview}</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-resolved">{stats.resolved}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-incidents"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "reported", "under_review", "resolved", "closed"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? "bg-module-accent hover:bg-module-accent/90" : ""}
                data-testid={`filter-${status}`}
              >
                {status === "all" ? "All" :
                 status === "under_review" ? "Under Review" :
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {filteredIncidents && filteredIncidents.length > 0 ? (
          <div className="space-y-4">
            {filteredIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onViewDetails={setSelectedIncident}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <AlertTriangle className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No incidents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "No incidents have been reported yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <IncidentDetailDialog
        incident={selectedIncident}
        open={selectedIncident !== null}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}
