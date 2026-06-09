import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComplianceBadge, DocumentStatusBadge } from "@/components/rag-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
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
  MessageSquare,
  Send,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  MoveRight,
  FolderTree,
  LayoutList,
  LayoutGrid,
  HardHat,
  Users,
  Scale,
  FileCheck,
  FileClock,
  FileWarning,
  ShieldCheck,
  Calendar,
  Save,
  Share2,
  MapPin,
  Plus,
  ExternalLink,
  RefreshCw,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Document, DocumentType, DocumentVersion, AuditLog, DocumentFolder, Site, ModuleType, DocumentStatus, ApprovalStatus } from "@shared/schema";

// Enriched document type with server-computed shared-link metadata
type EnrichedDocument = Document & {
  isSharedLink?: boolean;
  sharedScope?: "company" | "group";
  sharedFromEntityName?: string | null;
};

// Type for the documents hierarchy API response
interface DocumentHierarchyDocument {
  id: string;
  title: string;
  fileName: string;
  version?: number;
  fileSize?: number | null;
  siteId?: string | null;
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  isMandatory: boolean;
  source: string;
  templateId: string | null;
  expiryDate: string | null;
  updatedAt: string;
}

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

interface FolderStats {
  totalDocuments: number;
  compliant: number;
  approvalRequired: number;
  overdue: number;
  pendingApproval?: number;
  requiredTemplates: number;
  fulfilledRequired: number;
  folderStatus?: "compliant" | "incomplete" | "attention_needed";
}

interface TemplateInfo {
  id: string;
  name: string;
  isMandatory: boolean;
  renewalPeriodMonths: number | null;
  hasFulfilledDocument: boolean;
}

interface ChildFolder {
  id: string;
  name: string;
  description: string | null;
  isMandatory: boolean;
  siteFolder: { id: string; name: string } | null;
  documents: DocumentHierarchyDocument[];
  stats: FolderStats;
}

interface HierarchyFolder {
  id: string;
  name: string;
  description: string | null;
  isMandatory: boolean;
  sortOrder: number;
  siteFolder: { id: string; name: string } | null;
  documents: DocumentHierarchyDocument[];
  childFolders: ChildFolder[];
  stats: FolderStats;
  templateInfo: TemplateInfo[];
}

interface DocumentsHierarchyResponse {
  siteId: string;
  module: string;
  folders: HierarchyFolder[];
  unfiledDocuments: DocumentHierarchyDocument[];
  summary: {
    totalFolders: number;
    totalDocuments: number;
    compliant: number;
    approvalRequired: number;
    overdue: number;
  };
}

type ViewMode = "folder" | "table";

const documentTypeLabels: Record<DocumentType, string> = {
  // Health & Safety
  hs_policy: "H&S Policy",
  risk_assessment: "Risk Assessment",
  safety_audit: "Safety Audit",
  coshh_assessment: "COSHH Assessment",
  fire_safety: "Fire Safety",
  incident_report: "Incident Report",
  method_statement: "Method Statement",
  hs_checklist: "H&S Checklist",
  // Human Resources
  employment_contract: "Employment Contract",
  employee_handbook: "Employee Handbook",
  disciplinary_procedure: "Disciplinary Procedure",
  grievance_procedure: "Grievance Procedure",
  training_record: "Training Record",
  performance_review: "Performance Review",
  hr_policy: "HR Policy",
  absence_record: "Absence Record",
  // Employment Law
  tupe_consultation: "TUPE Consultation",
  investigation_report: "Investigation Report",
  disciplinary_hearing: "Disciplinary Hearing",
  cot3_agreement: "COT3 Agreement",
  settlement_agreement: "Settlement Agreement",
  grievance_outcome: "Grievance Outcome",
  appeal_hearing: "Appeal Hearing",
  witness_statement: "Witness Statement",
  case_notes: "Case Notes",
  legal_correspondence: "Legal Correspondence",
};

// Module labels for display (using ModuleType values from schema)
const moduleLabels: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "HR",
  employment_law: "Employment Law",
  support: "Support",
};

// Module icons (using ModuleType values from schema)
const moduleIcons: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
  support: MessageSquare,
};

function DocumentsListView() {
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get("site") ?? "all"; } catch { return "all"; }
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [provisionModule, setProvisionModule] = useState<string>("health_safety");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newFolderModule, setNewFolderModule] = useState<string>("health_safety");
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  const [selectedModule, setSelectedModule] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get("module") ?? "health_safety"; } catch { return "health_safety"; }
  });

  const [showArchived, setShowArchived] = useState(false);

  // Build a context-aware upload URL so the upload wizard receives siteId when a site is selected.
  const uploadUrl = (() => {
    if (selectedSiteId && selectedSiteId !== "all") {
      return `/documents/upload?siteId=${selectedSiteId}`;
    }
    return "/documents/upload";
  })();

  const { data: documents, isLoading } = useQuery<EnrichedDocument[]>({
    queryKey: ["/api/documents", "includeArchived"],
    queryFn: async () => {
      const res = await fetch("/api/documents?includeArchived=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch documents hierarchy for folder view - always include archived, filter client-side
  const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery<DocumentsHierarchyResponse>({
    queryKey: ["/api/sites", selectedSiteId, "modules", selectedModule, "documents-hierarchy", "includeArchived"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${selectedSiteId}/modules/${selectedModule}/documents-hierarchy?includeArchived=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hierarchy");
      return res.json();
    },
    enabled: selectedSiteId !== "all" && viewMode === "folder",
  });

  const { data: folders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", selectedSiteId],
    queryFn: async () => {
      if (selectedSiteId === "all") return [];
      const res = await fetch(`/api/folders?siteId=${selectedSiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedSiteId !== "all",
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; siteId: string; module: string }) => {
      return apiRequest("POST", "/api/folders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", selectedSiteId] });
      setShowCreateFolderDialog(false);
      setNewFolderName("");
      setNewFolderDescription("");
      setNewFolderModule("health_safety");
      toast({ title: "Folder created", description: "The folder has been created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create folder", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/archive`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "includeArchived"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/sites", selectedSiteId, "modules", selectedModule, "documents-hierarchy", "includeArchived"],
      });
      toast({
        title: "Document archived",
        description: "The document has been moved to the archive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive document",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/documents/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "includeArchived"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/sites", selectedSiteId, "modules", selectedModule, "documents-hierarchy", "includeArchived"],
      });
      toast({
        title: "Document restored",
        description: "The document has been restored from the archive",
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

  const provisionFoldersMutation = useMutation({
    mutationFn: async (data: { module: string }) => {
      return apiRequest("POST", `/api/sites/${selectedSiteId}/provision-folders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", selectedSiteId] });
      setShowProvisionDialog(false);
      toast({ 
        title: "Folders provisioned", 
        description: "Folder structure from templates has been created for this site" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to provision folders from templates", 
        variant: "destructive" 
      });
    },
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim() || selectedSiteId === "all") return;
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      description: newFolderDescription.trim(),
      siteId: selectedSiteId,
      module: newFolderModule,
    });
  };

  const canManageFolders = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.comments?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesSite = selectedSiteId === "all" || doc.siteId === selectedSiteId;
    const matchesFolder = selectedFolderId === null || doc.folderId === selectedFolderId;
    // When showArchived is true, we only want to see archived documents.
    // When showArchived is false, we only want to see non-archived documents.
    const archiveFilter = showArchived ? doc.isArchived : !doc.isArchived;
    return matchesSearch && matchesType && matchesStatus && matchesSite && matchesFolder && archiveFilter;
  });

  // Site lookup for metadata display
  const siteMap = useMemo(() => {
    const m = new Map<string, { name: string; companyName?: string | null }>();
    if (sites) sites.forEach((s: any) => m.set(s.id, { name: s.name, companyName: s.companyName }));
    return m;
  }, [sites]);

  // Build meta line: v1 · PDF · 2.4 MB [· Site] (site shown in flat list view only)
  const docMetaLine = (doc: { fileName: string; version?: number; approvedVersion?: number | null; approvalStatus?: string | null; fileSize?: number | null; siteId?: string | null }, includeSite = false) => {
    const parts: string[] = [];
    const isApproved = doc.approvalStatus === "approved" || !doc.approvalStatus;
    if (isApproved) {
      const vNum = doc.approvedVersion ?? 0;
      if (vNum > 0) parts.push(`v${vNum}`);
      else if (doc.version) parts.push(`v${doc.version}`);
    }
    const ext = getFileExtension(doc.fileName);
    if (ext) parts.push(ext);
    const size = formatFileSize(doc.fileSize);
    if (size) parts.push(size);
    if (includeSite && isPrivilegedUser && doc.siteId) {
      const siteInfo = siteMap.get(doc.siteId);
      if (siteInfo) {
        parts.push(siteInfo.name);
        if (selectedSiteId === "all" && siteInfo.companyName) parts.push(siteInfo.companyName);
      }
    }
    return parts.join(" · ");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 py-6 bg-background border-b flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage compliance documents and approvals
          </p>
        </div>
        {selectedSiteId && selectedSiteId !== "all" ? (
          <Button asChild>
            <Link href={uploadUrl} data-testid="button-upload-document">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Link>
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled data-testid="button-upload-document">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs whitespace-normal text-xs">
                Select a specific site first to upload a document
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      {/* Site Selection and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={selectedSiteId} onValueChange={(value) => { setSelectedSiteId(value); setSelectedFolderId(null); }}>
            <SelectTrigger className="w-52" data-testid="select-site">
              <SelectValue placeholder="Select Site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites?.map((site) => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Module selector for folder view */}
          {viewMode === "folder" && selectedSiteId !== "all" && (
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-48" data-testid="select-module">
                <SelectValue placeholder="Select Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="health_safety">
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4" />
                    Health &amp; Safety
                  </div>
                </SelectItem>
                <SelectItem value="human_resources">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    HR
                  </div>
                </SelectItem>
                <SelectItem value="employment_law">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Employment Law
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Folder buttons for table view (existing behavior) */}
          {viewMode === "table" && selectedSiteId !== "all" && folders && folders.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant={selectedFolderId === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFolderId(null)}
                data-testid="button-all-documents"
              >
                <FileText className="mr-2 h-4 w-4" />
                All Documents
              </Button>
              {folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={selectedFolderId === folder.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolderId(folder.id)}
                  data-testid={`button-folder-${folder.id}`}
                >
                  <Folder className="mr-2 h-4 w-4" />
                  {folder.name}
                </Button>
              ))}
            </div>
          )}

          {canManageFolders && selectedSiteId !== "all" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateFolderDialog(true)} data-testid="button-create-folder">
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowProvisionDialog(true)} data-testid="button-provision-folders">
                <FolderTree className="mr-2 h-4 w-4" />
                Apply Templates
              </Button>
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            data-testid="button-toggle-archived"
          >
            <Archive className="mr-2 h-4 w-4" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button
              variant={viewMode === "folder" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("folder")}
              data-testid="button-folder-view"
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Folder View
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              data-testid="button-table-view"
            >
              <LayoutList className="mr-2 h-4 w-4" />
              Table View
            </Button>
          </div>
        </div>
      </div>

      {/* Provision Folders from Templates Dialog */}
      <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Folder Templates</DialogTitle>
            <DialogDescription>
              Create folders from master templates for this site. This will create all active folder templates for the selected module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provision-module">Module</Label>
              <Select value={provisionModule} onValueChange={setProvisionModule}>
                <SelectTrigger data-testid="select-provision-module">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_safety">Health &amp; Safety</SelectItem>
                  <SelectItem value="human_resources">Human Resources</SelectItem>
                  <SelectItem value="employment_law">Employment Law</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select which module's folder templates to apply to this site.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProvisionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => provisionFoldersMutation.mutate({ module: provisionModule })} 
              disabled={provisionFoldersMutation.isPending} 
              data-testid="button-confirm-provision"
            >
              {provisionFoldersMutation.isPending ? "Applying..." : "Apply Templates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolderDialog} onOpenChange={setShowCreateFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organise your documents for this site.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                data-testid="input-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-module">Module</Label>
              <Select value={newFolderModule} onValueChange={setNewFolderModule}>
                <SelectTrigger data-testid="select-folder-module">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_safety">Health &amp; Safety</SelectItem>
                  <SelectItem value="human_resources">Human Resources</SelectItem>
                  <SelectItem value="employment_law">Employment Law</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description (optional)</Label>
              <Input
                id="folder-description"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Brief description of folder contents"
                data-testid="input-folder-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolderMutation.isPending} data-testid="button-confirm-create-folder">
              {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder View */}
      {viewMode === "folder" && selectedSiteId !== "all" && (
        <div className="space-y-4">
          {/* Summary Card */}
          {hierarchy?.summary && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const ModuleIcon = moduleIcons[selectedModule] || HardHat;
                      return <ModuleIcon className="h-5 w-5 text-primary" />;
                    })()}
                    <CardTitle className="text-lg">{moduleLabels[selectedModule]} Documents</CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-green-600" />
                      <span>{hierarchy.summary.compliant} Compliant</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-yellow-600" />
                      <span>{hierarchy.summary.approvalRequired} Approval Required</span>
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
          {isLoadingHierarchy ? (
            <FetchingOverlay />
          ) : hierarchy?.folders && hierarchy.folders.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Accordion type="multiple" className="w-full" defaultValue={hierarchy.folders.map(f => f.id)}>
                  {hierarchy.folders.map((folder) => (
                    <AccordionItem key={folder.id} value={folder.id} className="border-b last:border-b-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid={`accordion-folder-${folder.id}`}>
                        <div className="flex flex-1 items-center justify-between pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                              <FolderOpen className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{folder.name}</span>
                              </div>
                              {folder.description && (
                                <p className="text-sm text-muted-foreground">{folder.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {/* Folder status indicator */}
                            {folder.stats.folderStatus === "compliant" && folder.stats.totalDocuments > 0 && (
                              <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Compliant
                              </Badge>
                            )}
                            {folder.stats.folderStatus === "attention_needed" && (
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Needs Attention
                              </Badge>
                            )}
                            {folder.stats.totalDocuments === 0 && folder.stats.requiredTemplates === 0 && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Empty
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {folder.stats.totalDocuments} document{folder.stats.totalDocuments !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        {/* Template requirements */}
                        {folder.templateInfo && folder.templateInfo.length > 0 && (
                          <div className="mb-4 rounded-md border bg-muted/30 p-3">
                            <h4 className="mb-2 text-sm font-medium">Mandatory Documents</h4>
                            <div className="flex flex-wrap gap-2">
                              {folder.templateInfo.filter(t => t.isMandatory).map((template) => (
                                <Badge
                                  key={template.id}
                                  variant={template.hasFulfilledDocument ? "default" : "outline"}
                                  className={template.hasFulfilledDocument ? "bg-green-100 text-green-800" : ""}
                                >
                                  {template.hasFulfilledDocument && <CheckCircle className="mr-1 h-3 w-3" />}
                                  {template.name}
                                </Badge>
                              ))}
                              {folder.templateInfo.filter(t => t.isMandatory).length === 0 && (
                                <span className="text-sm text-muted-foreground">No mandatory documents for this folder</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Documents list */}
                        {folder.documents.length > 0 ? (
                          <div className="space-y-2">
                            {folder.documents.map((doc) => (
                              <Link 
                                key={doc.id} 
                                href={`/documents/${doc.id}`}
                                className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                                data-testid={`folder-doc-${doc.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{doc.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {docMetaLine(doc)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                  <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={doc.expiryDate} />
                                  <span className="text-sm text-muted-foreground">
                                    {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">No documents in this folder yet</p>
                            {selectedSiteId && selectedSiteId !== "all" ? (
                              <Button className="mt-3" size="sm" asChild>
                                <Link href={uploadUrl}>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Document
                                </Link>
                              </Button>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="mt-3">
                                      <Button size="sm" disabled>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Document
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs whitespace-normal text-xs">
                                    Select a specific site first to upload a document
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}

                        {/* Child folders - always show section if there are child folders in the template */}
                        {folder.childFolders && folder.childFolders.length > 0 && (
                          <div className="mt-4 border-t pt-4">
                            <h4 className="mb-3 text-sm font-medium">Sub-folders ({folder.childFolders.length})</h4>
                            <div className="space-y-2">
                              {folder.childFolders.map((child) => (
                                <div key={child.id} className="rounded-md border bg-muted/30 p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Folder className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{child.name}</span>
                                      {child.isMandatory && (
                                        <Badge variant="outline" className="text-xs">Mandatory</Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {child.documents.length} documents
                                    </span>
                                  </div>
                                  {child.documents.length > 0 ? (
                                    <div className="mt-2 space-y-1 pl-6">
                                      {child.documents.map((doc) => (
                                        <Link
                                          key={doc.id}
                                          href={`/documents/${doc.id}`}
                                          className="flex items-center justify-between rounded-md border bg-background p-2 hover-elevate"
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium truncate">{doc.title}</p>
                                              <p className="text-xs text-muted-foreground truncate">{docMetaLine(doc)}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                                            <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={doc.expiryDate} />
                                          </div>
                                        </Link>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2 pl-6 text-sm text-muted-foreground">No documents uploaded yet</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <FolderOpen className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No folders configured</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply folder templates to organise documents for this module
                </p>
                {canManageFolders && (
                  <Button className="mt-4" onClick={() => setShowProvisionDialog(true)}>
                    <FolderTree className="mr-2 h-4 w-4" />
                    Apply Templates
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unfiled Documents */}
          {hierarchy?.unfiledDocuments && hierarchy.unfiledDocuments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unfiled Documents</CardTitle>
                <CardDescription>Documents not assigned to any folder</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hierarchy.unfiledDocuments.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                        <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={doc.expiryDate} />
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(doc.updatedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Folder View - No Site Selected */}
      {viewMode === "folder" && selectedSiteId === "all" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Select a site</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a site to view documents organised by folder
            </p>
          </CardContent>
        </Card>
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
              <div className="flex flex-wrap gap-3">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40" data-testid="select-document-type">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(documentTypeLabels).map(([value, label]) => (
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
                    <SelectItem value="approval_required">Approval Required</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
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
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="hover-elevate" data-testid={`row-document-${doc.id}`}>
                    <TableCell>
                      <Link href={`/documents/${doc.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {docMetaLine(doc, true)}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="font-normal">
                          {documentTypeLabels[doc.type]}
                        </Badge>
                        {doc.isSharedLink ? (
                          <Badge variant="outline" className={`text-xs ${doc.sharedScope === "group" ? "border-purple-400 text-purple-600 dark:text-purple-400" : "border-blue-400 text-blue-600 dark:text-blue-400"}`} title={doc.sharedFromEntityName ? `Source: ${doc.sharedFromEntityName}` : undefined}>
                            Shared from {doc.sharedScope === "group" ? "Group" : "Company"}{doc.sharedFromEntityName ? `: ${doc.sharedFromEntityName}` : ""}
                          </Badge>
                        ) : (
                          <>
                            {doc.scope === "company" && (
                              <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400">Company</Badge>
                            )}
                            {doc.scope === "group" && (
                              <Badge variant="outline" className="text-xs border-purple-400 text-purple-600 dark:text-purple-400">Group</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge isMandatory={doc.isMandatory} status={doc.status} approvalStatus={doc.approvalStatus} renewalDate={(doc as any).renewalDate} expiryDate={(doc as any).expiryDate} />
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} expiryDate={doc.expiryDate} />
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
                            <Link href={`/documents/${doc.id}`} data-testid={`link-view-details-${doc.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              {doc.isSharedLink ? "View Source Document" : "View Details"}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          {canManageFolders && !doc.isSharedLink && folders && folders.length > 0 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <MoveRight className="mr-2 h-4 w-4" />
                                Move to Folder
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem 
                                  onClick={() => moveDocumentMutation.mutate({ documentId: doc.id, folderId: null })}
                                  data-testid={`button-move-to-root-${doc.id}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  No Folder
                                </DropdownMenuItem>
                                {folders.map((folder) => (
                                  <DropdownMenuItem 
                                    key={folder.id}
                                    onClick={() => moveDocumentMutation.mutate({ documentId: doc.id, folderId: folder.id })}
                                    data-testid={`button-move-to-folder-${folder.id}-${doc.id}`}
                                  >
                                    <Folder className="mr-2 h-4 w-4" />
                                    {folder.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}
                          {isPrivilegedUser && !doc.isSharedLink && (
                            <>
                              <DropdownMenuSeparator />
                              {doc.isArchived ? (
                                <DropdownMenuItem 
                                  onClick={() => restoreMutation.mutate(doc.id)}
                                  data-testid={`button-restore-${doc.id}`}
                                >
                                  <History className="mr-2 h-4 w-4" />
                                  Restore from Archive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => archiveMutation.mutate({ id: doc.id })}
                                  data-testid={`button-archive-${doc.id}`}
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first document to get started"}
              </p>
              {!searchQuery && typeFilter === "all" && statusFilter === "all" && (
                selectedSiteId && selectedSiteId !== "all" ? (
                  <Button className="mt-4" asChild>
                    <Link href={uploadUrl}>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </Link>
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="mt-4">
                          <Button disabled>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Document
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs whitespace-normal text-xs">
                        Select a specific site first to upload a document
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
}

function DocumentDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  // Full-permission clients whose company IS the document entity can also manage shares (origin-side)
  const isFullPermClientOrigin = (doc?: { scope?: string | null; entityId?: string | null }) =>
    user?.role === "client" && user?.clientPermissionRole === "full" && !!doc?.entityId && user?.companyId === doc.entityId;
  const [feedback, setFeedback] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "changes">("approve");
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [reissueNote, setReissueNote] = useState("");
  const [reissueBase, setReissueBase] = useState<"today" | "last_approval">("today");
  const [reissueRenewalMonths, setReissueRenewalMonths] = useState<number | null>(null);
  const [editComplianceMode, setEditComplianceMode] = useState<"none" | "renewal" | "expiry">("none");
  const [editRenewalPeriodMonths, setEditRenewalPeriodMonths] = useState<number | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [editIsRequired, setEditIsRequired] = useState(false);
  const [complianceDirty, setComplianceDirty] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { data: document, isLoading } = useQuery<EnrichedDocument>({
    queryKey: ["/api/documents", id],
  });

  const { data: versions } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", id, "versions"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/documents", id, "audit"],
  });

  const { data: documentShares, refetch: refetchShares } = useQuery<{ id: string; entityType: string; entityId: string; entityName: string | null }[]>({
    queryKey: ["/api/documents", id, "shares"],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}/shares`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(id && document && !document.isSharedLink && (document.scope === "company" || document.scope === "group")),
  });

  const removeShareMutation = useMutation({
    mutationFn: async ({ entityId, entityType }: { entityId: string; entityType: string }) => {
      const res = await fetch(`/api/documents/${id}/shares/${entityId}?entityType=${entityType}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove share");
      }
    },
    onSuccess: () => {
      refetchShares();
      toast({ title: "Share removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot remove share", description: err.message, variant: "destructive" });
    },
  });

  // State for add-destination picker
  const [selectedAddDestId, setSelectedAddDestId] = useState<string>("");

  // Available sites for company-scoped docs (all sites of the owning entity company)
  const { data: entitySites } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/sites", { companyId: document?.entityId }],
    queryFn: async () => {
      if (!document?.entityId) return [];
      const res = await fetch(`/api/sites?companyId=${document.entityId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sites ?? []);
    },
    enabled: !!(document && !document.isSharedLink && document.scope === "company" && document.entityId && (isPrivilegedUser || isFullPermClientOrigin(document))),
  });

  // Available member companies for group-scoped docs (companies with matching groupOwnerId)
  const { data: memberCompaniesData } = useQuery<{ companies: { id: string; name: string }[] }>({
    queryKey: ["/api/companies", { groupOwnerId: document?.entityId }],
    queryFn: async () => {
      if (!document?.entityId) return { companies: [] };
      const res = await fetch(`/api/companies?groupOwnerId=${document.entityId}&limit=1000`, { credentials: "include" });
      if (!res.ok) return { companies: [] };
      return res.json();
    },
    enabled: !!(document && !document.isSharedLink && document.scope === "group" && document.entityId && (isPrivilegedUser || isFullPermClientOrigin(document))),
  });

  // Destinations not yet shared
  const sharedEntityIds = new Set((documentShares ?? []).map(s => s.entityId));
  const availableAddDestinations = document?.scope === "company"
    ? (entitySites ?? []).filter(s => !sharedEntityIds.has(s.id))
    : (memberCompaniesData?.companies ?? []).filter(c => !sharedEntityIds.has(c.id));

  const addShareMutation = useMutation({
    mutationFn: async ({ entityId, entityType }: { entityId: string; entityType: string }) => {
      const res = await fetch(`/api/documents/${id}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entityId, entityType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add share");
      }
    },
    onSuccess: () => {
      setSelectedAddDestId("");
      refetchShares();
      toast({ title: "Destination added" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot add destination", description: err.message, variant: "destructive" });
    },
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
    queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
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

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("PATCH", `/api/documents/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      setEditingTitle(false);
      toast({ title: "Document renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename document", variant: "destructive" });
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

  const approvalMutation = useMutation({
    mutationFn: async (data: { action: string; feedback?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/approval`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      setShowApprovalDialog(false);
      setFeedback("");
      toast({
        title: "Success",
        description: `Document has been ${approvalAction === "approve" ? "approved" : "returned for changes"}`,
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

  const reissueMutation = useMutation({
    mutationFn: async (data: { renewalBase?: string; note?: string; renewalPeriodMonths?: number | null }) => {
      return apiRequest("POST", `/api/documents/${id}/reissue`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
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

  if (isLoading) {
    return <FetchingOverlay />;
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-semibold">Document not found</h2>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            {isPrivilegedUser && editingTitle ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  className="text-3xl font-semibold bg-transparent border-b-2 border-primary focus:outline-none min-w-0 w-96 max-w-full"
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && titleDraft.trim()) renameMutation.mutate(titleDraft.trim());
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  autoFocus
                  data-testid="input-document-title"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => { if (titleDraft.trim()) renameMutation.mutate(titleDraft.trim()); }}
                  disabled={renameMutation.isPending || !titleDraft.trim()}
                  data-testid="button-save-title"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setEditingTitle(false)}
                  data-testid="button-cancel-title"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-semibold">{document.title}</h1>
                {isPrivilegedUser && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => { setTitleDraft(document.title); setEditingTitle(true); }}
                    data-testid="button-edit-title"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
              <ComplianceBadge isMandatory={document.isMandatory} status={document.status} approvalStatus={document.approvalStatus} />
              <DocumentStatusBadge status={document.status} approvalStatus={document.approvalStatus} expiryDate={document.expiryDate} />
            </div>
          </div>
        </div>
        {document.isSharedLink && (
          <div className="w-full rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-2.5 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2 mt-2" data-testid="banner-shared-link">
            <span className="font-medium shrink-0">Shared from {document.sharedFromEntityName ?? (document.sharedScope === "group" ? "Group" : "Company")}.</span>
            <span>This is a read-only shared link. To edit, replace, or approve this document, sign in to the owning {document.sharedScope === "group" ? "group owner" : "company"} account{document.sharedFromEntityName ? ` (${document.sharedFromEntityName})` : ""}.</span>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          {document.approvalStatus === "pending" && !document.isSharedLink && (
            <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-review">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Review Document</DialogTitle>
                  <DialogDescription>
                    Provide your feedback and approval decision for this document.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-3">
                    <Button
                      variant={approvalAction === "approve" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("approve")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant={approvalAction === "changes" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("changes")}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Request Changes
                    </Button>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Feedback</label>
                    <Textarea
                      placeholder="Add your comments or feedback..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="mt-2"
                      data-testid="textarea-feedback"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleApproval} 
                    disabled={approvalMutation.isPending}
                    data-testid="button-submit-review"
                  >
                    {approvalMutation.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="divide-y divide-border pb-3">
                <div className="grid grid-cols-2 gap-x-6 px-6 py-2.5">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File Name</dt>
                    <dd className="mt-0.5 text-sm font-medium font-mono">{document.fileName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File Size</dt>
                    <dd className="mt-0.5 text-sm font-medium">{(document.fileSize / 1024).toFixed(1)} KB</dd>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 px-6 py-2.5">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
                    <dd className="mt-0.5 text-sm font-medium">{document.createdAt && format(new Date(document.createdAt), "MMM d, yyyy")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last Modified</dt>
                    <dd className="mt-0.5 text-sm font-medium">{document.updatedAt && format(new Date(document.updatedAt), "MMM d, yyyy")}</dd>
                  </div>
                </div>
                {(document.expiryDate || document.templateId) && (() => {
                  const template = document.templateId ? templates?.find((t: any) => t.id === document.templateId) : null;
                  return (
                    <div className="grid grid-cols-2 gap-x-6 px-6 py-2.5">
                      {document.expiryDate ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry Date</dt>
                          <dd className="mt-0.5 text-sm font-medium">{format(new Date(document.expiryDate), "MMM d, yyyy")}</dd>
                        </div>
                      ) : <div />}
                      {template ? (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template</dt>
                          <dd className="mt-0.5 text-sm font-medium">{template.name}</dd>
                        </div>
                      ) : <div />}
                    </div>
                  );
                })()}
                {document.comments && (
                  <div className="px-6 py-2.5">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Comments</dt>
                    <dd className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{document.comments}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible>
            <AccordionItem value="version-history" className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" />
                  Version History
                  {versions && versions.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{versions.length}</span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {versions && versions.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    {[...versions]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between gap-4 rounded-md border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
                              {(version as any).versionLabel ?? `v${version.version}`}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{version.fileName}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm text-muted-foreground">
                              {version.createdAt && format(new Date(version.createdAt), "dd MMM yyyy, HH:mm")}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {version.createdAt && formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No version history available
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="space-y-6">
          {isPrivilegedUser && (
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
                  ) : document?.isSharedLink ? (
                    <div className="flex items-center justify-between px-1" data-testid="compliance-required-toggle">
                      <span className="text-sm text-muted-foreground">Mandatory</span>
                      <Badge variant="outline" className="text-xs" data-testid="badge-mandatory-shared">{editIsRequired ? "Mandatory" : "Not mandatory"}</Badge>
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
                          {document.renewalDate && (
                            <span className="text-xs text-gray-500/80 dark:text-gray-400/80">Renewal due {format(new Date(document.renewalDate), "d MMM yyyy")}</span>
                          )}
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

                {isPrivilegedUser && !document.isSharedLink && !document.isArchived && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => { setShowReissueDialog(true); setReissueRenewalMonths(document.renewalPeriodMonths ?? null); }}
                      data-testid="button-reissue"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-issue Document
                    </Button>
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
                  </>
                )}

                <div className="border-t border-border" />

                {/* Section 3: Renewal & Expiry */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Renewal & Expiry</p>
                  {document?.isSharedLink ? (
                    // Shared links: read-only view — editing must be done at source
                    <div className="px-1 py-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {document.expiryDate
                          ? `Expires ${format(new Date(document.expiryDate), "d MMM yyyy")}`
                          : document.renewalPeriodMonths
                          ? `Renewal every ${document.renewalPeriodMonths} month${document.renewalPeriodMonths === 1 ? "" : "s"}`
                          : "No expiry or renewal"}
                      </p>
                      <p className="text-xs text-muted-foreground/60">Renewal and expiry settings are managed at the source document.</p>
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

          {/* Shared with section — only for origin users on company/group-scope docs */}
          {document && !document.isSharedLink && (document.scope === "company" || document.scope === "group") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Shared with
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {document.scope === "company"
                    ? "Sites within this company that have access to this document as a shared link."
                    : "Member companies that have access to this document as a shared link."}
                </p>
              </CardHeader>
              <CardContent>
                {documentShares && documentShares.length > 0 ? (
                  <ul className="divide-y">
                    {documentShares.map((share) => (
                      <li key={share.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{share.entityName ?? share.entityId}</span>
                          <Badge variant="outline" className="text-xs capitalize">{share.entityType}</Badge>
                        </div>
                        {(isPrivilegedUser || isFullPermClientOrigin(document)) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={documentShares.length <= 1 || removeShareMutation.isPending}
                            title={documentShares.length <= 1 ? "Cannot remove the last share destination" : "Remove this share"}
                            onClick={() => removeShareMutation.mutate({ entityId: share.entityId, entityType: share.entityType })}
                            data-testid={`button-remove-share-${share.entityId}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No destinations found.
                  </p>
                )}
                {/* Informational note when at last share — scope-change back to site-only is deferred */}
                {(isPrivilegedUser || isFullPermClientOrigin(document)) && documentShares && documentShares.length <= 1 && (
                  <p className="mt-2 text-xs text-muted-foreground" data-testid="text-last-share-note">
                    At least one share destination is required for {document.scope}-scoped documents. To restrict this document to a single site, archive it and re-upload as a site-scoped document.
                  </p>
                )}
                {/* Add destination control — shown to origin-side users when unshared destinations exist */}
                {(isPrivilegedUser || isFullPermClientOrigin(document)) && availableAddDestinations.length > 0 && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Select value={selectedAddDestId} onValueChange={setSelectedAddDestId}>
                      <SelectTrigger className="flex-1 h-8 text-sm" data-testid="select-add-share-destination">
                        <SelectValue placeholder={document?.scope === "company" ? "Add a site…" : "Add a company…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAddDestinations.map((dest) => (
                          <SelectItem key={dest.id} value={dest.id}>{dest.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!selectedAddDestId || addShareMutation.isPending}
                      onClick={() => {
                        if (!selectedAddDestId) return;
                        const entityType = document?.scope === "company" ? "site" : "company";
                        addShareMutation.mutate({ entityId: selectedAddDestId, entityType });
                      }}
                      data-testid="button-add-share-destination"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="relative space-y-4">
                  <div className="absolute bottom-0 left-3 top-0 w-px bg-border" />
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-8">
                      <div className="absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                        {log.action.includes("approved") ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : log.action.includes("rejected") ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : log.action.includes("comment") ? (
                          <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{log.userName}</span>{" "}
                          <span className="text-muted-foreground">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </p>
                        {log.details && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{log.details}</p>
                        )}
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No activity recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Documents() {
  const [matchList] = useRoute("/documents");
  const [, params] = useRoute("/documents/:id");

  if (params?.id && params.id !== "upload") {
    return <DocumentDetailView id={params.id} />;
  }

  return <DocumentsListView />;
}
