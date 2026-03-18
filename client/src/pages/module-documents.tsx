import { useState, useMemo, useEffect } from "react";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";
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
  Clock,
  ArrowLeft,
  History,
  HardHat,
  Users,
  ChevronDown,
  ChevronUp,
  Building2,
  LayoutGrid,
  LayoutList,
  FolderOpen,
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
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
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
import type { Document, DocumentWithDetails, DocumentVersion, AuditLog, ModuleType, DocumentTypeRecord, DocumentStatus, ApprovalStatus } from "@shared/schema";
import { moduleConfig } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

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
  isRequired: boolean;
  isArchived?: boolean;
  renewalPeriodMonths?: number | null;
  lastApprovedAt?: string | null;
  renewalDate?: string | null;
}

interface HierarchyFolder {
  id: string;
  name: string;
  code: string;
  isRequired: boolean;
  sortOrder: number;
  documents: HierarchyDocument[];
  stats: {
    totalDocuments: number;
    compliant: number;
    reviewRequired: number;
    overdue: number;
  };
}

interface DocumentHierarchy {
  folders: HierarchyFolder[];
  unfiledDocuments: HierarchyDocument[];
  summary: {
    totalDocuments: number;
    compliant: number;
    reviewRequired: number;
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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [renewalFilter, setRenewalFilter] = useState<string>(urlRenewal || "all");
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();
  useEffect(() => {
    if (urlCompany) handleCompanyChange(urlCompany);
    if (urlSiteId) setSelectedSiteId(urlSiteId);
  }, [urlSiteId, urlCompany]);
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  const [archivedDialogOpen, setArchivedDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{id: string, title: string} | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "human_resources" ? "/human-resources" : module === "employment_law" ? "/employment-law" : "/training";
  const ModuleIcon = module === "health_safety" ? HardHat : module === "training" ? FileText : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : module === "human_resources" ? "theme-hr" : module === "employment_law" ? "theme-el" : "theme-training";
  
  // Consultants and admins can view different sites
  const isClientUser = user?.role === "client";
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Restore document mutation
  const restoreMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest("POST", `/api/documents/${documentId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
  
  // Fetch sites for all users
  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });
  
  // With company-level module access, all sites in a company have the same access
  // So no per-site filtering needed - just show all sites for the user's company
  const clientSites = useMemo(() => {
    if (!sites) return [];
    return sites;
  }, [sites]);
  
  // Clients can filter by site if they have multiple sites
  const clientHasMultipleSites = isClientUser && clientSites && clientSites.length > 1;
  
  // Filter sites by selected company (for privileged users)
  const filteredSites = useMemo(() => {
    if (!clientSites) return [];
    if (!selectedCompany || selectedCompany === "all") return clientSites;
    return clientSites.filter(s => s.companyName === selectedCompany);
  }, [clientSites, selectedCompany]);
  
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module],
  });

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
  
  // Get the effective site ID for hierarchy query
  // Support "all" when a company is selected or when viewing all sites
  const hierarchySiteId = selectedSiteId 
    ? selectedSiteId 
    : (selectedCompany && selectedCompany !== "all") 
      ? "all" 
      : (sites && sites.length === 1 ? sites[0].id : "all");
  
  // Get companyId from selected company name (for filtering when viewing all sites)
  const selectedCompanyId = useMemo(() => {
    if (!selectedCompany || selectedCompany === "all" || !sites) return null;
    const siteInCompany = sites.find(s => s.companyName === selectedCompany);
    return siteInCompany?.companyId || null;
  }, [selectedCompany, sites]);
  
  // Build hierarchy URL - always fetch with includeArchived=true, filter client-side
  const hierarchyUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId) params.set("companyId", selectedCompanyId);
    params.set("includeArchived", "true");
    return `/api/sites/${hierarchySiteId}/modules/${module}/documents-hierarchy?${params.toString()}`;
  }, [hierarchySiteId, module, selectedCompanyId]);

  // Fetch document hierarchy for folder view
  const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery<DocumentHierarchy>({
    queryKey: [hierarchyUrl],
    enabled: !!hierarchySiteId && viewMode === "folder",
  });

  // Drag-and-drop for folder view (privileged users only)
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
  
  // Get folder status badge - colors match document-level RAGBadge for consistency
  const getFolderStatusBadge = (stats: HierarchyFolder["stats"]) => {
    if (stats.overdue > 0) return { variant: "outline" as const, label: "Attention Needed", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" };
    if (stats.reviewRequired > 0) return { variant: "outline" as const, label: "Review Required", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" };
    if (stats.compliant > 0 && stats.totalDocuments === stats.compliant) return null;
    if (stats.totalDocuments === 0) return null;
    return { variant: "outline" as const, label: "Incomplete", className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20" };
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
  const docMetaLine = (doc: { fileName: string; version?: number; fileSize?: number | null; siteId?: string | null }) => {
    const parts: string[] = [];
    if (doc.version) parts.push(`v${doc.version}`);
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
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.comments?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    // Filter by site - only show documents for the selected site
    let matchesSite = true;
    if (selectedSiteId && selectedSiteId !== "all") {
      matchesSite = doc.siteId === selectedSiteId;
    }
    
    // Filter by company - only show documents for sites in the selected company
    let matchesCompany = true;
    if (selectedCompany && selectedCompany !== "all") {
      // Use document's companyName directly if available, otherwise look up from sites
      const docCompanyName = (doc as any).companyName || sites?.find(s => s.id === doc.siteId)?.companyName;
      matchesCompany = docCompanyName === selectedCompany;
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
    if (renewalFilter !== "all" && doc.renewalDate) {
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
        case "none":
          matchesRenewal = false; // Will be handled below
          break;
      }
    } else if (renewalFilter === "none") {
      matchesRenewal = !doc.renewalDate;
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesFolder && matchesSite && matchesCompany && matchesRenewal && !doc.isArchived;
  });

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
    <div className={`${themeClass}`}>
      {/* Module Header with tinted background */}
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${moduleBgColors[module]}`}>
              <ModuleIcon className={`h-6 w-6 ${moduleColors[module]}`} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">{config.name} Documents</h1>
              <p className="text-muted-foreground">
                Manage {config.shortName} compliance documents
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            {/* Site Context - Company and Site selectors */}
            {(isPrivilegedUser || clientHasMultipleSites) && sites && sites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isPrivilegedUser && (
                  <>
                    <CompanyCombobox
                      sites={sites}
                      value={selectedCompany}
                      onValueChange={handleCompanyChange}
                      className="w-44"
                      testId="select-company-documents"
                    />
                    <span className="text-muted-foreground">/</span>
                  </>
                )}
                <SiteCombobox
                  sites={isPrivilegedUser ? filteredSites : clientSites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-documents"
                />
              </div>
            )}
            
            {isPrivilegedUser && (
              <Button className={`${moduleBgColors[module]} ${moduleColors[module]} border ${moduleBorderColors[module]} hover:opacity-90`} asChild>
                <Link href={`${basePath}/documents/upload`} data-testid="button-upload-document">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            )}
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

      <div className="space-y-6 p-8">


      {/* Folder View */}
      {viewMode === "folder" && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
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
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <span>{hierarchy.summary.compliant} Compliant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-yellow-600" />
                      <span>{hierarchy.summary.reviewRequired} Review Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-red-600" />
                      <span>{hierarchy.summary.overdue} Overdue</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Folders Accordion */}
          {hierarchySiteId && isLoadingHierarchy ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : hierarchySiteId && hierarchy?.folders && hierarchy.folders.length > 0 ? (
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardContent className="p-4">
                <Accordion type="multiple" className="w-full">
                  {hierarchy.folders.map((folder) => {
                    const statusBadge = getFolderStatusBadge(folder.stats);
                    const folderDropId = (folder as any).siteFolder?.id ?? folder.id;
                    return (
                      <DroppableFolderZone key={folder.id} folderId={folderDropId} isDragEnabled={isPrivilegedUser}>
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
                              {statusBadge && <Badge variant={statusBadge.variant} className={statusBadge.className}>{statusBadge.label}</Badge>}
                              <span className="text-sm text-muted-foreground">
                                {folder.stats.totalDocuments} document{folder.stats.totalDocuments !== 1 ? "s" : ""}
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
                                  const childStatusBadge = getFolderStatusBadge(childFolder.stats || { totalDocuments: 0, compliant: 0, reviewRequired: 0, overdue: 0 });
                                  const childDropId = (childFolder as any).siteFolder?.id ?? childFolder.id;
                                  return (
                                    <DroppableFolderZone key={childFolder.id} folderId={childDropId} isDragEnabled={isPrivilegedUser}>
                                    <AccordionItem value={childFolder.id} className={`border rounded-lg ${moduleBorderColors[module]} overflow-hidden`}>
                                      <AccordionTrigger className="hover:no-underline px-3 py-2 bg-muted/30">
                                        <div className="flex items-center justify-between w-full pr-2">
                                          <div className="flex items-center gap-3">
                                            <div className={`flex h-7 w-7 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                              <FolderOpen className={`h-3.5 w-3.5 ${moduleColors[module]}`} />
                                            </div>
                                            <span className="font-medium text-sm">{childFolder.name}</span>
                                            {childFolder.isRequired && (
                                              <Badge variant="outline" className={`text-xs ${moduleBorderColors[module]} ${moduleColors[module]}`}>Required</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {childStatusBadge && <Badge variant={childStatusBadge.variant} className={childStatusBadge.className}>{childStatusBadge.label}</Badge>}
                                            <span className="text-xs text-muted-foreground">
                                              {childFolder.stats?.totalDocuments || 0} doc{(childFolder.stats?.totalDocuments || 0) !== 1 ? "s" : ""}
                                            </span>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <div className="p-3 pl-10 space-y-2">
                                          {childFolder.documents && childFolder.documents.filter((doc: any) => !doc.isArchived).length > 0 ? (
                                            childFolder.documents.filter((doc: any) => !doc.isArchived).map((doc: any) => (
                                              <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={childDropId} isDragEnabled={isPrivilegedUser}>
                                              <Link
                                                href={`${basePath}/documents/${doc.id}`}
                                                className="flex items-center justify-between p-2 rounded-md border hover-elevate"
                                                data-testid={`link-document-${doc.id}`}
                                              >
                                                <div className="flex items-center gap-3">
                                                  {isPrivilegedUser && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
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
                                                  <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                                                  <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
                                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                              </Link>
                                              </DraggableDocRow>
                                            ))
                                          ) : (
                                            <div className="text-center py-4 text-muted-foreground">
                                              <p className="text-xs">No documents in this subfolder</p>
                                              {isPrivilegedUser && (
                                                <Button variant="ghost" size="sm" asChild className="mt-1">
                                                  <Link href={`${basePath}/documents/upload`}>
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
                                  <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={folderDropId} isDragEnabled={isPrivilegedUser}>
                                  <Link
                                    href={`${basePath}/documents/${doc.id}`}
                                    className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                                    data-testid={`link-document-${doc.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {isPrivilegedUser && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
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
                                      <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </Link>
                                  </DraggableDocRow>
                                ))}
                              </div>
                            )}
                            
                            {/* Upload to parent folder option - privileged only */}
                            {isPrivilegedUser && (
                              <div className={`flex items-center justify-center py-3 mt-2 border border-dashed rounded-md ${moduleBorderColors[module]}`}>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link href={`${basePath}/documents/upload`}>
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
                {isPrivilegedUser && (
                  <Button variant="outline" size="sm" asChild className={`mt-4 ${moduleBorderColors[module]} ${moduleColors[module]}`}>
                    <Link href={`${basePath}/documents/upload`}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Unfiled Documents */}
          {hierarchySiteId && hierarchy?.unfiledDocuments && hierarchy.unfiledDocuments.length > 0 && (
            <DroppableFolderZone folderId="__unfiled__" isDragEnabled={isPrivilegedUser}>
            <Card className={`border ${moduleBorderColors[module]}`}>
              <CardHeader className={`pb-3 ${moduleBgColors[module]} rounded-t-lg`}>
                <CardTitle className={`text-base flex items-center gap-2 ${moduleColors[module]}`}>
                  <FileText className="h-4 w-4" />
                  Unfiled Documents
                  <Badge variant="secondary">{hierarchy.unfiledDocuments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {hierarchy.unfiledDocuments.map((doc) => (
                  <DraggableDocRow key={doc.id} id={doc.id} title={doc.title} sourceFolderId={null} isDragEnabled={isPrivilegedUser}>
                  <Link
                    href={`${basePath}/documents/${doc.id}`}
                    className={`flex items-center justify-between p-3 rounded-md border ${moduleBorderColors[module]} hover-elevate`}
                    data-testid={`link-unfiled-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isPrivilegedUser && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />}
                      <FileText className={`h-4 w-4 ${moduleColors[module]}`} />
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{docMetaLine(doc)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                  </DraggableDocRow>
                ))}
              </CardContent>
            </Card>
            </DroppableFolderZone>
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="select-document-type">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {config.documentTypes.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-document-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="review_required">Review Required</SelectItem>
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
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredDocuments && filteredDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Renewal Period</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="hover-elevate" data-testid={`row-document-${doc.id}`}>
                    <TableCell>
                      <Link href={`${basePath}/documents/${doc.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {docMetaLine(doc)}
                            </p>
                          </div>
                          {doc.isArchived && (
                            <Badge variant="secondary" className="gap-1 bg-muted">
                              <Archive className="h-3 w-3" />
                              Archived
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {getDocTypeLabel(doc.type, (doc as any).documentTypeId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                    </TableCell>
                    <TableCell>
                      {(doc as any).renewalPeriodMonths ? (
                        <Badge variant="secondary">{(doc as any).renewalPeriodMonths}mo</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(doc as any).renewalDate ? (
                        <span className="text-sm">{format(new Date((doc as any).renewalDate), "MMM d, yyyy")}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.updatedAt && format(new Date(doc.updatedAt), "MMM d, yyyy")}
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
                          {isPrivilegedUser && (
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
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || typeFilter !== "all" || statusFilter !== "all" || renewalFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : isPrivilegedUser
                    ? `Upload your first ${config.shortName} document to get started`
                    : "No documents have been added yet"}
              </p>
              {isPrivilegedUser && (
                <Button className="mt-4" asChild>
                  <Link href={`${basePath}/documents/upload`}>
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
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
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
                      <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.version}</p>
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

function ModuleDocumentDetailView({ id, module }: { id: string; module: ModuleType }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "changes">("approve");
  const [feedback, setFeedback] = useState("");
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);
  const [showUploadVersionDialog, setShowUploadVersionDialog] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<{ objectPath: string; fileName: string; fileSize: number; mimeType: string } | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
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

  const { data: siteUsers } = useQuery<Array<{ id: string; fullName: string; email: string; role: string; status: string }>>({
    queryKey: ["/api/sites", document?.siteId, "users"],
    enabled: !!document?.siteId && isPrivilegedUser && (document?.approvalStatus === "pending" || document?.approvalStatus === "review_required"),
  });

  const siteClientUsers = useMemo(() => {
    if (!siteUsers) return [];
    return siteUsers.filter(u => u.role === "client");
  }, [siteUsers]);

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
      setEditIsRequired(document.isRequired);
      setComplianceDirty(false);
    }
  }, [document?.id, document?.isRequired, document?.expiryDate, document?.renewalDate, document?.renewalPeriodMonths]);

  const invalidateComplianceCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module] });
    queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
    queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
    queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
    queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && key[0].includes("documents-hierarchy");
      },
    });
  };

  const isRequiredMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      return apiRequest("PATCH", `/api/documents/${id}`, { isRequired: checked });
    },
    onMutate: (checked: boolean) => {
      const previous = editIsRequired;
      setEditIsRequired(checked);
      return { previous };
    },
    onSuccess: () => {
      invalidateComplianceCaches();
      toast({ title: "Compliance updated", description: "Required for compliance setting has been saved." });
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
        body.isRequired = editIsRequired;
      }
      if (editComplianceMode === "none") {
        body.expiryDate = null;
        body.renewalDate = null;
        body.renewalPeriodMonths = null;
      } else if (editComplianceMode === "renewal" && editRenewalPeriodMonths) {
        body.expiryDate = null;
        body.renewalPeriodMonths = editRenewalPeriodMonths;
        const baseDate = document.lastApprovedAt ? new Date(document.lastApprovedAt) : new Date();
        const renewalDate = new Date(baseDate);
        renewalDate.setMonth(renewalDate.getMonth() + editRenewalPeriodMonths);
        body.renewalDate = renewalDate.toISOString();
      } else if (editComplianceMode === "expiry" && editExpiryDate) {
        body.renewalDate = null;
        body.renewalPeriodMonths = null;
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setShowApprovalDialog(false);
      setFeedback("");
      toast({
        title: "Success",
        description: `Document has been ${approvalAction === "approve" ? "approved" : approvalAction === "reject" ? "rejected" : "returned for changes"}`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ 
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

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/documents/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module, "archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
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
            Version {document.version} - {getDocTypeLabel(document.type, (document as any).documentTypeId)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ComplianceBadge isRequired={document.isRequired} status={document.status} approvalStatus={document.approvalStatus} />
          <DocumentStatusBadge status={document.status} approvalStatus={document.approvalStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Document Details</CardTitle>
              <Badge variant="outline" className="text-sm font-semibold">
                Current Version: {document.version}
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
                  <p className="text-sm font-medium text-muted-foreground">Review Date</p>
                  <p>{document.renewalDate ? format(new Date(document.renewalDate), "MMM d, yyyy") : "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                  <p>{getDocTypeLabel(document.type, (document as any).documentTypeId)}</p>
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

          {(document.approvalStatus === "pending" || document.approvalStatus === "client_signed_off") && (() => {
            const isClient = user?.role === "client";
            const isConsultantOrAdmin = user?.role === "consultant" || user?.role === "admin";
            const isPending = document.approvalStatus === "pending";
            const isSignedOff = document.approvalStatus === "client_signed_off";
            
            // Check if client has approval permissions (owner, approver, or manager role)
            const clientHasApprovalPermission = isClient && 
              (user?.clientPermissionRole === "owner" || user?.clientPermissionRole === "approver" || user?.clientPermissionRole === "manager");
            
            // Determine which approval action is appropriate based on document uploader and current user
            // We need to know if the document was uploaded by a client or consultant
            // For now, we check document.uploadedBy against the current user
            // The backend enforces the actual rules, so we show UI optimistically based on approval status
            
            // Clients can only sign off on consultant-uploaded docs (pending status)
            // Consultants can approve client-uploaded docs (pending) or give final approval (client_signed_off)
            
            // Determine if current user can take action:
            // - Client with permissions + pending status = can sign off (if doc was consultant-uploaded, backend validates)
            // - Consultant/admin + pending status = can approve (if doc was client-uploaded, backend validates)
            // - Consultant/admin + client_signed_off = can final approve
            // - Client + client_signed_off = NO action (awaiting consultant)
            
            const canClientAct = isClient && clientHasApprovalPermission && isPending;
            const canConsultantAct = isConsultantOrAdmin && (isPending || isSignedOff);
            
            // If neither can act, don't show the card
            if (!canClientAct && !canConsultantAct) {
              // Show info-only card for clients on client_signed_off status
              if (isClient && isSignedOff) {
                return (
                  <Card data-testid="card-awaiting-final-approval">
                    <CardHeader>
                      <CardTitle>Awaiting Final Approval</CardTitle>
                      <CardDescription>
                        You have signed off on this document. It is now awaiting final approval from the consultant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="secondary" className="w-fit">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Client signed off - awaiting consultant final approval
                      </Badge>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            }
            
            const getTitle = () => {
              if (canClientAct) return "Client Sign-Off";
              if (isSignedOff) return "Final Approval";
              return "Approval Actions";
            };
            
            const getDescription = () => {
              if (canClientAct) return "Review and sign off on this document to confirm you've received and read it";
              if (isSignedOff) return "The client has signed off. Give final approval to complete the workflow";
              if (canConsultantAct && isPending) return "Review and approve this client-uploaded document";
              return "Review and approve or reject this document";
            };
            
            const getApproveLabel = () => {
              if (canClientAct) return "Sign Off";
              if (isSignedOff) return "Final Approval";
              return "Approve";
            };
            
            return (
              <Card>
                <CardHeader>
                  <CardTitle>{getTitle()}</CardTitle>
                  <CardDescription>{getDescription()}</CardDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-semibold">
                      Reviewing Version {document.version}
                    </Badge>
                    {isSignedOff && (
                      <Badge variant="secondary">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Client signed off - awaiting final approval
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
                                <SelectItem value="__none" disabled>No client users assigned to this site</SelectItem>
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

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => { setApprovalAction("approve"); setShowApprovalDialog(true); }}
                      data-testid="button-approve"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {getApproveLabel()}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setApprovalAction("changes"); setShowApprovalDialog(true); }}
                      data-testid="button-request-changes"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Request Changes
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => { setApprovalAction("reject"); setShowApprovalDialog(true); }}
                      data-testid="button-reject"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {auditLogs && auditLogs.length > 0 && (() => {
            const INITIAL_DISPLAY_COUNT = 5;
            // Filter out "viewed" entries for initial display to show important actions
            const importantActions = ['document_uploaded', 'document_approved', 'document_signed_off', 'document_rejected', 'changes_requested', 'document_archived', 'version_uploaded', 'email_sent'];
            const importantLogs = auditLogs.filter(log => importantActions.includes(log.action));
            const viewedLogs = auditLogs.filter(log => log.action === 'document_viewed');
            
            // Show important logs first, then viewed logs
            const sortedLogs = [...importantLogs, ...viewedLogs];
            const displayedLogs = showAllAuditLogs ? sortedLogs : sortedLogs.slice(0, INITIAL_DISPLAY_COUNT);
            const hasMoreLogs = sortedLogs.length > INITIAL_DISPLAY_COUNT;
            
            const getActionStyle = (action: string) => {
              switch (action) {
                case 'document_uploaded':
                  return { icon: Upload, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400' };
                case 'document_approved':
                  return { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400' };
                case 'document_signed_off':
                  return { icon: CheckCircle, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400' };
                case 'document_rejected':
                  return { icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/40', color: 'text-red-600 dark:text-red-400' };
                case 'changes_requested':
                  return { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400' };
                case 'email_sent':
                  return { icon: Mail, bg: 'bg-indigo-100 dark:bg-indigo-900/40', color: 'text-indigo-600 dark:text-indigo-400' };
                case 'document_viewed':
                  return { icon: Eye, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-600 dark:text-gray-400' };
                case 'document_downloaded':
                  return { icon: Download, bg: 'bg-purple-100 dark:bg-purple-900/40', color: 'text-purple-600 dark:text-purple-400' };
                default:
                  return { icon: FileText, bg: 'bg-muted', color: 'text-muted-foreground' };
              }
            };

            return (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit Trail
                    <Badge variant="secondary" className="text-xs">{auditLogs.length}</Badge>
                  </CardTitle>
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
                        log.details
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
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {displayedLogs.map((log) => {
                      const style = getActionStyle(log.action);
                      const ActionIcon = style.icon;
                      
                      return (
                        <div key={log.id} className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg}`}>
                            <ActionIcon className={`h-4 w-4 ${style.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{log.details}</p>
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                {log.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {log.userName} - {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                          Show {sortedLogs.length - INITIAL_DISPLAY_COUNT} More
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
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {document.fileUrl && (document.mimeType === "application/pdf" || document.mimeType?.startsWith("image/")) && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  data-testid="button-preview"
                  onClick={() => {
                    setPreviewVersion(null);
                    setShowPreviewDialog(true);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Document (v{document.version})
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                data-testid="button-download"
                onClick={() => {
                  if (!document.fileUrl) {
                    toast({ title: "File not available", description: "This document was uploaded before file storage was enabled. Please re-upload the document.", variant: "destructive" });
                    return;
                  }
                  downloadDocument(id, document.fileName);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Current (v{document.version})
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

          {isPrivilegedUser && !document.isArchived && (
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required for Compliance</p>
                  {isRequiredTemplate ? (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Required</span>
                      <Badge variant="secondary" className="text-xs" data-testid="badge-required-template">Required (via template)</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Required</span>
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
                        </div>
                      );
                    }
                    const now = new Date();
                    const isFullyCompliant = document.approvalStatus === "approved" && document.status === "compliant";
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
                               document.approvalStatus === "rejected" ? "Document has been rejected" :
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

                <div className="border-t border-border" />

                {/* Section 3: Renewal & Expiry */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Renewal & Expiry</p>
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
                </div>
              </CardContent>
            </Card>
          )}

          {document.versions && document.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Previous Versions</CardTitle>
                <CardDescription className="text-xs">
                  Archived when new versions were uploaded
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {document.versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          Archived {format(new Date(version.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => downloadDocument(id, version.fileName, version.version)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" 
                ? (user?.role === "client" && document?.approvalStatus === "pending" ? "Confirm Sign-Off" : "Approve Document")
                : approvalAction === "reject" ? "Reject Document" : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve" 
                ? (user?.role === "client" && document?.approvalStatus === "pending"
                    ? "By signing off, you confirm that you have received and reviewed this document. It will then be sent to the consultant for final approval."
                    : "This will mark the document as approved and compliant.")
                : approvalAction === "reject"
                ? "This will reject the document. Please provide a reason."
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
              variant={approvalAction === "reject" ? "destructive" : "default"}
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
                
                if (mimeType === "application/pdf") {
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
