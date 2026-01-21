import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { RAGBadge, ApprovalBadge } from "@/components/rag-badge";
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";
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
  ArrowLeft,
  History,
  HardHat,
  Users,
  Lock,
  Unlock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Building2,
  LayoutGrid,
  LayoutList,
  FolderOpen,
  FileCheck,
  FileClock,
  FileWarning,
  ChevronRight,
  Scale,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import type { Document, DocumentWithDetails, DocumentVersion, AuditLog, ModuleType, DocumentTypeWithAccess, DocumentTypeRecord } from "@shared/schema";
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
    a.download = fileName.replace(/\.[^/.]+$/, '') + '.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ModuleDocumentsProps {
  module: ModuleType;
}

interface SiteBasic {
  id: string;
  name: string;
}

interface SiteWithCompany extends SiteBasic {
  companyName?: string | null;
}

type ViewMode = "folder" | "table";

// Module-specific color theming (matching template library)
const moduleColors: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
  support: "text-purple-600 dark:text-purple-400",
};

const moduleBgColors: Record<string, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
  support: "bg-purple-100 dark:bg-purple-900/30",
};

const moduleBorderColors: Record<string, string> = {
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
  support: "border-purple-200 dark:border-purple-800",
};

// Hierarchy types for folder view
interface HierarchyDocument {
  id: string;
  title: string;
  fileName: string;
  type: string;
  status: string;
  version: number;
  approvalStatus: string;
  updatedAt: string;
  documentTypeId?: string | null;
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

function ModuleDocumentsListView({ module }: { module: ModuleType }) {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const urlSiteId = urlParams.get("siteId");
  const urlCompany = urlParams.get("company");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [showDocTypeAccess, setShowDocTypeAccess] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(urlSiteId);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(urlCompany);
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  
  const { user } = useAuth();
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : module === "human_resources" ? "/human-resources" : "/employment-law";
  const ModuleIcon = module === "health_safety" ? HardHat : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : module === "human_resources" ? "theme-hr" : "theme-el";
  
  // Consultants and admins can view different sites
  const isClientUser = user?.role === "client";
  
  // Fetch sites for consultant/admin users
  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
    enabled: !isClientUser,
  });
  
  // Filter sites by selected company
  const filteredSites = useMemo(() => {
    if (!sites) return [];
    if (!selectedCompany || selectedCompany === "all") return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);
  
  // Handle company selection - only clear site if not in new company
  const handleCompanyChange = (company: string | null) => {
    setSelectedCompany(company);
    // Only clear site if the current site is not in the new company
    if (selectedSiteId && company && company !== "all") {
      const currentSite = sites?.find(s => s.id === selectedSiteId);
      if (currentSite?.companyName !== company) {
        setSelectedSiteId(null);
      }
    }
  };

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module],
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
  const hierarchySiteId = selectedSiteId || (sites && sites.length === 1 ? sites[0].id : null);
  
  // Fetch document hierarchy for folder view
  const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery<DocumentHierarchy>({
    queryKey: ["/api/sites", hierarchySiteId, "modules", module, "documents-hierarchy"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${hierarchySiteId}/modules/${module}/documents-hierarchy`);
      if (!res.ok) throw new Error("Failed to fetch hierarchy");
      return res.json();
    },
    enabled: !!hierarchySiteId && viewMode === "folder",
  });
  
  // Get folder status badge
  const getFolderStatusBadge = (stats: HierarchyFolder["stats"]) => {
    if (stats.overdue > 0) return { variant: "destructive" as const, label: "Attention Needed" };
    if (stats.reviewRequired > 0) return { variant: "secondary" as const, label: "Review Required" };
    if (stats.compliant > 0 && stats.totalDocuments === stats.compliant) return { variant: "default" as const, label: "Compliant" };
    if (stats.totalDocuments === 0) return { variant: "outline" as const, label: "No Documents" };
    return { variant: "secondary" as const, label: "Incomplete" };
  };
  
  // Get folder templates for current module
  const moduleFolderTemplates = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter(t => t.module === module && t.isActive);
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

  // Determine which site to show access for
  // "all" means show data across all sites
  const canSelectSites = user?.role === "admin" || user?.role === "consultant";
  const siteId = isClientUser 
    ? (user?.siteId || null)
    : (selectedSiteId === "all" ? null : (selectedSiteId || null));
    
  const { data: documentTypesWithAccess } = useQuery<DocumentTypeWithAccess[]>({
    queryKey: ["/api/document-types", module, siteId],
    enabled: !!siteId,
  });
  
  const accessibleTypes = documentTypesWithAccess?.filter(dt => dt.hasAccess) || [];
  const unavailableTypes = documentTypesWithAccess?.filter(dt => !dt.hasAccess) || [];
  
  // Build context description for display
  const currentContextName = useMemo(() => {
    if (!canSelectSites) return null;
    if (selectedSiteId && selectedSiteId !== "all") {
      return sites?.find((s: SiteWithCompany) => s.id === selectedSiteId)?.name || null;
    }
    if (selectedCompany && selectedCompany !== "all") {
      return `${selectedCompany} (all sites)`;
    }
    return "All Clients";
  }, [canSelectSites, selectedSiteId, selectedCompany, sites]);

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    // Filter by folder - match documents whose document type is assigned to the selected folder
    let matchesFolder = true;
    if (folderFilter !== "all") {
      const docTypeId = (doc as any).documentTypeId;
      const docFolderName = docTypeId ? docTypeToFolderName.get(docTypeId) : null;
      matchesFolder = docFolderName === folderFilter;
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesFolder && !doc.isArchived;
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeClass}`}>
      {/* Module Header with tinted background */}
      <div className="bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
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
            {canSelectSites && sites && sites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/60 border">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CompanyCombobox
                  sites={sites}
                  value={selectedCompany}
                  onValueChange={handleCompanyChange}
                  className="w-44"
                  testId="select-company-documents"
                />
                <span className="text-muted-foreground">/</span>
                <SiteCombobox
                  sites={filteredSites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-documents"
                />
              </div>
            )}
            
            <Button className={`${moduleBgColors[module]} ${moduleColors[module]} border ${moduleBorderColors[module]} hover:opacity-90`} asChild>
              <Link href={`${basePath}/documents/upload`} data-testid="button-upload-document">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Link>
            </Button>
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
          
          {/* Quick stats badge */}
          {hierarchy?.summary && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">{hierarchy.summary.compliant}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileClock className="h-4 w-4 text-yellow-600" />
                <span className="text-muted-foreground">{hierarchy.summary.reviewRequired}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileWarning className="h-4 w-4 text-red-600" />
                <span className="text-muted-foreground">{hierarchy.summary.overdue}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 p-8">

      {/* Document Type Access Section */}
      {siteId && documentTypesWithAccess && documentTypesWithAccess.length > 0 && (
        <Collapsible open={showDocTypeAccess} onOpenChange={setShowDocTypeAccess}>
          <Card className={unavailableTypes.length > 0 ? "border-amber-300 dark:border-amber-700 shadow-sm" : ""}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${unavailableTypes.length > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-module-accent/10"}`}>
                      <ShieldCheck className={`h-5 w-5 ${unavailableTypes.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-module-accent"}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Your Document Type Access
                        {currentContextName && (
                          <span className="text-sm font-normal text-muted-foreground">
                            ({currentContextName})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {accessibleTypes.length} of {documentTypesWithAccess.length} document types included in your package
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {unavailableTypes.length > 0 && (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {unavailableTypes.length} upgrade options
                      </Badge>
                    )}
                    {showDocTypeAccess ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {/* Site selector for consultants/admins */}
                {!isClientUser && sites && sites.length > 1 && (
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">View access for:</span>
                    <Select 
                      value={siteId || ""} 
                      onValueChange={setSelectedSiteId}
                    >
                      <SelectTrigger className="w-64" data-testid="select-site-access">
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((site: SiteBasic) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {documentTypesWithAccess.map((docType) => (
                    <div
                      key={docType.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        docType.hasAccess 
                          ? "bg-card border-border" 
                          : "bg-muted/30 border-dashed border-muted-foreground/30"
                      }`}
                      data-testid={`doctype-${docType.code}`}
                    >
                      {docType.hasAccess ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Unlock className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${!docType.hasAccess && "text-muted-foreground"}`}>
                          {docType.name}
                        </p>
                        {docType.hasAccess ? (
                          <p className="text-xs text-muted-foreground">
                            {docType.documentCount} document{docType.documentCount !== 1 ? "s" : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Contact us to add
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {unavailableTypes.length > 0 && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 p-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Expand your compliance coverage
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          {unavailableTypes.length} additional document types are available for your organization
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                      data-testid="button-request-access"
                    >
                      Request Access
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Folder View */}
      {viewMode === "folder" && (
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
                  Choose a site to view documents organized by folder
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
                    return (
                      <AccordionItem key={folder.id} value={folder.id} data-testid={`accordion-folder-${folder.id}`} className={`border-b ${moduleBorderColors[module]}`}>
                        <AccordionTrigger className="hover:no-underline px-2">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${moduleBgColors[module]}`}>
                                <FolderOpen className={`h-4 w-4 ${moduleColors[module]}`} />
                              </div>
                              <span className="font-medium">{folder.name}</span>
                              {folder.isRequired && (
                                <Badge variant="outline" className={`text-xs ${moduleBorderColors[module]} ${moduleColors[module]}`}>Required</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {folder.stats.totalDocuments} document{folder.stats.totalDocuments !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-8 space-y-2">
                            {folder.documents.length > 0 ? (
                              folder.documents.map((doc) => (
                                <Link
                                  key={doc.id}
                                  href={`${basePath}/documents/${doc.id}`}
                                  className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                                  data-testid={`link-document-${doc.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium text-sm">{doc.title}</p>
                                      <p className="text-xs text-muted-foreground">v{doc.version}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <RAGBadge status={doc.status as any} />
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </Link>
                              ))
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <p className="text-sm">No documents in this folder</p>
                                <Button variant="ghost" size="sm" asChild className="mt-2">
                                  <Link href={`${basePath}/documents/upload`}>
                                    <Upload className="mr-2 h-3 w-3" />
                                    Upload Document
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
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
                  Upload documents to get started
                </p>
                <Button variant="outline" size="sm" asChild className={`mt-4 ${moduleBorderColors[module]} ${moduleColors[module]}`}>
                  <Link href={`${basePath}/documents/upload`}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Unfiled Documents */}
          {hierarchySiteId && hierarchy?.unfiledDocuments && hierarchy.unfiledDocuments.length > 0 && (
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
                  <Link
                    key={doc.id}
                    href={`${basePath}/documents/${doc.id}`}
                    className={`flex items-center justify-between p-3 rounded-md border ${moduleBorderColors[module]} hover-elevate`}
                    data-testid={`link-unfiled-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`h-4 w-4 ${moduleColors[module]}`} />
                      <div>
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">v{doc.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RAGBadge status={doc.status as any} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
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
                    {moduleFolderTemplates.map((folder) => (
                      <SelectItem key={folder.id} value={folder.name}>{folder.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDocuments && filteredDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
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
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            v{doc.version} - {doc.fileName}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {getDocTypeLabel(doc.type, (doc as any).documentTypeId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RAGBadge status={doc.status} />
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge status={doc.approvalStatus} />
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
                          <DropdownMenuItem onClick={() => downloadDocument(doc.id, doc.fileName)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
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
                {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : `Upload your first ${config.shortName} document to get started`}
              </p>
              <Button className="mt-4" asChild>
                <Link href={`${basePath}/documents/upload`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
}

function ModuleDocumentDetailView({ id, module }: { id: string; module: ModuleType }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "changes">("approve");
  const [feedback, setFeedback] = useState("");
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);

  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";

  const { data: document, isLoading } = useQuery<DocumentWithDetails>({
    queryKey: ["/api/documents", id],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/documents", id, "audit"],
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: { action: string; feedback?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/approval`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
      setShowApprovalDialog(false);
      setFeedback("");
      toast({
        title: "Success",
        description: `Document has been ${approvalAction === "approve" ? "approved" : approvalAction === "reject" ? "rejected" : "returned for changes"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document approval status",
        variant: "destructive",
      });
    },
  });

  const handleApproval = () => {
    approvalMutation.mutate({ action: approvalAction, feedback });
  };

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
          <h1 className="text-2xl font-semibold">{document.title}</h1>
          <p className="text-muted-foreground">
            Version {document.version} - {getDocTypeLabel(document.type, (document as any).documentTypeId)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RAGBadge status={document.status} />
          <ApprovalBadge status={document.approvalStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
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
                  <p>{document.fileName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File Size</p>
                  <p>{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Review Date</p>
                  <p>{document.reviewDate ? format(new Date(document.reviewDate), "MMM d, yyyy") : "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Uploaded By</p>
                  <p>{document.uploadedByName || "Unknown"}</p>
                </div>
              </div>
              {document.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="mt-1">{document.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {document.approvalStatus === "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Actions</CardTitle>
                <CardDescription>Review and approve or reject this document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => { setApprovalAction("approve"); setShowApprovalDialog(true); }}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
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
          )}

          {auditLogs && auditLogs.length > 0 && (() => {
            const INITIAL_DISPLAY_COUNT = 3;
            const displayedLogs = showAllAuditLogs ? auditLogs : auditLogs.slice(0, INITIAL_DISPLAY_COUNT);
            const hasMoreLogs = auditLogs.length > INITIAL_DISPLAY_COUNT;
            
            const getActionStyle = (action: string) => {
              switch (action) {
                case 'document_uploaded':
                  return { icon: Upload, bg: 'bg-blue-100 dark:bg-blue-900/40', color: 'text-blue-600 dark:text-blue-400' };
                case 'document_approved':
                  return { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400' };
                case 'document_rejected':
                  return { icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/40', color: 'text-red-600 dark:text-red-400' };
                case 'changes_requested':
                  return { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400' };
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
                          Show {auditLogs.length - INITIAL_DISPLAY_COUNT} More
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
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                data-testid="button-download"
                onClick={() => downloadDocument(id, document.fileName)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Document
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-upload-version">
                <Upload className="mr-2 h-4 w-4" />
                Upload New Version
              </Button>
            </CardContent>
          </Card>

          {document.versions && document.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {document.versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(version.createdAt), "MMM d, yyyy")}
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
              {approvalAction === "approve" ? "Approve Document" : 
               approvalAction === "reject" ? "Reject Document" : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve" 
                ? "This will mark the document as approved and compliant."
                : approvalAction === "reject"
                ? "This will reject the document. Please provide a reason."
                : "Please describe the changes required."}
            </DialogDescription>
          </DialogHeader>
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
              {approvalMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ModuleDocuments({ module }: ModuleDocumentsProps) {
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";
  const [matchDetail, params] = useRoute(`${basePath}/documents/:id`);

  if (matchDetail && params?.id) {
    return <ModuleDocumentDetailView id={params.id} module={module} />;
  }

  return <ModuleDocumentsListView module={module} />;
}
