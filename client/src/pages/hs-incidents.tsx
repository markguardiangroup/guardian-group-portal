import { useState, useRef } from "react";
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
} from "lucide-react";
import { format, isPast } from "date-fns";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", id],
    queryFn: () => fetch(`/api/incidents/${id}`).then(r => r.json()),
  });

  const { data: milestones = [] } = useQuery<IncidentMilestone[]>({
    queryKey: ["/api/incidents", id, "milestones"],
    queryFn: () => fetch(`/api/incidents/${id}/milestones`).then(r => r.json()),
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/incidents", id, "documents"],
    queryFn: () => fetch(`/api/incidents/${id}/documents`).then(r => r.json()),
  });

  const { data: site } = useQuery<any>({
    queryKey: ["/api/sites", incident?.siteId],
    queryFn: () => fetch(`/api/sites/${incident?.siteId}`).then(r => r.json()),
    enabled: !!incident?.siteId,
  });

  const { data: company } = useQuery<any>({
    queryKey: ["/api/companies", incident?.entityId],
    queryFn: () => fetch(`/api/companies/${incident?.entityId}`).then(r => r.json()),
    enabled: !!incident?.entityId,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiRequest("PATCH", `/api/incidents/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setShowStatusDialog(false);
      toast({ title: "Incident updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update incident.", variant: "destructive" }),
  });

  const addMilestoneMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/incidents/${id}/milestones`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents", id, "milestones"] }),
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
                        <div className="px-3 py-2">
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
                      <div key={doc.id} className="group flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors" data-testid={`doc-${doc.id}`}>
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
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
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isPrivileged && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(doc)}
                              data-testid={`button-edit-doc-${doc.id}`}
                              title="Edit title & notes"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {doc.fileUrl && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
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
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxPhoto(null)}
          data-testid="lightbox-overlay"
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
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
          <div className="flex flex-col items-center gap-3 max-h-[90vh] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxPhoto.fileUrl}
              alt={lightboxPhoto.title || lightboxPhoto.fileName}
              className="max-h-[75vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
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
      )}

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
  const [showReportDialog, setShowReportDialog] = useState(false);

  const isPrivileged = user?.role === "admin" || user?.role === "consultant";

  const { data: incidents = [], isLoading } = useQuery<Incident[]>({
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
    reported: incidents.filter(i => i.status === "reported").length,
    underReview: incidents.filter(i => i.status === "under_review").length,
    resolved: incidents.filter(i => i.status === "resolved" || i.status === "closed").length,
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
                <p className="text-muted-foreground">Report, review, and manage workplace incidents</p>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredIncidents.length > 0 ? (
          <div className="space-y-4">
            {filteredIncidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} sites={sites} />
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
