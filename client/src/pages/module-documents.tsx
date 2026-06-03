import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { useLocation, Link, useRoute, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceBadge, DocumentStatusBadge } from "@/components/rag-badge";
import { PdfViewer } from "@/components/pdf-viewer";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Search,
  Filter,
  Upload,
  MoreVertical,
  Eye,
  Download,
  Archive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowLeft,
  History,
  HardHat,
  Users,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  LayoutList,
  FolderOpen,
  Files,
  FileCheck,
  FileClock,
  FileWarning,
  ChevronRight,
  Scale,
  Mail,
  Send,
  RefreshCw,
  UserCheck,
  Trash2,
  ShieldCheck,
  Calendar,
  Save,
  GripVertical,
  X,
  LayoutDashboard,
  Building2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format, formatDistanceToNow } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Document, DocumentWithDetails, DocumentVersion, AuditLog, ModuleType, DocumentTypeRecord, DocumentStatus, ApprovalStatus, DocumentFolder } from "@shared/schema";
import { moduleConfig } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// Enriched document with server-computed shared-link metadata
type EnrichedDocument = Document & {
  isSharedLink?: boolean;
  sharedScope?: "company" | "group";
  sharedFromEntityName?: string | null;
};

const downloadDocument = async (documentId: string, fileName: string, version?: number) => {
  try {
    const url = version 
      ? `/api/documents/${documentId}/download?version=${version}`
      : `/api/documents/${documentId}/download`;
    
    const response = await fetch(url, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Download failed');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

interface ModuleDocumentsProps {
  module: ModuleType;
}

interface SiteBasic {
  id: string;
  name: string;
}

interface SiteModuleAccess {
  health_safety: "active" | "visible" | "hidden";
  human_resources: "active" | "visible" | "hidden";
  employment_law: "active" | "visible" | "hidden";
  training: "active" | "visible" | "hidden";
  support: "active" | "visible" | "hidden";
}

interface SiteWithCompany extends SiteBasic {
  companyId?: string;
  companyName?: string | null;
  moduleAccess?: SiteModuleAccess;
}

interface CompanyListItem {
  id: string;
  name: string;
  groupOwnerId?: string | null;
}

type ViewMode = "folder" | "table";

// Module-specific color theming (matching template library)
const moduleColors: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
  training: "text-purple-600 dark:text-purple-400",
  support: "text-purple-600 dark:text-purple-400",
};

const moduleBgColors: Record<string, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
  training: "bg-purple-100 dark:bg-purple-900/30",
  support: "bg-purple-100 dark:bg-purple-900/30",
};

const moduleBorderColors: Record<string, string> = {
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
  training: "border-purple-200 dark:border-purple-800",
  support: "border-purple-200 dark:border-purple-800",
};

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName?: string | null): string {
  if (!fileName) return "";
  const ext = fileName.split(".").pop();
  return ext ? ext.toUpperCase() : "";
}

// Hierarchy types for folder view
interface HierarchyDocument {
  id: string;
  title: string;
  fileName: string;
  type: string;
  status: DocumentStatus;
  version: number;
  fileSize?: number | null;
  siteId?: string | null;
  approvalStatus: ApprovalStatus;
  updatedAt: string;
  documentTypeId?: string | null;
  isMandatory: boolean;
  isArchived?: boolean;
  renewalPeriodMonths?: number | null;
  lastApprovedAt?: string | null;
  renewalDate?: string | null;
  isSharedLink?: boolean;
  sharedScope?: "company" | "group";
  sharedFromEntityName?: string | null;
  folderId?: string | null;
  folderTemplateId?: string | null;
}

interface HierarchyFolder {
  id: string;
  name: string;
  code: string;
  isMandatory: boolean;
  sortOrder: number;
  documents: HierarchyDocument[];
  stats: {
    totalDocuments: number;
    compliant: number;
    approvalRequired: number;
    overdue: number;
  };
}

interface DocumentHierarchy {
  folders: HierarchyFolder[];
  unfiledDocuments: HierarchyDocument[];
  sharedDocuments?: (HierarchyDocument & { sharedScope?: "company" | "group"; sharedFromEntityName?: string | null })[];
  summary: {
    totalDocuments: number;
    approved: number;
    approvalRequired: number;
    overdue: number;
    totalFolders: number;
    requiredFolders: number;
  };
}

function DroppableFolderZone({ folderId, isDragEnabled, children, className }: {
  folderId: string;
  isDragEnabled: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: folderId, disabled: !isDragEnabled });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isDragEnabled && isOver && "ring-2 ring-blue-400 rounded-lg bg-blue-50/20 dark:bg-blue-900/10 transition-colors"
      )}
    >
      {children}
    </div>
  );
}

function DraggableDocRow({ id, title, sourceFolderId, isDragEnabled, children }: {
  id: string;
  title: string;
  sourceFolderId: string | null;
  isDragEnabled: boolean;
  children: React.ReactNode;
}) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { sourceFolderId, title },
    disabled: !isDragEnabled,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDragEnabled ? listeners : {})}
      className={isDragging ? "opacity-40 relative z-50" : undefined}
    >
      {children}
    </div>
  );
}

function ModuleDocumentsListView({ module }: { module: ModuleType }) {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const urlSiteId = urlParams.get("siteId");
  const urlCompany = urlParams.get("company");
  const urlRenewal = urlParams.get("renewal");
  const urlScope = urlParams.get("scope");
  const urlEntityId = urlParams.get("entityId");
  const urlEntityName = urlParams.get("entityName");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [renewalFilter, setRenewalFilter] = useState<string>(urlRenewal || "all");
  const { selectedCompany, selectedSiteId, selectedGroup, setSelectedSiteId, setSelectedCompany, handleCompanyChange, resetFilters } = useSiteFilter();
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, coverageSitesUrl, coverageQueryKey, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();
  useEffect(() => {
    if (urlCompany) handleCompanyChange(urlCompany);
    if (urlSiteId) setSelectedSiteId(urlSiteId);
  }, [urlSiteId, urlCompany]);
  useEffect(() => {
    if (urlScope && urlEntityId) {
      setSelectedSiteId("all");
      // Sync the company filter so the doc list and missing-required slots are scoped
      // to this company's sites. For group scope we leave company as "all" (group docs
      // span multiple companies) but still pin the header via entityName below.
      if (urlScope === "company" && urlEntityName) {
        handleCompanyChange(urlEntityName);
      }
    }
  }, [urlScope, urlEntityId, urlEntityName]);

  // Fetch scoped (company/group) folders for this module
  const { data: scopedFolders = [] } = useQuery<any[]>({
    queryKey: ["/api/folders", "scoped", urlScope, urlEntityId, module],
    queryFn: async () => {
      if (!urlScope || !urlEntityId) return [];
      const res = await fetch(`/api/folders?scope=${urlScope}&entityId=${urlEntityId}&module=${module}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!urlScope && !!urlEntityId,
  });

  // Auto-provision scoped folders once per (scope, entity, module)
  const provisionedScopeKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!urlScope || !urlEntityId) return;
    if (urlScope !== "company" && urlScope !== "group") return;
    const key = `${urlScope}:${urlEntityId}:${module}`;
    if (provisionedScopeKeys.current.has(key)) return;
    // Only auto-provision when no scoped folders exist yet
    if (scopedFolders.length > 0) {
      provisionedScopeKeys.current.add(key);
      return;
    }
    provisionedScopeKeys.current.add(key);
    fetch("/api/folders/provision", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: urlScope, entityId: urlEntityId, module }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", "scoped", urlScope, urlEntityId, module] });
    }).catch(() => {});
  }, [urlScope, urlEntityId, module, scopedFolders.length]);
  const [explicitViewMode, setExplicitViewMode] = useState<ViewMode | null>(null);
  const [archivedDialogOpen, setArchivedDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{id: string, title: string} | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "human_resources" ? "/human-resources" : module === "employment_law" ? "/employment-law" : "/training";
  const ModuleIcon = module === "health_safety" ? HardHat : module === "training" ? FileText : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : module === "human_resources" ? "theme-hr" : module === "employment_law" ? "theme-el" : "theme-training";
  
  // Consultants and admins can view different sites
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isAdmin = user?.role === "admin";
  
  // Restore document mutation
  const restoreMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("POST", `/api/documents/${documentId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      toast({
        title: "Document restored",
        description: "The document has been restored from the archive.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore document.",
        variant: "destructive",
      });
    },
  });
  
  // Delete document mutation (for archived dialog — admin only)
  const deleteFromListMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      toast({ title: "Document deleted", description: "The document has been permanently deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
    },
  });

  // Archive document mutation (for list view)
  const archiveMutationList = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("POST", `/api/documents/${documentId}/archive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      toast({
        title: "Document archived",
        description: "The document has been archived.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to archive document.",
        variant: "destructive",
      });
    },
  });
  
  // Fetch sites for all users — when covering for someone, fetch only that person's sites
  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: coverageQueryKey,
    queryFn: coverageSitesUrl !== "/api/sites" ? async () => {
      const res = await fetch(coverageSitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sites");
      return res.json();
    } : undefined,
  });

  // Fetch companies for group scope filtering (when a group is selected or navigated via URL group scope)
  const { data: companiesResp } = useQuery<{ companies: CompanyListItem[] }>({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const res = await fetch(`/api/companies?limit=1000`, { credentials: "include" });
      return res.json();
    },
    enabled: selectedGroup !== "all" || (urlScope === "group" && !!urlEntityId),
  });
  const companies = companiesResp?.companies ?? [];

  // Set of company IDs that belong to the selected group (owner + members).
  // Works both for sidebar group-picker selection and URL-param group navigation.
  const groupCompanyIds = useMemo(() => {
    const groupId = selectedGroup !== "all" ? selectedGroup : (urlScope === "group" ? urlEntityId : null);
    if (!groupId || !companies.length) return null;
    const ids = companies
      .filter(c => c.id === groupId || c.groupOwnerId === groupId)
      .map(c => c.id);
    return ids.length > 0 ? new Set(ids) : null;
  }, [selectedGroup, companies, urlScope, urlEntityId]);

  // Filter to sites where this module is enabled (active or visible).
  // Sites with no moduleAccess record at all, or where the module is "hidden",
  // are excluded — their documents stay in place but don't appear in this view.
  const clientSites = useMemo(() => {
    if (!sites) return [];
    const moduleKey = module as keyof SiteModuleAccess;
    return sites.filter(s => {
      const access = s.moduleAccess?.[moduleKey];
      return access === "active" || access === "visible";
    });
  }, [sites, module]);
  
  // Filter sites by selected group, then by selected company (for privileged users)
  const filteredSites = useMemo(() => {
    if (!clientSites) return [];
    let result = clientSites;
    if (groupCompanyIds) {
      result = result.filter(s => groupCompanyIds.has(s.companyId ?? ""));
    }
    if (!selectedCompany || selectedCompany === "all") return result;
    return result.filter(s => s.companyName === selectedCompany);
  }, [clientSites, selectedCompany, groupCompanyIds]);

  // Derive the effective view mode: use the user's explicit choice if set, otherwise "folder".
  const viewMode: ViewMode | null = useMemo(() => {
    if (sites === undefined) return null;
    // When viewing a specific group/company scope, the folder hierarchy
    // (which is per-site) doesn't apply — show the flat table instead.
    if (urlScope && urlEntityId) return explicitViewMode ?? "folder";
    return explicitViewMode ?? "folder";
  }, [sites, explicitViewMode, urlScope, urlEntityId, selectedSiteId]);

  const setViewMode = (mode: ViewMode) => setExplicitViewMode(mode);

  // When selecting a site also sync the company dropdown
  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && siteId !== "all" && sites) {
      const site = sites.find(s => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites, setSelectedSiteId, setSelectedCompany]);

  // Get companyId from selected company name (for filtering when viewing all sites)
  const selectedCompanyId = useMemo(() => {
    if (!selectedCompany || selectedCompany === "all" || !sites) return null;
    const siteInCompany = sites.find(s => s.companyName === selectedCompany);
    return siteInCompany?.companyId || null;
  }, [selectedCompany, sites]);

  const getMissingSlotUrl = useCallback((slot: { templateId: string; siteId?: string | null; siteName?: string | null }) => {
    const params = new URLSearchParams();
    params.set("templateId", slot.templateId);
    params.set("module", module);
    const effectiveSiteId = slot.siteId || (selectedSiteId && selectedSiteId !== "all" ? selectedSiteId : "");
    if (effectiveSiteId) {
      params.set("scope", "site");
      params.set("entityId", effectiveSiteId);
      params.set("siteId", effectiveSiteId);
      if (slot.siteName) params.set("entityName", slot.siteName);
    } else if (urlScope && urlEntityId) {
      params.set("scope", urlScope);
      params.set("entityId", urlEntityId);
      if (urlEntityName) params.set("entityName", urlEntityName);
    }
    params.set("returnTo", window.location.pathname + window.location.search);
    return `/create-from-template?${params.toString()}`;
  }, [module, selectedSiteId, urlScope, urlEntityId, urlEntityName]);

  const getUploadUrl = useCallback((folderId?: string) => {
    const params = new URLSearchParams();
    if (urlScope && urlEntityId) {
      params.set("scope", urlScope);
      params.set("entityId", urlEntityId);
      if (urlEntityName) params.set("entityName", urlEntityName);
    } else if (selectedSiteId && selectedSiteId !== "all") {
      params.set("siteId", selectedSiteId);
    } else if (selectedCompanyId) {
      // "All Sites" view of a single company — use canonical company scope so the
      // upload wizard can resolve hasUrlContext correctly.
      params.set("scope", "company");
      params.set("entityId", selectedCompanyId);
      const companyName = companies.find(c => c.id === selectedCompanyId)?.name;
      if (companyName) params.set("entityName", companyName);
    } else {
      // "All Companies / All Sites" view — lock scope to site (no company/group context here).
      params.set("scope", "site");
    }
    if (folderId) {
      params.set("folderId", folderId);
    }
    const qs = params.toString();
    return `${basePath}/documents/upload${qs ? `?${qs}` : ""}`;
  }, [basePath, selectedSiteId, selectedCompanyId, companies, urlScope, urlEntityId, urlEntityName]);

  const groupOwnerName = useMemo(() => {
    if (selectedGroup === "all" || !companies.length) return null;
    return companies.find(c => c.id === selectedGroup)?.name ?? null;
  }, [selectedGroup, companies]);

  const contextCompany = useMemo(() => {
    if (urlScope === "group" && urlEntityName) return `${urlEntityName} (Group)`;
    if (urlScope === "company" && urlEntityName) return urlEntityName;
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyName || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompany;
    if (groupOwnerName) return `${groupOwnerName} (Group)`;
    return null;
  }, [selectedSiteId, selectedCompany, sites, urlScope, urlEntityName, groupOwnerName]);

  const contextSite = useMemo(() => {
    if (urlScope === "group") return "Group Documents";
    if (urlScope === "company") return "Company Documents";
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") return "All Sites";
    if (groupOwnerName) return "All Sites";
    return "All Sites";
  }, [selectedSiteId, selectedCompany, sites, urlScope, groupOwnerName]);

  const { data: documents, isLoading } = useQuery<EnrichedDocument[]>({
    queryKey: ["/api/documents/module", module],
    refetchOnMount: "always",
  });

  interface MissingRequiredTemplate {
    templateId: string;
    templateName: string;
    module: string;
    requiresApproval: boolean;
    siteId: string;
    siteName: string;
    companyId: string;
    companyName: string;
    groupOwnerId?: string | null;
    kind: string;
  }

  const { data: allMissingTemplates } = useQuery<MissingRequiredTemplate[]>({
    queryKey: ["/api/missing-required-templates"],
  });

  // Company-scope uses a dedicated endpoint that evaluates requirements at the
  // company level (no per-site exclusions), so all required templates are visible.
  const { data: companyScopeMissingTemplates } = useQuery<MissingRequiredTemplate[]>({
    queryKey: ["/api/missing-required-templates", "company", urlEntityId],
    queryFn: async () => {
      const res = await fetch(`/api/missing-required-templates?companyId=${urlEntityId}&module=${module}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch company missing templates");
      return res.json();
    },
    enabled: urlScope === "company" && !!urlEntityId,
  });

  // Required-but-missing slots for the current module + selected scope.
  //
  // Requirements cascade DOWNWARDS (Group → member Companies → Sites), so:
  // - Group scope: show missing slots for the group owner's own sites AND for
  //   all member-company sites whose groupOwnerId matches the group entity.
  // - Company scope: uses a company-level query (no per-site exclusions) so
  //   all required templates appear even if excluded at some sites.
  // - Site scope: filtered by siteId below.
  const missingSlots = useMemo(() => {
    if (urlScope === "company" && urlEntityId) {
      if (!companyScopeMissingTemplates) return [];
      return companyScopeMissingTemplates.filter(m => m.module === module);
    }
    if (!allMissingTemplates) return [];
    const filteredSiteIds = filteredSites.length > 0 ? new Set(filteredSites.map(s => s.id)) : null;
    return allMissingTemplates.filter(m => {
      if (m.module !== module) return false;
      if (urlScope === "group" && urlEntityId) {
        // Include slots from the group's own sites and all member companies' sites.
        if (m.companyId !== urlEntityId && m.groupOwnerId !== urlEntityId) return false;
      }
      if (selectedSiteId && selectedSiteId !== "all") return m.siteId === selectedSiteId;
      // No specific site selected — restrict to the currently visible (company-filtered) sites.
      if (!urlScope && filteredSiteIds) return filteredSiteIds.has(m.siteId);
      return true;
    });
  }, [allMissingTemplates, companyScopeMissingTemplates, module, selectedSiteId, urlScope, urlEntityId, filteredSites]);

  // For the flat table view, deduplicate by (templateId, siteId) so each missing
  // (template, site) pair gets its own row. In scoped (group/company) views where
  // siteId is "" for all slots, fall back to deduping by templateId alone to avoid
  // showing the same template once per site in the group.
  const tableMissingSlots = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof missingSlots = [];
    for (const slot of missingSlots) {
      const key = slot.siteId ? `${slot.templateId}||${slot.siteId}` : slot.templateId;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(slot);
    }
    return out;
  }, [missingSlots]);

  // Archived documents — fetched fresh only when the dialog opens
  const { data: archivedDocuments, isLoading: isLoadingArchived } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module, "archived"],
    queryFn: async () => {
      const res = await fetch(`/api/documents/module/${module}?includeArchived=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch archived documents");
      const all = await res.json();
      return all.filter((d: Document) => d.isArchived);
    },
    enabled: archivedDialogOpen,
    staleTime: 0,
  });

  const { data: allDocumentTypes } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });

  // Fetch folder templates for the current module
  interface FolderTemplate {
    id: string;
    name: string;
    code: string;
    module: string;
    parentId: string | null;
    isActive: boolean;
    isLocked: boolean;
    toolkitFolderId: string | null;
  }
  
  interface FolderDocumentTypeRule {
    id: string;
    folderTemplateId: string;
    documentTypeId: string;
  }
  
  const { data: folderTemplates } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });
  
  const { data: folderRules } = useQuery<FolderDocumentTypeRule[]>({
    queryKey: ["/api/folder-document-type-rules"],
  });

  // Fetch site folders for folder-path display in table view
  const effectiveSiteId = selectedSiteId && selectedSiteId !== "all" ? selectedSiteId : null;
  const { data: siteFoldersList } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", effectiveSiteId, module],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await fetch(`/api/folders?siteId=${effectiveSiteId}&module=${module}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!effectiveSiteId,
  });

  // Build map: folderId → "ParentName / ChildName" (or just "Name")
  const folderPathMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!siteFoldersList) return map;
    for (const folder of siteFoldersList) {
      if (folder.parentId) {
        const parent = siteFoldersList.find(f => f.id === folder.parentId);
        map.set(folder.id, parent ? `${parent.name} / ${folder.name}` : folder.name);
      } else {
        map.set(folder.id, folder.name);
      }
    }
    return map;
  }, [siteFoldersList]);

  // Get the effective site ID for hierarchy query
  // Support "all" when a company is selected or when viewing all sites
  const hierarchySiteId = selectedSiteId 
    ? selectedSiteId 
    : (selectedCompany && selectedCompany !== "all") 
      ? "all" 
      : (sites && sites.length === 1 ? sites[0].id : "all");
  
  // Whether the current view has enough context (specific site, company, or group)
  // to create a meaningful document upload. "All" views lack context.
  // A locked-company filter (selectedCompany !== "all") is valid context even when
  // siteId is "all" — the upload wizard will pre-fill the company scope.
  const hasSpecificContext = !!((urlScope && urlEntityId)
    || (selectedSiteId && selectedSiteId !== "all")
    || selectedCompanyId !== null);

  // IDs for linking company/site names to their profile pages in the header
  const contextCompanyId = useMemo(() => {
    if (urlScope === "company" || urlScope === "group") return urlEntityId;
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find(s => s.id === selectedSiteId)?.companyId || null;
    }
    if (selectedCompany && selectedCompany !== "all") return selectedCompanyId;
    return null;
  }, [urlScope, urlEntityId, selectedSiteId, selectedCompany, selectedCompanyId, sites]);

  const contextSiteId = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== "all") return selectedSiteId;
    return null;
  }, [selectedSiteId]);
  
  // Build hierarchy URL - always fetch with includeArchived=true, filter client-side
  const hierarchyUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (urlScope === "group" && urlEntityId) {
      // URL-param group navigation: restrict hierarchy to group member sites.
      params.set("groupOwnerId", urlEntityId);
    } else if (selectedGroup !== "all") {
      // Sidebar group-picker navigation: restrict hierarchy to group member sites.
      params.set("groupOwnerId", selectedGroup);
    } else if (selectedCompanyId) {
      params.set("companyId", selectedCompanyId);
    }
    params.set("includeArchived", "true");
    return `/api/sites/${hierarchySiteId}/modules/${module}/documents-hierarchy?${params.toString()}`;
  }, [hierarchySiteId, module, selectedCompanyId, urlScope, urlEntityId, selectedGroup]);

  // Fetch document hierarchy — fetch whenever hierarchySiteId is set, including
  // the "all" aggregate view which the backend handles by spanning all accessible sites.
  const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery<DocumentHierarchy>({
    queryKey: [hierarchyUrl],
    placeholderData: keepPreviousData,
    staleTime: 0,
    enabled: !!hierarchySiteId,
  });

  // Count of missing-required rows actually displayed in the UI. The two render
  // paths (scoped folder view vs. site hierarchy view) collapse/expand per-site
  // missing slots differently, so the summary stat is computed to match exactly
  // what the user sees rendered.
  const displayedMissingCount = useMemo(() => {
    // Scoped (group/company) view renders one row per unique missing templateId
    // per folder (and once in Unfiled), regardless of how many sites are missing it.
    if (urlScope && urlEntityId) {
      return tableMissingSlots.length;
    }
    // Site-hierarchy view: use missingSlots (same source as table view) for accuracy.
    return missingSlots.length;
  }, [urlScope, urlEntityId, tableMissingSlots, missingSlots]);

  // Build a map from folderTemplateId → list of missing slots for use in the
  // non-scoped hierarchy folder view. Uses the same authoritative data source
  // as the table view (missingSlots from allMissingTemplates) so both views
  // show identical counts and entries. Must be declared after `hierarchy`.
  const missingByFolderTemplateId = useMemo(() => {
    // Build the set of folder template IDs that actually exist in the hierarchy
    // so any slot whose folderTemplateId doesn't match a real hierarchy folder
    // (e.g. no site folder has been provisioned for it) falls into __unfiled__.
    const hierarchyFolderIds = new Set<string>();
    if (hierarchy?.folders) {
      for (const f of (hierarchy.folders as any[])) {
        if (f.id) hierarchyFolderIds.add(f.id);
        for (const cf of (f.childFolders ?? []) as any[]) {
          if (cf.id) hierarchyFolderIds.add(cf.id);
        }
      }
    }

    const map = new Map<string, typeof missingSlots>();
    for (const slot of missingSlots) {
      const ftId = (slot as any).folderTemplateId as string | null | undefined;
      const key = (ftId && hierarchyFolderIds.has(ftId)) ? ftId : "__unfiled__";
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [missingSlots, hierarchy]);

  // Group shared (Group/Company-scope) documents by the folder template they were filed under,
  // so each shared doc can be rendered inside the matching site folder. Any shared doc whose
  // folder template doesn't exist on this site falls through to "Unfiled".
  const { sharedByFolderTemplate, unmatchedShared } = useMemo(() => {
    const byTpl = new Map<string, HierarchyDocument[]>();
    const unmatched: HierarchyDocument[] = [];
    if (!hierarchy?.sharedDocuments) {
      return { sharedByFolderTemplate: byTpl, unmatchedShared: unmatched };
    }
    const knownTemplateIds = new Set<string>();
    const collectIds = (folders: HierarchyFolder[] | undefined) => {
      if (!folders) return;
      for (const f of folders) {
        knownTemplateIds.add(f.id);
        collectIds((f as any).childFolders);
      }
    };
    collectIds(hierarchy.folders);
    for (const doc of hierarchy.sharedDocuments) {
      const tplId = doc.folderTemplateId ?? null;
      if (tplId && knownTemplateIds.has(tplId)) {
        const arr = byTpl.get(tplId) ?? [];
        arr.push({ ...doc, isSharedLink: true });
        byTpl.set(tplId, arr);
      } else {
        unmatched.push({ ...doc, isSharedLink: true });
      }
    }
    return { sharedByFolderTemplate: byTpl, unmatchedShared: unmatched };
  }, [hierarchy]);

  // Set of shared-doc IDs that the hierarchy API confirmed are visible for the
  // currently selected site. Used to correctly include shared docs in table view.
  const sharedDocIdSet = useMemo(() => {
    const s = new Set<string>();
    if (hierarchy?.sharedDocuments) {
      for (const d of hierarchy.sharedDocuments) s.add(d.id);
    }
    return s;
  }, [hierarchy]);

  // Drag-and-drop for folder view (admin only — individual items use disabled:!isAdmin)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeDoc, setActiveDoc] = useState<{ id: string; title: string } | null>(null);

  const moveDocumentMutation = useMutation({
    mutationFn: ({ docId, folderId }: { docId: string; folderId: string | null }) =>
      apiRequest("PATCH", `/api/documents/${docId}`, { folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [hierarchyUrl] });
      toast({ title: "Document moved" });
    },
    onError: () => {
      toast({ title: "Could not move document", variant: "destructive" });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDoc({ id: active.id as string, title: (active.data.current as any)?.title ?? "" });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDoc(null);
    const { active, over } = event;
    if (!over) return;
    const docId = active.id as string;
    const targetFolderId = over.id === "__unfiled__" ? null : (over.id as string);
    const sourceFolderId: string | null = (active.data.current as any)?.sourceFolderId ?? null;
    if (targetFolderId === sourceFolderId) return;
    moveDocumentMutation.mutate({ docId, folderId: targetFolderId });
  };
  
  // Get folder status badges - returns up to two badges (Overdue + Approval Required) simultaneously
  const getFolderStatusBadge = (stats: HierarchyFolder["stats"]) => {
    const badges: { variant: "outline"; label: string; className: string }[] = [];
    if (stats.overdue > 0) badges.push({ variant: "outline", label: "Overdue", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" });
    if (stats.approvalRequired > 0) badges.push({ variant: "outline", label: "Approval Required", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" });
    return badges;
  };
  
  // Get folder templates for current module (exclude Toolkit roots and mirrored subfolders)
  const moduleFolderTemplates = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter(t => t.module === module && t.isActive && !t.isLocked && !t.toolkitFolderId);
  }, [folderTemplates, module]);
  
  // Build lookup: documentTypeId -> folder template name
  const docTypeToFolderName = useMemo(() => {
    const lookup = new Map<string, string>();
    if (!folderRules || !folderTemplates) return lookup;
    
    const templateMap = new Map(folderTemplates.map(t => [t.id, t]));
    
    for (const rule of folderRules) {
      const template = templateMap.get(rule.folderTemplateId);
      if (template && template.module === module) {
        lookup.set(rule.documentTypeId, template.name);
      }
    }
    return lookup;
  }, [folderRules, folderTemplates, module]);

  // Build a fast site lookup: siteId → { name, companyName }
  const siteMap = useMemo(() => {
    const m = new Map<string, { name: string; companyName?: string | null }>();
    if (sites) (sites as SiteWithCompany[]).forEach(s => m.set(s.id, { name: s.name, companyName: s.companyName }));
    return m;
  }, [sites]);

  // Show company column when a privileged user is viewing across all companies
  const showCompany = isPrivilegedUser && (!selectedSiteId || selectedSiteId === "all") && (!selectedCompany || selectedCompany === "all");

  // Build meta line for a document row: v1 · PDF · 2.4 MB [· Site] [· Company]
  const docMetaLine = (doc: { fileName: string; version?: number; approvedVersion?: number | null; approvalStatus?: string | null; fileSize?: number | null; siteId?: string | null }) => {
    const parts: string[] = [];
    // Show version label: v{approvedVersion} for approved docs; skip version for drafts in approval
    const isApproved = doc.approvalStatus === "approved" || !doc.approvalStatus;
    if (isApproved) {
      const vNum = doc.approvedVersion ?? 0;
      if (vNum > 0) parts.push(`v${vNum}`);
      else if (doc.version) parts.push(`v${doc.version}`); // legacy fallback for records before this feature
    }
    const ext = getFileExtension(doc.fileName);
    if (ext) parts.push(ext);
    const size = formatFileSize(doc.fileSize);
    if (size) parts.push(size);
    if (isPrivilegedUser && doc.siteId) {
      const siteInfo = siteMap.get(doc.siteId);
      if (siteInfo) {
        parts.push(siteInfo.name);
        if (showCompany && siteInfo.companyName) parts.push(siteInfo.companyName);
      }
    }
    return parts.join(" · ");
  };

  // Determine which site to show access for
  // "all" means show data across all sites
  // Client users see their company's sites (filtered in filteredDocuments below)
  const siteId = selectedSiteId === "all" ? null : (selectedSiteId || null);
    

  const filteredDocuments = documents?.filter((doc) => {
    // Scope filter — when navigating from a Group/Company card, show docs that are
    // either owned at that scope+entity, OR shared down to that entity from a higher
    // scope (e.g. a group doc shared with this company).
    if (urlScope && urlEntityId) {
      const ownedAtScope = (doc as any).scope === urlScope && (doc as any).entityId === urlEntityId;
      const sharedToCompany =
        urlScope === "company" &&
        Array.isArray((doc as any).sharedWithCompanyIds) &&
        (doc as any).sharedWithCompanyIds.includes(urlEntityId);
      if (!ownedAtScope && !sharedToCompany) {
        return false;
      }
    }
    // Sidebar group-picker filter: when a group is selected via the sidebar (not URL
    // params), restrict site-scoped docs to group member companies' sites only.
    // Only activates once groupCompanyIds is populated (after companies query loads).
    if (!urlScope && doc.siteId !== null && groupCompanyIds) {
      if (!filteredSites.some(s => s.id === doc.siteId)) return false;
    }
    // When a group is selected, also filter scoped (siteId=null) docs so the table
    // view matches the folder view:
    // - Group-scoped docs belong to the group tier, not individual sites — exclude them.
    // - Company-scoped docs from companies outside the group are irrelevant — exclude them.
    if (!urlScope && doc.siteId === null && groupCompanyIds) {
      if ((doc as any).scope === "group") return false;
      if ((doc as any).scope === "company") {
        const entityId = (doc as any).entityId as string | null | undefined;
        if (!entityId || !groupCompanyIds.has(entityId)) return false;
      }
    }
    // "All Companies - All Sites" view: gate scoped (siteId=null) docs via
    // sharedDocIdSet so the table matches the folder view exactly. The hierarchy
    // backend (computeSharedDocsForSiteH) requires an explicit share record before
    // including a scoped doc; the flat API does not — so without this filter the
    // table shows extra rows for docs that have no share records yet.
    // Only activates once the hierarchy has loaded (sharedDocIdSet.size > 0).
    if (
      !urlScope &&
      doc.siteId === null &&
      !groupCompanyIds &&
      (!selectedSiteId || selectedSiteId === "all") &&
      (!selectedCompany || selectedCompany === "all") &&
      sharedDocIdSet.size > 0
    ) {
      if (!sharedDocIdSet.has(doc.id)) return false;
    }
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.comments?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    // Filter by site - site-scoped docs must match selected site.
    // Shared-link docs (siteId=null) are included when the hierarchy confirms they
    // are visible to the selected site (via sharedDocIdSet). This ensures table view
    // matches folder view: both show the same shared/group documents.
    let matchesSite = true;
    if (urlScope && urlEntityId) {
      // Scope-view already constrains by entity; skip site/company filters
    } else if (selectedSiteId && selectedSiteId !== "all") {
      if (doc.siteId === null) {
        // Scoped (group/company) doc — include only if the hierarchy confirms it
        // is visible for the selected site. Works regardless of isSharedLink value
        // (admins are "origin" users so isSharedLink=false even for shared docs).
        matchesSite = sharedDocIdSet.has(doc.id);
      } else {
        matchesSite = doc.siteId === selectedSiteId;
      }
    }
    
    // Filter by company - show site-owned docs for that company, plus any scoped
    // (group/company) docs that are explicitly shared with a site or company in
    // the selected company. isSharedLink can be false for origin/admin users, so
    // we use siteId===null as the reliable signal for a scoped doc.
    let matchesCompany = true;
    if (urlScope && urlEntityId) {
      // Scope-view already constrains by entity
    } else if (selectedCompany && selectedCompany !== "all") {
      if (doc.siteId === null) {
        const companySiteIdSet = new Set(filteredSites.map(s => s.id));
        const selectedCompanyId = filteredSites[0]?.companyId;
        const sharedWithSiteIds = (doc as any).sharedWithSiteIds as string[] | undefined;
        const sharedWithCompanyIds = (doc as any).sharedWithCompanyIds as string[] | undefined;
        matchesCompany =
          (sharedWithSiteIds?.some(sid => companySiteIdSet.has(sid)) ?? false) ||
          !!(selectedCompanyId && sharedWithCompanyIds?.includes(selectedCompanyId)) ||
          // Doc owned by this company — no share record exists for the origin entity
          !!(selectedCompanyId && (doc as any).entityId === selectedCompanyId);
      } else {
        const docCompanyName = (doc as any).companyName || sites?.find(s => s.id === doc.siteId)?.companyName;
        matchesCompany = docCompanyName === selectedCompany;
      }
    }
    
    // Filter by folder - match documents whose document type is assigned to the selected folder
    let matchesFolder = true;
    if (folderFilter === "unfiled") {
      // Show only documents that have no folderId
      matchesFolder = !(doc as any).folderId;
    } else if (folderFilter !== "all") {
      const docTypeId = (doc as any).documentTypeId;
      const docFolderName = docTypeId ? docTypeToFolderName.get(docTypeId) : null;
      matchesFolder = docFolderName === folderFilter;
    }
    
    // Filter by renewal date
    let matchesRenewal = true;
    if (renewalFilter !== "all") {
      if (renewalFilter === "none") {
        matchesRenewal = !doc.renewalDate;
      } else if (!doc.renewalDate) {
        // Date-based filter active but doc has no renewal date — exclude it
        matchesRenewal = false;
      } else {
        const now = new Date();
        const renewalDate = new Date(doc.renewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        switch (renewalFilter) {
          case "overdue":
            matchesRenewal = daysUntilRenewal < 0;
            break;
          case "30days":
            matchesRenewal = daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
            break;
          case "60days":
            matchesRenewal = daysUntilRenewal >= 0 && daysUntilRenewal <= 60;
            break;
          case "90days":
            matchesRenewal = daysUntilRenewal >= 0 && daysUntilRenewal <= 90;
            break;
        }
      }
    }
    
    return matchesSearch && matchesStatus && matchesFolder && matchesSite && matchesCompany && matchesRenewal && !doc.isArchived;
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const sortedDocuments = useMemo(() => {
    if (!filteredDocuments) return [];
    return [...filteredDocuments].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      switch (sortBy) {
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "status":
          aVal = a.status || "";
          bVal = b.status || "";
          break;
        case "renewalPeriodMonths":
          aVal = (a as any).renewalPeriodMonths ?? -1;
          bVal = (b as any).renewalPeriodMonths ?? -1;
          break;
        case "renewalDate":
          aVal = (a as any).renewalDate ? new Date((a as any).renewalDate).getTime() : 0;
          bVal = (b as any).renewalDate ? new Date((b as any).renewalDate).getTime() : 0;
          break;
        case "expiryDate":
          aVal = (a as any).expiryDate ? new Date((a as any).expiryDate).getTime() : 0;
          bVal = (b as any).expiryDate ? new Date((b as any).expiryDate).getTime() : 0;
          break;
        case "updatedAt":
        default:
          aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredDocuments, sortBy, sortDir]);

  // In "All Sites" view, expand company-scoped docs (siteId=null) per covered site,
  // mirroring the folder view expansion so both views show the same document count.
  // Each virtual row gets siteId set to the target site (so docMetaLine shows the
  // correct site name) and _originalSiteIdWasNull=true so the "Shared from Company"
  // badge continues to render correctly via the existing row renderer logic.
  const expandedTableDocuments = useMemo(() => {
    const isAllSites = (!selectedSiteId || selectedSiteId === "all") && (!urlScope || !urlEntityId);
    if (!isAllSites || filteredSites.length <= 1) {
      return sortedDocuments.map(doc => ({ doc, rowKey: doc.id }));
    }
    const result: { doc: any; rowKey: string }[] = [];
    for (const doc of sortedDocuments) {
      if (doc.siteId !== null) {
        result.push({ doc, rowKey: doc.id });
        continue;
      }
      const sharedWithSiteIds = (doc as any).sharedWithSiteIds as string[] | undefined;
      const sharedWithCompanyIds = (doc as any).sharedWithCompanyIds as string[] | undefined;
      const docEntityId = (doc as any).entityId as string | undefined;
      const docScope = (doc as any).scope as string | undefined;
      const coveredSites = filteredSites.filter(s =>
        sharedWithSiteIds?.includes(s.id) ||
        sharedWithCompanyIds?.includes(s.companyId) ||
        // Group-scoped docs appear at their own company's sites (server requires shares.length>0)
        // Company-scoped docs must have explicit share records — no auto-inherit by entityId
        (docScope === "group" && docEntityId !== undefined && docEntityId === s.companyId)
      );
      if (coveredSites.length === 0) {
        result.push({ doc, rowKey: doc.id });
      } else {
        for (const site of coveredSites) {
          result.push({
            doc: { ...doc, siteId: site.id, _originalSiteIdWasNull: true },
            rowKey: `${doc.id}-${site.id}`,
          });
        }
      }
    }
    return result;
  }, [sortedDocuments, selectedSiteId, urlScope, urlEntityId, filteredSites]);

  // In "All Sites" folder view the hierarchy deduplicates shared docs to one entry.
  // Expand them here (per covered site) so the unfiled section shows one row per site,
  // mirroring the table-view expansion. filteredDocuments is the source of
  // sharedWithSiteIds / sharedWithCompanyIds since HierarchyDocument lacks them.
  const expandedUnmatchedShared = useMemo(() => {
    const isAllSites = (!selectedSiteId || selectedSiteId === "all") && (!urlScope || !urlEntityId);
    if (!isAllSites || filteredSites.length <= 1) return unmatchedShared;
    const docLookup = new Map<string, any>();
    for (const d of filteredDocuments ?? []) {
      if (d.siteId === null) docLookup.set(d.id, d);
    }
    const result: any[] = [];
    for (const doc of unmatchedShared) {
      const full = docLookup.get(doc.id);
      if (!full) {
        result.push(doc);
        continue;
      }
      const sharedWithSiteIds = (full as any).sharedWithSiteIds as string[] | undefined;
      const sharedWithCompanyIds = (full as any).sharedWithCompanyIds as string[] | undefined;
      const docEntityId = (full as any).entityId as string | undefined;
      const docScope = (full as any).scope as string | undefined;
      const coveredSites = filteredSites.filter(s =>
        sharedWithSiteIds?.includes(s.id) ||
        sharedWithCompanyIds?.includes(s.companyId) ||
        (docScope === "group" && docEntityId !== undefined && docEntityId === s.companyId)
      );
      if (coveredSites.length === 0) {
        result.push(doc);
      } else {
        for (const site of coveredSites) {
          result.push({ ...doc, _virtualSiteId: site.id, _virtualSiteName: site.name, _virtualKey: `${doc.id}-${site.id}` });
        }
      }
    }
    return result;
  }, [unmatchedShared, filteredDocuments, selectedSiteId, filteredSites]);

  // Same per-site expansion for shared docs filed inside a folder template.
  const expandedSharedByFolderTemplate = useMemo(() => {
    const isAllSites = (!selectedSiteId || selectedSiteId === "all") && (!urlScope || !urlEntityId);
    if (!isAllSites || filteredSites.length <= 1) return sharedByFolderTemplate;
    const docLookup = new Map<string, any>();
    for (const d of filteredDocuments ?? []) {
      if (d.siteId === null) docLookup.set(d.id, d);
    }
    const expanded = new Map<string, any[]>();
    for (const [tplId, docs] of sharedByFolderTemplate.entries()) {
      const expandedDocs: any[] = [];
      for (const doc of docs) {
        const full = docLookup.get(doc.id);
        if (!full) { expandedDocs.push(doc); continue; }
        const sharedWithSiteIds = (full as any).sharedWithSiteIds as string[] | undefined;
        const sharedWithCompanyIds = (full as any).sharedWithCompanyIds as string[] | undefined;
        const docEntityId = (full as any).entityId as string | undefined;
        const docScope = (full as any).scope as string | undefined;
        const coveredSites = filteredSites.filter(s =>
          sharedWithSiteIds?.includes(s.id) ||
          sharedWithCompanyIds?.includes(s.companyId) ||
          (docScope === "group" && docEntityId !== undefined && docEntityId === s.companyId)
        );
        if (coveredSites.length === 0) {
          expandedDocs.push(doc);
        } else {
          for (const site of coveredSites) {
            expandedDocs.push({ ...doc, _virtualSiteId: site.id, _virtualSiteName: site.name, _virtualKey: `${doc.id}-${site.id}` });
          }
        }
      }
      expanded.set(tplId, expandedDocs);
    }
    return expanded;
  }, [sharedByFolderTemplate, filteredDocuments, selectedSiteId, filteredSites]);

  // Compute how many extra virtual rows were added per folder (and a banner total)
  // so that displayed counts stay consistent with the expanded rows.
  const sharedExpansionDeltas = useMemo(() => {
    const empty = { byFolder: new Map<string, { totalDocuments: number; compliant: number; approved: number; approvalRequired: number; overdue: number }>(), summary: { totalDocuments: 0, compliant: 0, approved: 0, approvalRequired: 0, overdue: 0 } };
    const isAllSites = (!selectedSiteId || selectedSiteId === "all") && (!urlScope || !urlEntityId);
    if (!isAllSites || filteredSites.length <= 1) return empty;
    const byFolder = new Map<string, { totalDocuments: number; compliant: number; approved: number; approvalRequired: number; overdue: number }>();
    let sTotal = 0, sCompliant = 0, sApproved = 0, sReview = 0, sOverdue = 0;
    for (const [folderId, expandedDocs] of expandedSharedByFolderTemplate.entries()) {
      const originalDocs = sharedByFolderTemplate.get(folderId) ?? [];
      if (expandedDocs.length <= originalDocs.length) continue;
      const virtualRows = expandedDocs.filter(d => (d as any)._virtualKey);
      const delta = {
        totalDocuments: expandedDocs.length - originalDocs.length,
        compliant: virtualRows.filter(d => d.status === "compliant").length - originalDocs.filter(d => d.status === "compliant").length,
        approved: virtualRows.filter(d => d.status === "approved").length - originalDocs.filter(d => d.status === "approved").length,
        approvalRequired: virtualRows.filter(d => d.status === "approval_required").length - originalDocs.filter(d => d.status === "approval_required").length,
        overdue: virtualRows.filter(d => d.status === "overdue").length - originalDocs.filter(d => d.status === "overdue").length,
      };
      byFolder.set(folderId, delta);
      sTotal += delta.totalDocuments; sCompliant += delta.compliant; sApproved += delta.approved; sReview += delta.approvalRequired; sOverdue += delta.overdue;
    }
    return { byFolder, summary: { totalDocuments: sTotal, compliant: sCompliant, approved: sApproved, approvalRequired: sReview, overdue: sOverdue } };
  }, [expandedSharedByFolderTemplate, sharedByFolderTemplate, selectedSiteId, filteredSites]);

  const getDocTypeLabel = (type: string, documentTypeId?: string | null) => {
    if (documentTypeId && allDocumentTypes) {
      const apiDocType = allDocumentTypes.find(dt => dt.id === documentTypeId);
      if (apiDocType) return apiDocType.name;
    }
    const apiDocTypeByCode = allDocumentTypes?.find(dt => dt.code === type);
    if (apiDocTypeByCode) return apiDocTypeByCode.name;
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  return (
    <div className={`${themeClass} flex flex-col h-full`}>
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <ModuleIcon className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {config.name}
                <span className="font-normal text-muted-foreground text-2xl"> - Documents</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                {isPrivilegedUser && (
                  contextCompanyId ? (
                    <Link href={`/companies/${contextCompanyId}`}>
                      <span className="font-semibold text-foreground hover:underline cursor-pointer" data-testid="link-context-company">
                        {contextCompany || "All Companies"}
                      </span>
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{contextCompany || "All Companies"}</span>
                  )
                )}
                {!isPrivilegedUser && contextCompany && (
                  contextCompanyId ? (
                    <Link href={`/companies/${contextCompanyId}`}>
                      <span className="font-semibold text-foreground hover:underline cursor-pointer" data-testid="link-context-company-client">
                        {contextCompany}
                      </span>
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{contextCompany}</span>
                  )
                )}
                {(isPrivilegedUser || contextCompany) && contextSite && <span> - </span>}
                {contextSite && (
                  contextSiteId ? (
                    <Link href={`/sites/${contextSiteId}`}>
                      <span className="hover:underline cursor-pointer" data-testid="link-context-site">{contextSite}</span>
                    </Link>
                  ) : (
                    <span>{contextSite}</span>
                  )
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" data-testid="link-sites-from-documents" onClick={() => navigate(`${basePath}/sites`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground" asChild>
                <Link href={basePath} data-testid="link-dashboard-from-documents">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  View Dashboard
                </Link>
              </Button>
              {isPrivilegedUser && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground"
                          asChild={hasSpecificContext}
                          disabled={!hasSpecificContext}
                          data-testid="button-upload-document"
                        >
                          {hasSpecificContext ? (
                            <Link href={getUploadUrl()}>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Document
                            </Link>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Document
                            </>
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!hasSpecificContext && (
                      <TooltipContent>
                        <p>Select a specific site, company or group to upload documents</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Secondary toolbar with view toggle */}
      <div className="bg-muted/30 border-b px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <div className={`flex items-center gap-1 rounded-lg border ${moduleBorderColors[module]} p-1 bg-background`}>
              <Button
                variant={viewMode === "folder" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("folder")}
                className={viewMode === "folder" ? `${moduleBgColors[module]} ${moduleColors[module]} hover:opacity-90` : ""}
                data-testid="button-folder-view"
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Folders
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={viewMode === "table" ? `${moduleBgColors[module]} ${moduleColors[module]} hover:opacity-90` : ""}
                data-testid="button-table-view"
              >
                <LayoutList className="mr-2 h-4 w-4" />
                Table
              </Button>
            </div>
          </div>
          
          {hasCoverage && (
            <Select
              value={coverageFilter}
              onValueChange={(v) => { setCoverageFilter(v); setSelectedSiteId(null); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-docs">
                <span className="truncate pointer-events-none">
                  {coverageFilter === "my"
                    ? "My client sites"
                    : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my">My client sites</SelectItem>
                {coveringFor.map(c => (
                  <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-docs-${c.absentConsultantId}`}>
                    {c.absentConsultantName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isProConsultant && (
            <Select
              value={proStaffFilter}
              onValueChange={(v) => { setProStaffFilter(v); setSelectedSiteId(null); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-pro-staff-filter-docs">
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
                  <SelectItem key={s.id} value={s.id} data-testid={`pro-staff-filter-docs-${s.id}`}>
                    {s.fullName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isPrivilegedUser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchivedDialogOpen(true)}
              data-testid="button-show-archived"
              className="gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived Documents
            </Button>
          )}
          
          {/* Quick stats badge */}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto space-y-6 p-8 dash-animate">


      {/* Folder View */}
      {viewMode === "folder" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {/* Scoped folder view — when navigated from a Group/Company tile,
              the per-site folder hierarchy doesn't apply; render the scoped
              documents (owned + linked) as a single themed folder card. */}
          {urlScope && urlEntityId ? (
            <Card className={`border ${moduleBorderColors[module]}`} data-testid={`card-folder-scope-${urlScope}`}>
              <CardHeader className={`pb-3 ${moduleBgColors[module]} rounded-t-lg`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen className={`h-5 w-5 ${moduleColors[module]}`} />
                    <CardTitle className={`text-lg ${moduleColors[module]}`}>
                      {urlEntityName || (urlScope === "group" ? "Group" : "Company")}
                      {" "}— {urlScope === "group" ? "Group Documents" : "Company Documents"}
                    </CardTitle>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {sortedDocuments.length} document{sortedDocuments.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(() => {
                  const renderDocRow = (doc: any) => {
                    const viewedAsLinked = !!(
                      (doc as any).scope !== urlScope ||
                      (doc as any).entityId !== urlEntityId
                    );
                    const isScopedDoc = !!(doc.siteId === null && ((doc as any).scope === "group" || (doc as any).scope === "company") && viewedAsLinked);
                    const isLinkedRow = viewedAsLinked || !!doc.isSharedLink || isScopedDoc;
                    const linkedFromScope: "group" | "company" | null = viewedAsLinked
                      ? ((doc as any).scope === "group" ? "group" : "company")
                      : (doc.sharedScope === "group" ? "group" : doc.sharedScope === "company" ? "company"
                        : ((doc as any).scope === "group" ? "group" : (doc as any).scope === "company" ? "company" : null));
                    if (isLinkedRow) {
                      const resolvedEntityName = doc.sharedFromEntityName
                        ?? companies.find((c: any) => c.id === (doc as any).entityId)?.name
                        ?? null;
                      const sharedSubtitle = resolvedEntityName
                        ? `Shared from ${linkedFromScope === "group" ? "group" : "company"}: ${resolvedEntityName}`
                        : `Shared ${linkedFromScope ?? "document"} (read-only)`;
                      const isGroupScope = linkedFromScope === "group";
                      return (
                        <Link
                          key={doc.id}
                          href={`${basePath}/documents/${doc.id}`}
                          className={`flex items-center justify-between p-2 rounded-md border-2 border-dashed hover-elevate ${isGroupScope ? "border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20" : "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"}`}
                          data-testid={`row-folder-doc-${doc.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className={`h-4 w-4 ${isGroupScope ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`} />
                            <div>
                              <p className="font-medium text-sm">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">{sharedSubtitle}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${isGroupScope ? "border-purple-400 text-purple-700 dark:text-purple-300" : "border-blue-400 text-blue-700 dark:text-blue-300"}`}>
                              Shared
                            </Badge>
                            <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                            <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      );
                    }
                    const hasShares = ((doc as any).sharedWithSiteIds?.length ?? 0) + ((doc as any).sharedWithCompanyIds?.length ?? 0) > 0;
                    const originIsGroup = (doc as any).scope === "group";
                    if (hasShares) {
                      const shareCount = ((doc as any).sharedWithSiteIds?.length ?? 0) + ((doc as any).sharedWithCompanyIds?.length ?? 0);
                      return (
                        <Link
                          key={doc.id}
                          href={`${basePath}/documents/${doc.id}`}
                          className={`flex items-center justify-between p-2 rounded-md border-2 border-dashed hover-elevate ${originIsGroup ? "border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20" : "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"}`}
                          data-testid={`row-folder-doc-${doc.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className={`h-4 w-4 shrink-0 ${originIsGroup ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{doc.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{docMetaLine(doc)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs ${originIsGroup ? "border-purple-400 text-purple-700 dark:text-purple-300" : "border-blue-400 text-blue-700 dark:text-blue-300"}`}>
                              Shared to {shareCount} {shareCount === 1 ? "site" : "sites"}
                            </Badge>
                            <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                            <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      );
                    }
                    return (
                      <Link
                        key={doc.id}
                        href={`${basePath}/documents/${doc.id}`}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border ${moduleBorderColors[module]} hover-elevate`}
                        data-testid={`row-folder-doc-${doc.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{docMetaLine(doc)}</p>
                            {doc.isArchived && (
                              <Badge variant="secondary" className="mt-1 gap-1 bg-muted">
                                <Archive className="h-3 w-3" />
                                Archived
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                          <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                        </div>
                      </Link>
                    );
                  };

                  // Build folder hierarchy from scoped folders for this module
                  const folders = (scopedFolders || []).filter((f: any) => f.module === module && (f.sortOrder ?? 0) >= 0);
                  const parents = folders.filter((f: any) => !f.parentId).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

                  // Group documents by folderId; collect those without folder for "Unfiled".
                  // When a doc's folderId points to a folder outside this scope (e.g. a
                  // group-scoped doc whose source folder is the group's folder, viewed
                  // at company scope), resolve to the equivalent folder in the current
                  // scope by matching templateId — folders provisioned from the same
                  // folder template share the same `templateId` value across scopes.
                  const docsByFolder = new Map<string, any[]>();
                  const unfiled: any[] = [];
                  for (const doc of sortedDocuments) {
                    let targetFolder: any = null;
                    if (doc.folderId) {
                      targetFolder = folders.find((f: any) => f.id === doc.folderId);
                    }
                    if (!targetFolder && (doc as any).folderTemplateId) {
                      const ftId = (doc as any).folderTemplateId;
                      targetFolder = folders.find((f: any) => f.templateId === ftId);
                    }
                    if (targetFolder) {
                      const arr = docsByFolder.get(targetFolder.id) || [];
                      arr.push(doc);
                      docsByFolder.set(targetFolder.id, arr);
                    } else {
                      unfiled.push(doc);
                    }
                  }

                  // Group missing required slots by folder template id; dedupe by templateId
                  // (a slot can recur per-site under the entity).
                  const missingByFolder = new Map<string, Map<string, any>>();
                  const unfiledMissing = new Map<string, any>();
                  for (const slot of missingSlots) {
                    const ftId = (slot as any).folderTemplateId ?? null;
                    const matchingFolder = ftId ? folders.find((f: any) => f.id === ftId || (f as any).templateId === ftId || (f as any).folderTemplateId === ftId) : null;
                    if (matchingFolder) {
                      const m = missingByFolder.get(matchingFolder.id) || new Map<string, any>();
                      if (!m.has(slot.templateId)) m.set(slot.templateId, slot);
                      missingByFolder.set(matchingFolder.id, m);
                    } else {
                      if (!unfiledMissing.has(slot.templateId)) unfiledMissing.set(slot.templateId, slot);
                    }
                  }

                  // Count how many sites are missing each template (used in group scope subtitle).
                  const missingSiteCountByTemplate = new Map<string, number>();
                  for (const s of missingSlots) {
                    missingSiteCountByTemplate.set(s.templateId, (missingSiteCountByTemplate.get(s.templateId) ?? 0) + 1);
                  }

                  const renderMissingRow = (slot: any) => {
                    const affectedSites = missingSiteCountByTemplate.get(slot.templateId) ?? 1;
                    const subtitle = urlScope === "group" && affectedSites > 1
                      ? `Mandatory — missing across ${affectedSites} site${affectedSites !== 1 ? "s" : ""}`
                      : "Mandatory — not yet uploaded";
                    const canUpload = isPrivilegedUser && urlScope !== "group";
                    return (
                      <div
                        key={`missing-${slot.templateId}`}
                        className={`flex items-center justify-between p-2 rounded-md border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 ${canUpload ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" : ""}`}
                        data-testid={`row-missing-scope-${slot.templateId}`}
                        onClick={canUpload ? () => navigate(getMissingSlotUrl(slot)) : undefined}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-amber-800 dark:text-amber-200 truncate">{slot.templateName}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">{subtitle}{canUpload ? " — click to upload" : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory</Badge>
                          <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                        </div>
                      </div>
                    );
                  };

                  if (folders.length === 0 && sortedDocuments.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${moduleBgColors[module]}`}>
                          <FileText className={`h-6 w-6 ${moduleColors[module]}`} />
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          Setting up folders for this {urlScope === "group" ? "group" : "company"}…
                        </p>
                      </div>
                    );
                  }

                  const computeStats = (docs: any[]) => ({
                    totalDocuments: docs.length,
                    compliant: docs.filter((d: any) => d.status === "compliant").length,
                    approvalRequired: docs.filter((d: any) => d.status === "approval_required").length,
                    overdue: docs.filter((d: any) => d.status === "overdue").length,
                    requiredTemplates: 0,
                    fulfilledRequired: 0,
                  });

                  const renderChildFolder = (childFolder: any) => {
                    const childDocs = docsByFolder.get(childFolder.id) || [];
                    const childMissing = Array.from((missingByFolder.get(childFolder.id) ?? new Map()).values());
                    const childStatusBadge = getFolderStatusBadge(childFolder.stats ?? computeStats(childDocs));
                    return (
                      <AccordionItem
                        key={childFolder.id}
                        value={childFolder.id}
                        className={`border rounded-lg ${moduleBorderColors[module]} overflow-hidden`}
                        data-testid={`folder-scope-${childFolder.id}`}
                      >
                        <AccordionTrigger className="hover:no-underline px-3 py-2 bg-muted/30">
                          <div className="flex items-center justify-between w-full pr-2">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                <FolderOpen className={`h-3.5 w-3.5 ${moduleColors[module]}`} />
                              </div>
                              <span className="font-medium text-sm">{childFolder.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {childMissing.length > 0 && (
                                <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                                  <AlertCircle className="h-3 w-3" />
                                  {childMissing.length} Missing
                                </Badge>
                              )}
                              {childStatusBadge.map(b => <Badge key={b.label} variant={b.variant} className={b.className}>{b.label}</Badge>)}
                              <span className="text-xs text-muted-foreground">
                                {(childFolder.stats?.totalDocuments ?? childDocs.length)} document{(childFolder.stats?.totalDocuments ?? childDocs.length) !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="p-3 pl-10 space-y-2">
                            {childDocs.map(renderDocRow)}
                            {childMissing.map(renderMissingRow)}
                            {childDocs.length === 0 && childMissing.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">No documents in this subfolder</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  };

                  const renderParentFolder = (folder: any) => {
                    const childFolders = folders
                      .filter((f: any) => f.parentId === folder.id)
                      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    const folderDocs = docsByFolder.get(folder.id) || [];
                    const folderMissing = Array.from((missingByFolder.get(folder.id) ?? new Map()).values());
                    const childMissingTotal = childFolders.reduce(
                      (sum: number, c: any) => sum + ((missingByFolder.get(c.id) ?? new Map()).size),
                      0,
                    );
                    const totalMissing = folderMissing.length + childMissingTotal;
                    const allDocsInTree = [
                      ...folderDocs,
                      ...childFolders.flatMap((c: any) => docsByFolder.get(c.id) || []),
                    ];
                    const stats = computeStats(allDocsInTree);
                    const statusBadge = getFolderStatusBadge(stats);
                    return (
                      <AccordionItem
                        key={folder.id}
                        value={folder.id}
                        data-testid={`accordion-folder-${folder.id}`}
                        className={`border-b ${moduleBorderColors[module]}`}
                      >
                        <AccordionTrigger className="hover:no-underline px-2">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                <FolderOpen className={`h-4 w-4 ${moduleColors[module]}`} />
                              </div>
                              <span className="font-medium">{folder.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {totalMissing > 0 && (
                                <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                                  <AlertCircle className="h-3 w-3" />
                                  {totalMissing} Missing
                                </Badge>
                              )}
                              {statusBadge.map(b => <Badge key={b.label} variant={b.variant} className={b.className}>{b.label}</Badge>)}
                              <span className="text-sm text-muted-foreground">
                                {stats.totalDocuments} document{stats.totalDocuments !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-8 space-y-2">
                            {childFolders.length > 0 && (
                              <Accordion type="multiple" className="space-y-2 mb-4">
                                {childFolders.map(renderChildFolder)}
                              </Accordion>
                            )}
                            {folderDocs.length > 0 && (
                              <div className="space-y-2">{folderDocs.map(renderDocRow)}</div>
                            )}
                            {folderMissing.length > 0 && (
                              <div className="space-y-2">{folderMissing.map(renderMissingRow)}</div>
                            )}
                            {folderDocs.length === 0 && childFolders.length === 0 && folderMissing.length === 0 && (
                              <p className="text-xs text-muted-foreground italic">No documents in this folder</p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  };

                  return (
                    <Accordion type="multiple" className="w-full">
                      {parents.map(renderParentFolder)}
                      {(unfiled.length > 0 || unfiledMissing.size > 0) && (
                        <AccordionItem
                          value="__unfiled__"
                          data-testid="folder-scope-unfiled"
                          className={`border-b ${moduleBorderColors[module]}`}
                        >
                          <AccordionTrigger className="hover:no-underline px-2">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                  <FolderOpen className={`h-4 w-4 ${moduleColors[module]}`} />
                                </div>
                                <span className="font-medium">Unfiled</span>
                              </div>
                              <div className="flex items-center gap-3">
                                {unfiledMissing.size > 0 && (
                                  <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                                    <AlertCircle className="h-3 w-3" />
                                    {unfiledMissing.size} Missing
                                  </Badge>
                                )}
                                <span className="text-sm text-muted-foreground">
                                  {unfiled.length} document{unfiled.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="pl-8 space-y-2">
                              {unfiled.map(renderDocRow)}
                              {Array.from(unfiledMissing.values()).map(renderMissingRow)}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
          <>
          {/* No site selected message */}
          {!hierarchySiteId && (
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${moduleBgColors[module]}`}>
                  <FolderOpen className={`h-7 w-7 ${moduleColors[module]}`} />
                </div>
                <h3 className="mt-4 text-lg font-medium">Select a site</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a site to view documents organised by folder
                </p>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          {hierarchySiteId && hierarchy?.summary && (
            <Card className={`border-t-4 ${moduleBorderColors[module]} border-t-current`} style={{ borderTopColor: 'inherit' }}>
              <CardHeader className={`pb-3 ${moduleBgColors[module]} rounded-t-lg`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <ModuleIcon className={`h-5 w-5 ${moduleColors[module]}`} />
                    <CardTitle className={`text-lg ${moduleColors[module]}`}>{config.name} Documents</CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <Files className="h-4 w-4 text-muted-foreground" />
                      <span>{((hierarchy.summary.totalDocuments ?? 0) + (sharedExpansionDeltas.summary.totalDocuments ?? 0))} Total</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <span>{((hierarchy.summary as any).compliant ?? 0) + (sharedExpansionDeltas.summary.compliant ?? 0)} Compliant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-emerald-500" />
                      <span>{((hierarchy.summary as any).approved ?? 0) + (sharedExpansionDeltas.summary.approved ?? 0)} Approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-yellow-600" />
                      <span>{((hierarchy.summary.approvalRequired ?? 0) + (sharedExpansionDeltas.summary.approvalRequired ?? 0))} Approval Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-red-600" />
                      <span>{((hierarchy.summary.overdue ?? 0) + (sharedExpansionDeltas.summary.overdue ?? 0))} Overdue</span>
                    </div>
                    {displayedMissingCount > 0 && (
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span>{displayedMissingCount} Missing</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Folders Accordion */}
          {hierarchySiteId && isLoadingHierarchy ? (
            <FetchingOverlay />
          ) : hierarchySiteId && hierarchy?.folders && hierarchy.folders.length > 0 ? (
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardContent className="p-4">
                <Accordion type="multiple" className="w-full">
                  {hierarchy.folders.map((folder) => {
                    const folderDelta = sharedExpansionDeltas.byFolder.get(folder.id);
                    const adjustedFolderStats = folderDelta ? {
                      totalDocuments: folder.stats.totalDocuments + folderDelta.totalDocuments,
                      compliant: folder.stats.compliant + folderDelta.compliant,
                      approvalRequired: folder.stats.approvalRequired + folderDelta.approvalRequired,
                      overdue: folder.stats.overdue + folderDelta.overdue,
                    } : folder.stats;
                    const statusBadge = getFolderStatusBadge(adjustedFolderStats);
                    const folderDropId = (folder as any).siteFolder?.id ?? folder.id;
                    const parentMissingCount = (missingByFolderTemplateId.get(folder.id)?.length ?? 0) +
                      ((folder as any).childFolders ?? []).reduce((sum: number, cf: any) => sum + (missingByFolderTemplateId.get(cf.id)?.length ?? 0), 0);
                    return (
                      <DroppableFolderZone key={folder.id} folderId={folderDropId} isDragEnabled={isAdmin}>
                      <AccordionItem value={folder.id} data-testid={`accordion-folder-${folder.id}`} className={`border-b ${moduleBorderColors[module]}`}>
                        <AccordionTrigger className="hover:no-underline px-2">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                <FolderOpen className={`h-4 w-4 ${moduleColors[module]}`} />
                              </div>
                              <span className="font-medium">{folder.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {parentMissingCount > 0 && (
                                <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                                  <AlertCircle className="h-3 w-3" />
                                  {parentMissingCount} Missing
                                </Badge>
                              )}
                              {statusBadge.map(b => <Badge key={b.label} variant={b.variant} className={b.className}>{b.label}</Badge>)}
                              <span className="text-sm text-muted-foreground">
                                {adjustedFolderStats.totalDocuments} document{adjustedFolderStats.totalDocuments !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-8 space-y-2">
                            {/* Child Folders */}
                            {(folder as any).childFolders && (folder as any).childFolders.length > 0 && (
                              <Accordion type="multiple" className="space-y-2 mb-4">
                                {(folder as any).childFolders.map((childFolder: any) => {
                                  const childDelta = sharedExpansionDeltas.byFolder.get(childFolder.id);
                                  const baseChildStats = childFolder.stats || { totalDocuments: 0, compliant: 0, approvalRequired: 0, overdue: 0 };
                                  const adjustedChildStats = childDelta ? {
                                    totalDocuments: baseChildStats.totalDocuments + childDelta.totalDocuments,
                                    compliant: baseChildStats.compliant + childDelta.compliant,
                                    approvalRequired: baseChildStats.approvalRequired + childDelta.approvalRequired,
                                    overdue: baseChildStats.overdue + childDelta.overdue,
                                  } : baseChildStats;
                                  const childStatusBadge = getFolderStatusBadge(adjustedChildStats);
                                  const childDropId = (childFolder as any).siteFolder?.id ?? childFolder.id;
                                  return (
                                    <DroppableFolderZone key={childFolder.id} folderId={childDropId} isDragEnabled={isAdmin}>
                                    <AccordionItem value={childFolder.id} className={`border rounded-lg ${moduleBorderColors[module]} overflow-hidden`}>
                                      <AccordionTrigger className="hover:no-underline px-3 py-2 bg-muted/30">
                                        <div className="flex items-center justify-between w-full pr-2">
                                          <div className="flex items-center gap-3">
                                            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                              <FolderOpen className={`h-3.5 w-3.5 ${moduleColors[module]}`} />
                                            </div>
                                            <span className="font-medium text-sm">{childFolder.name}</span>
                                            {childFolder.isMandatory && (
                                              <Badge variant="outline" className={`text-xs ${moduleBorderColors[module]} ${moduleColors[module]}`}>Mandatory</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {(missingByFolderTemplateId.get(childFolder.id)?.length ?? 0) > 0 && (
                                              <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                                                <AlertCircle className="h-3 w-3" />
                                                {missingByFolderTemplateId.get(childFolder.id)!.length} Missing
                                              </Badge>
                                            )}
                                            {childStatusBadge.map(b => <Badge key={b.label} variant={b.variant} className={b.className}>{b.label}</Badge>)}
                                            <span className="text-xs text-muted-foreground">
                                              {adjustedChildStats.totalDocuments} doc{adjustedChildStats.totalDocuments !== 1 ? "s" : ""}
                                            </span>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="p-3 pl-10 space-y-2">
                                          {childFolder.documents && childFolder.documents.filter((doc: any) => !doc.isArchived).map((doc: any) => (
                                            <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={childDropId} isDragEnabled={isAdmin}>
                                            <Link
                                              href={`${basePath}/documents/${doc.id}`}
                                              className="flex items-center justify-between p-2 rounded-md border hover-elevate"
                                              data-testid={`link-document-${doc.id}`}
                                            >
                                              <div className="flex items-center gap-3">
                                                {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                  <p className="font-medium text-sm">{doc.title}</p>
                                                  <p className="text-xs text-muted-foreground">{docMetaLine(doc)}</p>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {doc.isArchived && (
                                                  <Badge variant="secondary" className="gap-1 bg-muted text-[10px] h-5">
                                                    <Archive className="h-3 w-3" />
                                                    Archived
                                                  </Badge>
                                                )}
                                                <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                                <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                              </div>
                                            </Link>
                                            </DraggableDocRow>
                                          ))}
                                          {/* Shared (Group/Company-scope) documents filed under this child folder template — read-only */}
                                          {(expandedSharedByFolderTemplate.get(childFolder.id) ?? []).map((doc) => {
                                            const isGrp = doc.sharedScope === "group";
                                            return (
                                            <Link
                                              key={(doc as any)._virtualKey ?? doc.id}
                                              href={`${basePath}/documents/${doc.id}`}
                                              className={`flex items-center justify-between p-2 rounded-md border-2 border-dashed hover-elevate ${isGrp ? "border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20" : "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"}`}
                                              data-testid={`link-shared-document-${(doc as any)._virtualKey ?? doc.id}`}
                                            >
                                              <div className="flex items-center gap-3">
                                                <FileText className={`h-4 w-4 ${isGrp ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`} />
                                                <div>
                                                  <p className="font-medium text-sm">{doc.title}</p>
                                                  <p className="text-xs text-muted-foreground">
                                                    {(doc as any)._virtualSiteName
                                                      ? `${(doc as any)._virtualSiteName}${doc.sharedFromEntityName ? ` · Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}` : ""}`
                                                      : doc.sharedFromEntityName
                                                        ? `Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}`
                                                        : `Shared ${doc.sharedScope ?? "document"} (read-only)`}
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`text-xs ${isGrp ? "border-purple-400 text-purple-700 dark:text-purple-300" : "border-blue-400 text-blue-700 dark:text-blue-300"}`}>
                                                  Shared
                                                </Badge>
                                                <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                                <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                              </div>
                                            </Link>
                                            );
                                          })}
                                          {/* Missing required slots for child folder — sourced from missingSlots for accuracy */}
                                          {(missingByFolderTemplateId.get(childFolder.id) ?? []).map((slot: any) => (
                                            <div key={`${slot.templateId}-${slot.siteId}`} className={`flex items-center justify-between p-2 rounded-md border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 ${isPrivilegedUser ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" : ""}`} data-testid={`row-missing-${slot.templateId}-${slot.siteId}`} onClick={isPrivilegedUser ? () => navigate(getMissingSlotUrl(slot)) : undefined}>
                                              <div className="flex items-center gap-3">
                                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                                <div>
                                                  <p className="font-medium text-sm text-amber-800 dark:text-amber-200">{slot.templateName}</p>
                                                  <p className="text-xs text-amber-600 dark:text-amber-400">Mandatory — not yet uploaded{slot.siteName ? ` · ${slot.siteName}` : ""}{isPrivilegedUser ? " — click to upload" : ""}</p>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory</Badge>
                                                <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                                              </div>
                                            </div>
                                          ))}
                                          {/* Empty state — only when no docs and no missing required slots */}
                                          {(!childFolder.documents || childFolder.documents.filter((doc: any) => !doc.isArchived).length === 0) &&
                                           (missingByFolderTemplateId.get(childFolder.id)?.length ?? 0) === 0 && (
                                            <div className="text-center py-4 text-muted-foreground">
                                              <p className="text-xs">No documents in this subfolder</p>
                                              {isPrivilegedUser && hasSpecificContext && (
                                                <Button variant="ghost" size="sm" className="mt-1" asChild>
                                                  <Link href={getUploadUrl()}>
                                                    <Upload className="mr-2 h-3 w-3" />
                                                    Upload
                                                  </Link>
                                                </Button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                    </DroppableFolderZone>
                                  );
                                })}
                              </Accordion>
                            )}
                            
                            {/* Parent Folder Documents */}
                            {folder.documents.filter(doc => !doc.isArchived).length > 0 && (
                              <div className="space-y-2">
                                {folder.documents.filter(doc => !doc.isArchived).map((doc) => (
                                  <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={folderDropId} isDragEnabled={isAdmin}>
                                  <Link
                                    href={`${basePath}/documents/${doc.id}`}
                                    className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                                    data-testid={`link-document-${doc.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-medium text-sm">{doc.title}</p>
                                          {doc.isArchived && (
                                            <Badge variant="secondary" className="gap-1 bg-muted text-[10px] h-5">
                                              <Archive className="h-3 w-3" />
                                              Archived
                                            </Badge>
                                          )}
                                          {doc.renewalPeriodMonths && (
                                            <Badge variant="secondary" className="text-xs">{doc.renewalPeriodMonths}mo</Badge>
                                          )}
                                          {doc.renewalDate && (
                                            <Badge variant="outline" className="text-xs">Renew: {format(new Date(doc.renewalDate), "MMM d, yyyy")}</Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{docMetaLine(doc)}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </Link>
                                  </DraggableDocRow>
                                ))}
                              </div>
                            )}

                            {/* Shared (Group/Company-scope) documents filed under this folder template — read-only */}
                            {(expandedSharedByFolderTemplate.get(folder.id) ?? []).length > 0 && (
                              <div className="space-y-2">
                                {(expandedSharedByFolderTemplate.get(folder.id) ?? []).map((doc) => {
                                  const isGrp = doc.sharedScope === "group";
                                  return (
                                  <Link
                                    key={(doc as any)._virtualKey ?? doc.id}
                                    href={`${basePath}/documents/${doc.id}`}
                                    className={`flex items-center justify-between p-3 rounded-md border-2 border-dashed hover-elevate ${isGrp ? "border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20" : "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"}`}
                                    data-testid={`link-shared-document-${(doc as any)._virtualKey ?? doc.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileText className={`h-4 w-4 ${isGrp ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`} />
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-medium text-sm">{doc.title}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {(doc as any)._virtualSiteName
                                            ? `${(doc as any)._virtualSiteName}${doc.sharedFromEntityName ? ` · Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}` : ""}`
                                            : doc.sharedFromEntityName
                                              ? `Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}`
                                              : `Shared ${doc.sharedScope ?? "document"} (read-only)`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={`text-xs ${isGrp ? "border-purple-400 text-purple-700 dark:text-purple-300" : "border-blue-400 text-blue-700 dark:text-blue-300"}`}>
                                        Shared
                                      </Badge>
                                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </Link>
                                  );
                                })}
                              </div>
                            )}

                            {/* Missing required document slots — sourced from missingSlots for accuracy */}
                            {(missingByFolderTemplateId.get((folder as any).id) ?? []).map((slot: any) => (
                              <div key={`${slot.templateId}-${slot.siteId}`} className={`flex items-center justify-between p-3 rounded-md border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 ${isPrivilegedUser ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" : ""}`} data-testid={`row-missing-${slot.templateId}-${slot.siteId}`} onClick={isPrivilegedUser ? () => navigate(getMissingSlotUrl(slot)) : undefined}>
                                <div className="flex items-center gap-3">
                                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                  <div>
                                    <p className="font-medium text-sm text-amber-800 dark:text-amber-200">{slot.templateName}</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">Mandatory — not yet uploaded{slot.siteName ? ` · ${slot.siteName}` : ""}{isPrivilegedUser ? " — click to upload" : ""}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory</Badge>
                                  <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                                </div>
                              </div>
                            ))}

                            {/* Upload to parent folder option - privileged only */}
                            {isPrivilegedUser && hasSpecificContext && (
                              <div className={`flex items-center justify-center py-3 mt-2 border border-dashed rounded-md ${moduleBorderColors[module]}`}>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={getUploadUrl(folder.id)}>
                                    <Upload className="mr-2 h-3 w-3" />
                                    Upload to {folder.name}
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      </DroppableFolderZone>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          ) : hierarchySiteId ? (
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className={`flex h-14 w-14 items-center justify-center rounded-full ${moduleBgColors[module]}`}>
                  <FolderOpen className={`h-7 w-7 ${moduleColors[module]}`} />
                </div>
                <h3 className="mt-4 text-lg font-medium">No folders yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPrivilegedUser ? "Upload documents to get started" : "No documents have been added yet"}
                </p>
                {isPrivilegedUser && hasSpecificContext && (
                  <Button variant="outline" size="sm" className={`mt-4 ${moduleBorderColors[module]} ${moduleColors[module]}`} asChild>
                    <Link href={getUploadUrl()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Unfiled Documents — includes any shared docs whose folder template doesn't exist on this site */}
          {hierarchySiteId && ((hierarchy?.unfiledDocuments?.length ?? 0) + expandedUnmatchedShared.length + (missingByFolderTemplateId.get("__unfiled__")?.length ?? 0)) > 0 && (
            <DroppableFolderZone folderId="__unfiled__" isDragEnabled={isAdmin}>
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardHeader className={`pb-3 ${moduleBgColors[module]} rounded-t-lg`}>
                <CardTitle className={`text-base flex items-center gap-2 ${moduleColors[module]}`}>
                  <FileText className="h-4 w-4" />
                  Unfiled Documents
                  <Badge variant="secondary">{(hierarchy?.unfiledDocuments?.length ?? 0) + expandedUnmatchedShared.length}</Badge>
                  {(missingByFolderTemplateId.get("__unfiled__")?.length ?? 0) > 0 && (
                    <Badge className="gap-1 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      {missingByFolderTemplateId.get("__unfiled__")!.length} Missing
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {(hierarchy?.unfiledDocuments ?? []).map((doc) => (
                  <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={null} isDragEnabled={isAdmin}>
                  <Link
                    href={`${basePath}/documents/${doc.id}`}
                    className={`flex items-center justify-between p-3 rounded-md border ${moduleBorderColors[module]} hover-elevate`}
                    data-testid={`link-unfiled-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                      <FileText className={`h-4 w-4 ${moduleColors[module]}`} />
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{docMetaLine(doc)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  </DraggableDocRow>
                ))}
                {expandedUnmatchedShared.map((doc) => {
                  const isGrp = doc.sharedScope === "group";
                  return (
                  <Link
                    key={(doc as any)._virtualKey ?? doc.id}
                    href={`${basePath}/documents/${doc.id}`}
                    className={`flex items-center justify-between p-3 rounded-md border-2 border-dashed hover-elevate ${isGrp ? "border-purple-300 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-950/20" : "border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20"}`}
                    data-testid={`link-shared-document-${(doc as any)._virtualKey ?? doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`h-4 w-4 ${isGrp ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400"}`} />
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc as any)._virtualSiteName
                            ? `${(doc as any)._virtualSiteName}${doc.sharedFromEntityName ? ` · Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}` : ""}`
                            : doc.sharedFromEntityName
                              ? `Shared from ${doc.sharedScope === "group" ? "group" : "company"}: ${doc.sharedFromEntityName}`
                              : `Shared ${doc.sharedScope ?? "document"} (read-only)`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${isGrp ? "border-purple-400 text-purple-700 dark:text-purple-300" : "border-blue-400 text-blue-700 dark:text-blue-300"}`}>
                        Shared
                      </Badge>
                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  );
                })}
                {(missingByFolderTemplateId.get("__unfiled__") ?? []).map((slot: any) => (
                  <div key={`${slot.templateId}-${slot.siteId}`} className={`flex items-center justify-between p-3 rounded-md border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 ${isPrivilegedUser ? "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" : ""}`} data-testid={`row-missing-${slot.templateId}-${slot.siteId}`} onClick={isPrivilegedUser ? () => navigate(getMissingSlotUrl(slot)) : undefined}>
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-amber-800 dark:text-amber-200">{slot.templateName}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Mandatory — not yet uploaded{slot.siteName ? ` · ${slot.siteName}` : ""}{isPrivilegedUser ? " — click to upload" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory</Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">Missing</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            </DroppableFolderZone>
          )}
          </>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDoc && (
            <div className="flex items-center gap-2 bg-background border shadow-lg rounded-md px-3 py-2 opacity-90 pointer-events-none">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{activeDoc.title}</span>
            </div>
          )}
        </DragOverlay>
        </DndContext>
      )}

      {/* Table View */}
      {viewMode === "table" && (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-documents"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-document-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="approval_required">Approval Required</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              {moduleFolderTemplates.length > 0 && (
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger className="w-44" data-testid="select-folder-filter">
                    <SelectValue placeholder="Folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Folders</SelectItem>
                    <SelectItem value="unfiled">Unfiled</SelectItem>
                    {moduleFolderTemplates.map((folder) => (
                      <SelectItem key={folder.id} value={folder.name}>{folder.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={renewalFilter} onValueChange={setRenewalFilter}>
                <SelectTrigger className="w-44" data-testid="select-renewal-filter">
                  <SelectValue placeholder="Renewal Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Renewals</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="30days">Next 30 Days</SelectItem>
                  <SelectItem value="60days">Next 60 Days</SelectItem>
                  <SelectItem value="90days">Next 90 Days</SelectItem>
                  <SelectItem value="none">No Renewal Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <FetchingOverlay />
          ) : filteredDocuments && filteredDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort("title")} className="cursor-pointer select-none whitespace-nowrap min-w-[240px]">
                    <span className="flex items-center gap-2">
                      Document
                      {sortBy === "title" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                      <span className="ml-1 text-xs font-normal text-muted-foreground normal-case">
                        {expandedTableDocuments.length} Documents
                      </span>
                    </span>
                  </TableHead>
                  <TableHead className="w-28 whitespace-nowrap">Compliance</TableHead>
                  <TableHead onClick={() => handleSort("renewalPeriodMonths")} className="cursor-pointer select-none whitespace-nowrap w-20">
                    <span className="flex items-center gap-1">
                      Period
                      {sortBy === "renewalPeriodMonths" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                  <TableHead onClick={() => handleSort("renewalDate")} className="cursor-pointer select-none whitespace-nowrap w-24">
                    <span className="flex items-center gap-1">
                      Renews
                      {sortBy === "renewalDate" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                  <TableHead onClick={() => handleSort("expiryDate")} className="cursor-pointer select-none whitespace-nowrap w-24">
                    <span className="flex items-center gap-1">
                      Expires
                      {sortBy === "expiryDate" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                  <TableHead onClick={() => handleSort("status")} className="cursor-pointer select-none whitespace-nowrap w-32">
                    <span className="flex items-center gap-1">
                      Status
                      {sortBy === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                  <TableHead onClick={() => handleSort("updatedAt")} className="cursor-pointer select-none whitespace-nowrap w-24">
                    <span className="flex items-center gap-1">
                      Modified
                      {sortBy === "updatedAt" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronDown className="h-3 w-3 opacity-30" />}
                    </span>
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expandedTableDocuments.map(({ doc, rowKey }) => {
                  // When viewed in a company/group-scoped page, a doc whose native scope
                  // (or owning entity) differs from the URL scope is being shown via a
                  // share — render it read-only with a clear "linked from group/company"
                  // indication, even if the server hasn't pre-flagged it as a shared link.
                  const viewedAsLinked = !!(
                    urlScope &&
                    urlEntityId &&
                    (
                      (doc as any).scope !== urlScope ||
                      (doc as any).entityId !== urlEntityId
                    )
                  );
                  // A doc is group/company-scoped if siteId is null, or was null before
                  // per-site expansion (expansion sets siteId to the target site but
                  // preserves _originalSiteIdWasNull). isSharedLink is false for origin/
                  // admin users even on genuine shared docs, so we can't rely on it alone.
                  const isGroupOrCompanyScoped = (doc.siteId === null || !!(doc as any)._originalSiteIdWasNull) &&
                    ((doc as any).scope === "group" || (doc as any).scope === "company");
                  const isLinkedRow = viewedAsLinked || !!doc.isSharedLink || isGroupOrCompanyScoped;
                  const linkedFromScope: "group" | "company" | null = viewedAsLinked
                    ? ((doc as any).scope === "group" ? "group" : "company")
                    : (doc.sharedScope === "group" ? "group" : doc.sharedScope === "company" ? "company"
                      : ((doc as any).scope === "group" ? "group" : (doc as any).scope === "company" ? "company" : null));
                  return (
                  <TableRow key={rowKey} className="hover-elevate" data-testid={`row-document-${rowKey}`}>
                    <TableCell>
                      <Link href={`${basePath}/documents/${doc.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {docMetaLine(doc)}
                          </p>
                          {isLinkedRow ? (
                            <Badge variant="outline" className={`mt-1 text-xs ${linkedFromScope === "group" ? "border-purple-400 text-purple-600 dark:text-purple-400" : "border-blue-400 text-blue-600 dark:text-blue-400"}`} title={doc.sharedFromEntityName ? `Source: ${doc.sharedFromEntityName}` : undefined} data-testid={`badge-linked-${doc.id}`}>
                              <LinkIcon className="h-3 w-3 mr-1" />
                              Shared from {linkedFromScope === "group" ? "Group" : "Company"}{doc.sharedFromEntityName ? `: ${doc.sharedFromEntityName}` : ""}
                            </Badge>
                          ) : null}
                          {doc.isArchived && (
                            <Badge variant="secondary" className="mt-1 gap-1 bg-muted">
                              <Archive className="h-3 w-3" />
                              Archived
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                    </TableCell>
                    <TableCell>
                      {(doc as any).renewalPeriodMonths ? (
                        <Badge variant="secondary">{(doc as any).renewalPeriodMonths}mo</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(doc as any).renewalDate ? (
                        <span className="text-sm">{format(new Date((doc as any).renewalDate), "d MMM yyyy")}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(doc as any).expiryDate ? (
                        <span className="text-sm">{format(new Date((doc as any).expiryDate), "d MMM yyyy")}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={(doc as any).expiryDate} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {doc.updatedAt && format(new Date(doc.updatedAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${doc.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`${basePath}/documents/${doc.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {isLinkedRow && (
                            <DropdownMenuItem asChild>
                              <Link href={`/documents/${doc.id}`} data-testid={`link-view-source-${doc.id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Source Document
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            if (!doc.fileUrl) {
                              toast({ title: "File not available", description: "This document needs to be re-uploaded.", variant: "destructive" });
                              return;
                            }
                            downloadDocument(doc.id, doc.fileName);
                          }}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          {isPrivilegedUser && !doc.isSharedLink && (
                            <>
                              <DropdownMenuSeparator />
                              {doc.isArchived ? (
                                <DropdownMenuItem 
                                  onClick={() => restoreMutation.mutate(doc.id)}
                                  disabled={restoreMutation.isPending}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Restore from Archive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => archiveMutationList.mutate(doc.id)}
                                  disabled={archiveMutationList.isPending}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {/* Missing required document slots — shown only when no active search/status/folder/renewal filters */}
                {!searchQuery && statusFilter === "all" && folderFilter === "all" && renewalFilter === "all" && tableMissingSlots.map((slot) => (
                  <TableRow key={slot.templateId} className={`bg-amber-50/50 dark:bg-amber-950/10 border-dashed ${isPrivilegedUser ? "cursor-pointer hover:bg-amber-100/70 dark:hover:bg-amber-900/20" : ""}`} data-testid={`row-missing-${slot.templateId}`} onClick={isPrivilegedUser ? () => navigate(getMissingSlotUrl(slot)) : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30 border-2 border-dashed border-amber-300 dark:border-amber-700">
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">{slot.templateName}</p>
                          <p className="text-sm text-amber-600 dark:text-amber-400">Mandatory — not yet uploaded{slot.siteName ? ` · ${slot.siteName}` : ""}{isPrivilegedUser ? " — click to upload" : ""}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory — Missing</Badge>
                    </TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : missingSlots.length > 0 && !searchQuery && statusFilter === "all" && folderFilter === "all" && renewalFilter === "all" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Document</TableHead>
                  <TableHead className="w-28 whitespace-nowrap">Compliance</TableHead>
                  <TableHead className="w-20 whitespace-nowrap">Period</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">Renews</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">Expires</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Status</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">Modified</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableMissingSlots.map((slot) => (
                  <TableRow key={slot.templateId} className={`bg-amber-50/50 dark:bg-amber-950/10 ${isPrivilegedUser ? "cursor-pointer hover:bg-amber-100/70 dark:hover:bg-amber-900/20" : ""}`} data-testid={`row-missing-${slot.templateId}`} onClick={isPrivilegedUser ? () => navigate(getMissingSlotUrl(slot)) : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30 border-2 border-dashed border-amber-300 dark:border-amber-700">
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">{slot.templateName}</p>
                          <p className="text-sm text-amber-600 dark:text-amber-400">Mandatory — not yet uploaded{slot.siteName ? ` · ${slot.siteName}` : ""}{isPrivilegedUser ? " — click to upload" : ""}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 text-xs">Mandatory — Missing</Badge>
                    </TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell><span className="text-muted-foreground text-sm">—</span></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || renewalFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : isPrivilegedUser
                    ? `Upload your first ${config.shortName} document to get started`
                    : "No documents have been added yet"}
              </p>
              {isPrivilegedUser && hasSpecificContext && (
                <Button className="mt-4" asChild>
                  <Link href={getUploadUrl()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      </div>

      {/* Archived Documents Dialog */}
      <Dialog open={archivedDialogOpen} onOpenChange={setArchivedDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Archived Documents
            </DialogTitle>
            <DialogDescription>
              Documents that have been archived for this module. You can restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {isLoadingArchived ? (
              <FetchingOverlay />
            ) : !archivedDocuments || archivedDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Archive className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No archived documents</p>
                <p className="text-xs mt-1">Archived documents will appear here</p>
              </div>
            ) : (
              archivedDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.fileName}{(doc as any).approvedVersion ? ` · v${(doc as any).approvedVersion}` : doc.version ? ` · v${doc.version}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Link href={`${basePath}/documents/${doc.id}`} onClick={() => setArchivedDialogOpen(false)}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        restoreMutation.mutate(doc.id);
                        setArchivedDialogOpen(false);
                      }}
                    >
                      Restore
                    </Button>
                    {user?.role === "admin" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDocumentToDelete({id: doc.id, title: doc.title})}
                        disabled={deleteFromListMutation.isPending}
                        data-testid={`button-delete-archived-${doc.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Document
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{documentToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (documentToDelete) {
                  deleteFromListMutation.mutate(documentToDelete.id);
                  setDocumentToDelete(null);
                }
              }}
              disabled={deleteFromListMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

interface ShareRecord {
  id: string;
  documentId: string;
  entityType: "site" | "company";
  entityId: string;
  entityName: string | null;
}

interface ShareCandidate {
  id: string;
  name: string;
}

function DocumentSharingCard({
  documentId,
  scope,
  ownerEntityId,
}: {
  documentId: string;
  scope: "company" | "group";
  ownerEntityId: string;
}) {
  const { toast } = useToast();
  const [selectedToAdd, setSelectedToAdd] = useState<string>("");

  const sharesKey = ["/api/documents", documentId, "shares"] as const;

  const { data: shares = [], isLoading: loadingShares } = useQuery<ShareRecord[]>({
    queryKey: sharesKey,
  });

  const candidatesUrl =
    scope === "group"
      ? `/api/companies?groupOwnerId=${ownerEntityId}`
      : `/api/sites?companyId=${ownerEntityId}`;

  const { data: candidatesRaw } = useQuery<any>({
    queryKey: [candidatesUrl],
  });

  const candidatesList: any[] = Array.isArray(candidatesRaw)
    ? candidatesRaw
    : Array.isArray(candidatesRaw?.companies)
      ? candidatesRaw.companies
      : Array.isArray(candidatesRaw?.sites)
        ? candidatesRaw.sites
        : Array.isArray(candidatesRaw?.data)
          ? candidatesRaw.data
          : [];

  const candidates: ShareCandidate[] = candidatesList
    .filter((c: any) => c.id !== ownerEntityId)
    .map((c: any) => ({ id: c.id, name: c.name }));

  const sharedIds = new Set(shares.map((s) => s.entityId));
  const available = candidates.filter((c) => !sharedIds.has(c.id));

  const invalidateAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: sharesKey });
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
  };

  const addShare = useMutation({
    mutationFn: async (entityId: string) => {
      const entityType = scope === "group" ? "company" : "site";
      const res = await apiRequest("POST", `/api/documents/${documentId}/shares`, {
        entityType,
        entityId,
      });
      return res.json();
    },
    onSuccess: () => {
      setSelectedToAdd("");
      invalidateAfterChange();
      toast({ title: scope === "group" ? "Company added" : "Site added", description: "Compliance scores will update shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not share document", description: err.message, variant: "destructive" });
    },
  });

  const removeShare = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await apiRequest("DELETE", `/api/documents/${documentId}/shares/${entityId}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterChange();
      toast({ title: scope === "group" ? "Company removed" : "Site removed", description: "Compliance scores will update shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove share", description: err.message, variant: "destructive" });
    },
  });

  const targetLabel = scope === "group" ? "Companies" : "Sites";
  const singularLabel = scope === "group" ? "company" : "site";

  return (
    <Card data-testid="card-document-sharing">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Shared {targetLabel}
        </CardTitle>
        <CardDescription>
          {scope === "group"
            ? "Companies in this group that count this document toward their compliance."
            : "Sites at this company that count this document toward their compliance."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingShares ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not shared with any {singularLabel} yet.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {shares.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
                data-testid={`row-share-${s.entityId}`}
              >
                <span className="text-sm truncate" title={s.entityName ?? undefined}>
                  {s.entityName ?? s.entityId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Remove this ${singularLabel} from the shared document? Their compliance score will be recalculated.`)) {
                      removeShare.mutate(s.entityId);
                    }
                  }}
                  disabled={removeShare.isPending || shares.length <= 1}
                  title={shares.length <= 1 ? `At least one ${singularLabel} must remain shared` : `Remove ${singularLabel}`}
                  data-testid={`button-remove-share-${s.entityId}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
            <SelectTrigger className="flex-1" data-testid="select-add-share">
              <SelectValue placeholder={available.length ? `Add ${singularLabel}…` : `All ${targetLabel.toLowerCase()} already shared`} />
            </SelectTrigger>
            <SelectContent>
              {available.map((c) => (
                <SelectItem key={c.id} value={c.id} data-testid={`option-share-${c.id}`}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => selectedToAdd && addShare.mutate(selectedToAdd)}
            disabled={!selectedToAdd || addShare.isPending}
            data-testid="button-add-share"
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleDocumentDetailView({ id, module }: { id: string; module: ModuleType }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const isClientUser = user?.role === "client";
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "changes">("approve");
  const [feedback, setFeedback] = useState("");
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const ALL_AUDIT_TYPES = ["uploads", "approvals", "views", "downloads", "emails", "other"] as const;
  const [auditTypeFilter, setAuditTypeFilter] = useState<Set<string>>(new Set(ALL_AUDIT_TYPES));
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [showUploadVersionDialog, setShowUploadVersionDialog] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<{ objectPath: string; fileName: string; fileSize: number; mimeType: string } | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [reissueNote, setReissueNote] = useState("");
  const [reissueBase, setReissueBase] = useState<"today" | "last_approval">("today");
  const [reissueRenewalMonths, setReissueRenewalMonths] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedNewApprover, setSelectedNewApprover] = useState("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [editComplianceMode, setEditComplianceMode] = useState<"none" | "renewal" | "expiry">("none");
  const [editRenewalPeriodMonths, setEditRenewalPeriodMonths] = useState<number | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [editIsRequired, setEditIsRequired] = useState(false);
  const [complianceDirty, setComplianceDirty] = useState(false);

  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "human_resources" ? "/human-resources" : module === "employment_law" ? "/employment-law" : "/training";

  const { data: document, isLoading } = useQuery<DocumentWithDetails>({
    queryKey: ["/api/documents", id],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/documents", id, "audit"],
  });

  // Fire the view-log POST exactly once per document (keyed on the route id prop,
  // which is stable across window-focus refetches and only changes on navigation).
  useEffect(() => {
    if (!id) return;
    apiRequest("POST", `/api/documents/${id}/view`).catch(() => {});
  }, [id]);

  // Fetch site folders so we can show folder/subfolder path instead of doc type
  const { data: detailSiteFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", document?.siteId, module],
    queryFn: async () => {
      const res = await fetch(`/api/folders?siteId=${document!.siteId}&module=${module}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!document?.siteId,
  });

  const detailFolderPathMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!detailSiteFolders) return map;
    for (const folder of detailSiteFolders) {
      if (folder.parentId) {
        const parent = detailSiteFolders.find(f => f.id === folder.parentId);
        map.set(folder.id, parent ? `${parent.name} / ${folder.name}` : folder.name);
      } else {
        map.set(folder.id, folder.name);
      }
    }
    return map;
  }, [detailSiteFolders]);

  const getFolderPath = (folderId?: string | null) => {
    if (!folderId) return "—";
    return detailFolderPathMap.get(folderId) || "—";
  };

  const { data: templates } = useQuery<any[]>({
    queryKey: ["/api/document-templates"],
    enabled: !!document?.templateId,
  });

  const { data: companyRequiredTemplates } = useQuery<any[]>({
    queryKey: ["/api/companies", document?.entityId, "required-templates"],
    enabled: !!document?.entityId && !!document?.templateId && isPrivilegedUser,
  });

  const isRequiredTemplate = useMemo(() => {
    if (!document?.templateId || !companyRequiredTemplates) return false;
    return companyRequiredTemplates.some((rt: any) => rt.templateId === document.templateId);
  }, [document?.templateId, companyRequiredTemplates]);

  const requiredTemplateName = useMemo(() => {
    if (!isRequiredTemplate || !templates || !document?.templateId) return null;
    const tmpl = templates.find((t: any) => t.id === document.templateId);
    return tmpl?.name ?? null;
  }, [isRequiredTemplate, templates, document?.templateId]);

  const effectivelyRequired = editIsRequired || isRequiredTemplate;

  const isDocumentScoped = !!document && !document.siteId && (document.scope === "company" || document.scope === "group");
  const documentEntityId = document?.entityId;

  const approvalInProgress = document?.approvalStatus === "pending" || document?.approvalStatus === "client_signed_off";

  const { data: siteUsers } = useQuery<Array<{ id: string; fullName: string; email: string; role: string; status: string; companyId?: string }>>({
    queryKey: ["/api/sites", document?.siteId, "users"],
    enabled: !!document?.siteId && isPrivilegedUser && approvalInProgress,
  });

  const { data: allUsersForApproval } = useQuery<Array<{ id: string; fullName: string; email: string; role: string; status: string; companyId?: string }>>({
    queryKey: ["/api/users"],
    enabled: isDocumentScoped && isPrivilegedUser && approvalInProgress,
  });

  const siteClientUsers = useMemo(() => {
    if (isDocumentScoped) {
      return (allUsersForApproval ?? []).filter(u => u.role === "client" && u.companyId === documentEntityId);
    }
    if (!siteUsers) return [];
    return siteUsers.filter(u => u.role === "client");
  }, [siteUsers, allUsersForApproval, isDocumentScoped, documentEntityId]);

  useEffect(() => {
    if (document) {
      if (document.expiryDate) {
        setEditComplianceMode("expiry");
        setEditExpiryDate(format(new Date(document.expiryDate), "yyyy-MM-dd"));
        setEditRenewalPeriodMonths(null);
      } else if (document.renewalDate) {
        setEditComplianceMode("renewal");
        setEditExpiryDate("");
        setEditRenewalPeriodMonths(document.renewalPeriodMonths ?? null);
      } else {
        setEditComplianceMode("none");
        setEditExpiryDate("");
        setEditRenewalPeriodMonths(null);
      }
      setEditIsRequired(document.isMandatory);
      setComplianceDirty(false);
    }
  }, [document?.id, document?.isMandatory, document?.expiryDate, document?.renewalDate, document?.renewalPeriodMonths]);

  const invalidateComplianceCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
    queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
    queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
    queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
    queryClient.invalidateQueries({
      refetchType: "all",
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && key[0].includes("documents-hierarchy");
      },
    });
  };

  const isRequiredMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      return apiRequest("PATCH", `/api/documents/${id}`, { isMandatory: checked });
    },
    onMutate: (checked: boolean) => {
      const previous = editIsRequired;
      setEditIsRequired(checked);
      return { previous };
    },
    onSuccess: () => {
      invalidateComplianceCaches();
      toast({ title: "Compliance updated", description: "Mandatory for compliance setting has been saved." });
    },
    onError: (error: Error, _vars, context) => {
      if (context) setEditIsRequired(context.previous);
      toast({ title: "Error", description: error.message || "Failed to update compliance setting", variant: "destructive" });
    },
  });

  const complianceUpdateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {};
      if (!isRequiredTemplate) {
        body.isMandatory = editIsRequired;
      }
      if (editComplianceMode === "none") {
        body.expiryDate = null;
        body.renewalDate = null;
        body.renewalPeriodMonths = null;
      } else if (editComplianceMode === "renewal" && editRenewalPeriodMonths) {
        body.expiryDate = null;
        body.renewalPeriodMonths = editRenewalPeriodMonths;
        // renewalDate is calculated server-side from lastApprovedAt + renewalPeriodMonths
      } else if (editComplianceMode === "expiry" && editExpiryDate) {
        body.renewalPeriodMonths = null;
        body.renewalDate = null;
        body.expiryDate = editExpiryDate;
      }
      return apiRequest("PATCH", `/api/documents/${id}`, body);
    },
    onSuccess: () => {
      invalidateComplianceCaches();
      setComplianceDirty(false);
      toast({ title: "Compliance tracking updated", description: "The document compliance settings have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update compliance tracking", variant: "destructive" });
    },
  });

  const approvalNotifications = useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs
      .filter(log => log.action === "email_sent" && log.details?.includes("Approval notification email sent to"))
      .map(log => {
        const match = log.details?.match(/sent to (.+?) \((.+?)\)/);
        return {
          id: log.id,
          name: match?.[1] || "Unknown",
          email: match?.[2] || "",
          sentAt: log.createdAt,
          sentBy: log.userName,
        };
      });
  }, [auditLogs]);

  const resendNotifyMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/documents/${id}/approval-notify`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      toast({
        title: "Notification Sent",
        description: "Approval notification email has been sent",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: { action: string; feedback?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/approval`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      setShowApprovalDialog(false);
      setFeedback("");
      toast({
        title: "Success",
        description: `Document has been ${approvalAction === "approve" ? "approved" : "returned for changes"}`,
      });
    },
    onError: (error: Error) => {
      // Try to parse the error message to get the detailed message from the API
      let errorTitle = "Error";
      let errorDescription = "Failed to update document approval status";
      
      try {
        // Error message format is "400: {json}" - extract the JSON part
        const jsonMatch = error.message.match(/^\d+:\s*(.+)$/);
        if (jsonMatch) {
          const errorData = JSON.parse(jsonMatch[1]);
          errorTitle = errorData.error || errorTitle;
          errorDescription = errorData.message || errorData.error || errorDescription;
        } else {
          errorDescription = error.message || errorDescription;
        }
      } catch {
        errorDescription = error.message || errorDescription;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    },
  });

  const handleApproval = () => {
    approvalMutation.mutate({ action: approvalAction, feedback });
  };

  const uploadVersionMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileUrl: string; fileSize: number; mimeType: string; changeNote?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/versions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "versions"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      setShowUploadVersionDialog(false);
      setNewVersionFile(null);
      setChangeNote("");
      toast({
        title: "Success",
        description: "New version uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload new version",
        variant: "destructive",
      });
    },
  });

  const handleUploadVersion = () => {
    if (!newVersionFile) return;
    uploadVersionMutation.mutate({
      fileName: newVersionFile.fileName,
      fileUrl: newVersionFile.objectPath,
      fileSize: newVersionFile.fileSize,
      mimeType: newVersionFile.mimeType,
      changeNote: changeNote || undefined,
    });
  };

  const archiveMutation = useMutation({
    mutationFn: async (data: { reason?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/archive`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({
        refetchType: "all",
        predicate: (query) => query.queryKey.some(
          (key) => typeof key === 'string' && key.includes('documents-hierarchy')
        )
      });
      setShowArchiveDialog(false);
      setArchiveReason("");
      toast({
        title: "Document archived",
        description: "The document has been archived successfully.",
      });
      navigate(`${basePath}/documents`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive document",
        variant: "destructive",
      });
    },
  });

  const handleArchive = () => {
    archiveMutation.mutate({ reason: archiveReason || undefined });
  };

  const reissueMutation = useMutation({
    mutationFn: async (data: { renewalBase?: string; note?: string; renewalPeriodMonths?: number | null }) => {
      return apiRequest("POST", `/api/documents/${id}/reissue`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.removeQueries({ queryKey: ["/api/dashboard", module] });
      // Immediately sync the Renewal & Expiry edit state to match the chosen period
      if ("renewalPeriodMonths" in variables) {
        if (variables.renewalPeriodMonths != null) {
          setEditComplianceMode("renewal");
          setEditRenewalPeriodMonths(variables.renewalPeriodMonths);
        } else {
          setEditComplianceMode("none");
          setEditRenewalPeriodMonths(null);
        }
        setEditExpiryDate("");
        setComplianceDirty(false);
      }
      setShowReissueDialog(false);
      setReissueNote("");
      setReissueBase("today");
      toast({ title: "Document re-issued", description: "The document has been re-issued and marked as approved." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to re-issue document", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/documents/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      toast({
        title: "Document restored",
        description: "The document has been restored from the archive.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"], refetchType: "all" });
      toast({ title: "Document deleted", description: "The document has been permanently deleted." });
      navigate(`${basePath}/documents`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete document", variant: "destructive" });
    },
  });

  const getDocTypeLabel = (type: string, documentTypeId?: string | null) => {
    if (documentTypeId) {
      return type.replace(/_/g, " ");
    }
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  if (isLoading) {
    return <FetchingOverlay />;
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold">Document not found</h2>
        <Button className="mt-4" asChild>
          <Link href={`${basePath}/documents`}>Back to Documents</Link>
        </Button>
      </div>
    );
  }

  // Re-issue dialog helpers
  const reissueLastApproved = document.lastApprovedAt ? new Date(document.lastApprovedAt) : null;
  const reissueIsToday = reissueLastApproved?.toDateString() === new Date().toDateString();
  const showReissueBaseChoice = !!(reissueLastApproved && !reissueIsToday && reissueRenewalMonths !== null);
  const getReissuePreview = (base: "today" | "last_approval"): Date | null => {
    if (!reissueRenewalMonths) return null;
    const start = base === "last_approval" && reissueLastApproved ? new Date(reissueLastApproved) : new Date();
    const d = new Date(start);
    d.setMonth(d.getMonth() + reissueRenewalMonths);
    return d;
  };
  const reissuePreview = getReissuePreview(reissueBase);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`${basePath}/documents`} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{document.title}</h1>
            {document.isArchived && (
              <Badge variant="secondary" className="gap-1 bg-muted">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {(() => {
              const av = (document as any).approvedVersion ?? 0;
              const draftCount = document.versions?.filter((v: any) => v.isDraft).length ?? 0;
              const label = document.approvalStatus === "approved"
                ? `v${av > 0 ? av : document.version}`
                : `v${av}.${draftCount + 1}`;
              return label;
            })()} - {getFolderPath((document as any).folderId)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ComplianceBadge isMandatory={document.isMandatory} status={document.status} approvalStatus={document.approvalStatus} />
          <DocumentStatusBadge status={document.status} approvalStatus={document.approvalStatus} expiryDate={(document as any).expiryDate} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Document Details</CardTitle>
              <Badge variant="outline" className="text-sm font-semibold">
                {(() => {
                  const av = (document as any).approvedVersion ?? 0;
                  const draftCount = document.versions?.filter((v: any) => v.isDraft).length ?? 0;
                  return document.approvalStatus === "approved"
                    ? `v${av > 0 ? av : document.version}`
                    : `Draft v${av}.${draftCount + 1}`;
                })()}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company</p>
                  <p>{document.companyName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Site</p>
                  <p>{document.siteName || "All Sites"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File</p>
                  <p>{decodeURIComponent(document.fileName)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File Size</p>
                  <p>{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p>{document.updatedAt ? format(new Date(document.updatedAt), "MMM d, yyyy 'at' h:mm a") : "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Uploaded By</p>
                  <p>{document.uploadedByName || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p>{getFolderPath((document as any).folderId)}</p>
                </div>
              </div>
              {document.templateId && (() => {
                const template = templates?.find((t: any) => t.id === document.templateId);
                return template ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Template</p>
                    <p className="mt-1">{template.name}</p>
                  </div>
                ) : null;
              })()}
              {document.comments && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Comments</p>
                  <p className="mt-1">{document.comments}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {(document.approvalStatus === "pending" || document.approvalStatus === "client_signed_off") && !document.isArchived && (() => {
            const isClient = user?.role === "client";
            const isConsultantOrAdmin = user?.role === "consultant" || user?.role === "admin";
            const isPending = document.approvalStatus === "pending";
            const isSignedOff = document.approvalStatus === "client_signed_off";

            const clientHasApprovalPermission = isClient &&
              (user?.clientPermissionRole === "full" || user?.isGroupPrimaryContact);

            // Only the designated approver (or any client if no one was designated) can act
            const isDesignatedApprover = !(document as any).approvalRequestedFrom || (document as any).approvalRequestedFrom === user?.id;
            const canClientAct = isClient && clientHasApprovalPermission && isPending && isDesignatedApprover;
            // Consultants/admins can act on client_signed_off docs (final approval) or pending client-uploaded docs
            const canConsultantAct = isConsultantOrAdmin && (isSignedOff || (isPending && (document as any).uploaderRole === "client"));

            if (!canClientAct && !canConsultantAct) {
              if (isClient && isSignedOff) {
                return (
                  <Card className="border-2 border-blue-400 dark:border-blue-600 bg-blue-100/80 dark:bg-blue-900/25" data-testid="card-awaiting-final-approval">
                    <CardHeader>
                      <CardTitle className="text-blue-800 dark:text-blue-300">Awaiting Final Approval</CardTitle>
                      <CardDescription className="text-blue-700/80 dark:text-blue-400/80">
                        You have signed off on this document. It is now awaiting final approval from the consultant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="w-fit">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Client signed off — awaiting consultant final approval
                      </Badge>
                    </CardContent>
                  </Card>
                );
              }
              if (isClient && isPending && !isDesignatedApprover) {
                return (
                  <Card className="border-2 border-amber-400 dark:border-amber-600 bg-amber-100/80 dark:bg-amber-900/25" data-testid="card-awaiting-designated-approver">
                    <CardHeader>
                      <CardTitle className="text-amber-800 dark:text-amber-300">Awaiting Sign-Off</CardTitle>
                      <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                        This document has been sent to a designated person for sign-off. Only that person can approve or request changes.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              }
              // Consultants/admins viewing a pending consultant-uploaded doc fall through
              // to the informational card (with notification panel, but no action buttons).
              if (!isConsultantOrAdmin || !isPending) return null;
            }

            const getTitle = () => {
              if (canClientAct) return "Client Sign-Off";
              if (isSignedOff) return "Final Approval";
              if (isConsultantOrAdmin && isPending && !canConsultantAct) return "Awaiting Client Sign-Off";
              return "Approval Actions";
            };

            const getDescription = () => {
              if (canClientAct) return "Review and sign off on this document to confirm you've received and read it";
              if (isSignedOff) return "The client has signed off. Give final approval to complete the workflow";
              if (canConsultantAct && isPending) return "Review and approve this client-uploaded document";
              if (isConsultantOrAdmin && isPending && !canConsultantAct) return "This document has been submitted and is awaiting the client's review and sign-off. You can resend the notification below.";
              return "Review and approve this document";
            };

            const getApproveLabel = () => {
              if (canClientAct) return "Sign Off";
              if (isSignedOff) return "Final Approval";
              return "Approve";
            };

            const cardColor = isSignedOff
              ? "border-2 border-blue-400 dark:border-blue-600 bg-blue-100/80 dark:bg-blue-900/25"
              : "border-2 border-amber-400 dark:border-amber-600 bg-amber-100/80 dark:bg-amber-900/25";

            const titleColor = isSignedOff
              ? "text-blue-800 dark:text-blue-300"
              : "text-amber-800 dark:text-amber-300";

            const descColor = isSignedOff
              ? "text-blue-700/80 dark:text-blue-400/80"
              : "text-amber-700/80 dark:text-amber-400/80";

            return (
              <Card className={cardColor}>
                <CardHeader>
                  <CardTitle className={titleColor}>{getTitle()}</CardTitle>
                  <CardDescription className={descColor}>{getDescription()}</CardDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-semibold">
                      {(() => {
                        const av = (document as any).approvedVersion ?? 0;
                        const draftCount = document.versions?.filter((v: any) => v.isDraft).length ?? 0;
                        return document.approvalStatus === "approved"
                          ? `v${av > 0 ? av : document.version}`
                          : `Draft v${av}.${draftCount + 1}`;
                      })()}
                    </Badge>
                    {isSignedOff && (
                      <Badge variant="secondary">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Client signed off — awaiting final approval
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isPrivilegedUser && isPending && (
                    <div className="rounded-lg border p-4 space-y-3" data-testid="approval-notifications-section">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Approval Notifications</span>
                      </div>

                      {approvalNotifications.length > 0 ? (
                        <div className="space-y-2">
                          {approvalNotifications.map((notif) => (
                            <div key={notif.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{notif.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{notif.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Sent {new Date(notif.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} by {notif.sentBy}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resendNotifyMutation.isPending}
                                onClick={() => {
                                  const matchingUser = siteClientUsers.find(u => u.email === notif.email);
                                  if (matchingUser) {
                                    resendNotifyMutation.mutate(matchingUser.id);
                                  }
                                }}
                                data-testid={`button-resend-${notif.id}`}
                              >
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Resend
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No approval notifications have been sent yet.</p>
                      )}

                      <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground mb-2">Send approval notification to a different client user:</p>
                        <div className="flex flex-wrap gap-2">
                          <Select value={selectedNewApprover} onValueChange={setSelectedNewApprover}>
                            <SelectTrigger className="flex-1 min-w-[180px]" data-testid="select-new-approver">
                              <SelectValue placeholder="Select client user..." />
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
                                    <span>{u.fullName} ({u.email})</span>
                                    {u.status !== "active" && (
                                      <span className="text-xs text-muted-foreground">Not Active</span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                              {siteClientUsers.length === 0 && (
                                <SelectItem value="__none" disabled>
                                  {isDocumentScoped ? "No client users found for this company" : "No client users assigned to this site"}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            size="default"
                            variant="outline"
                            disabled={!selectedNewApprover || resendNotifyMutation.isPending}
                            onClick={() => {
                              if (selectedNewApprover) {
                                resendNotifyMutation.mutate(selectedNewApprover);
                                setSelectedNewApprover("");
                              }
                            }}
                            data-testid="button-send-new-approver"
                          >
                            <Send className="mr-1 h-4 w-4" />
                            Send Notification
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(canClientAct || canConsultantAct) && (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        className={isSignedOff ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
                        onClick={() => { setApprovalAction("approve"); setShowApprovalDialog(true); }}
                        data-testid="button-approve"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {getApproveLabel()}
                      </Button>
                      {!isSignedOff && (
                        <Button
                          variant="outline"
                          onClick={() => { setApprovalAction("changes"); setShowApprovalDialog(true); }}
                          data-testid="button-request-changes"
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Request Changes
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {document.approvalStatus === "changes_requested" && !document.isArchived && (() => {
            const changesLog = [...(auditLogs ?? [])]
              .filter(l => l.action === "changes_requested")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const feedback = changesLog?.details && changesLog.details.toLowerCase() !== "changes requested"
              ? changesLog.details
              : null;

            return (
              <Card className="border-2 border-orange-400 dark:border-orange-600 bg-orange-100/80 dark:bg-orange-900/25" data-testid="card-changes-requested">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                    <AlertTriangle className="h-5 w-5" />
                    {isClientUser ? "Changes Requested" : "New Version Required"}
                  </CardTitle>
                  <CardDescription className="text-orange-700/80 dark:text-orange-400/80">
                    {isClientUser
                      ? "You have requested changes to this document. Your consultant will review and upload a revised version."
                      : "The client has requested changes to this document. Upload a revised version to continue the approval workflow."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {changesLog && (
                    <div className="rounded-md border border-orange-300 dark:border-orange-700 bg-white/60 dark:bg-black/20 p-3 space-y-1">
                      <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
                        Feedback from {changesLog.userName}
                      </p>
                      <p className="text-sm text-orange-900 dark:text-orange-100">
                        {feedback ?? "No specific feedback provided."}
                      </p>
                      <p className="text-xs text-orange-700/60 dark:text-orange-400/60">
                        {format(new Date(changesLog.createdAt), "d MMM yyyy 'at' HH:mm")}
                      </p>
                    </div>
                  )}
                  {isPrivilegedUser && (
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={() => setShowUploadVersionDialog(true)}
                      data-testid="button-upload-version-changes"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Revised Version
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Approved summary card ────────────────────────────────── */}
          {document.approvalStatus === "approved" && !document.isArchived && (() => {
            // Pull the most-recent sign-off and approval entries from audit log
            const signOffLog = auditLogs?.find(l => l.action === "document_signed_off");
            const approvalLog = auditLogs?.find(l => l.action === "document_approved");
            const hasAnyEntry = signOffLog || approvalLog || document.lastApprovedAt;
            if (!hasAnyEntry) return null;
            // Reviewer comments: changes_requested entries with real feedback text
            const reviewerComments = [...(auditLogs ?? [])]
              .filter(l => l.action === "changes_requested" && l.details && l.details.toLowerCase() !== "changes requested")
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            return (
              <Card className="border-2 border-green-400 dark:border-green-600 bg-green-50/80 dark:bg-green-900/20" data-testid="card-document-approved">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    Document Approved
                  </CardTitle>
                  <CardDescription className="text-green-700/80 dark:text-green-400/80">
                    This document has completed the approval workflow and is compliant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {signOffLog && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Client Sign-Off</p>
                        <p className="text-sm text-muted-foreground">{signOffLog.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(signOffLog.createdAt), "d MMM yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    </div>
                  )}
                  {approvalLog && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Final Approval</p>
                        <p className="text-sm text-muted-foreground">{approvalLog.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(approvalLog.createdAt), "d MMM yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    </div>
                  )}
                  {!signOffLog && !approvalLog && document.lastApprovedAt && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Approved</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(document.lastApprovedAt), "d MMM yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    </div>
                  )}
                  {isPrivilegedUser && reviewerComments.length > 0 && (
                    <div className="border-t border-green-200 dark:border-green-800 pt-3 mt-1 space-y-2">
                      <p className="text-xs font-medium text-green-800 dark:text-green-300">Reviewer Comments</p>
                      {reviewerComments.map(log => (
                        <div key={log.id} className="rounded-md bg-white/60 dark:bg-black/20 border border-green-200 dark:border-green-800 px-3 py-2 space-y-0.5">
                          <p className="text-xs text-foreground break-words">"{log.details}"</p>
                          <p className="text-xs text-muted-foreground">— {log.userName}, {format(new Date(log.createdAt), "d MMM yyyy 'at' HH:mm")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Renewal due soon warning ──────────────────────────────── */}
          {document.approvalStatus === "approved" && document.renewalDate && !document.isArchived && (() => {
            const renewal = new Date(document.renewalDate);
            const now = new Date();
            const daysLeft = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 0 || daysLeft > 30) return null;
            return (
              <Card className="border-2 border-amber-400 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-900/20" data-testid="card-renewal-due-soon">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <Clock className="h-5 w-5" />
                    Review Due Soon
                  </CardTitle>
                  <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                    This document is due for review in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> ({format(renewal, "d MMM yyyy")}).{" "}
                    {isClientUser
                      ? "Your consultant will be in touch shortly to arrange a review."
                      : "Please arrange a review with the client and upload an updated version or re-issue as appropriate."}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })()}

          {auditLogs && auditLogs.length > 0 && (() => {
            const INITIAL_DISPLAY_COUNT = 5;

            const getActionStyle = (action: string) => {
              switch (action) {
                case 'document_uploaded':
                  return { icon: Upload, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400', label: 'Upload' };
                case 'document_approved':
                  return { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400', label: 'Approval' };
                case 'document_signed_off':
                  return { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400', label: 'Approval' };
                case 'document_rejected':
                  return { icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/40', color: 'text-red-600 dark:text-red-400', label: 'Approval' };
                case 'changes_requested':
                  return { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400', label: 'Approval' };
                case 'email_sent':
                  return { icon: Mail, bg: 'bg-indigo-100 dark:bg-indigo-900/40', color: 'text-indigo-600 dark:text-indigo-400', label: 'Email' };
                case 'document_viewed':
                  return { icon: Eye, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-600 dark:text-gray-400', label: 'View' };
                case 'document_downloaded':
                  return { icon: Download, bg: 'bg-purple-100 dark:bg-purple-900/40', color: 'text-purple-600 dark:text-purple-400', label: 'Download' };
                case 'version_uploaded':
                case 'document_version_uploaded':
                  return { icon: Upload, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400', label: 'Upload' };
                case 'document_archived':
                  return { icon: FileText, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-600 dark:text-gray-400', label: 'Archive' };
                default:
                  return { icon: FileText, bg: 'bg-muted', color: 'text-muted-foreground', label: 'Other' };
              }
            };

            const getActionLabel = (action: string) => {
              switch (action) {
                case 'document_uploaded': return 'Document uploaded';
                case 'document_version_uploaded':
                case 'version_uploaded': return 'New version uploaded';
                case 'document_approved': return 'Document approved';
                case 'document_signed_off': return 'Client signed off';
                case 'document_rejected': return 'Document rejected';
                case 'changes_requested': return 'Changes requested';
                case 'email_sent': return 'Email notification sent';
                case 'document_viewed': return 'Document viewed';
                case 'document_downloaded': return 'Document downloaded';
                case 'document_archived': return 'Document archived';
                default: return action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              }
            };

            // Map filter value → matching action strings
            const filterMap: Record<string, string[]> = {
              uploads:   ['document_uploaded', 'version_uploaded'],
              approvals: ['document_approved', 'document_signed_off', 'document_rejected', 'changes_requested'],
              views:     ['document_viewed'],
              downloads: ['document_downloaded'],
              emails:    ['email_sent'],
              other:     ['document_archived'],
            };

            // Sort newest first, then apply type filter
            const sortedAll = [...auditLogs].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const allTypesSelected = ALL_AUDIT_TYPES.every(k => auditTypeFilter.has(k));
            const filteredLogs = allTypesSelected
              ? sortedAll
              : sortedAll.filter(log =>
                  [...auditTypeFilter].some(key => (filterMap[key] ?? []).includes(log.action))
                );

            const displayedLogs = showAllAuditLogs ? filteredLogs : filteredLogs.slice(0, INITIAL_DISPLAY_COUNT);
            const hasMoreLogs = filteredLogs.length > INITIAL_DISPLAY_COUNT;

            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit Trail
                    <Badge variant="secondary" className="text-xs">{auditLogs.length}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" data-testid="button-audit-filter">
                          <Filter className="h-3 w-3 shrink-0" />
                          {allTypesSelected
                            ? "All types"
                            : auditTypeFilter.size === 1
                              ? ({"uploads":"Uploads","approvals":"Approvals","views":"Views","downloads":"Downloads","emails":"Emails","other":"Other"} as Record<string,string>)[
                                  [...auditTypeFilter][0]
                                ] ?? "1 selected"
                              : auditTypeFilter.size === 0
                                ? "None selected"
                                : `${auditTypeFilter.size} selected`}
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {([ ["uploads","Uploads"], ["approvals","Approvals"], ["views","Views"], ["downloads","Downloads"], ["emails","Emails"], ["other","Other"] ] as [string,string][]).map(([key, label]) => (
                          <DropdownMenuCheckboxItem
                            key={key}
                            checked={auditTypeFilter.has(key)}
                            onCheckedChange={(checked) => {
                              setAuditTypeFilter(prev => {
                                const next = new Set(prev);
                                checked ? next.add(key) : next.delete(key);
                                return next;
                              });
                              setShowAllAuditLogs(false);
                            }}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {label}
                          </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuSeparator />
                        <div className="flex">
                          {!allTypesSelected && (
                            <DropdownMenuItem
                              className="text-xs text-muted-foreground flex-1 justify-center"
                              onSelect={() => { setAuditTypeFilter(new Set(ALL_AUDIT_TYPES)); setShowAllAuditLogs(false); }}
                            >
                              Select all
                            </DropdownMenuItem>
                          )}
                          {auditTypeFilter.size > 0 && (
                            <DropdownMenuItem
                              className="text-xs text-muted-foreground flex-1 justify-center"
                              onSelect={() => { setAuditTypeFilter(new Set()); setShowAllAuditLogs(false); }}
                            >
                              Unselect all
                            </DropdownMenuItem>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const headers = ['Date', 'Time', 'User', 'Action', 'Details'];
                        const rows = auditLogs.map(log => [
                          format(new Date(log.createdAt), 'yyyy-MM-dd'),
                          format(new Date(log.createdAt), 'HH:mm:ss'),
                          log.userName,
                          log.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                          `"${(log.details ?? '').replace(/"/g, '""')}"`
                        ]);
                        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = window.document.createElement('a');
                        a.href = url;
                        a.download = `audit_trail_${document?.title?.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      data-testid="button-export-audit"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No entries match this filter.</p>
                  ) : (
                    <div className="space-y-4">
                      {displayedLogs.map((log) => {
                        const style = getActionStyle(log.action);
                        const ActionIcon = style.icon;
                        const details = log.details ?? '';
                        const isExpanded = expandedLogIds.has(log.id);

                        const toggleLog = () => setExpandedLogIds(prev => {
                          const next = new Set(prev);
                          isExpanded ? next.delete(log.id) : next.add(log.id);
                          return next;
                        });
                        // Only surface an expand link for entries where the user typed a message manually.
                        // Auto-generated detail strings (views, downloads, uploads, approvals) don't need it.
                        const AUTO_DETAIL_ACTIONS = new Set([
                          'document_viewed', 'document_downloaded', 'document_uploaded',
                          'document_approved', 'document_signed_off', 'document_rejected',
                          'email_sent', 'document_version_uploaded', 'version_uploaded',
                        ]);
                        const hasManualComment = !!details && !AUTO_DETAIL_ACTIONS.has(log.action);

                        // For email entries, parse metadata for a friendly type label and show details inline
                        const EMAIL_TYPE_LABELS: Record<string, string> = {
                          approval_notification: 'Approval requested',
                          sign_off_notification: 'Sign-off requested',
                          document_approved_notification: 'Approval confirmed',
                          invitation: 'User invited',
                        };
                        let emailMeta: { emailType?: string } = {};
                        if (log.action === 'email_sent' && log.metadata) {
                          try { emailMeta = JSON.parse(log.metadata); } catch { /* ignore */ }
                        }
                        const emailTypeLabel = emailMeta.emailType ? EMAIL_TYPE_LABELS[emailMeta.emailType] ?? null : null;

                        return (
                          <div key={log.id} className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                              <ActionIcon className={`h-4 w-4 ${style.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{getActionLabel(log.action)}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {log.userName} · {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
                                  {log.action === 'email_sent' && isExpanded && (emailTypeLabel || details) && (
                                    <div className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 space-y-0.5">
                                      {emailTypeLabel && (
                                        <p className="text-xs font-medium text-foreground">{emailTypeLabel}</p>
                                      )}
                                      {details && (
                                        <p className="text-xs text-muted-foreground break-words">{details}</p>
                                      )}
                                    </div>
                                  )}
                                  {isExpanded && hasManualComment && (
                                    <div className="mt-2 rounded-md bg-muted/60 px-3 py-2">
                                      <p className="text-xs text-foreground break-words whitespace-pre-wrap">{details}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <Badge variant="secondary" className="text-xs whitespace-nowrap">{style.label}</Badge>
                                  {hasManualComment && (
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={toggleLog}
                                      data-testid={`button-expand-log-${log.id}`}
                                    >
                                      {isExpanded ? 'Hide comment' : 'Expand to see comment'}
                                    </button>
                                  )}
                                  {log.action === 'email_sent' && (emailTypeLabel || details) && (
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={toggleLog}
                                      data-testid={`button-expand-log-${log.id}`}
                                    >
                                      {isExpanded ? 'Hide details' : 'See more'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {hasMoreLogs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setShowAllAuditLogs(!showAllAuditLogs)}
                      data-testid="button-toggle-audit-logs"
                    >
                      {showAllAuditLogs ? (
                        <>
                          <ChevronUp className="mr-2 h-4 w-4" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-2 h-4 w-4" />
                          Show {filteredLogs.length - INITIAL_DISPLAY_COUNT} More
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        <div className="space-y-6">
          {(() => {
            // Work out which file to surface as the "current" version.
            // If the document is approved → current fileUrl IS the approved file.
            // If not approved → use the most-recent non-draft snapshot from version history.
            // If no approved snapshot exists at all → current file is a draft.
            const isApproved = document.approvalStatus === "approved";
            const av = (document as any).approvedVersion ?? 0;
            const sortedSnapshots: any[] = (document.versions ?? []).slice();
            const latestApprovedSnapshot = !isApproved
              ? sortedSnapshots
                  .filter((v: any) => !v.isDraft)
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
              : null;
            const showingDraft = !isApproved && !latestApprovedSnapshot;
            const currentVersionLabel = isApproved
              ? `v${av > 0 ? av : document.version}`
              : latestApprovedSnapshot
                ? `v${(latestApprovedSnapshot as any).versionLabel ?? latestApprovedSnapshot.version}`
                : "Draft";

            const canPreview =
              document.mimeType === "application/pdf" ||
              document.mimeType?.startsWith("image/") ||
              document.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
              document.mimeType === "application/msword";

            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    Current Document Version
                    <Badge variant={showingDraft ? "secondary" : "default"} className="text-xs font-normal">
                      {currentVersionLabel}
                    </Badge>
                  </CardTitle>
                  {showingDraft && (
                    <CardDescription className="text-xs">
                      No approved version yet — this is the current draft
                    </CardDescription>
                  )}
                  {latestApprovedSnapshot && (
                    <CardDescription className="text-xs">
                      Latest approved version — a new draft is pending
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {canPreview && (document.fileUrl || latestApprovedSnapshot) && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      data-testid="button-preview"
                      onClick={() => {
                        setPreviewVersion(latestApprovedSnapshot ? latestApprovedSnapshot.version : null);
                        setShowPreviewDialog(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Document ({currentVersionLabel})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    data-testid="button-download"
                    onClick={() => {
                      if (!document.fileUrl && !latestApprovedSnapshot) {
                        toast({ title: "File not available", description: "This document was uploaded before file storage was enabled. Please re-upload the document.", variant: "destructive" });
                        return;
                      }
                      if (latestApprovedSnapshot) {
                        downloadDocument(id, latestApprovedSnapshot.fileName, latestApprovedSnapshot.version);
                      } else {
                        downloadDocument(id, document.fileName);
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download ({currentVersionLabel})
                  </Button>
                  {user?.role !== "client" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      data-testid="button-upload-version"
                      onClick={() => setShowUploadVersionDialog(true)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload New Version
                    </Button>
                  )}
                  {isPrivilegedUser && (
                    document.isArchived ? (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="button-restore-document"
                        onClick={() => restoreMutation.mutate()}
                        disabled={restoreMutation.isPending}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {restoreMutation.isPending ? "Restoring..." : "Restore from Archive"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        data-testid="button-archive-document"
                        onClick={() => setShowArchiveDialog(true)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Document
                      </Button>
                    )
                  )}
                  {user?.role === "admin" && (
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      data-testid="button-delete-document"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Document
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {isPrivilegedUser && !document.isArchived && (document.scope === "company" || document.scope === "group") && document.entityId && (
            <DocumentSharingCard
              documentId={document.id}
              scope={document.scope as "company" | "group"}
              ownerEntityId={document.entityId}
            />
          )}

          {!document.isArchived && (isPrivilegedUser || (isClientUser && (document.isMandatory || !!isRequiredTemplate))) && (
            <Card data-testid="card-compliance-tracking">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Compliance Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isRequiredTemplate && requiredTemplateName && (
                  <div className="flex items-center justify-between px-1 pb-1 border-b" data-testid="compliance-required-template">
                    <span className="text-sm text-muted-foreground">Template</span>
                    <span className="text-sm font-medium truncate ml-2" data-testid="text-required-template-name">{requiredTemplateName}</span>
                  </div>
                )}

                {/* Section 1: Required for Compliance */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mandatory for Compliance</p>
                  {isRequiredTemplate ? (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Mandatory</span>
                      <Badge variant="secondary" className="text-xs" data-testid="badge-mandatory-template">Mandatory (via template)</Badge>
                    </div>
                  ) : isClientUser ? (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Mandatory</span>
                      <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Yes</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Mandatory</span>
                      <Switch
                        checked={editIsRequired}
                        disabled={isRequiredMutation.isPending}
                        onCheckedChange={(checked) => { isRequiredMutation.mutate(checked); }}
                        data-testid="switch-is-required"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-border" />

                {/* Section 2: Document Status */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document Status</p>
                  {(() => {
                    if (!effectivelyRequired) {
                      return (
                        <div className="flex flex-col items-center gap-1 py-2.5 px-3 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-900/20 dark:border-gray-700" data-testid="compliance-status-indicator">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <ShieldCheck className="h-4 w-4" />
                            <span className="font-bold text-xs tracking-wider">NOT REQUIRED</span>
                          </div>
                          <span className="text-xs text-center text-gray-500/80 dark:text-gray-400/80">Excluded from compliance metrics</span>
                          {(document as any).renewalDate && (
                            <span className="text-xs text-gray-500/80 dark:text-gray-400/80">Renewal due {format(new Date((document as any).renewalDate), "d MMM yyyy")}</span>
                          )}
                        </div>
                      );
                    }
                    const now = new Date();
                    const isFullyCompliant = document.approvalStatus === "approved" && (document.status === "compliant" || document.status === "approved");
                    if (isFullyCompliant) {
                      return (
                        <div className="flex flex-col items-center gap-1 py-2.5 px-3 rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700" data-testid="compliance-status-indicator">
                          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-bold text-xs tracking-wider">COMPLIANT</span>
                          </div>
                          {document.expiryDate && (
                            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Expires {format(new Date(document.expiryDate), "d MMM yyyy")}</span>
                          )}
                          {document.renewalDate && (
                            <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Renewal due {format(new Date(document.renewalDate), "d MMM yyyy")}</span>
                          )}
                          {document.lastApprovedAt && (
                            <span className="text-xs text-emerald-600/60 dark:text-emerald-400/60 mt-0.5">Approved {format(new Date(document.lastApprovedAt), "d MMM yyyy")}</span>
                          )}
                        </div>
                      );
                    }
                    let reason = "";
                    if (document.approvalStatus !== "approved") {
                      reason = document.approvalStatus === "pending" ? "Awaiting client sign-off" :
                               document.approvalStatus === "client_signed_off" ? "Awaiting final approval" :
                               document.approvalStatus === "changes_requested" ? "Changes have been requested" :
                               "Review required";
                    } else if (document.status === "overdue" || (document.expiryDate && new Date(document.expiryDate) < now)) {
                      reason = document.expiryDate ? `Expired ${format(new Date(document.expiryDate), "d MMM yyyy")}` : "Document has expired";
                    } else if (document.renewalDate && new Date(document.renewalDate) < now) {
                      reason = `Renewal was due ${format(new Date(document.renewalDate), "d MMM yyyy")}`;
                    } else if (document.renewalDate) {
                      reason = `Renewal due ${format(new Date(document.renewalDate), "d MMM yyyy")}`;
                    } else {
                      reason = "Review required";
                    }
                    return (
                      <div className="flex flex-col items-center gap-1 py-2.5 px-3 rounded-md border-2 border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700" data-testid="compliance-status-indicator">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                          <span className="font-bold text-xs tracking-wider">NOT COMPLIANT</span>
                        </div>
                        <span className="text-xs text-center text-red-600/80 dark:text-red-400/80">{reason}</span>
                      </div>
                    );
                  })()}
                </div>

                {isPrivilegedUser && !document.isArchived && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setShowReissueDialog(true); setReissueRenewalMonths(document.renewalPeriodMonths ?? null); }}
                    data-testid="button-reissue"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-issue Document
                  </Button>
                )}

                <div className="border-t border-border" />

                {/* Section 3: Renewal & Expiry */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Renewal & Expiry</p>
                  {isClientUser ? (
                    <div className="flex items-center justify-between px-1 py-1" data-testid="compliance-renewal-readonly">
                      <span className="text-sm text-muted-foreground">
                        {document.renewalPeriodMonths
                          ? "Renewal period"
                          : document.expiryDate
                          ? "Expiry date"
                          : "No expiry or renewal"}
                      </span>
                      {document.renewalPeriodMonths ? (
                        <span className="text-sm font-medium">
                          {document.renewalPeriodMonths} {document.renewalPeriodMonths === 1 ? "month" : "months"}
                          {document.renewalDate && (
                            <span className="block text-right text-xs text-muted-foreground">Due {format(new Date(document.renewalDate), "d MMM yyyy")}</span>
                          )}
                        </span>
                      ) : document.expiryDate ? (
                        <span className="text-sm font-medium">{format(new Date(document.expiryDate), "d MMM yyyy")}</span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${editComplianceMode === "none" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-edit-compliance-none">
                        <input
                          type="radio"
                          name={`complianceModeEdit-${id}`}
                          value="none"
                          checked={editComplianceMode === "none"}
                          onChange={() => { setEditComplianceMode("none"); setEditRenewalPeriodMonths(null); setEditExpiryDate(""); setComplianceDirty(true); }}
                          className="accent-primary"
                        />
                        <span className="text-sm">No expiry or renewal</span>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${editComplianceMode === "renewal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-edit-compliance-renewal">
                        <input
                          type="radio"
                          name={`complianceModeEdit-${id}`}
                          value="renewal"
                          checked={editComplianceMode === "renewal"}
                          onChange={() => { setEditComplianceMode("renewal"); setEditExpiryDate(""); setComplianceDirty(true); }}
                          className="accent-primary mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <span className="text-sm">Renewal period</span>
                          {editComplianceMode === "renewal" && (
                            <>
                              <Select
                                value={editRenewalPeriodMonths != null ? String(editRenewalPeriodMonths) : ""}
                                onValueChange={(val) => { setEditRenewalPeriodMonths(parseInt(val)); setComplianceDirty(true); }}
                              >
                                <SelectTrigger className="h-9" data-testid="select-edit-renewal-period">
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
                              <p className="text-xs text-muted-foreground">
                                {document.lastApprovedAt
                                  ? `Renewal date calculated from last approval date (${format(new Date(document.lastApprovedAt), "d MMM yyyy")}).`
                                  : "Renewal date will be calculated from today as no approval date is recorded."}
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${editComplianceMode === "expiry" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-edit-compliance-expiry">
                        <input
                          type="radio"
                          name={`complianceModeEdit-${id}`}
                          value="expiry"
                          checked={editComplianceMode === "expiry"}
                          onChange={() => { setEditComplianceMode("expiry"); setEditRenewalPeriodMonths(null); setComplianceDirty(true); }}
                          className="accent-primary mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <span className="text-sm">Expiry date</span>
                          {editComplianceMode === "expiry" && (
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="date"
                                className="pl-10 h-9"
                                value={editExpiryDate}
                                onChange={(e) => { setEditExpiryDate(e.target.value); setComplianceDirty(true); }}
                                data-testid="input-edit-expiry-date"
                              />
                            </div>
                          )}
                        </div>
                      </label>
                      {complianceDirty && (
                        <Button
                          className="w-full mt-2"
                          size="sm"
                          onClick={() => complianceUpdateMutation.mutate()}
                          disabled={
                            complianceUpdateMutation.isPending ||
                            (editComplianceMode === "renewal" && !editRenewalPeriodMonths) ||
                            (editComplianceMode === "expiry" && !editExpiryDate)
                          }
                          data-testid="button-save-compliance"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {complianceUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {document.versions && document.versions.length > 0 &&
           (document.approvalStatus === "approved" || (document.versions as any[]).some((v: any) => !v.isDraft)) && (
            <Accordion type="single" collapsible>
              <AccordionItem value="version-history" className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <History className="h-4 w-4" />
                    Version History
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      {document.versions.length}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3 pt-1">
                    {[...(document.versions as any[])]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((version) => {
                        const displayLabel = version.versionLabel
                          ? `v${version.versionLabel}`
                          : `v${version.version}`;
                        const isDraft = version.isDraft === true;
                        return (
                          <div key={version.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-2">
                                {displayLabel}
                                {isDraft && (
                                  <span className="text-xs font-normal text-muted-foreground">(draft)</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(version.createdAt), "dd MMM yyyy, HH:mm")}
                                <span className="ml-1.5 text-muted-foreground/60">
                                  · {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                                </span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => downloadDocument(id, version.fileName, version.version)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" 
                ? (user?.role === "client" && document?.approvalStatus === "pending" ? "Confirm Sign-Off" : "Approve Document")
                : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve" 
                ? (user?.role === "client" && document?.approvalStatus === "pending"
                    ? "By signing off, you confirm that you have received and reviewed this document. It will then be sent to the consultant for final approval."
                    : "This will mark the document as approved and compliant.")
                : "Please describe the changes required."}
            </DialogDescription>
          </DialogHeader>
          {user?.role === "client" && approvalAction === "approve" && document?.approvalStatus === "pending" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Please confirm:</strong> I have read and reviewed the document "{document?.title}" and I acknowledge its contents.
              </p>
            </div>
          )}
          <div className="py-4">
            <Textarea
              placeholder={approvalAction === "approve" ? "Optional comments..." : "Please provide details..."}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-24"
              data-testid="input-feedback"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApproval}
              disabled={approvalMutation.isPending}
              variant="default"
              data-testid="button-confirm-approval"
            >
              {approvalMutation.isPending ? "Processing..." : 
                (user?.role === "client" && approvalAction === "approve" && document?.approvalStatus === "pending" 
                  ? "Sign Off" 
                  : "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadVersionDialog} onOpenChange={setShowUploadVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload New Version</DialogTitle>
            <DialogDescription>
              Upload a new version of "{document?.title}". The current version will be archived.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {newVersionFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{decodeURIComponent(newVersionFile.fileName)}</p>
                  <p className="text-xs text-muted-foreground">{(newVersionFile.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewVersionFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <SimpleFileUpload
                onUploadComplete={(result) => setNewVersionFile(result)}
              />
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Notes (optional)</label>
              <Textarea
                placeholder="Describe what changed in this version..."
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowUploadVersionDialog(false);
                setNewVersionFile(null);
                setChangeNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadVersion}
              disabled={!newVersionFile || uploadVersionMutation.isPending}
            >
              {uploadVersionMutation.isPending ? "Uploading..." : "Upload Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{document?.title}"? Archived documents will no longer appear in active lists.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for archiving (optional)</label>
              <Textarea
                placeholder="Enter a reason for archiving this document..."
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                rows={3}
                data-testid="input-archive-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowArchiveDialog(false);
                setArchiveReason("");
              }}
              data-testid="button-cancel-archive"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Document
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{document?.title}"? This action cannot be undone and will remove all versions of this document.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {document?.title}
                {previewVersion ? ` (v${previewVersion})` : ` (v${document?.version})`}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {document && (
              (() => {
                const mimeType = document.mimeType || "";
                const previewUrl = previewVersion
                  ? `/api/documents/${id}/preview?version=${previewVersion}`
                  : `/api/documents/${id}/preview`;
                
                if (mimeType === "application/pdf" ||
                    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                    mimeType === "application/msword") {
                  return (
                    <PdfViewer url={previewUrl} data-testid="preview-pdf" />
                  );
                }
                
                if (mimeType.startsWith("image/")) {
                  return (
                    <div className="w-full h-full flex items-center justify-center overflow-auto">
                      <img
                        src={previewUrl}
                        alt={document.title}
                        className="max-w-full max-h-full object-contain"
                        data-testid="preview-image"
                      />
                    </div>
                  );
                }
                
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center gap-4">
                    <FileText className="h-16 w-16 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">Preview not available for this file type</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {document.fileName} ({mimeType || "unknown type"})
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Please download the file to view it.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        downloadDocument(id, document.fileName, previewVersion || undefined);
                        setShowPreviewDialog(false);
                      }}
                      data-testid="button-download-from-preview"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReissueDialog} onOpenChange={(open) => { setShowReissueDialog(open); if (!open) { setReissueNote(""); setReissueBase("today"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-issue Document</DialogTitle>
            <DialogDescription>
              Mark this document as reviewed with no content changes. A new version will be recorded in the history and the document will be set to approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Renewal period</label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${reissueRenewalMonths === null ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                  <input type="radio" checked={reissueRenewalMonths === null} onChange={() => setReissueRenewalMonths(null)} className="accent-primary" data-testid="radio-reissue-no-renewal" />
                  <span className="text-sm">No renewal period</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${reissueRenewalMonths !== null ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}>
                  <input type="radio" checked={reissueRenewalMonths !== null} onChange={() => setReissueRenewalMonths(document.renewalPeriodMonths ?? 12)} className="accent-primary" data-testid="radio-reissue-renewal" />
                  <span className="text-sm flex-1">Renewal every</span>
                  {reissueRenewalMonths !== null && (
                    <Select value={String(reissueRenewalMonths)} onValueChange={(v) => setReissueRenewalMonths(Number(v))}>
                      <SelectTrigger className="w-32 h-8" data-testid="select-reissue-renewal-months">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 6, 12, 18, 24, 36].map(m => (
                          <SelectItem key={m} value={String(m)}>{m} {m === 1 ? "month" : "months"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </label>
              </div>
            </div>
            {showReissueBaseChoice && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Calculate renewal from</label>
                <div className="flex gap-3">
                  <Button
                    variant={reissueBase === "today" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setReissueBase("today")}
                    data-testid="button-reissue-base-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant={reissueBase === "last_approval" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setReissueBase("last_approval")}
                    data-testid="button-reissue-base-last-approval"
                  >
                    Last approval ({format(reissueLastApproved!, "d MMM yyyy")})
                  </Button>
                </div>
              </div>
            )}
            {reissuePreview && (
              <p className="text-sm text-muted-foreground">
                New renewal date: <strong>{format(reissuePreview, "d MMM yyyy")}</strong>
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Review note <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                placeholder="e.g. Annual review complete — no changes required"
                value={reissueNote}
                onChange={(e) => setReissueNote(e.target.value)}
                rows={3}
                data-testid="textarea-reissue-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReissueDialog(false)}>Cancel</Button>
            <Button
              onClick={() => reissueMutation.mutate({ renewalBase: showReissueBaseChoice ? reissueBase : "today", note: reissueNote || undefined, renewalPeriodMonths: reissueRenewalMonths })}
              disabled={reissueMutation.isPending}
              data-testid="button-confirm-reissue"
            >
              {reissueMutation.isPending ? "Re-issuing..." : "Re-issue Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ModuleDocuments({ module }: ModuleDocumentsProps) {
  const basePath = module === "health_safety" ? "/health-safety" : module === "human_resources" ? "/human-resources" : module === "employment_law" ? "/employment-law" : "/training";
  const [matchDetail, params] = useRoute(`${basePath}/documents/:id`);

  if (matchDetail && params?.id) {
    return <ModuleDocumentDetailView id={params.id} module={module} />;
  }

  return <ModuleDocumentsListView module={module} />;
}
