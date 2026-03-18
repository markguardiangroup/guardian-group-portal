import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Document, DocumentType, DocumentVersion, AuditLog, DocumentFolder, Site, ModuleType, DocumentStatus, ApprovalStatus } from "@shared/schema";

// Type for the documents hierarchy API response
interface DocumentHierarchyDocument {
  id: string;
  title: string;
  fileName: string;
  status: DocumentStatus;
  approvalStatus: ApprovalStatus;
  isRequired: boolean;
  source: string;
  templateId: string | null;
  expiryDate: string | null;
  updatedAt: string;
}

interface FolderStats {
  totalDocuments: number;
  compliant: number;
  reviewRequired: number;
  overdue: number;
  pendingApproval?: number;
  requiredTemplates: number;
  fulfilledRequired: number;
  folderStatus?: "compliant" | "incomplete" | "attention_needed";
}

interface TemplateInfo {
  id: string;
  name: string;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  hasFulfilledDocument: boolean;
}

interface ChildFolder {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  siteFolder: { id: string; name: string } | null;
  documents: DocumentHierarchyDocument[];
  stats: FolderStats;
}

interface HierarchyFolder {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
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
    reviewRequired: number;
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
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [provisionModule, setProvisionModule] = useState<string>("health_safety");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");
  const [newFolderModule, setNewFolderModule] = useState<string>("health_safety");
  const [viewMode, setViewMode] = useState<ViewMode>("folder");
  const [selectedModule, setSelectedModule] = useState<string>("health_safety");

  const [showArchived, setShowArchived] = useState(false);

  const { data: documents, isLoading } = useQuery<Document[]>({
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

  const canManageFolders = user?.role === "admin" || user?.role === "consultant";

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

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage compliance documents and approvals
          </p>
        </div>
        <Button asChild>
          <Link href="/documents/upload" data-testid="button-upload-document">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Link>
        </Button>
      </div>

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
          {isLoadingHierarchy ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
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
                            {folder.stats.folderStatus === "incomplete" && (
                              <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
                                <Clock className="mr-1 h-3 w-3" />
                                {folder.stats.fulfilledRequired}/{folder.stats.requiredTemplates} Required
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
                            <h4 className="mb-2 text-sm font-medium">Required Documents</h4>
                            <div className="flex flex-wrap gap-2">
                              {folder.templateInfo.filter(t => t.isRequired).map((template) => (
                                <Badge
                                  key={template.id}
                                  variant={template.hasFulfilledDocument ? "default" : "outline"}
                                  className={template.hasFulfilledDocument ? "bg-green-100 text-green-800" : ""}
                                >
                                  {template.hasFulfilledDocument && <CheckCircle className="mr-1 h-3 w-3" />}
                                  {template.name}
                                </Badge>
                              ))}
                              {folder.templateInfo.filter(t => t.isRequired).length === 0 && (
                                <span className="text-sm text-muted-foreground">No required documents for this folder</span>
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
                                      {doc.fileName} • {doc.source === "template" ? "From Template" : "Uploaded"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                                  <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
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
                            <Button className="mt-3" size="sm" asChild>
                              <Link href="/documents/upload">
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Document
                              </Link>
                            </Button>
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
                                      {child.isRequired && (
                                        <Badge variant="outline" className="text-xs">Required</Badge>
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
                                          <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{doc.title}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                                            <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
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
                        <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
                        <DocumentStatusBadge status={doc.status} approvalStatus={doc.approvalStatus} />
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
                    <SelectItem value="review_required">Review Required</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
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
                            v{doc.version} • {doc.fileName}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {documentTypeLabels[doc.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge isRequired={doc.isRequired} status={doc.status} approvalStatus={doc.approvalStatus} />
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
                            <Link href={`/documents/${doc.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          {canManageFolders && folders && folders.length > 0 && (
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
                          {isPrivilegedUser && (
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
                <Button className="mt-4" asChild>
                  <Link href="/documents/upload">
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
  );
}

function DocumentDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  const [feedback, setFeedback] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "changes">("approve");
  const [editComplianceMode, setEditComplianceMode] = useState<"none" | "renewal" | "expiry">("none");
  const [editRenewalPeriodMonths, setEditRenewalPeriodMonths] = useState<number | null>(null);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  const [editIsRequired, setEditIsRequired] = useState(false);
  const [complianceDirty, setComplianceDirty] = useState(false);

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
  });

  const { data: versions } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", id, "versions"],
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

  const approvalMutation = useMutation({
    mutationFn: async (data: { action: string; feedback?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/approval`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
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

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">{document.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
              <ComplianceBadge isRequired={document.isRequired} status={document.status} approvalStatus={document.approvalStatus} />
              <DocumentStatusBadge status={document.status} approvalStatus={document.approvalStatus} />
              <span className="text-sm text-muted-foreground">Version {document.version}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          {document.approvalStatus === "pending" && (
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
                    <Button
                      variant={approvalAction === "reject" ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("reject")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
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
            <CardContent className="space-y-4">
              {document.templateId && (() => {
                const template = templates?.find((t: any) => t.id === document.templateId);
                return template ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Template</h4>
                    <p className="mt-1">{template.name}</p>
                  </div>
                ) : null;
              })()}
              {document.comments && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Comments</h4>
                  <p className="mt-1">{document.comments}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">File Name</h4>
                  <p className="mt-1 font-mono text-sm">{document.fileName}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">File Size</h4>
                  <p className="mt-1">{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                  <p className="mt-1">
                    {document.createdAt && format(new Date(document.createdAt), "PPP")}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Last Modified</h4>
                  <p className="mt-1">
                    {document.updatedAt && format(new Date(document.updatedAt), "PPP")}
                  </p>
                </div>
                {document.reviewDate && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Review Date</h4>
                    <p className="mt-1">{format(new Date(document.reviewDate), "PPP")}</p>
                  </div>
                )}
                {document.expiryDate && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Expiry Date</h4>
                    <p className="mt-1">{format(new Date(document.expiryDate), "PPP")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions && versions.length > 0 ? (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-4 rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          v{version.version}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{version.fileName}</p>
                          {version.changeNote && (
                            <p className="text-sm text-muted-foreground">{version.changeNote}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
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
