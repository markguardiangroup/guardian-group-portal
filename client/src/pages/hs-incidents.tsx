import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Flag,
  Target,
  FileText,
  Loader2,
  Edit,
  CheckSquare,
  Square,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Incident, IncidentMilestone } from "@shared/schema";

type IncidentSeverity = "minor" | "moderate" | "major" | "critical";
type IncidentStatus = "reported" | "under_review" | "resolved" | "closed";

const INCIDENT_TYPES = [
  "Slip/Trip/Fall",
  "Near Miss",
  "Injury",
  "Hazardous Substance",
  "Fire/Explosion",
  "Equipment Failure",
  "Ergonomic Issue",
  "Violence/Aggression",
  "Property Damage",
  "Environmental Incident",
  "Other",
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

const reportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  incidentType: z.string().min(1, "Please select an incident type"),
  severity: z.enum(["minor", "moderate", "major", "critical"]),
  siteId: z.string().min(1, "Please select a site"),
  entityId: z.string().min(1, "Company is required"),
  incidentDate: z.string().min(1, "Incident date is required"),
  injuriesReported: z.boolean().default(false),
  riddorReportable: z.boolean().default(false),
  injuryDetails: z.string().optional(),
  immediateActions: z.string().optional(),
  locationDetails: z.string().optional(),
  witnesses: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

function ReportIncidentDialog({
  open,
  onClose,
  sites,
  companies,
  userRole,
  userCompanyId,
}: {
  open: boolean;
  onClose: () => void;
  sites: any[];
  companies: any[];
  userRole: string;
  userCompanyId: string | null;
}) {
  const { toast } = useToast();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: "",
      description: "",
      incidentType: "",
      severity: "minor",
      siteId: "",
      entityId: userRole === "client" && userCompanyId ? userCompanyId : "",
      incidentDate: new Date().toISOString().split("T")[0],
      injuriesReported: false,
      riddorReportable: false,
      injuryDetails: "",
      immediateActions: "",
      locationDetails: "",
      witnesses: "",
    },
  });

  const watchEntityId = form.watch("entityId");
  const watchInjuries = form.watch("injuriesReported");

  const filteredSites = sites.filter(s =>
    watchEntityId ? s.entityId === watchEntityId || s.companyId === watchEntityId : true
  );

  const mutation = useMutation({
    mutationFn: (data: ReportFormValues) => apiRequest("POST", "/api/incidents", {
      ...data,
      incidentDate: new Date(data.incidentDate).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident reported", description: "The incident has been recorded successfully." });
      form.reset();
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to report incident.", variant: "destructive" });
    },
  });

  const onSubmit = (values: ReportFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-module-accent" />
            Report Incident
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Incident Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the incident" {...field} data-testid="input-incident-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="incidentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-incident-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INCIDENT_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {userRole !== "client" && (
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company *</FormLabel>
                      <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("siteId", ""); }}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site *</FormLabel>
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v);
                      const site = sites.find((s: any) => s.id === v);
                      if (site) form.setValue("entityId", site.entityId || site.companyId || "");
                    }}>
                      <FormControl>
                        <SelectTrigger data-testid="select-site">
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSites.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="incidentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-incident-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what happened in detail..."
                      className="resize-none"
                      rows={4}
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Details</FormLabel>
                  <FormControl>
                    <Input placeholder="Specific location within the site" {...field} data-testid="input-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="immediateActions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Immediate Actions Taken</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What immediate steps were taken to address the incident?"
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="textarea-immediate-actions"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="witnesses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Witnesses</FormLabel>
                  <FormControl>
                    <Input placeholder="Names of any witnesses present" {...field} data-testid="input-witnesses" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Safety Flags</p>
              <FormField
                control={form.control}
                name="injuriesReported"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-injuries"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Injuries were sustained</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="riddorReportable"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-riddor"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">RIDDOR reportable</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {watchInjuries && (
              <FormField
                control={form.control}
                name="injuryDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Injury Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the injuries sustained..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="textarea-injury-details"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-module-accent hover:bg-module-accent/90"
                data-testid="button-submit-incident"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Report Incident
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneItem({
  milestone,
  isPrivileged,
  onToggle,
  onDelete,
}: {
  milestone: IncidentMilestone;
  isPrivileged: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <button
        onClick={() => isPrivileged && onToggle(milestone.id, !milestone.isCompleted)}
        className={`mt-0.5 shrink-0 ${isPrivileged ? "cursor-pointer" : "cursor-default"}`}
        data-testid={`milestone-toggle-${milestone.id}`}
      >
        {milestone.isCompleted ? (
          <CheckSquare className="h-4 w-4 text-emerald-500" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {milestone.title}
        </p>
        {milestone.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
        )}
        {milestone.dueDate && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Due: {format(new Date(milestone.dueDate), "d MMM yyyy")}
          </p>
        )}
      </div>
      {isPrivileged && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(milestone.id)}
          data-testid={`milestone-delete-${milestone.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function IncidentDetailDialog({
  incidentId,
  open,
  onClose,
  sites,
  isPrivileged,
}: {
  incidentId: string | null;
  open: boolean;
  onClose: () => void;
  sites: any[];
  isPrivileged: boolean;
}) {
  const { toast } = useToast();
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", incidentId],
    queryFn: () => fetch(`/api/incidents/${incidentId}`).then(r => r.json()),
    enabled: !!incidentId,
  });

  const { data: milestones = [] } = useQuery<IncidentMilestone[]>({
    queryKey: ["/api/incidents", incidentId, "milestones"],
    queryFn: () => fetch(`/api/incidents/${incidentId}/milestones`).then(r => r.json()),
    enabled: !!incidentId,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", incidentId, "documents"],
    queryFn: () => fetch(`/api/incidents/${incidentId}/documents`).then(r => r.json()),
    enabled: !!incidentId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/incidents/${incidentId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incidentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setEditingStatus(false);
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (title: string) => apiRequest("POST", `/api/incidents/${incidentId}/milestones`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incidentId, "milestones"] });
      setNewMilestoneTitle("");
      setAddingMilestone(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add milestone.", variant: "destructive" }),
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      apiRequest("PATCH", `/api/milestones/incident/${id}`, {
        isCompleted,
        completedDate: isCompleted ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incidentId, "milestones"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update milestone.", variant: "destructive" }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/milestones/incident/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", incidentId, "milestones"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete milestone.", variant: "destructive" }),
  });

  if (!incidentId) return null;

  const siteName = incident ? sites.find(s => s.id === incident.siteId)?.name : null;
  const severity = incident ? severityConfig[incident.severity as IncidentSeverity] : null;
  const statusCfg = incident ? statusConfig[incident.status as IncidentStatus] : null;
  const StatusIcon = statusCfg?.icon ?? AlertTriangle;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !incident ? (
          <div className="py-16 text-center text-muted-foreground">Incident not found</div>
        ) : (
          <>
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
                <div>
                  <span>{incident.title}</span>
                  <p className="text-sm font-normal text-muted-foreground mt-0.5">{incident.incidentReference}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {severity && (
                  <Badge variant="outline" className={severity.className}>
                    {severity.label}
                  </Badge>
                )}
                {statusCfg && (
                  <Badge variant="outline" className={statusCfg.className}>
                    <StatusIcon className="mr-1.5 h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                )}
                {incident.injuriesReported && (
                  <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>
                )}
                {incident.riddorReportable && (
                  <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
                )}
              </div>

              {isPrivileged && (
                <div className="flex items-center gap-2">
                  {editingStatus ? (
                    <>
                      <Select onValueChange={(v) => updateStatusMutation.mutate(v)}>
                        <SelectTrigger className="w-48" data-testid="select-update-status">
                          <SelectValue placeholder="Change status..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reported">Reported</SelectItem>
                          <SelectItem value="under_review">Under Review</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => setEditingStatus(false)}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingStatus(true)} data-testid="button-change-status">
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Change Status
                    </Button>
                  )}
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <ClipboardList className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Incident Type</p>
                    <p className="font-medium">{incident.incidentType}</p>
                  </div>
                </div>
                {siteName && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Site</p>
                      <p className="font-medium">{siteName}</p>
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
                    <p className="text-muted-foreground">Reported On</p>
                    <p className="font-medium">{format(new Date(incident.createdAt), "d MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                {incident.resolvedAt && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Resolved At</p>
                      <p className="font-medium">{format(new Date(incident.resolvedAt), "d MMM yyyy")}</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{incident.description}</p>
              </div>

              {incident.locationDetails && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Location</p>
                  <p className="text-sm">{incident.locationDetails}</p>
                </div>
              )}

              {incident.immediateActions && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Immediate Actions Taken</p>
                  <p className="text-sm">{incident.immediateActions}</p>
                </div>
              )}

              {incident.witnesses && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Witnesses</p>
                  <p className="text-sm">{incident.witnesses}</p>
                </div>
              )}

              {incident.injuryDetails && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Injury Details</p>
                  <p className="text-sm">{incident.injuryDetails}</p>
                </div>
              )}

              {incident.rootCause && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Root Cause</p>
                  <p className="text-sm">{incident.rootCause}</p>
                </div>
              )}

              {incident.correctiveActions && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Corrective Actions</p>
                  <p className="text-sm">{incident.correctiveActions}</p>
                </div>
              )}

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Action Items</h3>
                    <Badge variant="secondary">{milestones.length}</Badge>
                  </div>
                  {isPrivileged && !addingMilestone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingMilestone(true)}
                      data-testid="button-add-milestone"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add Action
                    </Button>
                  )}
                </div>

                {addingMilestone && (
                  <div className="flex gap-2 mb-3">
                    <Input
                      placeholder="Action item title..."
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMilestoneTitle.trim()) {
                          addMilestoneMutation.mutate(newMilestoneTitle.trim());
                        }
                        if (e.key === "Escape") { setAddingMilestone(false); setNewMilestoneTitle(""); }
                      }}
                      autoFocus
                      data-testid="input-milestone-title"
                    />
                    <Button
                      size="sm"
                      disabled={!newMilestoneTitle.trim() || addMilestoneMutation.isPending}
                      onClick={() => newMilestoneTitle.trim() && addMilestoneMutation.mutate(newMilestoneTitle.trim())}
                      data-testid="button-save-milestone"
                    >
                      Add
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setAddingMilestone(false); setNewMilestoneTitle(""); }}>
                      Cancel
                    </Button>
                  </div>
                )}

                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No action items added yet.</p>
                ) : (
                  <div className="divide-y">
                    {milestones.map(m => (
                      <MilestoneItem
                        key={m.id}
                        milestone={m}
                        isPrivileged={isPrivileged}
                        onToggle={(id, completed) => toggleMilestoneMutation.mutate({ id, isCompleted: completed })}
                        onDelete={(id) => deleteMilestoneMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {documents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">Documents</h3>
                      <Badge variant="secondary">{documents.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.title || doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">{doc.mimeType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IncidentCard({ incident, onViewDetails, sites }: { incident: Incident; onViewDetails: (id: string) => void; sites: any[] }) {
  const severity = severityConfig[incident.severity as IncidentSeverity] || severityConfig.minor;
  const statusCfg = statusConfig[incident.status as IncidentStatus] || statusConfig.reported;
  const StatusIcon = statusCfg.icon;
  const siteName = sites.find(s => s.id === incident.siteId)?.name;

  return (
    <Card className="hover-elevate" data-testid={`card-incident-${incident.id}`}>
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
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{incident.title}</h3>
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground border-muted">
                  {incident.incidentReference}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{incident.incidentType}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {siteName && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {siteName}
                  </span>
                )}
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
            <Badge variant="outline" className={statusCfg.className}>
              <StatusIcon className="mr-1.5 h-3 w-3" />
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        {(incident.injuriesReported || incident.riddorReportable) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {incident.injuriesReported && (
              <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>
            )}
            {incident.riddorReportable && (
              <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {format(new Date(incident.incidentDate), "MMM d, yyyy")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-module-accent hover:text-module-accent"
            onClick={() => onViewDetails(incident.id)}
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

export default function HSIncidents() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(params.id || null);

  useEffect(() => {
    if (params.id) setSelectedIncidentId(params.id);
  }, [params.id]);

  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
    queryFn: () => fetch("/api/incidents").then(r => r.json()),
  });

  const { data: sites = [] } = useQuery<any[]>({
    queryKey: ["/api/sites"],
  });

  const { data: companiesData } = useQuery<any>({
    queryKey: ["/api/companies"],
    enabled: isPrivileged,
  });
  const companies = companiesData?.companies ?? [];

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.incidentReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.incidentType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: incidents.length,
    reported: incidents.filter((i) => i.status === "reported").length,
    underReview: incidents.filter((i) => i.status === "under_review").length,
    resolved: incidents.filter((i) => i.status === "resolved" || i.status === "closed").length,
  };

  const handleViewDetails = (id: string) => {
    setSelectedIncidentId(id);
    setLocation(`/health-safety/incidents/${id}`);
  };

  const handleCloseDetail = () => {
    setSelectedIncidentId(null);
    setLocation("/health-safety/incidents");
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
            <Button
              className="bg-module-accent hover:bg-module-accent/90"
              onClick={() => setShowReportDialog(true)}
              data-testid="button-report-incident"
            >
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

        {incidentsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredIncidents.length > 0 ? (
          <div className="space-y-4">
            {filteredIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                sites={sites}
                onViewDetails={handleViewDetails}
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
              <Button
                className="mt-4 bg-module-accent hover:bg-module-accent/90"
                onClick={() => setShowReportDialog(true)}
                data-testid="button-report-first-incident"
              >
                <Plus className="mr-2 h-4 w-4" />
                Report First Incident
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ReportIncidentDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        sites={sites}
        companies={companies}
        userRole={user?.role || "client"}
        userCompanyId={user?.companyId || null}
      />

      <IncidentDetailDialog
        incidentId={selectedIncidentId}
        open={!!selectedIncidentId}
        onClose={handleCloseDetail}
        sites={sites}
        isPrivileged={isPrivileged}
      />
    </div>
  );
}
