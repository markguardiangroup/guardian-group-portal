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
import { DocScopeContextBanner } from "@/components/doc-scope-context-banner";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  comments: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  folderId: z.string().optional(),
  requiresApproval: z.boolean().default(true),
  isMandatory: z.boolean().default(false),
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
  isMandatory: boolean;
  expiryDate?: string | null;
  renewalPeriodMonths?: number | null;
  notifyUserIds: string[];
  templateId?: string | null;
  // Admin "approval on behalf of" consultant who owns sign-off
  onBehalfOfUserId?: string;
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
  const [selectedOnBehalfId, setSelectedOnBehalfId] = useState<string>("");
  const [approvalMessage, setApprovalMessage] = useState<string>("");
  const [showInactiveApproverWarning, setShowInactiveApproverWarning] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);

  const isDeveloperOrConsultant = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  const isAdministrator = user?.role === "administrator";
  const isFullPermissionClient = user?.role === "client" && user?.clientPermissionRole === "full";
  const canUploadCompanyGroupScope = isDeveloperOrConsultant || isFullPermissionClient;
  const [uploadStep, setUploadStep] = useState<"choice" | "scope-decision" | "upload" | "complete">("choice");
  const goToUploadStep = (step: "choice" | "scope-decision" | "upload" | "complete") => {
    setUploadStep(step);
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [showSiteConfirmDialog, setShowSiteConfirmDialog] = useState(false);
  const [shareToAll, setShareToAll] = useState(false);
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

  const { data: allCompaniesData } = useQuery<{ companies: { id: string; name: string; isGroupOwner?: boolean; groupOwnerId?: string | null }[] }>({
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
  const canUseGroupScope = isDeveloperOrConsultant || (isFullPermissionClient && !!userCompany?.isGroupOwner);

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
    } else if (docScope === "company" || docScope === "group") {
      goToUploadStep("scope-decision");
    } else {
      goToUploadStep("upload");
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
      isMandatory: false,
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
    if (user && !isDeveloperOrConsultant && !isFullPermissionClient) {
      navigate("/");
    }
  }, [user, isDeveloperOrConsultant, isFullPermissionClient]);

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
    isGroupOwnerCompany?: boolean;
  }

  const { data: allUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: isDeveloperOrConsultant,
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

  // Client approver options — users with access to ALL selected sites, plus any group-owner
  // company clients whose company is the GO of the sites' company
  const siteClientUsers = useMemo(() => {
    if (!allUsers || selectedSiteIds.length === 0) return [];
    // Collect group-owner IDs for the companies of the selected sites
    const goIds = new Set<string>();
    for (const site of selectedSiteObjects) {
      if (!site.companyId) continue;
      const co = allCompanies.find(c => c.id === site.companyId);
      if (co?.groupOwnerId) goIds.add(co.groupOwnerId);
    }
    return allUsers.filter(u =>
      u.role === "client" && (
        selectedSiteIds.every(siteId => u.siteAssignments?.some(a => a.siteId === siteId)) ||
        (goIds.size > 0 && u.companyId != null && goIds.has(u.companyId))
      )
    );
  }, [allUsers, selectedSiteIds, selectedSiteObjects, allCompanies]);

  // "Approval on behalf of" options — only consultants actually eligible to own sign-off
  // for the chosen target (assigned to the site, or pro-by-source for the company/group).
  // The same eligibility is enforced server-side; the dropdown must never list every consultant.
  const onBehalfScopeKey = useMemo(() => {
    if (docScope === "site") {
      return { mode: "site" as const, siteIds: [...selectedSiteIds].sort() };
    }
    return { mode: "entity" as const, scope: docScope, entityId: selectedEntityId };
  }, [docScope, selectedSiteIds, selectedEntityId]);

  const onBehalfQueryEnabled =
    isAdministrator &&
    requiresApproval &&
    (onBehalfScopeKey.mode === "site"
      ? onBehalfScopeKey.siteIds.length > 0
      : !!onBehalfScopeKey.entityId);

  const { data: onBehalfConsultants = [] } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/eligible-sign-off-consultants", onBehalfScopeKey],
    enabled: onBehalfQueryEnabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (onBehalfScopeKey.mode === "site") {
        params.set("siteIds", onBehalfScopeKey.siteIds.join(","));
      } else {
        params.set("scope", onBehalfScopeKey.scope);
        if (onBehalfScopeKey.entityId) params.set("entityId", onBehalfScopeKey.entityId);
      }
      const res = await fetch(`/api/eligible-sign-off-consultants?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  // Client approver options for company/group scope — includes the entity's own clients
  // plus any group-owner company clients (GO users can approve on behalf of member companies)
  const entityClientUsers = useMemo(() => {
    if (!allUsers || !selectedEntityId) return [];
    const targetCompany = allCompanies.find(c => c.id === selectedEntityId);
    const groupOwnerId = targetCompany?.groupOwnerId ?? null;
    return allUsers.filter(u =>
      u.role === "client" && (
        u.companyId === selectedEntityId ||
        (groupOwnerId && u.companyId === groupOwnerId)
      )
    );
  }, [allUsers, allCompanies, docScope, selectedEntityId]);

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
        // Guard: if sharing to all, ensure destination data has loaded before resolving
        if (shareToAll) {
          const destinationData = docScope === "company" ? companySites : groupMemberCompanies;
          if (!destinationData) throw new Error("Destination data is still loading — please try again in a moment");
        }
        const resolvedShareDestinations = shareToAll
          ? docScope === "company"
            ? (companySites ?? []).map(s => s.id)
            : (groupMemberCompanies ?? []).map(c => c.id)
          : shareDestinations;
        const formData: DocumentUploadPayload = {
          title: data.title,
          comments: data.comments,
          module: data.module,
          scope: docScope,
          entityId: selectedEntityId,
          shareDestinations: resolvedShareDestinations,
          folderId: data.folderId || undefined,
          requiresApproval: data.requiresApproval,
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
          onBehalfOfUserId: isAdministrator && data.requiresApproval && selectedOnBehalfId ? selectedOnBehalfId : undefined,
          approvalMessage: data.requiresApproval && selectedApproverId && approvalMessage.trim() ? approvalMessage.trim() : undefined,
          templateId: selectedTemplateId || undefined,
        };
        const result = await (await apiRequest("POST", "/api/documents", formData)).json();
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
          isMandatory: data.isMandatory,
          expiryDate: data.complianceMode === "expiry" && data.expiryDate ? data.expiryDate : undefined,
          renewalPeriodMonths: data.complianceMode === "renewal" ? data.renewalPeriodMonths : undefined,
          type: "supporting_document",
          fileName: selectedFile.name,
          fileUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/pdf",
          approvalRequestedFrom: data.requiresApproval && selectedApproverId ? selectedApproverId : undefined,
          notifyUserIds: data.requiresApproval && selectedApproverId && isFirstSite ? [selectedApproverId] : [],
          onBehalfOfUserId: isAdministrator && data.requiresApproval && selectedOnBehalfId ? selectedOnBehalfId : undefined,
          approvalMessage: data.requiresApproval && selectedApproverId && approvalMessage.trim() ? approvalMessage.trim() : undefined,
        };
        const result = await (await apiRequest("POST", "/api/documents", formData)).json();
        results.push(result);
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      setUploadedDocId(data[0]?.id ?? null);
      goToUploadStep("complete");
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
      if (!data.folderId) {
        toast({
          title: "No Folder Selected",
          description: "Please select a folder to organise this document.",
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
    if (isAdministrator && data.requiresApproval && !selectedOnBehalfId) {
      toast({
        title: "Approval On Behalf Of Required",
        description: "As an Admin, select the consultant who will own sign-off for this document.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const steps = [
    { key: "scope-decision", label: docScope === "company" ? "Select Scope" : "Select Scope" },
    { key: "upload", label: "Upload & Details" },
  ] as const;

  // Whether there is enough URL context to proceed with an upload.
  // Admins/consultants can also upload from a company filter (companyId param = site scope restricted to one company).
  const hasUrlContext = !!(urlUploadScope && urlUploadEntityId) || !!urlSiteId;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-back"
          onClick={() => {
            if (!hasUrlContext || uploadStep === "choice") navigate(buildReturnUrl(selectedModule));
            else if (uploadStep === "scope-decision") goToUploadStep("choice");
            else if (uploadStep === "upload" && (docScope === "company" || docScope === "group")) goToUploadStep("scope-decision");
            else if (uploadStep === "upload") goToUploadStep("choice");
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

      {(uploadStep === "scope-decision" || uploadStep === "upload") && (docScope === "company" || docScope === "group") && (
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const isActive = uploadStep === step.key;
            const isComplete = steps.findIndex(s => s.key === uploadStep) > idx;
            return (
              <div key={step.key} className="flex items-center gap-2">
                {idx > 0 && <div className={`h-px w-8 ${isComplete || isActive ? "bg-primary" : "bg-border"}`} />}
                <button
                  onClick={() => { if (isComplete) goToUploadStep(step.key); }}
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

      {!hasUrlContext && (
        <div className="max-w-lg">
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">No upload context</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                To upload a document, navigate to a specific site, company, or group from the documents page and use the Upload button there.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate(buildReturnUrl(selectedModule))}
                data-testid="button-no-context-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Documents
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasUrlContext && uploadStep === "choice" && (
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          {isDeveloperOrConsultant && (
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

      {hasUrlContext && uploadStep === "scope-decision" && (
        <div className="max-w-2xl space-y-5">
          <div className="flex items-start gap-2.5 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-3.5 py-3 text-sm">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
            <div className="text-blue-800 dark:text-blue-300">
              <p>Uploading to <strong>{docScope === "company" ? "company" : "group"}</strong>: {initialUrlEntityName || allCompanies.find(c => c.id === selectedEntityId)?.name || "—"}</p>
              <p className="mt-0.5">How should this document be shared?</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className="cursor-pointer border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => { setShareToAll(false); setShareDestinations([]); goToUploadStep("upload"); }}
              data-testid="button-scope-this-level-only"
            >
              <CardContent className="py-6 flex flex-col gap-4">
                <div className="p-3 bg-muted rounded-lg w-fit">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-base">This {docScope === "company" ? "company" : "group"} only</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Document is visible at the {docScope === "company" ? "company" : "group"} level only — not pushed down to individual sites.
                  </p>
                </div>
                <Button variant="outline" className="w-full pointer-events-none" tabIndex={-1}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => { setShareToAll(true); goToUploadStep("upload"); }}
              data-testid="button-scope-share-all"
            >
              <CardContent className="py-6 flex flex-col gap-4">
                <div className="p-3 bg-primary/10 rounded-lg w-fit">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base">
                    Share to all {docScope === "company" ? "sites" : "member companies"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically shared to{" "}
                    {docScope === "company"
                      ? companySites
                        ? `all ${companySites.length} site${companySites.length === 1 ? "" : "s"}`
                        : "all sites"
                      : groupMemberCompanies
                        ? `all ${groupMemberCompanies.length} member ${groupMemberCompanies.length === 1 ? "company" : "companies"}`
                        : "all member companies"}.
                  </p>
                  <div className="flex items-start gap-2 mt-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      This cannot be selectively applied — the document will be shared to <strong>all current and future</strong>{docScope === "company" ? " sites within this company" : " companies (and all their sites) within this group"} automatically.
                    </span>
                  </div>
                </div>
                <Button className="w-full pointer-events-none" tabIndex={-1}>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {hasUrlContext && uploadStep === "upload" && (
        <div className="space-y-4">
          <DocScopeContextBanner
            docScope={docScope}
            entityName={allCompanies?.find(c => c.id === selectedEntityId)?.name}
            siteObjects={selectedSiteObjects}
            companySites={companySites ?? []}
            groupMemberCompanies={groupMemberCompanies ?? []}
            groupMemberSites={(sites ?? []).filter(s => groupMemberCompanies?.some(c => c.id === s.companyId))}
          />
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

                    {isDeveloperOrConsultant && (
                      <FormField
                        control={form.control}
                        name="comments"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Internal Comments</FormLabel>
                            <p className="text-[11px] italic text-muted-foreground/70">Not visible to the client</p>
                            <FormControl>
                              <Textarea
                                placeholder="Add internal comments (staff only)..."
                                {...field}
                                data-testid="textarea-comments"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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

                    {isDeveloperOrConsultant && (selectedSitesWithNoClients.length > 0 || selectedSitesWithNoConsultants.length > 0) && (
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
                          <FormLabel>
                            Folder <span className="text-destructive">*</span>
                          </FormLabel>
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
                          <Select
                            value={selectedApproverId}
                            onValueChange={(id) => {
                              setSelectedApproverId(id);
                              const picked = siteClientUsers.find(u => u.id === id);
                              if (picked && picked.status !== "active") setShowInactiveApproverWarning(true);
                            }}
                          >
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
                                  data-testid={`option-approver-${u.id}`}
                                >
                                  <span className="flex items-center gap-2">
                                    {u.fullName}
                                    {u.status !== "active" && (
                                      <span className="text-xs text-amber-600 font-medium">(inactive)</span>
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
                        <div className="space-y-1 pt-2">
                          <label className="text-sm font-medium text-muted-foreground">Message to approver <span className="font-normal">(optional)</span></label>
                          <Textarea
                            placeholder="Add a message or instructions for the approver…"
                            rows={2}
                            value={approvalMessage}
                            onChange={(e) => setApprovalMessage(e.target.value)}
                            data-testid="textarea-approval-message"
                          />
                          <p className="text-xs text-muted-foreground">This message will be included in the approval request email if one is sent.</p>
                        </div>
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
                            ? "Client users from the company or its group owner can approve company-level documents."
                            : "Client users from the group owner company can approve group-level documents."}
                        </p>
                        {entityClientUsers.length > 0 ? (
                          <Select
                            value={selectedApproverId}
                            onValueChange={(id) => {
                              setSelectedApproverId(id);
                              const picked = entityClientUsers.find(u => u.id === id);
                              if (picked && picked.status !== "active") setShowInactiveApproverWarning(true);
                            }}
                          >
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
                                  data-testid={`option-approver-${u.id}`}
                                >
                                  <span className="flex items-center gap-2">
                                    {u.fullName}
                                    {u.status !== "active" && (
                                      <span className="text-xs text-amber-600 font-medium">(inactive)</span>
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
                        <div className="space-y-1 pt-2">
                          <label className="text-sm font-medium text-muted-foreground">Message to approver <span className="font-normal">(optional)</span></label>
                          <Textarea
                            placeholder="Add a message or instructions for the approver…"
                            rows={2}
                            value={approvalMessage}
                            onChange={(e) => setApprovalMessage(e.target.value)}
                            data-testid="textarea-approval-message-entity"
                          />
                          <p className="text-xs text-muted-foreground">This message will be included in the approval request email if one is sent.</p>
                        </div>
                      </div>
                    )}

                    {isAdministrator && requiresApproval && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-1">
                          Approval On Behalf Of
                          <span className="text-destructive">*</span>
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          As an Admin you cannot personally sign off. Select the consultant who will own sign-off for this document.
                        </p>
                        {onBehalfConsultants.length > 0 ? (
                          <Select value={selectedOnBehalfId} onValueChange={setSelectedOnBehalfId}>
                            <SelectTrigger
                              className={!selectedOnBehalfId ? "border-destructive" : ""}
                              data-testid="select-on-behalf-consultant"
                            >
                              <SelectValue placeholder="Select a consultant…" />
                            </SelectTrigger>
                            <SelectContent>
                              {onBehalfConsultants.map((u) => (
                                <SelectItem
                                  key={u.id}
                                  value={u.id}
                                  disabled={u.status !== "active"}
                                  data-testid={`option-on-behalf-${u.id}`}
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
                            No consultants are available to own sign-off. Create a consultant in User Management first.
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
                        name="isMandatory"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <FormLabel className="text-sm font-medium text-foreground">
                                  Mandatory for Compliance
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
                        onClick={() => (docScope === "company" || docScope === "group") ? goToUploadStep("scope-decision") : goToUploadStep("choice")}
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
            {(docScope === "company" || docScope === "group") && shareToAll && (
              <Card className="mb-6 border-primary/30 bg-primary/5" data-testid="panel-share-destinations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {docScope === "company" ? "Sites that will receive this document" : "Companies that will receive this document"}
                  </CardTitle>
                  <CardDescription>
                    {docScope === "company"
                      ? "This document will be shared to all current sites in this company."
                      : "This document will be shared to all current member companies in this group."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {docScope === "company" ? (
                    companySites === undefined ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading sites…
                      </div>
                    ) : companySites.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No sites found for this company.</p>
                    ) : (
                      <ul className="space-y-1.5" data-testid="list-share-destinations">
                        {companySites.map(site => (
                          <li key={site.id} className="flex items-center gap-2 text-sm" data-testid={`dest-site-${site.id}`}>
                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium">{site.name}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : (
                    groupMemberCompanies === undefined ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Loading member companies…
                      </div>
                    ) : groupMemberCompanies.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No member companies found for this group.</p>
                    ) : (
                      <ul className="space-y-1.5" data-testid="list-share-destinations">
                        {groupMemberCompanies.map(company => (
                          <li key={company.id} className="flex items-center gap-2 text-sm" data-testid={`dest-company-${company.id}`}>
                            <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium">{company.name}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </CardContent>
              </Card>
            )}

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
                  <span>Set renewal dates for compliance tracking</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>All uploads are logged for audit purposes</span>
                </div>
              </CardContent>
            </Card>
          </div>
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
            <div className="flex gap-4 flex-wrap justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  goToUploadStep("choice");
                  setSelectedSiteIds([]);
                  setSelectedFile(null);
                  setSelectedApproverId("");
                  setUploadedDocId(null);
                  form.reset();
                }}
                data-testid="button-upload-another"
              >
                Upload Another
              </Button>
              {uploadedDocId && selectedSiteIds.length <= 1 && (() => {
                const slugs: Record<string, string> = { health_safety: "health-safety", human_resources: "human-resources", employment_law: "employment-law" };
                const slug = slugs[selectedModule];
                const docUrl = slug ? `/${slug}/documents/${uploadedDocId}` : `/documents/${uploadedDocId}`;
                return (
                  <Button
                    variant="outline"
                    onClick={() => navigate(docUrl)}
                    data-testid="button-view-document"
                  >
                    View Document
                  </Button>
                );
              })()}
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
                if (docScope === "company" || docScope === "group") {
                  goToUploadStep("scope-decision");
                } else {
                  goToUploadStep("upload");
                }
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

      <AlertDialog open={showInactiveApproverWarning} onOpenChange={setShowInactiveApproverWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              User is inactive
            </AlertDialogTitle>
            <AlertDialogDescription>
              This user is currently inactive and will <strong>not receive any email notifications</strong> until their account becomes active. The document will still be assigned to them for approval — they will see it as an action to complete when they first log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction data-testid="button-inactive-approver-ok">
              OK, understood
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
