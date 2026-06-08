import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  X,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Users,
  MapPin,
} from "lucide-react";
import type { ModuleType, Site } from "@shared/schema";

const uploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  comments: z.string().optional(),
  folderId: z.string().min(1, "Please select a folder"),
  requiresApproval: z.boolean().default(true),
  autoFinalApproval: z.boolean().default(true),
  isMandatory: z.boolean().default(false),
  expiryDate: z.string().optional(),
  complianceMode: z.enum(["none", "renewal", "expiry"]).default("none"),
  renewalPeriodMonths: z.number().nullable().optional(),
}).refine((data) => {
  if (data.complianceMode === "renewal" && !data.renewalPeriodMonths) return false;
  return true;
}, { message: "Please select a renewal period", path: ["renewalPeriodMonths"] })
.refine((data) => {
  if (data.complianceMode === "expiry" && !data.expiryDate) return false;
  return true;
}, { message: "Please select an expiry date", path: ["expiryDate"] });

type UploadForm = z.infer<typeof uploadSchema>;

interface DocumentFolder {
  id: string;
  name: string;
  siteId: string;
  module: string;
  parentId?: string | null;
  sortOrder?: number;
}

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

interface UserWithAssignments {
  id: string;
  fullName: string;
  role: string;
  status: string;
  companyId?: string | null;
  siteAssignments?: { siteId: string; siteName: string }[];
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  siteName: string;
  companyName?: string | null;
  module: ModuleType;
  initialFolderId?: string;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  siteId,
  siteName,
  companyName,
  module,
  initialFolderId,
}: UploadDocumentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [selectedOnBehalfId, setSelectedOnBehalfId] = useState<string>("");

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      comments: "",
      folderId: initialFolderId || "",
      requiresApproval: true,
      autoFinalApproval: true,
      isMandatory: false,
      expiryDate: "",
      complianceMode: "none",
      renewalPeriodMonths: null,
    },
  });

  const requiresApproval = form.watch("requiresApproval");
  const autoFinalApproval = form.watch("autoFinalApproval");
  const complianceMode = form.watch("complianceMode");
  const renewalPeriodMonths = form.watch("renewalPeriodMonths");

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        comments: "",
        folderId: initialFolderId || "",
        requiresApproval: true,
        autoFinalApproval: true,
        isMandatory: false,
        expiryDate: "",
        complianceMode: "none",
        renewalPeriodMonths: null,
      });
      setSelectedFile(null);
      setSelectedApproverId("");
      setSelectedOnBehalfId("");
    }
  }, [open, initialFolderId]);

  useEffect(() => {
    setSelectedApproverId("");
    setSelectedOnBehalfId("");
  }, [siteId]);

  const provisionFoldersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/folders/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, module }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to provision folders");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", siteId, module] });
    },
  });

  // Fetch folders — plain fetch only, no provision inside to avoid invalidation loops
  const { data: siteFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", siteId, module],
    queryFn: async () => {
      if (!siteId) return [];
      const res = await fetch(`/api/folders?siteId=${siteId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!siteId,
  });

  // Provision folders once when the dialog opens for this site (outside queryFn)
  const provisionedKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open || !siteId) return;
    const key = `${siteId}:${module}`;
    if (provisionedKeys.current.has(key)) return;
    provisionedKeys.current.add(key);
    provisionFoldersMutation.mutate();
  }, [open, siteId, module]); // eslint-disable-line react-hooks/exhaustive-deps

  const moduleFolders = (() => {
    const filtered = siteFolders?.filter(f => f.module === module) || [];
    const result: DocumentFolder[] = [];
    const parentFolders = filtered.filter(f => !f.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const parent of parentFolders) {
      result.push(parent);
      const children = filtered.filter(f => f.parentId === parent.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      result.push(...children);
    }
    return result;
  })();

  const { data: allUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const siteClientUsers = (() => {
    if (!allUsers || !siteId) return [];
    return allUsers.filter(
      u => u.role === "client" && u.siteAssignments?.some(a => a.siteId === siteId)
    );
  })();

  const isAdmin = user?.role === "administrator";
  // For admin on-behalf-of: show all active consultants; server validates eligibility.
  const eligibleOnBehalfConsultants = isAdmin
    ? (allUsers ?? []).filter(u => u.role === "consultant" && u.status === "active")
    : [];

  const mutation = useMutation({
    mutationFn: async (data: UploadForm) => {
      if (!selectedFile) throw new Error("No file selected");

      const uploadResponse = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(selectedFile.name),
        },
        body: selectedFile,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 401) throw new Error("Your session has expired — please refresh the page and log back in.");
        throw new Error("Failed to upload file to storage");
      }
      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;

      return apiRequest("POST", "/api/documents", {
        title: data.title,
        comments: data.comments,
        module,
        siteId,
        folderId: data.folderId || undefined,
        requiresApproval: data.requiresApproval,
        autoFinalApproval: data.requiresApproval ? data.autoFinalApproval : false,
        isMandatory: data.isMandatory,
        expiryDate: data.complianceMode === "expiry" && data.expiryDate ? data.expiryDate : undefined,
        renewalPeriodMonths: data.complianceMode === "renewal" ? data.renewalPeriodMonths : undefined,
        type: "supporting_document",
        fileName: selectedFile.name,
        fileUrl,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || "application/pdf",
        approvalRequestedFrom: data.requiresApproval && selectedApproverId ? selectedApproverId : undefined,
        notifyUserIds: data.requiresApproval && selectedApproverId ? [selectedApproverId] : [],
        onBehalfOfUserId: isAdmin && data.requiresApproval && selectedOnBehalfId ? selectedOnBehalfId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      toast({ title: "Document Uploaded", description: "Your document has been uploaded successfully." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "There was an error uploading your document.", variant: "destructive" });
    },
  });

  const onSubmit = (data: UploadForm) => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select a file to upload.", variant: "destructive" });
      return;
    }
    if (isAdmin && data.requiresApproval && !selectedOnBehalfId) {
      toast({ title: "Consultant Required", description: "Please select a consultant to act on behalf of for this document.", variant: "destructive" });
      return;
    }
    if (data.requiresApproval && siteId && !selectedApproverId) {
      toast({ title: "Client Approver Required", description: "Please select a client approver for this document.", variant: "destructive" });
      return;
    }
    mutation.mutate(data);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </DialogTitle>
        </DialogHeader>

        {/* Site context badge */}
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{siteName}</p>
            {companyName && <p className="text-xs text-muted-foreground truncate">{companyName}</p>}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Document title" {...field} data-testid="input-upload-dialog-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comments */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any comments about this document" rows={2} {...field} data-testid="input-upload-dialog-comments" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File upload */}
            <div>
              <p className="text-sm font-medium mb-2">File <span className="text-destructive">*</span></p>
              <div
                className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors ${
                  isDragging ? "border-primary bg-primary/5"
                  : selectedFile ? "border-emerald-500 bg-emerald-500/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                    <p className="mt-2 font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedFile(null)} type="button">
                      <X className="mr-1 h-3 w-3" /> Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Drop file here or click to browse</p>
                    <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint</p>
                    <label className="absolute inset-0 cursor-pointer">
                      <input type="file" className="sr-only" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" data-testid="input-upload-dialog-file" />
                    </label>
                  </>
                )}
              </div>
            </div>

            {/* Folder */}
            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder <span className="text-destructive">*</span></FormLabel>
                  {moduleFolders.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-upload-dialog-folder">
                          <SelectValue placeholder="Select a folder" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {moduleFolders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.parentId ? "└ " : ""}{folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Setting up folders...</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Approval */}
            <FormField
              control={form.control}
              name="requiresApproval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approval Process</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      data-testid="upload-dialog-approval-required"
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                        field.value ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : "border-muted bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <XCircle className={`h-3.5 w-3.5 ${field.value ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                        Client approval
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">Needs review before compliant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      data-testid="upload-dialog-no-approval"
                      className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                        !field.value ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "border-muted bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${!field.value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                        Auto-approve
                      </span>
                      <span className="text-xs text-muted-foreground leading-tight">Marked compliant immediately</span>
                    </button>
                  </div>
                </FormItem>
              )}
            />

            {/* Auto Final Approval toggle — only visible when Client Approval is on */}
            {requiresApproval && (
              <FormField
                control={form.control}
                name="autoFinalApproval"
                render={({ field }) => (
                  <FormItem>
                    <div className="ml-1 flex items-center justify-between gap-4 rounded-md border border-dashed px-4 py-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">Auto Final Approval</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {field.value
                            ? "This document will be approved automatically once the client approves it"
                            : "A consultant will need to provide final sign-off after the client approves."}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="toggle-upload-dialog-auto-final-approval"
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Admin: Approval on behalf of consultant */}
            {requiresApproval && isAdmin && (
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  Approval on behalf of <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground">Select the consultant who will own and sign off this document.</p>
                {eligibleOnBehalfConsultants.length > 0 ? (
                  <Select value={selectedOnBehalfId} onValueChange={setSelectedOnBehalfId}>
                    <SelectTrigger className={!selectedOnBehalfId ? "border-destructive" : ""} data-testid="select-upload-dialog-on-behalf">
                      <SelectValue placeholder="Select a consultant…" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleOnBehalfConsultants.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    No active consultants available.
                  </div>
                )}
              </div>
            )}

            {/* Client approver */}
            {requiresApproval && siteId && (
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  Client Approver <span className="text-destructive">*</span>
                </label>
                {siteClientUsers.length > 0 ? (
                  <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                    <SelectTrigger className={!selectedApproverId ? "border-destructive" : ""} data-testid="select-upload-dialog-approver">
                      <SelectValue placeholder="Select a client approver…" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteClientUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id} disabled={u.status !== "active"}>
                          {u.fullName}{u.status !== "active" ? " (inactive)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    No client users assigned to this site.
                  </div>
                )}
              </div>
            )}

            {/* Compliance section */}
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Compliance</h3>
              </div>
              <FormField
                control={form.control}
                name="isMandatory"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">Required for Compliance</FormLabel>
                        <p className="text-xs text-muted-foreground">Counts against the compliance score if not up to date.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="toggle-upload-dialog-required" />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            </div>


            {/* Compliance tracking */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Compliance Tracking</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "none" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                  <input type="radio" name="complianceModeDialog" value="none" checked={complianceMode === "none"}
                    onChange={() => { form.setValue("complianceMode", "none"); form.setValue("renewalPeriodMonths", null); form.setValue("expiryDate", ""); }}
                    className="accent-primary" />
                  <span className="text-sm">No expiry or renewal</span>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "renewal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                  <input type="radio" name="complianceModeDialog" value="renewal" checked={complianceMode === "renewal"}
                    onChange={() => { form.setValue("complianceMode", "renewal"); form.setValue("expiryDate", ""); }}
                    className="accent-primary mt-1" />
                  <div className="flex-1 space-y-2">
                    <span className="text-sm">Renewal period {complianceMode === "renewal" && <span className="text-destructive">*</span>}</span>
                    {complianceMode === "renewal" && (
                      <Select value={renewalPeriodMonths != null ? String(renewalPeriodMonths) : ""} onValueChange={(val) => form.setValue("renewalPeriodMonths", parseInt(val))}>
                        <SelectTrigger className="h-9" data-testid="select-upload-dialog-renewal">
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                            <SelectItem key={m} value={String(m)}>
                              {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "expiry" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                  <input type="radio" name="complianceModeDialog" value="expiry" checked={complianceMode === "expiry"}
                    onChange={() => { form.setValue("complianceMode", "expiry"); form.setValue("renewalPeriodMonths", null); }}
                    className="accent-primary mt-1" />
                  <div className="flex-1 space-y-2">
                    <span className="text-sm">Expiry date {complianceMode === "expiry" && <span className="text-destructive">*</span>}</span>
                    {complianceMode === "expiry" && (
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input type="date" className="pl-10 h-9" {...field} data-testid="input-upload-dialog-expiry" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-upload-dialog-submit">
                {mutation.isPending ? "Uploading..." : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
