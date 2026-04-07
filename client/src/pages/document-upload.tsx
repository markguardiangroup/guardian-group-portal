import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Users,
  ShieldCheck,
  ChevronRight,
  Check,
  Search,
  MapPin,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import type { Site, ModuleType } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  comments: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  folderId: z.string().min(1, "Please select a folder"),
  requiresApproval: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
  complianceMode: z.enum(["none", "renewal", "expiry"]).default("none"),
  renewalPeriodMonths: z.number().nullable().optional(),
}).refine((data) => {
  if (data.complianceMode === "renewal" && !data.renewalPeriodMonths) {
    return false;
  }
  return true;
}, {
  message: "Please select a renewal period",
  path: ["renewalPeriodMonths"],
}).refine((data) => {
  if (data.complianceMode === "expiry" && !data.expiryDate) {
    return false;
  }
  return true;
}, {
  message: "Please select an expiry date",
  path: ["expiryDate"],
});

type DocumentUploadForm = z.infer<typeof documentUploadSchema>;

const moduleLabels: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
  reports: "Reports",
};

const modulePaths: Record<ModuleType, string> = {
  health_safety: "/health-safety/documents",
  human_resources: "/human-resources/documents",
  employment_law: "/employment-law",
  training: "/training/documents",
  support: "/support",
  reports: "/reports",
};

interface DocumentFolder {
  id: string;
  name: string;
  siteId: string;
  module: string;
  parentId?: string | null;
  sortOrder?: number;
  templateId?: string | null;
}

export default function DocumentUpload() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  const isAdminOrConsultant = user?.role === "admin" || user?.role === "consultant";
  const [uploadStep, setUploadStep] = useState<"choice" | "site" | "upload" | "complete">("choice");
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [sitePickerSearch, setSitePickerSearch] = useState("");
  const [expandedPickerCompanies, setExpandedPickerCompanies] = useState<Set<string>>(new Set());

  // Read pre-fill params from URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlSiteId = urlParams.get("siteId") || "";
  const urlFolderId = urlParams.get("folderId") || "";

  // Detect module from URL path
  const getModuleFromPath = (): ModuleType => {
    if (location.includes("/health-safety")) return "health_safety";
    if (location.includes("/human-resources")) return "human_resources";
    if (location.includes("/employment-law")) return "employment_law";
    if (location.includes("/training")) return "training";
    return "health_safety"; // default
  };
  
  const initialModule = getModuleFromPath();
  const isModulePreselected = location.includes("/health-safety") || 
    location.includes("/human-resources") || 
    location.includes("/employment-law") || 
    location.includes("/training");

  interface SiteWithCompany extends Site {
    companyName?: string | null;
  }

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: folderTemplates = [] } = useQuery<{ id: string }[]>({
    queryKey: ["/api/folder-templates"],
  });

  const { data: moduleTemplates } = useQuery<any[]>({
    queryKey: ["/api/document-templates", initialModule],
    queryFn: async () => {
      const res = await fetch(`/api/document-templates?module=${initialModule}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const hasRelevantTemplates = (moduleTemplates?.length ?? 0) > 0;

  const handleUploadFromScratch = () => {
    if (hasRelevantTemplates) {
      setShowTemplatePrompt(true);
    } else {
      setUploadStep("site");
    }
  };

  const form = useForm<DocumentUploadForm>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      title: "",
      comments: "",
      module: initialModule,
      folderId: "",
      requiresApproval: true,
      isRequired: false,
      reviewDate: "",
      expiryDate: "",
      complianceMode: "none",
      renewalPeriodMonths: null,
    },
  });

  const selectedModule = form.watch("module");
  const requiresApproval = form.watch("requiresApproval");
  const complianceMode = form.watch("complianceMode");
  const renewalPeriodMonths = form.watch("renewalPeriodMonths");

  const primarySiteId = selectedSiteIds[0] ?? "";
  const selectedSiteObjects = (() => {
    if (!sites) return [];
    return sites.filter(s => selectedSiteIds.includes(s.id));
  })();

  useEffect(() => {
    if (user && !isAdminOrConsultant) {
      navigate("/");
    }
  }, [user, isAdminOrConsultant]);

  useEffect(() => {
    setSelectedApproverId("");
  }, [selectedSiteIds.join(",")]);

  // Auto-populate site from URL param once sites load
  useEffect(() => {
    if (urlSiteId && sites && sites.length > 0 && selectedSiteIds.length === 0) {
      const site = sites.find(s => s.id === urlSiteId);
      if (site) {
        setSelectedSiteIds([urlSiteId]);
      }
    }
  }, [urlSiteId, sites]);

  // Keep the accordion expanded for any selected sites
  useEffect(() => {
    if (selectedSiteIds.length > 0 && sites) {
      setExpandedPickerCompanies(prev => {
        const next = new Set(prev);
        for (const siteId of selectedSiteIds) {
          const site = sites.find(s => s.id === siteId);
          if (site?.companyId) next.add(site.companyId);
        }
        return next;
      });
    }
  }, [selectedSiteIds, sites]);

  // Group all sites by company for the accordion picker
  const siteGroups = useMemo(() => {
    if (!sites) return [];
    const grouped: Record<string, { companyId: string; companyName: string; sites: SiteWithCompany[] }> = {};
    for (const site of sites) {
      const key = site.companyId || "";
      if (!grouped[key]) grouped[key] = { companyId: key, companyName: site.companyName || "", sites: [] };
      grouped[key].sites.push(site);
    }
    return Object.values(grouped).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [sites]);

  const filteredSiteGroups = useMemo(() => {
    const q = sitePickerSearch.trim().toLowerCase();
    if (!q) return siteGroups;
    return siteGroups.map(g => {
      const companyMatches = g.companyName.toLowerCase().includes(q);
      const matchingSites = companyMatches ? g.sites : g.sites.filter(s => s.name.toLowerCase().includes(q));
      return { ...g, sites: matchingSites };
    }).filter(g => g.sites.length > 0);
  }, [siteGroups, sitePickerSearch]);

  const handleSitePickerSelect = (site: SiteWithCompany) => {
    setSelectedSiteIds(prev => {
      if (prev.includes(site.id)) {
        return prev.filter(id => id !== site.id);
      }
      return [...prev, site.id];
    });
    form.setValue("folderId", "");
  };

  const togglePickerCompany = (companyId: string) => {
    setExpandedPickerCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  interface UserWithAssignments {
    id: string;
    fullName: string;
    role: string;
    status: string;
    companyId?: string | null;
    siteAssignments?: { siteId: string; siteName: string }[];
  }

  const { data: allUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: isAdminOrConsultant,
  });

  // Warnings for upload step: identify selected sites missing clients or consultants
  const selectedSitesWithNoClients = useMemo(() => {
    if (!allUsers || selectedSiteIds.length === 0 || !sites) return [];
    return selectedSiteObjects.filter(site =>
      !allUsers.some(u => u.role === "client" && u.siteAssignments?.some(a => a.siteId === site.id))
    );
  }, [allUsers, selectedSiteIds, selectedSiteObjects]);

  const selectedSitesWithNoConsultants = useMemo(() => {
    if (selectedSiteIds.length === 0 || !sites) return [];
    return selectedSiteObjects.filter(site =>
      !site.assignedConsultants || site.assignedConsultants.length === 0
    );
  }, [selectedSiteIds, selectedSiteObjects, sites]);

  // Client approver options — only users with access to ALL selected sites
  const siteClientUsers = useMemo(() => {
    if (!allUsers || selectedSiteIds.length === 0) return [];
    return allUsers.filter(
      u => u.role === "client" &&
        selectedSiteIds.every(siteId => u.siteAssignments?.some(a => a.siteId === siteId))
    );
  }, [allUsers, selectedSiteIds]);

  // Provision folders mutation
  const provisionFoldersMutation = useMutation({
    mutationFn: async ({ siteId, module }: { siteId: string; module: string }) => {
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
      queryClient.refetchQueries({ queryKey: ["/api/folders", primarySiteId] });
    },
  });

  // Fetch folders for the primary selected site
  const { data: siteFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", primarySiteId],
    queryFn: async () => {
      if (!primarySiteId) return [];
      const res = await fetch(`/api/folders?siteId=${primarySiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const folders = await res.json();

      // Always call provision to sync any missing template folders
      try {
        await provisionFoldersMutation.mutateAsync({ siteId: primarySiteId, module: selectedModule });
        const newRes = await fetch(`/api/folders?siteId=${primarySiteId}`, {
          credentials: "include",
        });
        if (newRes.ok) return newRes.json();
      } catch (e) {
        console.error("Failed to provision folders:", e);
      }

      return folders;
    },
    enabled: !!primarySiteId,
  });

  // Filter and sort folders hierarchically by selected module
  const moduleFolders = (() => {
    const validTemplateIds = new Set(folderTemplates.map(ft => ft.id));
    const forModule = siteFolders?.filter(f => f.module === selectedModule) || [];
    // Toolkit root folders have sortOrder < 0; exclude them and all their children
    const toolkitRootIds = new Set(forModule.filter(f => (f.sortOrder ?? 0) < 0).map(f => f.id));
    // Only show folders whose template still exists (filter out orphaned folders from deleted templates)
    const filtered = forModule.filter(f =>
      (f.sortOrder ?? 0) >= 0 &&
      !toolkitRootIds.has(f.parentId ?? "") &&
      (!f.templateId || validTemplateIds.has(f.templateId))
    );
    // Sort hierarchically: parents first, then children immediately after their parent
    const result: DocumentFolder[] = [];
    const parentFolders = filtered.filter(f => !f.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const parent of parentFolders) {
      result.push(parent);
      const children = filtered.filter(f => f.parentId === parent.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      result.push(...children);
    }
    return result;
  })();

  // Auto-populate folder from URL param once module folders load
  useEffect(() => {
    if (urlFolderId && moduleFolders.length > 0 && !form.getValues("folderId")) {
      const folder = moduleFolders.find(f => f.id === urlFolderId);
      if (folder) {
        form.setValue("folderId", urlFolderId);
      }
    }
  }, [urlFolderId, moduleFolders]);

  const mutation = useMutation({
    mutationFn: async (data: DocumentUploadForm) => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

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
        throw new Error("Failed to upload file to storage");
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;

      const selectedFolderName = moduleFolders.find(f => f.id === data.folderId)?.name || "";
      const results = [];

      for (const siteId of selectedSiteIds) {
        try {
          await fetch("/api/folders/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteId, module: data.module }),
            credentials: "include",
          });
        } catch (e) {
          console.error(`Failed to provision folders for site ${siteId}:`, e);
        }

        let siteFolderId = data.folderId;
        if (selectedSiteIds.length > 1) {
          try {
            const foldersRes = await fetch(`/api/folders?siteId=${siteId}`, { credentials: "include" });
            if (foldersRes.ok) {
              const siteFoldersList = await foldersRes.json();
              const matchingFolder = siteFoldersList.find((f: DocumentFolder) => f.name === selectedFolderName && f.module === data.module);
              if (matchingFolder) siteFolderId = matchingFolder.id;
            }
          } catch (e) {
            console.error(`Failed to fetch folders for site ${siteId}:`, e);
          }
        }

        const isFirstSite = siteId === selectedSiteIds[0];
        const formData: Record<string, any> = {
          title: data.title,
          comments: data.comments,
          module: data.module,
          siteId,
          folderId: siteFolderId || undefined,
          requiresApproval: data.requiresApproval,
          isRequired: data.isRequired,
          reviewDate: data.reviewDate,
          expiryDate: data.complianceMode === "expiry" && data.expiryDate ? data.expiryDate : undefined,
          renewalPeriodMonths: data.complianceMode === "renewal" ? data.renewalPeriodMonths : undefined,
          type: "supporting_document",
          fileName: selectedFile.name,
          fileUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/pdf",
          notifyUserIds: data.requiresApproval && selectedApproverId && isFirstSite ? [selectedApproverId] : [],
        };
        const result = await apiRequest("POST", "/api/documents", formData);
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      setUploadStep("complete");
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const onSubmit = (data: DocumentUploadForm) => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    if (selectedSiteIds.length === 0) {
      toast({
        title: "No Site Selected",
        description: "Please go back and select at least one site.",
        variant: "destructive",
      });
      return;
    }
    if (data.requiresApproval && siteClientUsers.length > 0 && !selectedApproverId) {
      toast({
        title: "Client Approver Required",
        description: "Please select a client approver for this document.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const steps = [
    { key: "site", label: "Select Site(s)" },
    { key: "upload", label: "Upload & Details" },
  ] as const;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-back"
          onClick={() => {
            if (uploadStep === "site") setUploadStep("choice");
            else if (uploadStep === "upload") setUploadStep("site");
            else navigate(modulePaths[selectedModule] || "/documents");
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Upload External Document</h1>
          <p className="mt-1 text-muted-foreground">
            Upload a third-party or externally created document
          </p>
        </div>
      </div>

      {(uploadStep === "site" || uploadStep === "upload") && (
        <div className="flex items-center gap-0">
          {steps.map((step, idx) => {
            const isActive = uploadStep === step.key;
            const isComplete = steps.findIndex(s => s.key === uploadStep) > idx;
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                    isActive ? "bg-white/20" : isComplete ? "bg-primary/20" : "bg-muted-foreground/20"
                  }`}>{idx + 1}</span>
                  <span>{step.label}</span>
                </div>
                {idx < steps.length - 1 && <div className="h-px w-8 bg-border mx-1" />}
              </div>
            );
          })}
        </div>
      )}

      {uploadStep === "choice" && (
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          {isAdminOrConsultant && (
            <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
              <CardContent className="py-6 flex flex-col items-start gap-4 h-full">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Create from Template</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use a pre-built template with standardised content and compliance settings.
                  </p>
                </div>
                <Link href={`/create-from-template?returnTo=${encodeURIComponent(location)}&module=${initialModule}${urlSiteId ? `&siteId=${urlSiteId}` : ""}`} className="w-full">
                  <Button className="w-full" data-testid="button-create-from-template">
                    Create from Template
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
          <Card className="border-muted hover:bg-muted/30 transition-colors">
            <CardContent className="py-6 flex flex-col items-start gap-4 h-full">
              <div className="p-3 bg-muted rounded-lg">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">Upload from Scratch</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload an existing document from your computer without using a template.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={handleUploadFromScratch} data-testid="button-upload-from-scratch">
                Upload from Scratch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {uploadStep === "site" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Select Site(s)</CardTitle>
            <CardDescription>Choose one or more sites this document will be uploaded to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSiteIds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedSiteIds.map(siteId => {
                  const site = sites?.find(s => s.id === siteId);
                  if (!site) return null;
                  return (
                    <div key={siteId} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm" data-testid={`badge-site-${siteId}`}>
                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                      <span className="font-medium">{site.name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSiteIds(prev => prev.filter(id => id !== siteId))}
                        className="text-muted-foreground hover:text-foreground ml-0.5"
                        data-testid={`button-remove-site-${siteId}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={sitePickerSearch}
                onChange={(e) => setSitePickerSearch(e.target.value)}
                placeholder="Search companies or sites…"
                className="pl-8 h-8 text-sm"
                data-testid="input-site-picker-search"
              />
            </div>

            {!sites ? (
              <p className="text-sm text-muted-foreground">Loading sites…</p>
            ) : filteredSiteGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching sites found.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1 rounded-md border p-1" data-testid="site-picker-list">
                {filteredSiteGroups.map(({ companyId, companyName, sites: groupSites }) => {
                  const isOpen = sitePickerSearch.trim() !== "" || expandedPickerCompanies.has(companyId);
                  return (
                    <div key={companyId} className="rounded-md border">
                      <button
                        type="button"
                        onClick={() => togglePickerCompany(companyId)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-md text-left"
                        data-testid={`button-picker-toggle-company-${companyId}`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{companyName}</span>
                          <span className="text-xs text-muted-foreground">({groupSites.length})</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t">
                          {groupSites.map((site) => {
                            const isSelected = selectedSiteIds.includes(site.id);
                            return (
                              <button
                                key={site.id}
                                type="button"
                                onClick={() => handleSitePickerSelect(site)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left last:rounded-b-md transition-colors ${
                                  isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                                }`}
                                data-testid={`button-picker-select-site-${site.id}`}
                              >
                                <span className="text-sm pl-5">{site.name}</span>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          <div className="px-6 pb-6 flex justify-end">
            <Button
              onClick={() => setUploadStep("upload")}
              disabled={selectedSiteIds.length === 0}
              data-testid="button-continue-to-upload"
            >
              Continue{selectedSiteIds.length > 1 ? ` (${selectedSiteIds.length} sites)` : ""}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {uploadStep === "upload" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>
                  {selectedSiteIds.length > 1
                    ? `Uploading to ${selectedSiteIds.length} sites`
                    : `Uploading to ${selectedSiteObjects[0]?.name ?? "selected site"}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Document title" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Comments</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any comments about this document"
                              {...field}
                              data-testid="textarea-comments"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!isModulePreselected && (
                      <FormField
                        control={form.control}
                        name="module"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Module <span className="text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-module">
                                  <SelectValue placeholder="Select module" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(moduleLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {isAdminOrConsultant && (selectedSitesWithNoClients.length > 0 || selectedSitesWithNoConsultants.length > 0) && (
                      <div className="space-y-2">
                        {selectedSitesWithNoClients.length > 0 && (
                          <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-sites-no-clients">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Sites with no client users assigned</p>
                              <p className="text-sm text-muted-foreground">
                                {selectedSitesWithNoClients.map(s => s.name).join(", ")} — documents uploaded to these sites will not be visible to any client users.
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedSitesWithNoConsultants.length > 0 && (
                          <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-sites-no-consultants">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Sites with no consultant assigned</p>
                              <p className="text-sm text-muted-foreground">
                                {selectedSitesWithNoConsultants.map(s => s.name).join(", ")} — approvals and reviews won't be possible for these sites.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="folderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Folder *</FormLabel>
                          {provisionFoldersMutation.isPending ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Setting up folders...
                            </div>
                          ) : moduleFolders.length > 0 ? (
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-folder">
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
                            <div className="text-sm text-muted-foreground py-2">
                              No folders available for this module. Please wait while folders are being set up...
                            </div>
                          )}
                          <FormDescription>
                            Select a folder to organise this document
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                              data-testid="approval-required-button"
                              className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                                field.value
                                  ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                  : "border-muted bg-muted/30 hover:bg-muted/50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 font-medium">
                                <XCircle className={`h-3.5 w-3.5 ${field.value ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                                Client approval
                              </span>
                              <span className="text-xs text-muted-foreground leading-tight">
                                Needs review before becoming compliant
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange(false)}
                              data-testid="no-approval-button"
                              className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                                !field.value
                                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                  : "border-muted bg-muted/30 hover:bg-muted/50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 font-medium">
                                <CheckCircle2 className={`h-3.5 w-3.5 ${!field.value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                                Auto-approve
                              </span>
                              <span className="text-xs text-muted-foreground leading-tight">
                                Marked compliant immediately on upload
                              </span>
                            </button>
                          </div>
                        </FormItem>
                      )}
                    />

                    {requiresApproval && selectedSiteIds.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-1">
                          Client Approver
                          <span className="text-destructive">*</span>
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {selectedSiteIds.length > 1
                            ? `Select a client user with access to all ${selectedSiteIds.length} selected sites`
                            : "Select the client user who will review and approve this document"}
                        </p>
                        {siteClientUsers.length > 0 ? (
                          <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                            <SelectTrigger
                              className={!selectedApproverId ? "border-destructive" : ""}
                              data-testid="select-client-approver"
                            >
                              <SelectValue placeholder="Select a client approver…" />
                            </SelectTrigger>
                            <SelectContent>
                              {siteClientUsers.map((u) => (
                                <SelectItem
                                  key={u.id}
                                  value={u.id}
                                  disabled={u.status !== "active"}
                                  data-testid={`option-approver-${u.id}`}
                                >
                                  <span className="flex items-center gap-2">
                                    {u.fullName}
                                    {u.status !== "active" && (
                                      <span className="text-xs text-muted-foreground">(not active)</span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            <Users className="h-4 w-4 shrink-0" />
                            {selectedSiteIds.length > 1
                              ? "No client users have access to all selected sites. Assign users in User Management first."
                              : "No client users are assigned to this site. Assign users in User Management first."}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Compliance</h3>
                      </div>
                      <FormField
                        control={form.control}
                        name="isRequired"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <FormLabel className="text-sm font-medium text-foreground">
                                  Required for Compliance
                                </FormLabel>
                                <p className="text-xs text-muted-foreground leading-snug">
                                  Mark this document as required. If it is not compliant and up to date, it will count against the compliance score for this site.
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="toggle-is-required"
                                  className="shrink-0 mt-0.5"
                                />
                              </FormControl>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reviewDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>When should this document be reviewed by?</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="date" className="pl-10" {...field} data-testid="input-review-date" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Compliance Tracking</Label>
                      <div className="space-y-2">
                        <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "none" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-none">
                          <input type="radio" name="complianceModeRadio" value="none" checked={complianceMode === "none"}
                            onChange={() => { form.setValue("complianceMode", "none"); form.setValue("renewalPeriodMonths", null); form.setValue("expiryDate", ""); }}
                            className="accent-primary" />
                          <span className="text-sm">No expiry or renewal</span>
                        </label>
                        <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "renewal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-renewal">
                          <input type="radio" name="complianceModeRadio" value="renewal" checked={complianceMode === "renewal"}
                            onChange={() => { form.setValue("complianceMode", "renewal"); form.setValue("expiryDate", ""); }}
                            className="accent-primary mt-1" />
                          <div className="flex-1 space-y-2">
                            <span className="text-sm">Renewal period {complianceMode === "renewal" && <span className="text-destructive">*</span>}</span>
                            {complianceMode === "renewal" && (
                              <Select
                                value={renewalPeriodMonths != null ? String(renewalPeriodMonths) : ""}
                                onValueChange={(val) => form.setValue("renewalPeriodMonths", parseInt(val))}
                              >
                                <SelectTrigger className="h-9" data-testid="select-compliance-renewal-period">
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
                        <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "expiry" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-expiry">
                          <input type="radio" name="complianceModeRadio" value="expiry" checked={complianceMode === "expiry"}
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
                                        <Input type="date" className="pl-10 h-9" {...field} data-testid="input-expiry-date" />
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

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setUploadStep("site")}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                      </Button>
                      <Button type="submit" disabled={mutation.isPending} data-testid="button-upload">
                        {mutation.isPending ? (
                          "Uploading..."
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Document
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Upload File <span className="text-destructive text-base">*</span></CardTitle>
                <CardDescription>Drag and drop or click to select</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : selectedFile
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                      </div>
                      <p className="mt-3 font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="mt-3 font-medium">Drop file here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                      <label className="absolute inset-0 cursor-pointer">
                        <input
                          type="file"
                          className="sr-only"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          data-testid="input-file"
                        />
                      </label>
                    </>
                  )}
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Supported formats: PDF, Word, Excel, PowerPoint
                </p>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Upload Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Maximum file size: 25MB</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Use descriptive file names</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Set review dates for compliance tracking</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>All uploads are logged for audit purposes</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {uploadStep === "complete" && (
        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">
              {selectedSiteIds.length > 1 ? "Documents Uploaded Successfully" : "Document Uploaded Successfully"}
            </h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              {selectedSiteIds.length > 1 ? (
                <>The document has been uploaded to <span className="font-medium">{selectedSiteIds.length} sites</span>.</>
              ) : (
                <>The document has been uploaded to <span className="font-medium">{selectedSiteObjects[0]?.name}</span>.</>
              )}
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadStep("choice");
                  setSelectedSiteIds([]);
                  setSelectedFile(null);
                  setSelectedApproverId("");
                  form.reset();
                }}
                data-testid="button-upload-another"
              >
                Upload Another
              </Button>
              <Button
                onClick={() => navigate(modulePaths[selectedModule] || "/documents")}
                data-testid="button-view-documents"
              >
                View Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showTemplatePrompt} onOpenChange={setShowTemplatePrompt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Templates Available
            </DialogTitle>
            <DialogDescription>
              There are templates available for this module that can save you time and ensure compliance standards are met. Would you like to use a template instead?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full"
              onClick={() => {
                setShowTemplatePrompt(false);
                navigate(`/create-from-template?returnTo=${encodeURIComponent(location)}&module=${initialModule}${urlSiteId ? `&siteId=${urlSiteId}` : ""}`);
              }}
              data-testid="button-prompt-switch-template"
            >
              Switch to Template
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowTemplatePrompt(false);
                setUploadStep("site");
              }}
              data-testid="button-prompt-continue"
            >
              Continue Without Template
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setShowTemplatePrompt(false)}
              data-testid="button-prompt-cancel"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
