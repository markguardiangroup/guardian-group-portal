import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Loader2,
  ArrowLeft,
  MoreVertical,
  RotateCcw,
  FileText,
  Upload,
  Download,
  Trash2,
  Flag,
  Activity,
  Camera,
  ZoomIn,
  X,
  Pencil,
  MessageSquare,
  History,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye,
  Filter,
} from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { format, formatDistanceToNow, isPast } from "date-fns";
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

// ─── Report Incident Dialog ───────────────────────────────────────────────────

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
  const [, navigate] = useLocation();

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
    onSuccess: async (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident reported", description: "The incident has been recorded successfully." });
      form.reset();
      onClose();
      // Navigate to the new incident detail page
      if (res?.id) navigate(`/health-safety/incidents/${res.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to report incident.", variant: "destructive" });
    },
  });

  const onSubmit = (values: ReportFormValues) => mutation.mutate(values);

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
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Incident Title *</FormLabel>
                <FormControl><Input placeholder="Brief description of the incident" {...field} data-testid="input-incident-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="incidentType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Incident Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-incident-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
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
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {userRole !== "client" && (
                <FormField control={form.control} name="entityId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("siteId", ""); }}>
                      <FormControl>
                        <SelectTrigger data-testid="select-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site *</FormLabel>
                  <Select value={field.value} onValueChange={(v) => {
                    field.onChange(v);
                    const site = sites.find((s: any) => s.id === v);
                    if (site) form.setValue("entityId", site.entityId || site.companyId || "");
                  }}>
                    <FormControl>
                      <SelectTrigger data-testid="select-site"><SelectValue placeholder="Select site" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSites.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="incidentDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Incident Date *</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-incident-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl><Textarea placeholder="Describe what happened in detail..." className="resize-none" rows={4} {...field} data-testid="textarea-description" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="locationDetails" render={({ field }) => (
              <FormItem>
                <FormLabel>Location Details</FormLabel>
                <FormControl><Input placeholder="Specific location within the site" {...field} data-testid="input-location" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="immediateActions" render={({ field }) => (
              <FormItem>
                <FormLabel>Immediate Actions Taken</FormLabel>
                <FormControl><Textarea placeholder="What immediate steps were taken?" className="resize-none" rows={3} {...field} data-testid="textarea-immediate-actions" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="witnesses" render={({ field }) => (
              <FormItem>
                <FormLabel>Witnesses</FormLabel>
                <FormControl><Input placeholder="Names of any witnesses present" {...field} data-testid="input-witnesses" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="space-y-3 rounded-md border p-4">
              <p className="text-sm font-medium">Safety Flags</p>
              <FormField control={form.control} name="injuriesReported" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-injuries" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">Injuries were sustained</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="riddorReportable" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-riddor" /></FormControl>
                  <FormLabel className="font-normal cursor-pointer">RIDDOR reportable</FormLabel>
                </FormItem>
              )} />
            </div>

            {watchInjuries && (
              <FormField control={form.control} name="injuryDetails" render={({ field }) => (
                <FormItem>
                  <FormLabel>Injury Details</FormLabel>
                  <FormControl><Textarea placeholder="Describe the injuries sustained..." className="resize-none" rows={3} {...field} data-testid="textarea-injury-details" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-module-accent hover:bg-module-accent/90" data-testid="button-submit-incident">
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

// ─── Doc History Panel ────────────────────────────────────────────────────────

function DocHistoryPanel({ docId }: { docId: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents", docId, "audit"],
    queryFn: () => fetch(`/api/documents/${docId}/audit`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch audit"); return r.json(); }),
  });

  const actionLabel: Record<string, string> = {
    document_uploaded: "Uploaded",
    update_document: "Details updated",
  };
  const actionIcon: Record<string, React.ReactNode> = {
    document_uploaded: <Upload className="h-3.5 w-3.5" />,
    update_document: <Pencil className="h-3.5 w-3.5" />,
  };
  const actionColor: Record<string, string> = {
    document_uploaded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    update_document: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading history…</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 px-1">No history recorded for this file.</p>;
  }

  return (
    <div className="space-y-2 py-1">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-start gap-2.5">
          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${actionColor[log.action] ?? "bg-muted text-muted-foreground"}`}>
            {actionIcon[log.action] ?? <Activity className="h-3 w-3" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium leading-tight">
              {actionLabel[log.action] ?? log.action} <span className="font-normal text-muted-foreground">by {log.userName}</span>
            </p>
            {log.details && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {format(new Date(log.createdAt), "d MMM yyyy 'at' HH:mm")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit Action Style Helper ────────────────────────────────────────────────

function getAuditActionStyle(action: string): { icon: (props: any) => JSX.Element; bg: string; color: string } {
  switch (action) {
    case "incident_created":       return { icon: Plus,              bg: "bg-pink-50 dark:bg-pink-950",    color: "text-pink-600 dark:text-pink-400" };
    case "incident_status_changed":return { icon: AlertTriangle,     bg: "bg-amber-50 dark:bg-amber-950",  color: "text-amber-600 dark:text-amber-400" };
    case "incident_updated":       return { icon: FileText,          bg: "bg-muted",                        color: "text-muted-foreground" };
    case "document_uploaded":      return { icon: Upload,            bg: "bg-blue-50 dark:bg-blue-950",    color: "text-blue-600 dark:text-blue-400" };
    case "milestone_added":        return { icon: Calendar,          bg: "bg-purple-50 dark:bg-purple-950",color: "text-purple-600 dark:text-purple-400" };
    case "milestone_completed":    return { icon: CheckCircle,       bg: "bg-green-50 dark:bg-green-950",  color: "text-green-600 dark:text-green-400" };
    case "update_document":        return { icon: Pencil,            bg: "bg-blue-50 dark:bg-blue-950",    color: "text-blue-600 dark:text-blue-400" };
    default:                       return { icon: Shield,            bg: "bg-muted",                        color: "text-muted-foreground" };
  }
}

// ─── Incident Detail View (Full Page) ────────────────────────────────────────

function IncidentDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isPrivileged = user?.role === "admin" || user?.role === "consultant";
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<IncidentMilestone | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  const navigatePhoto = useCallback((direction: "prev" | "next", photoList: any[]) => {
    setLightboxPhoto(current => {
      if (!current || photoList.length < 2) return current;
      const idx = photoList.findIndex(p => p.id === current.id);
      if (idx === -1) return current;
      return direction === "next"
        ? photoList[(idx + 1) % photoList.length]
        : photoList[(idx - 1 + photoList.length) % photoList.length];
    });
  }, []);

  const toggleHistory = (docId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", id],
    queryFn: () => fetch(`/api/incidents/${id}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch incident"); return r.json(); }),
  });

  const { data: milestones = [] } = useQuery<IncidentMilestone[]>({
    queryKey: ["/api/incidents", id, "milestones"],
    queryFn: () => fetch(`/api/incidents/${id}/milestones`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch milestones"); return r.json(); }),
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", id, "documents"],
    queryFn: () => fetch(`/api/incidents/${id}/documents`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch documents"); return r.json(); }),
  });

  useEffect(() => {
    if (!lightboxPhoto) return;
    const photoList = documents.filter((d: any) => d.mimeType?.startsWith("image/"));
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") navigatePhoto("next", photoList);
      else if (e.key === "ArrowLeft") navigatePhoto("prev", photoList);
      else if (e.key === "Escape") setLightboxPhoto(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxPhoto, documents, navigatePhoto]);

  const { data: incidentAuditLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", id, "audit"],
    queryFn: () => fetch(`/api/incidents/${id}/audit`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch audit"); return r.json(); }),
    enabled: !!id,
  });

  const { data: site } = useQuery<any>({
    queryKey: ["/api/sites", incident?.siteId],
    queryFn: () => fetch(`/api/sites/${incident?.siteId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch site"); return r.json(); }),
    enabled: !!incident?.siteId,
  });

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies", incident?.entityId],
    queryFn: () => fetch(`/api/companies/${incident?.entityId}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error("Failed to fetch company"); return r.json(); }),
    enabled: !!incident?.entityId,
  });

  const invalidateAudit = () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "audit"] });

  const downloadIncidentDocument = async (docId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${docId}/download`, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiRequest("PATCH", `/api/incidents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      invalidateAudit();
      setShowStatusDialog(false);
      toast({ title: "Incident updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update incident.", variant: "destructive" }),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/incidents/${id}/milestones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] });
      invalidateAudit();
      setShowMilestoneDialog(false);
      toast({ title: "Action item added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add action item.", variant: "destructive" }),
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("PATCH", `/api/milestones/incident/${milestoneId}`, {
      isCompleted: true,
      completedDate: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] });
      invalidateAudit();
    },
    onError: () => toast({ title: "Error", description: "Failed to complete action item.", variant: "destructive" }),
  });

  const reopenMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("PATCH", `/api/milestones/incident/${milestoneId}`, {
      isCompleted: false,
      completedDate: null,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] }),
    onError: () => toast({ title: "Error", description: "Failed to reopen action item.", variant: "destructive" }),
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) => apiRequest("DELETE", `/api/milestones/incident/${milestoneId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] }),
    onError: () => toast({ title: "Error", description: "Failed to delete action item.", variant: "destructive" }),
  });

  const regenerateReportMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/incidents/${id}/regenerate-report`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      invalidateAudit();
      toast({ title: "Report regenerated", description: "The incident report document has been updated with the latest details." });
    },
    onError: () => toast({ title: "Error", description: "Failed to regenerate report.", variant: "destructive" }),
  });

  const openEditDialog = (doc: any) => {
    setEditingDoc(doc);
    setEditTitle(doc.title || "");
    setEditNotes(doc.description || "");
  };

  const saveDocEdit = async () => {
    if (!editingDoc) return;
    setIsSavingEdit(true);
    try {
      await apiRequest("PATCH", `/api/documents/${editingDoc.id}`, {
        title: editTitle.trim() || editingDoc.title,
        description: editNotes,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      if (lightboxPhoto?.id === editingDoc.id) {
        setLightboxPhoto({ ...lightboxPhoto, title: editTitle.trim() || editingDoc.title, description: editNotes });
      }
      toast({ title: "Saved" });
      setEditingDoc(null);
    } catch {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const uploadRes = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: buffer,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      const { objectPath } = await uploadRes.json();

      const created = await apiRequest("POST", `/api/incidents/${id}/documents`, {
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        fileUrl: objectPath,
        fileSize: file.size,
        mimeType: file.type,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
      invalidateAudit();
      toast({ title: "Document uploaded" });
      if (created) openEditDialog({ ...created, description: "" });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the document.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    let lastDoc: any = null;
    let successCount = 0;
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const uploadRes = await fetch("/api/uploads/file", {
          method: "POST",
          headers: {
            "Content-Type": file.type || "image/jpeg",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: buffer,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        const { objectPath } = await uploadRes.json();

        const created = await apiRequest("POST", `/api/incidents/${id}/documents`, {
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          fileUrl: objectPath,
          fileSize: file.size,
          mimeType: file.type,
        });
        lastDoc = created;
        successCount++;
      } catch {
        toast({ title: "Photo upload failed", description: `Could not upload ${file.name}.`, variant: "destructive" });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "documents"] });
    if (successCount > 0) invalidateAudit();
    if (successCount > 0) {
      toast({ title: successCount === 1 ? "Photo uploaded" : `${successCount} photos uploaded`, description: "You can add a title and notes by clicking the edit button." });
      if (successCount === 1 && lastDoc) {
        openEditDialog({ ...lastDoc, description: "" });
      }
    }
    setIsUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Incident not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/health-safety/incidents")}>
          Back to Incidents
        </Button>
      </div>
    );
  }

  const severity = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
  const statusCfg = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
  const StatusIcon = statusCfg.icon;
  const completedMilestones = milestones.filter(m => m.isCompleted).length;
  const totalMilestones = milestones.length;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const photos = documents.filter(d => d.mimeType?.startsWith("image/"));
  const files = documents.filter(d => !d.mimeType?.startsWith("image/"));

  return (
    <div className="theme-hs">
      <div className="space-y-6 p-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/health-safety/incidents")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">{incident.incidentReference}</h1>
              <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
              <Badge variant="outline" className={statusCfg.className}>
                <StatusIcon className="mr-1.5 h-3 w-3" />
                {statusCfg.label}
              </Badge>
              {incident.injuriesReported && (
                <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>
              )}
              {incident.riddorReportable && (
                <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>
              )}
            </div>
            <p className="mt-1 text-lg text-muted-foreground">{incident.title}</p>
          </div>
          {isPrivileged && (
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(true)}
              data-testid="button-update-status"
            >
              Update Status
            </Button>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Incident Details */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Incident Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Incident Type</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      {incident.incidentType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Incident Date</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(incident.incidentDate), "d MMMM yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reported By</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {incident.reportedByName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reported On</p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(incident.createdAt), "d MMM yyyy, HH:mm")}
                    </p>
                  </div>
                  {incident.resolvedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Resolved On</p>
                      <p className="mt-1 flex items-center gap-2 font-medium text-emerald-600">
                        <CheckCircle className="h-4 w-4" />
                        {format(new Date(incident.resolvedAt), "d MMM yyyy")}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm leading-relaxed">{incident.description}</p>
                </div>

                {incident.locationDetails && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Location</p>
                    <p className="text-sm leading-relaxed">{incident.locationDetails}</p>
                  </div>
                )}

                {incident.immediateActions && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Immediate Actions Taken</p>
                    <p className="text-sm leading-relaxed">{incident.immediateActions}</p>
                  </div>
                )}

                {incident.witnesses && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Witnesses</p>
                    <p className="text-sm leading-relaxed">{incident.witnesses}</p>
                  </div>
                )}

                {incident.injuryDetails && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Injury Details</p>
                    <p className="text-sm leading-relaxed">{incident.injuryDetails}</p>
                  </div>
                )}

                {incident.rootCause && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Root Cause</p>
                    <p className="text-sm leading-relaxed">{incident.rootCause}</p>
                  </div>
                )}

                {incident.correctiveActions && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Corrective Actions</p>
                    <p className="text-sm leading-relaxed">{incident.correctiveActions}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Items / Milestones */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg">Action Items</CardTitle>
                  <CardDescription>Track follow-up tasks and corrective actions</CardDescription>
                </div>
                {isPrivileged && (
                  <Button
                    size="sm"
                    onClick={() => setShowMilestoneDialog(true)}
                    className="bg-module-accent hover:bg-module-accent/90"
                    data-testid="button-add-milestone"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Action
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-5">
                {totalMilestones > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{completedMilestones} of {totalMilestones} completed</span>
                    </div>
                    <Progress value={milestoneProgress} className="h-2" />
                  </div>
                )}
                <div className="space-y-3">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        milestone.isCompleted
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                          : "bg-card"
                      }`}
                      data-testid={`milestone-${milestone.id}`}
                    >
                      <div className={`mt-0.5 rounded-full p-1 ${
                        milestone.isCompleted
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {milestone.isCompleted
                          ? <CheckCircle className="h-4 w-4" />
                          : <Clock className="h-4 w-4" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                          {milestone.title}
                        </p>
                        {milestone.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{milestone.description}</p>
                        )}
                        {milestone.dueDate && (
                          <p className={`text-xs mt-1 ${
                            !milestone.isCompleted && isPast(new Date(milestone.dueDate))
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}>
                            Due: {format(new Date(milestone.dueDate), "d MMM yyyy")}
                          </p>
                        )}
                      </div>
                      {isPrivileged && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-milestone-menu-${milestone.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!milestone.isCompleted ? (
                              <DropdownMenuItem
                                onClick={() => completeMilestoneMutation.mutate(milestone.id)}
                                data-testid={`button-complete-milestone-${milestone.id}`}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                                Mark Complete
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => reopenMilestoneMutation.mutate(milestone.id)}
                                data-testid={`button-reopen-milestone-${milestone.id}`}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reopen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                              data-testid={`button-delete-milestone-${milestone.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                  {milestones.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No action items yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    Photos
                  </CardTitle>
                  <CardDescription>Incident scene photographs and visual evidence</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{photos.length}</Badge>
                  {isPrivileged && (
                    <>
                      <input
                        ref={photoInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        multiple
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        data-testid="button-upload-photo"
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Add Photos
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No photos have been added yet.</p>
                    {isPrivileged && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Upload Photos
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {photos.map((photo: any) => (
                      <div key={photo.id} className="group rounded-lg border bg-card overflow-hidden" data-testid={`photo-thumb-${photo.id}`}>
                        {/* Image area */}
                        <div className="relative aspect-video bg-muted overflow-hidden">
                          <button
                            className="absolute inset-0 w-full h-full"
                            onClick={() => setLightboxPhoto(photo)}
                          >
                            <img
                              src={photo.fileUrl}
                              alt={photo.title || photo.fileName}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </div>
                          </button>
                          {isPrivileged && (
                            <button
                              className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 z-10"
                              onClick={(e) => { e.stopPropagation(); openEditDialog(photo); }}
                              title="Edit title & notes"
                              data-testid={`button-edit-photo-${photo.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {/* Caption */}
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-sm font-medium leading-tight truncate text-foreground">
                            {photo.title || photo.fileName}
                          </p>
                          {photo.description ? (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                              {photo.description}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No notes</p>
                          )}
                          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                            <span className="text-xs text-muted-foreground truncate">
                              {photo.uploadedByName || "Unknown"} · {format(new Date(photo.createdAt), "d MMM yyyy")}
                            </span>
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0 ml-2"
                              onClick={() => toggleHistory(photo.id)}
                              data-testid={`button-history-photo-${photo.id}`}
                            >
                              <History className="h-3 w-3" />
                              {expandedHistory.has(photo.id) ? "Hide" : "History"}
                            </button>
                          </div>
                          {expandedHistory.has(photo.id) && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <DocHistoryPanel docId={photo.id} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
                <div>
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <CardDescription>Reports and files attached to this incident</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{files.length}</Badge>
                  {isPrivileged && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => regenerateReportMutation.mutate()}
                        disabled={regenerateReportMutation.isPending}
                        title="Regenerate the original incident report document with the latest incident details"
                        data-testid="button-regenerate-report"
                      >
                        {regenerateReportMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        Regenerate Report
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        data-testid="button-upload-document"
                      >
                        {isUploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Upload
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No documents attached yet.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((doc: any) => (
                      <div key={doc.id} className="rounded-md border overflow-hidden" data-testid={`doc-${doc.id}`}>
                        <div className="group flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.title || doc.fileName}</p>
                            {doc.description ? (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{doc.description}</span>
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 truncate">{doc.fileName}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.uploadedByName || "Unknown"} · {format(new Date(doc.createdAt), "d MMM yyyy 'at' HH:mm")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {doc.fileUrl && (doc.mimeType === "application/pdf" || doc.mimeType?.startsWith("image/")) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setPreviewDoc(doc)}
                                data-testid={`button-preview-doc-${doc.id}`}
                                title="Preview document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleHistory(doc.id)}
                              data-testid={`button-history-doc-${doc.id}`}
                              title="View history"
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            {isPrivileged && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditDialog(doc)}
                                data-testid={`button-edit-doc-${doc.id}`}
                                title="Edit title & notes"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {doc.fileUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => downloadIncidentDocument(doc.id, doc.fileName)}
                                data-testid={`button-download-doc-${doc.id}`}
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {expandedHistory.has(doc.id) && (
                          <div className="border-t bg-muted/20 px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">File History</p>
                            <DocHistoryPanel docId={doc.id} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base">Overview</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Severity</p>
                  <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="outline" className={statusCfg.className}>
                    <StatusIcon className="mr-1.5 h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                </div>
                <Separator />
                {company && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Company</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {company.name}
                    </p>
                  </div>
                )}
                {site && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Site</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {site.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reported By</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {incident.reportedByName}
                  </p>
                </div>
              </CardContent>
            </Card>

            {(incident.injuriesReported || incident.riddorReportable) && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="border-b border-red-200 dark:border-red-900 pb-3">
                  <CardTitle className="text-base text-red-700 dark:text-red-400 flex items-center gap-2">
                    <Flag className="h-4 w-4" />
                    Safety Flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {incident.injuriesReported && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium">Injuries reported</span>
                    </div>
                  )}
                  {incident.riddorReportable && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium">RIDDOR reportable</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-center mb-3">
                  <p className="text-2xl font-bold">{completedMilestones}<span className="text-muted-foreground text-lg">/{totalMilestones}</span></p>
                  <p className="text-xs text-muted-foreground">actions completed</p>
                </div>
                <Progress value={milestoneProgress} className="h-2" />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-muted-foreground">{Math.round(milestoneProgress)}% done</span>
                  <span className="text-xs text-muted-foreground">{totalMilestones - completedMilestones} remaining</span>
                </div>
              </CardContent>
            </Card>

            {/* Audit Trail */}
            <Card>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {incidentAuditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">No activity yet</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {(showAllAuditLogs ? incidentAuditLogs : incidentAuditLogs.slice(0, 3)).map((log: any) => {
                        const style = getAuditActionStyle(log.action);
                        const Icon = style.icon;
                        return (
                          <div key={log.id} className="flex gap-3 items-start">
                            <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${style.bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${style.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug text-foreground">{log.details}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {log.userName} · {format(new Date(log.createdAt), "d MMM yyyy, HH:mm")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {incidentAuditLogs.length > 3 && (
                      <button
                        className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowAllAuditLogs(v => !v)}
                        data-testid="audit-toggle"
                      >
                        {showAllAuditLogs ? (
                          <><ChevronUp className="h-3 w-3" /> Show less</>
                        ) : (
                          <><ChevronDown className="h-3 w-3" /> Show {incidentAuditLogs.length - 3} more</>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (() => {
        const currentIdx = photos.findIndex(p => p.id === lightboxPhoto.id);
        const hasMultiple = photos.length > 1;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxPhoto(null)}
            data-testid="lightbox-overlay"
          >
            {/* Top-right controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {hasMultiple && (
                <span className="text-xs text-white/60 font-medium tabular-nums px-2">
                  {currentIdx + 1} / {photos.length}
                </span>
              )}
              {isPrivileged && (
                <button
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                  onClick={(e) => { e.stopPropagation(); openEditDialog(lightboxPhoto); }}
                  title="Edit title & notes"
                  data-testid="lightbox-edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                onClick={() => setLightboxPhoto(null)}
                data-testid="lightbox-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Prev arrow */}
            {hasMultiple && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); navigatePhoto("prev", photos); }}
                data-testid="lightbox-prev"
                title="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Next arrow */}
            {hasMultiple && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); navigatePhoto("next", photos); }}
                data-testid="lightbox-next"
                title="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Image + caption */}
            <div className="flex flex-col items-center gap-3 max-h-[90vh] max-w-[80vw]" onClick={e => e.stopPropagation()}>
              <img
                key={lightboxPhoto.id}
                src={lightboxPhoto.fileUrl}
                alt={lightboxPhoto.title || lightboxPhoto.fileName}
                className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-white">{lightboxPhoto.title || lightboxPhoto.fileName}</p>
                {lightboxPhoto.description && (
                  <p className="text-xs text-white/60 max-w-md">{lightboxPhoto.description}</p>
                )}
              </div>
              <Button size="sm" variant="secondary" asChild>
                <a href={lightboxPhoto.fileUrl} download={lightboxPhoto.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1.5 h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Document Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="h-[80vh] flex flex-col p-0 gap-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewDoc?.title || previewDoc?.fileName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewDoc && (() => {
              const mime = previewDoc.mimeType || "";
              const previewUrl = `/api/documents/${previewDoc.id}/preview`;
              if (mime === "text/html") {
                return (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={previewDoc.title || previewDoc.fileName}
                    sandbox="allow-same-origin"
                    data-testid="preview-iframe"
                  />
                );
              }
              if (mime === "application/pdf") {
                return (
                  <PdfViewer url={previewUrl} data-testid="preview-pdf" />
                );
              }
              if (mime.startsWith("image/")) {
                return (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-muted/20">
                    <img
                      src={previewUrl}
                      alt={previewDoc.title}
                      className="max-w-full max-h-full object-contain rounded"
                      data-testid="preview-image"
                    />
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                  <FileText className="h-14 w-14 text-muted-foreground" />
                  <div>
                    <p className="text-base font-medium">Preview not available for this file type</p>
                    <p className="text-sm text-muted-foreground mt-1">{previewDoc.fileName} ({mime || "unknown"})</p>
                  </div>
                  <Button variant="outline" onClick={() => downloadIncidentDocument(previewDoc.id, previewDoc.fileName)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              );
            })()}
          </div>
          <div className="px-5 py-3 border-t bg-muted/30 flex justify-between items-center shrink-0">
            <span className="text-xs text-muted-foreground truncate">{previewDoc?.fileName}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewDoc && downloadIncidentDocument(previewDoc.id, previewDoc.fileName)}
              data-testid="button-download-from-preview"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Title & Notes Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) setEditingDoc(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-doc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingDoc?.mimeType?.startsWith("image/") ? (
                <><Camera className="h-4 w-4" /> Edit Photo Details</>
              ) : (
                <><FileText className="h-4 w-4" /> Edit Document Details</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingDoc?.mimeType?.startsWith("image/") && editingDoc?.fileUrl && (
              <div className="overflow-hidden rounded-md border bg-muted h-32">
                <img src={editingDoc.fileUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Enter a descriptive title..."
                data-testid="input-edit-title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Notes / Comments
              </label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Add context, observations, or notes about this file..."
                className="resize-none"
                rows={3}
                data-testid="textarea-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={saveDocEdit} disabled={isSavingEdit} data-testid="button-save-doc-edit">
              {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Incident Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select
              defaultValue={incident.status}
              onValueChange={(v) => updateMutation.mutate({ status: v })}
            >
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        open={showMilestoneDialog}
        onClose={() => setShowMilestoneDialog(false)}
        onAdd={(data) => addMilestoneMutation.mutate(data)}
        isLoading={addMilestoneMutation.isPending}
      />
    </div>
  );
}

function AddMilestoneDialog({
  open,
  onClose,
  onAdd,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (data: any) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Action Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              placeholder="Action item title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-milestone-title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
            className="bg-module-accent hover:bg-module-accent/90"
            data-testid="button-save-milestone"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Incidents List View ──────────────────────────────────────────────────────

function IncidentCard({ incident, sites }: { incident: Incident; sites: any[] }) {
  const severity = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
  const statusCfg = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
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
              <div className="flex items-center gap-2 flex-wrap">
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
            <Badge variant="outline" className={severity.className}>{severity.label}</Badge>
            <Badge variant="outline" className={statusCfg.className}>
              <StatusIcon className="mr-1.5 h-3 w-3" />
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        {(incident.injuriesReported || incident.riddorReportable) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {incident.injuriesReported && <Badge variant="destructive" className="text-xs">Injuries Reported</Badge>}
            {incident.riddorReportable && <Badge variant="destructive" className="text-xs">RIDDOR Reportable</Badge>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{format(new Date(incident.incidentDate), "MMM d, yyyy")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-module-accent hover:text-module-accent"
            asChild
          >
            <Link href={`/health-safety/incidents/${incident.id}`} data-testid={`button-view-details-${incident.id}`}>
              Open File
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentsListView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();

  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data: incidentsRaw, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });
  const incidents = Array.isArray(incidentsRaw) ? incidentsRaw : [];

  const { data: sites = [] } = useQuery<any[]>({
    queryKey: ["/api/sites"],
  });

  const { data: companiesData } = useQuery<any>({
    queryKey: ["/api/companies"],
    enabled: isPrivileged,
  });
  const companies = companiesData?.companies ?? [];

  const filteredSitesForCombobox = useMemo(() => {
    if (!sites || !selectedCompany || selectedCompany === "all") return sites;
    return sites.filter((s: any) => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const selectedSiteObj = useMemo(() =>
    sites.find((s: any) => s.id === selectedSiteId), [sites, selectedSiteId]);

  const currentContextLabel = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return selectedSiteObj?.name || null;
    if (isPrivileged) return selectedCompany && selectedCompany !== "all" ? selectedCompany : "All Clients";
    return null;
  }, [selectedSiteId, selectedCompany, selectedSiteObj, isPrivileged]);

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const incidentSite = sites.find((s: any) => s.id === incident.siteId);
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.incidentReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.incidentType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesSite = !selectedSiteId || selectedSiteId === "all" || incident.siteId === selectedSiteId;
    const matchesCompany = !selectedCompany || selectedCompany === "all" || incidentSite?.companyName === selectedCompany;
    return matchesSearch && matchesStatus && matchesSeverity && matchesSite && matchesCompany;
  }), [incidents, sites, searchQuery, statusFilter, severityFilter, selectedSiteId, selectedCompany]);

  const stats = {
    active: incidents.filter(i => i.status === "reported" || i.status === "under_review").length,
    critical: incidents.filter(i => i.severity === "major" || i.severity === "critical").length,
    resolved: incidents.filter(i => i.status === "resolved" || i.status === "closed").length,
  };

  return (
    <div className="theme-hs">
      {/* Module header */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ShieldAlert className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Incidents</h1>
              <p className="text-muted-foreground">
                Workplace incident management
                {currentContextLabel && <span className="font-medium"> – {currentContextLabel}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isPrivileged && sites && sites.length > 0 && (
              <>
                <CompanyCombobox
                  sites={sites}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-48"
                  testId="select-company-incidents"
                />
                <SiteCombobox
                  sites={filteredSitesForCombobox}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-48"
                  testId="select-site-incidents"
                />
              </>
            )}
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

      <div className="space-y-6 p-8 dash-animate">
        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-module-accent">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
              <div className="rounded-full bg-module-accent/10 p-2">
                <AlertOctagon className="h-4 w-4 text-module-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-module-accent" data-testid="text-active-incidents">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Reported or under review</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Severity</CardTitle>
              <div className="rounded-full bg-red-100 dark:bg-red-900/40 p-2">
                <Flag className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-critical-incidents">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Major or critical severity</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-resolved-incidents">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Successfully closed</p>
            </CardContent>
          </Card>
        </div>

        {/* Table card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Incident Register</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[200px] pl-8"
                    data-testid="input-search-incidents"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-severity-filter">
                    <SelectValue placeholder="All Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredIncidents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => {
                    const site = sites.find((s: any) => s.id === incident.siteId);
                    const sev = severityConfig[incident.severity as IncidentSeverity] ?? severityConfig.minor;
                    const sta = statusConfig[incident.status as IncidentStatus] ?? statusConfig.reported;
                    return (
                      <TableRow
                        key={incident.id}
                        className="cursor-pointer"
                        data-testid={`row-incident-${incident.id}`}
                        onClick={() => window.location.href = `/health-safety/incidents/${incident.id}`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-module-accent" />
                            <span>{incident.incidentReference}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{incident.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {site ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {site.name}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {incident.incidentType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${sev.className}`}>
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${sta.className}`}>
                            {sta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(incident.incidentDate), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-incident-menu-${incident.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/health-safety/incidents/${incident.id}`} data-testid={`button-view-incident-${incident.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Incident
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <AlertTriangle className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No incidents found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || severityFilter !== "all"
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportIncidentDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        sites={sites}
        companies={companies}
        userRole={user?.role || "client"}
        userCompanyId={user?.companyId || null}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function HSIncidents() {
  const [matchDetail, paramsDetail] = useRoute("/health-safety/incidents/:id");
  const [matchList] = useRoute("/health-safety/incidents");

  if (matchDetail && paramsDetail?.id) {
    return <IncidentDetailView id={paramsDetail.id} />;
  }

  return <IncidentsListView />;
}
