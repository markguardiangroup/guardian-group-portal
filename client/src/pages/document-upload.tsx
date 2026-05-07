import { useState, useEffect, useMemo, useRef } from "react";
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
  Info,
  Building2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import type { Site, ModuleType, DocumentTypeRecord } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  comments: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  folderId: z.string().optional(),
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

interface DocumentUploadPayload {
  title: string;
  comments?: string;
  module: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  requiresApproval: boolean;
  isRequired: boolean;
  reviewDate?: string | null;
  expiryDate?: string | null;
  renewalPeriodMonths?: number | null;
  notifyUserIds: string[];
  templateId?: string | null;
  // Site-scoped fields
  siteId?: string;
  folderId?: string;
  // Company/Group-scoped fields
  scope?: "site" | "company" | "group";
  entityId?: string;
  shareDestinations?: string[];
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
  const isFullPermissionClient = user?.role === "client" && user?.clientPermissionRole === "full";
  const canUploadCompanyGroupScope = isAdminOrConsultant || isFullPermissionClient;
  const [uploadStep, setUploadStep] = useState<"choice" | "site" | "upload" | "complete">("choice");
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [showSiteConfirmDialog, setShowSiteConfirmDialog] = useState(false);
  const [sitePickerSearch, setSitePickerSearch] = useState("");
  const [expandedPickerCompanies, setExpandedPickerCompanies] = useState<Set<string>>(new Set());
  // Full-permission clients can only upload company/group scope docs, not site-scope
  const initialUrlParams = new URLSearchParams(window.location.search);
  const initialUrlScope = initialUrlParams.get("scope") as "site" | "company" | "group" | null;
  const initialUrlEntityId = initialUrlParams.get("entityId") || "";
  const initialUrlEntityName = initialUrlParams.get("entityName") || "";
  const initialUrlSiteId = initialUrlParams.get("siteId") || "";

  // Build the return URL preserving the original scope (group/company) so that
  // the back button and post-upload "View Documents" button take the user back
  // to the same scoped documents view (not the first company under the group).
  const buildReturnUrl = (mod: ModuleType) => {
    const base = modulePaths[mod] || "/documents";
    const params = new URLSearchParams();
    if (initialUrlScope && initialUrlEntityId) {
      params.set("scope", initialUrlScope);
      params.set("entityId", initialUrlEntityId);
      if (initialUrlEntityName) params.set("entityName", initialUrlEntityName);
    } else if (initialUrlSiteId) {
      params.set("siteId", initialUrlSiteId);
    }
    const qs = params.toString();
    return `${base}${qs ? `?${qs}` : ""}`;
  };
  const [docScope, setDocScope] = useState<"site" | "company" | "group">(
    initialUrlScope ? initialUrlScope : (initialUrlSiteId ? "site" : (isFullPermissionClient ? "company" : "site"))
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialUrlEntityId);
  const [entitySearch, setEntitySearch] = useState("");
  // Share destinations: site IDs (company scope) or company IDs (group scope) — require at least one
  const [shareDestinations, setShareDestinations] = useState<string[]>([]);
  const [destSearch, setDestSearch] = useState("");

  // Read pre-fill params from URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlSiteId = urlParams.get("siteId") || "";
  const urlFolderId = urlParams.get("folderId") || "";
  const urlUploadScope = (urlParams.get("scope") as "site" | "company" | "group" | null) || null;
  const urlUploadEntityId = urlParams.get("entityId") || "";
  const urlCompanyFilterId = urlParams.get("companyId") || "";

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

  const { data: allCompaniesData } = useQuery<{ companies: { id: string; name: string; isGroupOwner?: boolean }[] }>({
    queryKey: ["/api/companies", { limit: 1000 }],
    queryFn: async () => {
      const res = await fetch("/api/companies?limit=1000", { credentials: "include" });
      if (!res.ok) return { companies: [] };
      return res.json();
    },
    enabled: canUploadCompanyGroupScope,
  });
  const allCompanies = allCompaniesData?.companies ?? [];

  // Fetch the current user's company to determine group-owner status for UI gating
  const { data: userCompany } = useQuery<{ id: string; name: string; isGroupOwner?: boolean } | null>({
    queryKey: ["/api/companies", user?.companyId],
    queryFn: async () => {
      if (!user?.companyId) return null;
      const res = await fetch(`/api/companies/${user.companyId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isFullPermissionClient && !!user?.companyId,
  });
  // Group scope is available to: admins, consultants, or full-perm clients at a group-owner company
  const canUseGroupScope = isAdminOrConsultant || (isFullPermissionClient && !!userCompany?.isGroupOwner);

  // Sites within the selected company (for company-scope destination picker)
  const { data: companySites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites", { companyId: selectedEntityId }],
    queryFn: async () => {
      if (!selectedEntityId) return [];
      const res = await fetch(`/api/sites?companyId=${selectedEntityId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sites ?? []);
    },
    enabled: docScope === "company" && !!selectedEntityId,
  });
  // Member companies within the selected group (for group-scope destination picker)
  const { data: groupMemberCompanies } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/companies/group-members", selectedEntityId],
    queryFn: async () => {
      if (!selectedEntityId) return [];
      const res = await fetch(`/api/companies?groupOwnerId=${selectedEntityId}&limit=1000`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.companies ?? [];
    },
    enabled: docScope === "group" && !!selectedEntityId,
  });

  const { data: folderTemplates = [] } = useQuery<{ id: string }[]>({
    queryKey: ["/api/folder-templates"],
  });

  const { data: moduleTemplates } = useQuery<DocumentTypeRecord[]>({
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
    if (user && !isAdminOrConsultant && !isFullPermissionClient) {
      navigate("/");
    }
  }, [user, isAdminOrConsultant, isFullPermissionClient]);

  // For full-permission clients doing company/group scope uploads, auto-set their company as the entity
  useEffect(() => {
    if (isFullPermissionClient && docScope !== "site" && user?.companyId && !selectedEntityId) {
      setSelectedEntityId(user.companyId);
    }
  }, [isFullPermissionClient, docScope, user?.companyId, selectedEntityId]);

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

  // Scroll the pre-selected site into view inside the picker list.
  // Must depend on expandedPickerCompanies too: the accordion expand effect
  // runs at the same time as the selection, so the button doesn't exist in
  // the DOM yet on the first fire. After the accordion state update triggers
  // a re-render the effect re-runs, this time finding the button.
  const sitePickerListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedSiteIds.length === 0) return;
    const target = selectedSiteIds[0];
    // Defer one frame so the accordion has finished rendering its children
    const id = requestAnimationFrame(() => {
      if (!sitePickerListRef.current) return;
      const btn = sitePickerListRef.current.querySelector(
        `[data-testid="button-picker-select-site-${target}"]`
      );
      if (btn) (btn as HTMLElement).scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedSiteIds[0], expandedPickerCompanies]);

  // Group all sites by company for the accordion picker
  const siteGroups = useMemo(() => {
    if (!sites) return [];
    const filtered = urlCompanyFilterId
      ? sites.filter(s => s.companyId === urlCompanyFilterId)
      : sites;
    const grouped: Record<string, { companyId: string; companyName: string; sites: SiteWithCompany[] }> = {};
    for (const site of filtered) {
      const key = site.companyId || "";
      if (!grouped[key]) grouped[key] = { companyId: key, companyName: site.companyName || "", sites: [] };
      grouped[key].sites.push(site);
    }
    return Object.values(grouped).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [sites, urlCompanyFilterId]);

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
      if (prev.includes(site.id)) return prev.filter(id => id !== site.id);
      const selectedCompanyId = prev.length > 0 ? sites?.find(s => s.id === prev[0])?.companyId : null;
      if (selectedCompanyId && site.companyId !== selectedCompanyId) return [site.id];
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

  // Client approver options for company/group scope
  // For both company and group scope, the approver must be from the ORIGIN (entity) company —
  // only those users have write/approval access. Member-company clients are destination-only.
  const entityClientUsers = useMemo(() => {
    if (!allUsers || !selectedEntityId) return [];
    // Both company-scope and group-scope: entity (owner) company clients are the eligible approvers
    return allUsers.filter(u => u.role === "client" && u.companyId === selectedEntityId);
  }, [allUsers, docScope, selectedEntityId]);

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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", variables.siteId] });
    },
  });

  // Fetch folders for the primary selected site (plain fetch — no provision inside)
  const { data: siteFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", primarySiteId],
    queryFn: async () => {
      if (!primarySiteId) return [];
      const res = await fetch(`/api/folders?siteId=${primarySiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primarySiteId,
  });

  // Fetch folders for scoped (company/group) uploads
  const scopedFolderScope = urlUploadScope && (urlUploadScope === "company" || urlUploadScope === "group") ? urlUploadScope : null;
  const { data: scopedFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", "scoped", scopedFolderScope, urlUploadEntityId, selectedModule],
    queryFn: async () => {
      if (!scopedFolderScope || !urlUploadEntityId) return [];
      const res = await fetch(`/api/folders?scope=${scopedFolderScope}&entityId=${urlUploadEntityId}&module=${selectedModule}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!scopedFolderScope && !!urlUploadEntityId,
  });

  // Provision folders once per site (outside queryFn to avoid an invalidation loop)
  const provisionedSites = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!primarySiteId || provisionedSites.current.has(primarySiteId)) return;
    provisionedSites.current.add(primarySiteId);
    provisionFoldersMutation.mutate({ siteId: primarySiteId, module: selectedModule });
  }, [primarySiteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Provision scoped folders once per (scope,entity,module)
  const provisionedScopes = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!scopedFolderScope || !urlUploadEntityId) return;
    const key = `${scopedFolderScope}:${urlUploadEntityId}:${selectedModule}`;
    if (provisionedScopes.current.has(key)) return;
    provisionedScopes.current.add(key);
    fetch("/api/folders/provision", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: scopedFolderScope, entityId: urlUploadEntityId, module: selectedModule }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", "scoped", scopedFolderScope, urlUploadEntityId, selectedModule] });
    }).catch(() => {});
  }, [scopedFolderScope, urlUploadEntityId, selectedModule]);

  // Filter and sort folders hierarchically by selected module
  const moduleFolders = (() => {
    const validTemplateIds = new Set(folderTemplates.map(ft => ft.id));
    const sourceFolders = scopedFolderScope ? (scopedFolders || []) : (siteFolders || []);
    const forModule = sourceFolders.filter(f => f.module === selectedModule);
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
        if (uploadResponse.status === 401) throw new Error("Your session has expired — please refresh the page and log back in.");
        throw new Error("Failed to upload file to storage");
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;

      // Company or Group scoped upload — single document, no site association
      if (docScope === "company" || docScope === "group") {
        if (!selectedEntityId) throw new Error("Please select a target company or group");
        if (shareDestinations.length === 0) throw new Error("Please select at least one destination");
        const formData: DocumentUploadPayload = {
          title: data.title,
          comments: data.comments,
          module: data.module,
          scope: docScope,
          entityId: selectedEntityId,
          shareDestinations,
          folderId: data.folderId || undefined,
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
          notifyUserIds: data.requiresApproval && selectedApproverId ? [selectedApproverId] : [],
          templateId: selectedTemplateId || undefined,
        };
        const result = await apiRequest("POST", "/api/documents", formData);
        return [result];
      }

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
        const formData: DocumentUploadPayload = {
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
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
    if (docScope === "site") {
      if (selectedSiteIds.length === 0) {
        toast({
          title: "No Site Selected",
          description: "Please go back and select at least one site.",
          variant: "destructive",
        });
        return;
      }
      if (!data.folderId) {
        toast({
          title: "No Folder Selected",
          description: "Please select a folder to organise this document.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedEntityId) {
        toast({
          title: "No Entity Selected",
          description: `Please go back and select a ${docScope === "company" ? "company" : "group"}.`,
          variant: "destructive",
        });
        return;
      }
      if (shareDestinations.length === 0) {
        toast({
          title: "No Destinations Selected",
          description: docScope === "company"
            ? "Please select at least one site to share this document to."
            : "Please select at least one member company to share this document to.",
          variant: "destructive",
        });
        return;
      }
    }
    if (docScope === "site" && data.requiresApproval && siteClientUsers.length > 0 && !selectedApproverId) {
      toast({
        title: "Client Approver Required",
        description: "Please select a client approver for this document.",
        variant: "destructive",
      });
      return;
    }
    if ((docScope === "company" || docScope === "group") && data.requiresApproval && entityClientUsers.length > 0 && !selectedApproverId) {
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
    { key: "site", label: docScope === "site" ? "Select Site(s)" : docScope === "company" ? "Select Company" : "Select Group" },
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
            else navigate(buildReturnUrl(selectedModule));
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
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const isActive = uploadStep === step.key;
            const isComplete = steps.findIndex(s => s.key === uploadStep) > idx;
            return (
              <div key={step.key} className="flex items-center gap-2">
                {idx > 0 && <div className={`h-px w-8 ${isComplete || isActive ? "bg-primary" : "bg-border"}`} />}
                <button
                  onClick={() => { if (isComplete) setUploadStep(step.key); }}
                  disabled={!isComplete && !isActive}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                      ? "bg-muted hover-elevate cursor-pointer"
                      : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                  }`}
                  data-testid={`step-${step.key}`}
                >
                  <span className="font-medium">{idx + 1}</span>
                  <span>{step.label}</span>
                </button>
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
                <Link href={`/create-from-template?returnTo=${encodeURIComponent(buildReturnUrl(initialModule))}&module=${initialModule}${urlSiteId ? `&siteId=${urlSiteId}` : ""}${urlUploadScope && urlUploadEntityId ? `&scope=${urlUploadScope}&entityId=${urlUploadEntityId}${initialUrlEntityName ? `&entityName=${encodeURIComponent(initialUrlEntityName)}` : ""}` : ""}${urlCompanyFilterId ? `&companyId=${urlCompanyFilterId}` : ""}${urlUploadScope === "site" ? `&scope=site` : ""}`} className="w-full">
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
        <div className="flex gap-6 items-start">
        <Card className="flex-1 max-w-2xl">
          <CardHeader>
            {canUploadCompanyGroupScope && (
              <div className="mb-2">
                <p className="text-sm font-medium mb-2">Document scope</p>
                <div className="flex gap-2">
                  {(["site", "company", "group"] as const).filter(scope =>
                  (scope !== "site" || isAdminOrConsultant) && (scope !== "group" || canUseGroupScope)
                  && (!urlUploadScope || scope === urlUploadScope)
                  && (!urlSiteId || scope === "site")
                  && (!urlCompanyFilterId || scope === "site")
                ).map(scope => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => { setDocScope(scope); setSelectedEntityId(""); setEntitySearch(""); }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        docScope === scope
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                      data-testid={`button-scope-${scope}`}
                    >
                      {scope === "site" ? "Site" : scope === "company" ? "Company" : "Group"}
                    </button>
                  ))}
                </div>
                {docScope !== "site" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {docScope === "company"
                      ? "This document will be shared to specific sites within the selected company. You can manage share destinations after upload."
                      : "This document will be shared to specific member companies within the selected group. You can manage share destinations after upload."}
                  </p>
                )}
              </div>
            )}
            <CardTitle>
              {docScope === "site" ? "Select Site(s)" : docScope === "company" ? "Select Company" : "Select Group Owner"}
            </CardTitle>
            <CardDescription>
              {docScope === "site"
                ? "Choose one or more sites this document will be uploaded to"
                : docScope === "company"
                ? "Choose the company this document belongs to"
                : "Choose the group owner company for this document"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company / Group scope — cascading notice */}
            {(docScope === "company" || docScope === "group") && (
              <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3.5 py-3 text-sm text-amber-800 dark:text-amber-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {docScope === "company"
                    ? "This document is added at company level. It will cascade down and be visible in every destination site you select below."
                    : "This document is added at group level. It will cascade down and be visible in every selected member company and all of their sites."}
                </span>
              </div>
            )}

            {/* Company or Group entity picker */}
            {(docScope === "company" || docScope === "group") && (
              <div className="space-y-2">
                {isFullPermissionClient ? (
                  /* Full-permission clients: entity is always their own company — show read-only */
                  <div className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" data-testid="badge-selected-entity">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium">{allCompanies?.find(c => c.id === selectedEntityId)?.name ?? "Your company"}</span>
                    <span className="ml-1 text-muted-foreground">(your company)</span>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={entitySearch}
                        onChange={(e) => setEntitySearch(e.target.value)}
                        placeholder={docScope === "company" ? "Search companies…" : "Search group owners…"}
                        className="pl-8 h-8 text-sm"
                        data-testid="input-entity-search"
                      />
                    </div>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1 rounded-md border p-1" data-testid="entity-picker-list">
                      {(allCompanies ?? [])
                        .filter(c => docScope === "group" ? c.isGroupOwner : true)
                        .filter(c => !entitySearch.trim() || c.name.toLowerCase().includes(entitySearch.toLowerCase()))
                        .map(company => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => { setSelectedEntityId(company.id); setShareDestinations([]); setDestSearch(""); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md text-sm transition-colors ${
                              selectedEntityId === company.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                            }`}
                            data-testid={`button-entity-select-${company.id}`}
                          >
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            {company.name}
                            {selectedEntityId === company.id && <Check className="h-3.5 w-3.5 ml-auto" />}
                          </button>
                        ))
                      }
                    </div>
                    {selectedEntityId && (
                      <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm w-fit" data-testid="badge-selected-entity">
                        <Building2 className="h-3 w-3 text-primary shrink-0" />
                        <span className="font-medium">{allCompanies?.find(c => c.id === selectedEntityId)?.name}</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedEntityId(""); setShareDestinations([]); }}
                          className="text-muted-foreground hover:text-foreground ml-0.5"
                          data-testid="button-clear-entity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {/* Destination picker — select specific sites (company scope) or member companies (group scope) */}
            {(docScope === "company" || docScope === "group") && selectedEntityId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {docScope === "company" ? "Share to sites (select at least one)" : "Share to member companies (select at least one)"}
                </label>
                <p className="text-xs text-muted-foreground">
                  {docScope === "company"
                    ? "The document will appear as a shared link in the selected sites."
                    : "All sites within each chosen company will automatically receive the shared link."}
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={destSearch}
                    onChange={(e) => setDestSearch(e.target.value)}
                    placeholder={docScope === "company" ? "Search sites…" : "Search companies…"}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-dest-search"
                  />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1 rounded-md border p-1" data-testid="dest-picker-list">
                  {docScope === "company" && (companySites ?? [])
                    .filter(s => !destSearch.trim() || s.name.toLowerCase().includes(destSearch.toLowerCase()))
                    .map(site => (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => setShareDestinations(prev =>
                          prev.includes(site.id) ? prev.filter(id => id !== site.id) : [...prev, site.id]
                        )}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md text-sm transition-colors ${
                          shareDestinations.includes(site.id) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                        }`}
                        data-testid={`button-dest-select-${site.id}`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {site.name}
                        {shareDestinations.includes(site.id) && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    ))
                  }
                  {docScope === "group" && (groupMemberCompanies ?? [])
                    .filter(c => !destSearch.trim() || c.name.toLowerCase().includes(destSearch.toLowerCase()))
                    .map(company => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => setShareDestinations(prev =>
                          prev.includes(company.id) ? prev.filter(id => id !== company.id) : [...prev, company.id]
                        )}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md text-sm transition-colors ${
                          shareDestinations.includes(company.id) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                        }`}
                        data-testid={`button-dest-select-${company.id}`}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {company.name}
                        {shareDestinations.includes(company.id) && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    ))
                  }
                </div>
                {shareDestinations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {shareDestinations.map(destId => {
                      const label = docScope === "company"
                        ? (companySites ?? []).find(s => s.id === destId)?.name
                        : (groupMemberCompanies ?? []).find(c => c.id === destId)?.name;
                      if (!label) return null;
                      return (
                        <div key={destId} className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs" data-testid={`badge-dest-${destId}`}>
                          {docScope === "company" ? <MapPin className="h-3 w-3 shrink-0" /> : <Building2 className="h-3 w-3 shrink-0" />}
                          <span>{label}</span>
                          <button type="button" onClick={() => setShareDestinations(prev => prev.filter(id => id !== destId))} className="text-muted-foreground hover:text-foreground ml-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {docScope === "site" && selectedSiteIds.length > 0 && (
              <div className="space-y-1.5">
                {(() => {
                  const companyName = sites?.find(s => s.id === selectedSiteIds[0])?.companyName;
                  return companyName ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-selected-company">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span>{companyName}</span>
                    </div>
                  ) : null;
                })()}
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
              </div>
            )}

            {docScope === "site" && <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={sitePickerSearch}
                onChange={(e) => setSitePickerSearch(e.target.value)}
                placeholder="Search companies or sites…"
                className="pl-8 h-8 text-sm"
                data-testid="input-site-picker-search"
              />
            </div>}

            {docScope === "site" && (
            !sites ? (
              <p className="text-sm text-muted-foreground">Loading sites…</p>
            ) : filteredSiteGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching sites found.</p>
            ) : (
              <div ref={sitePickerListRef} className="space-y-1 max-h-72 overflow-y-auto pr-1 rounded-md border p-1" data-testid="site-picker-list">
                {(() => {
                  const selectedCompanyId = selectedSiteIds.length > 0 ? sites?.find(s => s.id === selectedSiteIds[0])?.companyId : null;
                  return filteredSiteGroups.map(({ companyId, companyName, sites: groupSites }) => {
                  const isOpen = sitePickerSearch.trim() !== "" || expandedPickerCompanies.has(companyId);
                  const isLockedCompany = !!selectedCompanyId && companyId !== selectedCompanyId;
                  return (
                    <div key={companyId} className="rounded-md border">
                      <div className={`flex items-center rounded-md ${isLockedCompany ? "" : "hover:bg-muted/50"}`}>
                        <button
                          type="button"
                          onClick={() => togglePickerCompany(companyId)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-left"
                          data-testid={`button-picker-toggle-company-${companyId}`}
                        >
                          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wide ${isLockedCompany ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{companyName}</span>
                          <span className={`text-xs ${isLockedCompany ? "text-muted-foreground/40" : "text-muted-foreground"}`}>({groupSites.length})</span>
                        </button>
                        {groupSites.length > 1 && (() => {
                          const allSelected = groupSites.every(s => selectedSiteIds.includes(s.id));
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedSiteIds(prev => prev.filter(id => !groupSites.some(s => s.id === id)));
                                } else {
                                  setSelectedSiteIds(prev => {
                                    const base = isLockedCompany ? [] : prev.filter(id => !groupSites.some(s => s.id === id));
                                    const toAdd = groupSites.map(s => s.id);
                                    return [...base, ...toAdd];
                                  });
                                  form.setValue("folderId", "");
                                }
                              }}
                              className="px-3 py-2 text-xs text-primary hover:text-primary/80 shrink-0"
                              data-testid={`button-select-all-company-${companyId}`}
                            >
                              {allSelected ? "Deselect all" : "Select all"}
                            </button>
                          );
                        })()}
                      </div>
                      {isOpen && (
                        <div className="border-t">
                          {groupSites.map((site) => {
                            const isSelected = selectedSiteIds.includes(site.id);
                            const isDisabled = isLockedCompany;
                            return (
                              <button
                                key={site.id}
                                type="button"
                                onClick={() => handleSitePickerSelect(site)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left last:rounded-b-md transition-colors ${
                                  isSelected ? "bg-primary/10 text-primary" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
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
                });
              })()}
            </div>
            ))}
          </CardContent>
          <div className="px-6 pb-6 flex justify-end">
            <Button
              onClick={() => {
                if (docScope === "site") {
                  setShowSiteConfirmDialog(true);
                } else {
                  if (!selectedEntityId) return;
                  setUploadStep("upload");
                }
              }}
              disabled={docScope === "site" ? selectedSiteIds.length === 0 : (!selectedEntityId || shareDestinations.length === 0)}
              data-testid="button-continue-to-upload"
            >
              {docScope === "site"
                ? `Continue${selectedSiteIds.length > 1 ? ` (${selectedSiteIds.length} sites)` : ""}`
                : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Guidance panel — right column */}
        <div className="w-72 shrink-0 hidden lg:block sticky top-6">
          <div className="flex items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3.5 py-3 text-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
            <div className="space-y-1 text-blue-800 dark:text-blue-300">
              <p className="font-medium">How to select sites</p>
              <ul className="space-y-0.5 text-blue-700 dark:text-blue-400 list-disc list-inside">
                <li>Click a company name to expand and see its sites</li>
                <li>Select individual sites, or use <strong>Select all</strong> to pick every site under a company at once</li>
                <li>Multi-site upload is limited to one company at a time — selecting a site from a different company will clear your current selection</li>
              </ul>
              <p className="font-semibold text-blue-800 dark:text-blue-300 pt-1">The same document will be uploaded to each selected site.</p>
              <p className="font-semibold text-blue-800 dark:text-blue-300">If approval is required, the approving client user must have access to every selected site.</p>
            </div>
          </div>
        </div>
        </div>
      )}

      {uploadStep === "upload" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Details</CardTitle>
                <CardDescription>
                  {docScope === "company"
                    ? `Uploading to company: ${allCompanies?.find(c => c.id === selectedEntityId)?.name ?? "selected company"}`
                    : docScope === "group"
                    ? `Uploading to group: ${allCompanies?.find(c => c.id === selectedEntityId)?.name ?? "selected group"}`
                    : selectedSiteIds.length > 1
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

                    {(docScope === "company" || docScope === "group") && moduleTemplates && moduleTemplates.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Compliance Template (optional)</label>
                        <select
                          value={selectedTemplateId}
                          onChange={e => setSelectedTemplateId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          data-testid="select-template-id"
                        >
                          <option value="">— No template —</option>
                          {moduleTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">Linking a template allows this document to satisfy required-document compliance checks at shared destinations.</p>
                      </div>
                    )}

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

                    {docScope === "site" && (
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
                    )}

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

                    {requiresApproval && (docScope === "company" || docScope === "group") && selectedEntityId && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-1">
                          {docScope === "company" ? "Company Approver" : "Group Approver"}
                          <span className="text-destructive">*</span>
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {docScope === "company"
                            ? "Only client users belonging to the origin company can approve company-level documents."
                            : "Only client users belonging to the group owner company can approve group-level documents."}
                        </p>
                        {entityClientUsers.length > 0 ? (
                          <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                            <SelectTrigger
                              className={!selectedApproverId ? "border-destructive" : ""}
                              data-testid="select-entity-approver"
                            >
                              <SelectValue placeholder="Select an approver…" />
                            </SelectTrigger>
                            <SelectContent>
                              {entityClientUsers.map((u) => (
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
                            {docScope === "company"
                              ? "No client users found for this company. Assign users in User Management first."
                              : "No client users found for the group owner company. Assign users in User Management first."}
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
                onClick={() => navigate(buildReturnUrl(selectedModule))}
                data-testid="button-view-documents"
              >
                View Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site selection confirmation dialog */}
      <Dialog open={showSiteConfirmDialog} onOpenChange={setShowSiteConfirmDialog}>
        <DialogContent data-testid="dialog-site-confirm">
          <DialogHeader>
            <DialogTitle>Confirm your selection</DialogTitle>
            <DialogDescription>
              Please confirm the site(s) before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            {selectedSiteObjects.map(site => (
              <div key={site.id} className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{site.name}</p>
                  {site.companyName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{site.companyName}</p>
                  )}
                  {site.address && (
                    <p className="text-xs text-muted-foreground">{site.address}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSiteConfirmDialog(false)}
              data-testid="button-confirm-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowSiteConfirmDialog(false);
                setUploadStep("upload");
              }}
              data-testid="button-confirm-continue"
            >
              Confirm & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                navigate(`/create-from-template?returnTo=${encodeURIComponent(buildReturnUrl(initialModule))}&module=${initialModule}${urlSiteId ? `&siteId=${urlSiteId}` : ""}${urlUploadScope && urlUploadEntityId ? `&scope=${urlUploadScope}&entityId=${urlUploadEntityId}${initialUrlEntityName ? `&entityName=${encodeURIComponent(initialUrlEntityName)}` : ""}` : ""}${urlCompanyFilterId ? `&companyId=${urlCompanyFilterId}` : ""}${urlUploadScope === "site" ? `&scope=site` : ""}`);
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
