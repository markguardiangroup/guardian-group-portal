import { useQuery, useMutation } from "@tanstack/react-query";
import { PdfViewer } from "@/components/pdf-viewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  Folder,
  FolderOpen,
  FolderTree,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Upload,
  FileText,
  File,
  FileSpreadsheet,
  Headphones,
  BookOpen,
  History,
  Eye,
  Filter,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  X,
  Wand2,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Check,
  CircleDot,
  GripVertical,
  Inbox,
  Lock,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FolderTemplate, DocumentTemplate, DocumentTypeRecord, FolderDocumentTypeRule, ModuleType } from "@shared/schema";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

const moduleIcons: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
  support: Headphones,
};

const moduleNames: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  support: "Support",
};

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

const moduleGradients: Record<string, string> = {
  health_safety: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
  human_resources: "from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10",
  employment_law: "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
  support: "from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-500/20 dark:via-purple-500/10",
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  if (mimeType.includes("document") || mimeType.includes("word")) {
    return FileText;
  }
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadFile = async (fileUrl: string, fileName: string) => {
  try {
    const response = await fetch(`${fileUrl}?download=${encodeURIComponent(fileName)}`);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decodeURIComponent(fileName);
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Download error:', error);
  }
};

type TemplateFormData = {
  name: string;
  description: string;
  synopsis: string;
  module: ModuleType;
  folderTemplateId: string;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  requiresApproval: boolean;
  visibility: "public" | "private";
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  placeholders: string;
  sortOrder: number;
  createNewFolder: boolean;
  newFolderName: string;
  toolkitFolderId: string;
  createNewToolkitFolder: boolean;
  newToolkitFolderName: string;
};

type BulkSharedSettings = {
  module: ModuleType;
  folderTemplateId: string;
  createNewFolder: boolean;
  newFolderName: string;
  requiresApproval: boolean;
  renewalPeriodMonths: number | null;
  visibility: "public" | "private";
  toolkitFolderId: string;
  createNewToolkitFolder: boolean;
  newToolkitFolderName: string;
};

type BulkFileItem = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  objectPath: string;
  name: string;
  description: string;
  status: "uploading" | "ready" | "creating" | "done" | "error";
  error?: string;
};

const defaultBulkSharedSettings: BulkSharedSettings = {
  module: "health_safety",
  folderTemplateId: "",
  createNewFolder: false,
  newFolderName: "",
  requiresApproval: true,
  renewalPeriodMonths: null,
  visibility: "private",
  toolkitFolderId: "",
  createNewToolkitFolder: false,
  newToolkitFolderName: "",
};

type FolderFormData = {
  name: string;
  module: ModuleType;
  description: string;
  parentId: string | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
};

type DocTypeFormData = {
  name: string;
  module: ModuleType;
  folderTemplateId: string;
  description: string;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  sortOrder: number;
  isActive: boolean;
};

const defaultTemplateFormData: TemplateFormData = {
  name: "",
  description: "",
  synopsis: "",
  module: "health_safety",
  folderTemplateId: "",
  isRequired: false,
  renewalPeriodMonths: null,
  requiresApproval: true,
  visibility: "private",
  fileName: "",
  fileUrl: "",
  fileSize: 0,
  mimeType: "",
  placeholders: "",
  sortOrder: 0,
  createNewFolder: false,
  newFolderName: "",
  toolkitFolderId: "",
  createNewToolkitFolder: false,
  newToolkitFolderName: "",
};

const defaultFolderFormData: FolderFormData = {
  name: "",
  module: "health_safety",
  description: "",
  parentId: null,
  isRequired: false,
  sortOrder: 0,
  isActive: true,
};

const defaultDocTypeFormData: DocTypeFormData = {
  name: "",
  module: "health_safety",
  folderTemplateId: "",
  description: "",
  isRequired: false,
  renewalPeriodMonths: null,
  sortOrder: 0,
  isActive: true,
};

type WizardStep = "module" | "folder" | "doctype" | "template" | "complete";

type WizardData = {
  module: ModuleType;
  folderId: string;
  folderName: string;
  createNewFolder: boolean;
  newFolderName: string;
  docTypeName: string;
  docTypeDescription: string;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  addTemplate: boolean;
  templateName: string;
  templateFileName: string;
  templateDescription: string;
};

const defaultWizardData: WizardData = {
  module: "health_safety",
  folderId: "",
  folderName: "",
  createNewFolder: false,
  newFolderName: "",
  docTypeName: "",
  docTypeDescription: "",
  isRequired: false,
  renewalPeriodMonths: null,
  addTemplate: false,
  templateName: "",
  templateFileName: "",
  templateDescription: "",
};

type RuleWithDocType = FolderDocumentTypeRule & { documentType?: DocumentTypeRecord };

function DroppableFolderContent({
  folderId,
  isOver,
  children,
}: {
  folderId: string;
  isOver: boolean;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `folder-${folderId}`, data: { folderId } });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[32px] rounded-md transition-colors ${isOver ? "bg-primary/10 ring-1 ring-primary ring-inset" : ""}`}
    >
      {children}
    </div>
  );
}

function DroppableFolderAccordionItem({
  folderId,
  isOver,
  children,
  className,
}: {
  folderId: string;
  isOver: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id: `folder-header-${folderId}`, data: { folderId } });
  return (
    <div
      ref={setNodeRef}
      className={`${className || ""} transition-all ${isOver ? "ring-2 ring-primary ring-offset-1 rounded-lg" : ""}`}
    >
      {children}
    </div>
  );
}

function DroppableUnassignedContent({
  moduleId,
  isOver,
  children,
}: {
  moduleId: string;
  isOver: boolean;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `__unassigned_${moduleId}__`, data: { folderId: null } });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-dashed transition-colors mt-3 ${isOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
    >
      {children}
    </div>
  );
}

function DraggableTemplateCard({ template, isAdmin, renderCard }: {
  template: DocumentTemplate;
  isAdmin: boolean;
  renderCard: (dragHandleProps: Record<string, unknown> | undefined) => JSX.Element | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: template.id,
    data: { template },
    disabled: !isAdmin,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 999 : undefined }
    : { opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {renderCard(listeners as Record<string, unknown> | undefined)}
    </div>
  );
}

export default function TemplateLibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const canDelete = user?.role === "admin" || (user?.role === "consultant" && user?.consultantTier === "pro");
  
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleType | "all">("all");
  const [requiredFilter, setRequiredFilter] = useState<"all" | "required" | "optional">("all");
  const [renewalFilter, setRenewalFilter] = useState<"all" | "has_renewal" | "no_renewal">("all");
  const [approvalFilter, setApprovalFilter] = useState<"all" | "needs_approval" | "auto_compliant">("all");
  
  // Template dialogs
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isVersionUploadDialogOpen, setIsVersionUploadDialogOpen] = useState(false);
  const [isVersionHistoryDialogOpen, setIsVersionHistoryDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);
  const [versionUploadTemplate, setVersionUploadTemplate] = useState<DocumentTemplate | null>(null);
  const [versionChangeNote, setVersionChangeNote] = useState("");
  const [newVersionFile, setNewVersionFile] = useState<{ objectPath: string; fileName: string; fileSize: number; mimeType: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState<TemplateFormData>(defaultTemplateFormData);

  // Bulk add template state
  const [bulkShared, setBulkShared] = useState<BulkSharedSettings>(defaultBulkSharedSettings);
  const [bulkFileItems, setBulkFileItems] = useState<BulkFileItem[]>([]);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  
  // Folder dialogs
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isEditFolderDialogOpen, setIsEditFolderDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderTemplate | null>(null);
  const [folderFormData, setFolderFormData] = useState<FolderFormData>(defaultFolderFormData);
  
  // Document type dialogs
  const [isDocTypeDialogOpen, setIsDocTypeDialogOpen] = useState(false);
  const [isEditDocTypeDialogOpen, setIsEditDocTypeDialogOpen] = useState(false);
  const [isAssignFolderDialogOpen, setIsAssignFolderDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeRecord | null>(null);
  const [docTypeFormData, setDocTypeFormData] = useState<DocTypeFormData>(defaultDocTypeFormData);
  const [selectedFolderIdForAssign, setSelectedFolderIdForAssign] = useState<string>("");
  
  // Setup wizard
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("module");
  const [wizardData, setWizardData] = useState<WizardData>(defaultWizardData);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [createdFolderId, setCreatedFolderId] = useState<string | null>(null);
  const [createdDocTypeId, setCreatedDocTypeId] = useState<string | null>(null);
  
  // Archive confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Permanent delete confirmation
  const [isPermanentDeleteDialogOpen, setIsPermanentDeleteDialogOpen] = useState(false);
  const [templateToPermanentlyDelete, setTemplateToPermanentlyDelete] = useState<DocumentTemplate | null>(null);
  const [permanentDeleteReason, setPermanentDeleteReason] = useState("");
  
  // Folder delete confirmation
  const [folderToDelete, setFolderToDelete] = useState<FolderTemplate | null>(null);
  
  // Doc type delete confirmation  
  const [docTypeToDelete, setDocTypeToDelete] = useState<DocumentTypeRecord | null>(null);
  
  // Queries
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });
  
  // Archived templates query
  const { data: archivedTemplates = [], isLoading: archivedLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates-archived"],
  });
  
  // Show archived toggle
  const [showArchived, setShowArchived] = useState(false);
  
  // Folder expansion state - starts collapsed by default
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  
  const { data: folderTemplates = [], isLoading: foldersLoading } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });
  
  const { data: documentTypes = [], isLoading: docTypesLoading } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });
  
  const { data: folderRules = [] } = useQuery<FolderDocumentTypeRule[]>({
    queryKey: ["/api/folder-document-type-rules"],
  });

  const { data: toolkitFolders = [] } = useQuery<Array<{ id: string; name: string; module: string; sortOrder: number }>>({
    queryKey: ["/api/toolkit/folders"],
  });
  
  // Helper to invalidate documents hierarchy cache (depends on folder/document templates)
  const invalidateDocumentsHierarchy = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        return query.queryKey.some(
          (key) => typeof key === 'string' && key.includes('documents-hierarchy')
        );
      }
    });
  };
  
  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<TemplateFormData>) => {
      return apiRequest("POST", "/api/document-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      invalidateDocumentsHierarchy();
      setIsTemplateDialogOpen(false);
      setTemplateFormData(defaultTemplateFormData);
      toast({ title: "Template created", description: "The document template has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create template", variant: "destructive" });
    },
  });
  
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormData> }) => {
      return apiRequest("PATCH", `/api/document-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      invalidateDocumentsHierarchy();
      setIsEditTemplateDialogOpen(false);
      setSelectedTemplate(null);
      toast({ title: "Template updated", description: "The document template has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update template", variant: "destructive" });
    },
  });
  
  const deleteTemplateMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("DELETE", `/api/document-templates/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates-archived"] });
      invalidateDocumentsHierarchy();
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
      setDeleteReason("");
      toast({ title: "Template archived", description: "The document template has been archived with full audit trail." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to archive template", variant: "destructive" });
    },
  });
  
  const permanentDeleteTemplateMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("DELETE", `/api/document-templates/${id}/permanent`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates-archived"] });
      invalidateDocumentsHierarchy();
      setIsPermanentDeleteDialogOpen(false);
      setTemplateToPermanentlyDelete(null);
      setPermanentDeleteReason("");
      toast({ title: "Template permanently deleted", description: "The document template has been permanently removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to permanently delete template", variant: "destructive" });
    },
  });

  const restoreTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/document-templates/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates-archived"] });
      invalidateDocumentsHierarchy();
      toast({ title: "Template restored", description: "The document template has been restored and is now active." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to restore template", variant: "destructive" });
    },
  });

  const uploadVersionMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: { fileName: string; fileUrl: string; fileSize: number; mimeType: string; changeNote?: string } }) => {
      return apiRequest("POST", `/api/document-templates/${templateId}/versions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates", versionUploadTemplate?.id, "versions"] });
      setIsVersionUploadDialogOpen(false);
      setVersionUploadTemplate(null);
      setNewVersionFile(null);
      setVersionChangeNote("");
      toast({ title: "New version uploaded", description: "The template has been updated with a new version." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to upload new version", variant: "destructive" });
    },
  });

  // Mutation for reordering templates via drag-and-drop
  const reorderTemplatesMutation = useMutation({
    mutationFn: async (data: { folderTemplateId: string; templateOrder: Array<{ id: string; sortOrder: number }> }) => {
      return apiRequest("POST", "/api/document-templates/reorder", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Templates reordered", description: "Template order has been saved." });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Error", description: error.message || "Failed to reorder templates", variant: "destructive" });
    },
  });

  const moveFolderTemplateMutation = useMutation({
    mutationFn: async ({ templateId, folderTemplateId }: { templateId: string; folderTemplateId: string | null }) =>
      apiRequest("PATCH", `/api/document-templates/${templateId}`, { folderTemplateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Template moved", description: "Template folder assignment updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move template.", variant: "destructive" });
    },
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [overDropId, setOverDropId] = useState<string | null>(null);

  // Query for version history
  const { data: templateVersions = [] } = useQuery<Array<{ id: string; templateId: string; version: number; fileName: string; fileUrl: string | null; fileSize: number; mimeType: string | null; changeNote: string | null; uploadedBy: string; createdAt: string }>>({
    queryKey: ["/api/document-templates", selectedTemplate?.id, "versions"],
    enabled: !!selectedTemplate && isVersionHistoryDialogOpen,
  });

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: async (data: FolderFormData) => {
      return apiRequest("POST", "/api/folder-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      invalidateDocumentsHierarchy();
      setIsFolderDialogOpen(false);
      setFolderFormData(defaultFolderFormData);
      toast({ title: "Folder created", description: "The folder template has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create folder", variant: "destructive" });
    },
  });
  
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FolderFormData> }) => {
      return apiRequest("PATCH", `/api/folder-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      invalidateDocumentsHierarchy();
      setIsEditFolderDialogOpen(false);
      setSelectedFolder(null);
      toast({ title: "Folder updated", description: "The folder template has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update folder", variant: "destructive" });
    },
  });
  
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/folder-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      invalidateDocumentsHierarchy();
      toast({ title: "Folder deleted", description: "The folder template has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete folder", variant: "destructive" });
    },
  });
  
  
  // Document type mutations
  const createDocTypeMutation = useMutation({
    mutationFn: async (data: DocTypeFormData) => {
      return apiRequest("POST", "/api/document-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      setIsDocTypeDialogOpen(false);
      setDocTypeFormData(defaultDocTypeFormData);
      toast({ title: "Template type created", description: "The template type has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create template type", variant: "destructive" });
    },
  });
  
  const updateDocTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocTypeFormData> }) => {
      return apiRequest("PATCH", `/api/document-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      setIsEditDocTypeDialogOpen(false);
      setSelectedDocType(null);
      toast({ title: "Template type updated", description: "The template type has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update template type", variant: "destructive" });
    },
  });
  
  const deleteDocTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/document-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Template type deleted", description: "The template type has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete template type", variant: "destructive" });
    },
  });
  
  const assignFolderMutation = useMutation({
    mutationFn: async ({ folderTemplateId, documentTypeId }: { folderTemplateId: string; documentTypeId: string }) => {
      return apiRequest("POST", "/api/folder-document-type-rules", {
        folderTemplateId,
        documentTypeId,
        isRequired: false,
        sortOrder: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      setIsAssignFolderDialogOpen(false);
      setSelectedDocType(null);
      setSelectedFolderIdForAssign("");
      toast({ title: "Folder assigned", description: "The template type has been assigned to the folder." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to assign folder", variant: "destructive" });
    },
  });
  
  // Memoized data
  const filteredFolders = useMemo(() => {
    let folders = folderTemplates.filter(f => f.isActive);
    if (selectedModule !== "all") {
      folders = folders.filter(f => f.module === selectedModule);
    }
    return folders;
  }, [folderTemplates, selectedModule]);
  
  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (selectedModule !== "all") {
      result = result.filter(t => t.module === selectedModule);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.fileName.toLowerCase().includes(query)
      );
    }
    // Compliance filter: required vs optional
    if (requiredFilter === "required") {
      result = result.filter(t => t.isRequired === true);
    } else if (requiredFilter === "optional") {
      result = result.filter(t => t.isRequired !== true);
    }
    // Renewal filter: has renewal period vs no renewal
    if (renewalFilter === "has_renewal") {
      result = result.filter(t => t.renewalPeriodMonths !== null && t.renewalPeriodMonths !== undefined);
    } else if (renewalFilter === "no_renewal") {
      result = result.filter(t => t.renewalPeriodMonths === null || t.renewalPeriodMonths === undefined);
    }
    // Approval filter: needs approval vs auto-compliant
    if (approvalFilter === "needs_approval") {
      result = result.filter(t => t.requiresApproval !== false);
    } else if (approvalFilter === "auto_compliant") {
      result = result.filter(t => t.requiresApproval === false);
    }
    return result;
  }, [templates, selectedModule, searchQuery, requiredFilter, renewalFilter, approvalFilter]);
  
  const filteredDocTypes = useMemo(() => {
    let result = documentTypes;
    if (selectedModule !== "all") {
      result = result.filter(t => t.module === selectedModule);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.code.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    return result.sort((a, b) => {
      if (a.module !== b.module) return a.module.localeCompare(b.module);
      return a.sortOrder - b.sortOrder;
    });
  }, [documentTypes, selectedModule, searchQuery]);
  
  const docTypeToFolders = useMemo(() => {
    const lookup = new Map<string, string[]>();
    if (!folderRules || !folderTemplates) return lookup;
    
    const templateMap = new Map(folderTemplates.map(t => [t.id, t]));
    
    for (const rule of folderRules) {
      const template = templateMap.get(rule.folderTemplateId);
      if (template) {
        const existing = lookup.get(rule.documentTypeId) || [];
        existing.push(template.name);
        lookup.set(rule.documentTypeId, existing);
      }
    }
    return lookup;
  }, [folderRules, folderTemplates]);
  
  
  const availableFoldersForDocType = useMemo(() => {
    if (!selectedDocType || !folderTemplates) return [];
    return folderTemplates.filter(t => t.module === selectedDocType.module && t.isActive);
  }, [selectedDocType, folderTemplates]);
  
  const parentFolderOptions = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter(t => 
      t.module === folderFormData.module && 
      t.id !== selectedFolder?.id &&
      !t.parentId
    );
  }, [folderTemplates, folderFormData.module, selectedFolder]);
  
  // Helper functions
  const getTemplatesForFolder = (folderId: string) => {
    return filteredTemplates
      .filter(t => t.folderTemplateId === folderId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  };

  const getTotalTemplatesInFolderTree = (folderId: string): number => {
    const direct = filteredTemplates.filter(t => t.folderTemplateId === folderId).length;
    const childFolders = filteredFolders.filter(f => f.parentId === folderId);
    const childTotal = childFolders.reduce((sum, child) => sum + getTotalTemplatesInFolderTree(child.id), 0);
    return direct + childTotal;
  };
  
  const getRootFolders = (module: ModuleType) => {
    return filteredFolders.filter(f => f.module === module && !f.parentId);
  };
  
  const getChildFolders = (parentId: string) => {
    return filteredFolders.filter(f => f.parentId === parentId);
  };

  const getUnassignedTemplates = (module: string) => {
    return filteredTemplates
      .filter(t => t.module === module && !t.folderTemplateId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTemplateId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverDropId(event.over?.id as string | null ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTemplateId(null);
    setOverDropId(null);
    if (!over) return;

    const templateId = active.id as string;
    const isUnassignedDrop = (over.id as string).startsWith("__unassigned_");
    const targetFolderId = isUnassignedDrop
      ? null
      : (over.data.current?.folderId ?? null);

    const currentTemplate = templates.find(t => t.id === templateId);
    if (!currentTemplate) return;

    const currentFolderId = currentTemplate.folderTemplateId ?? null;
    if (currentFolderId === targetFolderId) return;

    moveFolderTemplateMutation.mutate({ templateId, folderTemplateId: targetFolderId });
  }, [templates, moveFolderTemplateMutation]);

  // Sort folders hierarchically: parents first, then their children immediately after
  const sortFoldersHierarchically = (folders: FolderTemplate[]) => {
    const result: FolderTemplate[] = [];
    const parentFolders = folders.filter(f => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    
    for (const parent of parentFolders) {
      result.push(parent);
      // Add children of this parent immediately after
      const children = folders.filter(f => f.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder);
      result.push(...children);
    }
    
    return result;
  };
  
  // Get all folder IDs for expand/collapse all functionality
  const getAllFolderIds = (): string[] => {
    return folderTemplates.map(f => f.id);
  };
  
  const toggleAllFolders = () => {
    const allIds = getAllFolderIds();
    if (openFolders.length === allIds.length) {
      setOpenFolders([]);
    } else {
      setOpenFolders(allIds);
    }
  };
  
  const allFoldersExpanded = openFolders.length === getAllFolderIds().length && openFolders.length > 0;
  
  const getFolderName = (folderId: string) => {
    return folderTemplates.find(f => f.id === folderId)?.name || "Unknown";
  };
  
  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    return folderTemplates.find(t => t.id === parentId)?.name || null;
  };
  
  // Template handlers
  const handleCreateTemplate = async () => {
    if (!templateFormData.name) {
      toast({ title: "Validation error", description: "Please enter a template name", variant: "destructive" });
      return;
    }
    
    if (!templateFormData.fileUrl || !templateFormData.fileName) {
      toast({ title: "Validation error", description: "Please upload a template file", variant: "destructive" });
      return;
    }
    
    // For public templates, the server auto-assigns folderTemplateId from the toolkit folder
    const isPublic = templateFormData.visibility === "public";

    let folderId = isPublic ? undefined : templateFormData.folderTemplateId;
    
    // If private: creating a new Template Library folder
    if (!isPublic && templateFormData.createNewFolder) {
      if (!templateFormData.newFolderName) {
        toast({ title: "Validation error", description: "Please fill in folder name", variant: "destructive" });
        return;
      }
      try {
        const response = await apiRequest("POST", "/api/folder-templates", {
          name: templateFormData.newFolderName,
          module: templateFormData.module,
          description: "",
          parentId: null,
          sortOrder: 0,
          isActive: true,
        });
        const newFolder = await response.json();
        folderId = newFolder.id;
        queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      } catch (error) {
        toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
        return;
      }
    }
    
    if (!isPublic && !folderId) {
      toast({ title: "Validation error", description: "Please select or create a folder", variant: "destructive" });
      return;
    }

    // If public, toolkit folder is mandatory (library folder assigned automatically by server)
    let toolkitFolderId: string | undefined = templateFormData.toolkitFolderId || undefined;
    if (isPublic) {
      if (templateFormData.createNewToolkitFolder) {
        if (!templateFormData.newToolkitFolderName) {
          toast({ title: "Validation error", description: "Please enter a Toolkit folder name", variant: "destructive" });
          return;
        }
        try {
          const response = await apiRequest("POST", "/api/toolkit/folders", {
            name: templateFormData.newToolkitFolderName,
            module: templateFormData.module,
            sortOrder: 0,
          });
          const newToolkitFolder = await response.json();
          toolkitFolderId = newToolkitFolder.id;
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit/folders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
        } catch (error) {
          toast({ title: "Error", description: "Failed to create Toolkit folder", variant: "destructive" });
          return;
        }
      } else if (!toolkitFolderId) {
        toast({ title: "Validation error", description: "Please select or create a Toolkit folder", variant: "destructive" });
        return;
      }
    }
    
    createTemplateMutation.mutate({
      name: templateFormData.name,
      description: templateFormData.description || undefined,
      synopsis: templateFormData.synopsis || undefined,
      module: templateFormData.module,
      ...(folderId ? { folderTemplateId: folderId } : {}),
      fileName: templateFormData.fileName,
      fileUrl: templateFormData.fileUrl,
      fileSize: templateFormData.fileSize || 1024,
      mimeType: templateFormData.mimeType || "application/octet-stream",
      placeholders: templateFormData.placeholders || undefined,
      sortOrder: templateFormData.sortOrder,
      isRequired: templateFormData.isRequired,
      renewalPeriodMonths: templateFormData.renewalPeriodMonths,
      requiresApproval: templateFormData.requiresApproval,
      visibility: templateFormData.visibility,
      toolkitFolderId: isPublic ? (toolkitFolderId || null) : null,
    } as any);
  };
  
  // Bulk file select handler — uploads files immediately
  const handleBulkFileSelect = async (files: FileList) => {
    const newItems: BulkFileItem[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      objectPath: "",
      name: "",
      description: "",
      status: "uploading" as const,
    }));

    setBulkFileItems((prev) => [...prev, ...newItems]);

    await Promise.all(
      Array.from(files).map(async (file, idx) => {
        const item = newItems[idx];
        try {
          const uploadRes = await fetch("/api/uploads/file", {
            method: "POST",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "X-File-Name": encodeURIComponent(file.name),
            },
            credentials: "include",
            body: file,
          });
          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(errData.error || `Upload failed: ${uploadRes.status}`);
          }
          const result = await uploadRes.json();
          setBulkFileItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, objectPath: result.objectPath, fileSize: result.fileSize, mimeType: result.mimeType, status: "ready" }
                : i
            )
          );
        } catch (err) {
          setBulkFileItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
                : i
            )
          );
        }
      })
    );
  };

  // Bulk create handler — sends one API call per ready item
  const handleBulkCreate = async () => {
    const readyItems = bulkFileItems.filter((i) => i.status === "ready");

    // Validate names
    const missingName = readyItems.find((i) => !i.name.trim());
    if (missingName) {
      toast({ title: "Validation error", description: "Please enter a name for every file", variant: "destructive" });
      return;
    }

    // For public templates, library folder is auto-assigned by the server from the toolkit folder
    const isBulkPublic = bulkShared.visibility === "public";

    // Resolve Template Library folder (private only)
    let folderId = isBulkPublic ? undefined : bulkShared.folderTemplateId;
    if (!isBulkPublic && bulkShared.createNewFolder) {
      if (!bulkShared.newFolderName.trim()) {
        toast({ title: "Validation error", description: "Please enter a folder name", variant: "destructive" });
        return;
      }
      try {
        const res = await apiRequest("POST", "/api/folder-templates", {
          name: bulkShared.newFolderName,
          module: bulkShared.module,
          description: "",
          parentId: null,
          sortOrder: 0,
          isActive: true,
        });
        const newFolder = await res.json();
        folderId = newFolder.id;
        queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      } catch {
        toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
        return;
      }
    }
    if (!isBulkPublic && !folderId) {
      toast({ title: "Validation error", description: "Please select or create a folder", variant: "destructive" });
      return;
    }

    // Resolve Toolkit folder (only if public)
    let toolkitFolderId: string | undefined = bulkShared.toolkitFolderId || undefined;
    if (bulkShared.visibility === "public") {
      if (bulkShared.createNewToolkitFolder) {
        if (!bulkShared.newToolkitFolderName.trim()) {
          toast({ title: "Validation error", description: "Please enter a Toolkit folder name", variant: "destructive" });
          return;
        }
        try {
          const res = await apiRequest("POST", "/api/toolkit/folders", {
            name: bulkShared.newToolkitFolderName,
            module: bulkShared.module,
            sortOrder: 0,
          });
          const newTkFolder = await res.json();
          toolkitFolderId = newTkFolder.id;
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit/folders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
        } catch {
          toast({ title: "Error", description: "Failed to create Toolkit folder", variant: "destructive" });
          return;
        }
      } else if (!toolkitFolderId) {
        toast({ title: "Validation error", description: "Please select or create a Toolkit folder", variant: "destructive" });
        return;
      }
    }

    setIsBulkCreating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of readyItems) {
      setBulkFileItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "creating" } : i)));
      try {
        await apiRequest("POST", "/api/document-templates", {
          name: item.name.trim(),
          description: item.description.trim() || undefined,
          module: bulkShared.module,
          ...(folderId ? { folderTemplateId: folderId } : {}),
          fileName: item.fileName,
          fileUrl: item.objectPath,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
          sortOrder: 0,
          isRequired: false,
          renewalPeriodMonths: bulkShared.renewalPeriodMonths,
          requiresApproval: bulkShared.requiresApproval,
          visibility: bulkShared.visibility,
          toolkitFolderId: isBulkPublic ? (toolkitFolderId || null) : null,
        });
        setBulkFileItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "done" } : i)));
        successCount++;
      } catch (err) {
        setBulkFileItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: err instanceof Error ? err.message : "Failed to create" }
              : i
          )
        );
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    invalidateDocumentsHierarchy();
    setIsBulkCreating(false);

    if (errorCount === 0) {
      toast({ title: "Templates created", description: `${successCount} template${successCount !== 1 ? "s" : ""} created successfully.` });
      setIsTemplateDialogOpen(false);
      setBulkFileItems([]);
      setBulkShared(defaultBulkSharedSettings);
    } else {
      toast({ title: "Partial success", description: `${successCount} created, ${errorCount} failed. Fix errors and retry.`, variant: "destructive" });
    }
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormData({
      name: template.name,
      description: template.description || "",
      synopsis: (template as any).synopsis || "",
      module: template.module,
      folderTemplateId: template.folderTemplateId,
      isRequired: template.isRequired || false,
      renewalPeriodMonths: template.renewalPeriodMonths || null,
      requiresApproval: template.requiresApproval !== false,
      visibility: (template.visibility as "public" | "private") || "public",
      fileName: template.fileName,
      fileUrl: template.fileUrl || "",
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      placeholders: template.placeholders || "",
      sortOrder: template.sortOrder,
      createNewFolder: false,
      newFolderName: "",
      toolkitFolderId: (template as any).toolkitFolderId || "",
      createNewToolkitFolder: false,
      newToolkitFolderName: "",
    });
    setIsEditTemplateDialogOpen(true);
  };
  
  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    let toolkitFolderId: string | null = templateFormData.toolkitFolderId || null;
    if (templateFormData.visibility === "public") {
      if (templateFormData.createNewToolkitFolder) {
        if (!templateFormData.newToolkitFolderName) {
          toast({ title: "Validation error", description: "Please enter a Toolkit folder name", variant: "destructive" });
          return;
        }
        try {
          const response = await apiRequest("POST", "/api/toolkit/folders", {
            name: templateFormData.newToolkitFolderName,
            module: templateFormData.module,
            sortOrder: 0,
          });
          const newToolkitFolder = await response.json();
          toolkitFolderId = newToolkitFolder.id;
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit/folders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
        } catch (error) {
          toast({ title: "Error", description: "Failed to create Toolkit folder", variant: "destructive" });
          return;
        }
      } else if (!toolkitFolderId) {
        toast({ title: "Validation error", description: "Please select or create a Toolkit folder", variant: "destructive" });
        return;
      }
    }

    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: templateFormData.name,
        description: templateFormData.description || undefined,
        synopsis: templateFormData.synopsis || undefined,
        placeholders: templateFormData.placeholders || undefined,
        sortOrder: templateFormData.sortOrder,
        isRequired: templateFormData.isRequired,
        renewalPeriodMonths: templateFormData.renewalPeriodMonths,
        requiresApproval: templateFormData.requiresApproval,
        visibility: templateFormData.visibility,
        toolkitFolderId: templateFormData.visibility === "public" ? toolkitFolderId : null,
      } as any,
    });
  };
  
  const handleDeleteTemplate = (template: DocumentTemplate) => {
    setTemplateToDelete(template);
    setDeleteReason("");
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeleteTemplate = () => {
    if (!templateToDelete || deleteReason.trim().length < 5) return;
    deleteTemplateMutation.mutate({ id: templateToDelete.id, reason: deleteReason.trim() });
  };

  const handlePermanentDeleteTemplate = (template: DocumentTemplate) => {
    setTemplateToPermanentlyDelete(template);
    setPermanentDeleteReason("");
    setIsPermanentDeleteDialogOpen(true);
  };

  const confirmPermanentDeleteTemplate = () => {
    if (!templateToPermanentlyDelete || permanentDeleteReason.trim().length < 5) return;
    permanentDeleteTemplateMutation.mutate({ id: templateToPermanentlyDelete.id, reason: permanentDeleteReason.trim() });
  };
  
  // Folder handlers
  const handleCreateFolder = () => {
    if (!folderFormData.name) {
      toast({ title: "Validation error", description: "Please enter a folder name", variant: "destructive" });
      return;
    }
    createFolderMutation.mutate(folderFormData);
  };
  
  const handleEditFolder = (folder: FolderTemplate) => {
    setSelectedFolder(folder);
    setFolderFormData({
      name: folder.name,
      module: folder.module,
      description: folder.description || "",
      parentId: folder.parentId,
      isRequired: folder.isRequired,
      sortOrder: folder.sortOrder,
      isActive: folder.isActive,
    });
    setIsEditFolderDialogOpen(true);
  };
  
  const handleUpdateFolder = () => {
    if (!selectedFolder) return;
    updateFolderMutation.mutate({
      id: selectedFolder.id,
      data: folderFormData,
    });
  };
  
  const handleDeleteFolder = (folder: FolderTemplate) => {
    setFolderToDelete(folder);
  };

  const confirmDeleteFolder = () => {
    if (folderToDelete) {
      deleteFolderMutation.mutate(folderToDelete.id);
      setFolderToDelete(null);
    }
  };
  
  
  // Document type handlers
  const handleCreateDocType = async () => {
    if (!docTypeFormData.name || !docTypeFormData.folderTemplateId) {
      toast({ title: "Validation error", description: "Please fill in all required fields including folder", variant: "destructive" });
      return;
    }
    try {
      const response = await apiRequest("POST", "/api/document-types", {
        name: docTypeFormData.name,
        module: docTypeFormData.module,
        description: docTypeFormData.description || undefined,
        isRequired: docTypeFormData.isRequired,
        renewalPeriodMonths: docTypeFormData.renewalPeriodMonths,
        sortOrder: docTypeFormData.sortOrder,
        isActive: docTypeFormData.isActive,
      });
      const newDocType = await response.json();
      await apiRequest("POST", "/api/folder-document-type-rules", {
        folderTemplateId: docTypeFormData.folderTemplateId,
        documentTypeId: newDocType.id,
        isRequired: docTypeFormData.isRequired,
        sortOrder: 0,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      setIsDocTypeDialogOpen(false);
      setDocTypeFormData(defaultDocTypeFormData);
      toast({ title: "Template type created", description: "The template type has been created and assigned to the folder." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create template type", variant: "destructive" });
    }
  };
  
  const handleEditDocType = (docType: DocumentTypeRecord) => {
    setSelectedDocType(docType);
    const assignedFolders = docTypeToFolders.get(docType.id);
    const folderId = assignedFolders && assignedFolders.length > 0 
      ? folderTemplates.find(f => f.name === assignedFolders[0])?.id || ""
      : "";
    setDocTypeFormData({
      name: docType.name,
      module: docType.module,
      folderTemplateId: folderId,
      description: docType.description || "",
      isRequired: docType.isRequired,
      renewalPeriodMonths: docType.renewalPeriodMonths,
      sortOrder: docType.sortOrder,
      isActive: docType.isActive,
    });
    setIsEditDocTypeDialogOpen(true);
  };
  
  const handleUpdateDocType = () => {
    if (!selectedDocType) return;
    updateDocTypeMutation.mutate({
      id: selectedDocType.id,
      data: {
        name: docTypeFormData.name,
        description: docTypeFormData.description,
        isRequired: docTypeFormData.isRequired,
        renewalPeriodMonths: docTypeFormData.renewalPeriodMonths,
        sortOrder: docTypeFormData.sortOrder,
        isActive: docTypeFormData.isActive,
      },
    });
  };
  
  const handleDeleteDocType = (docType: DocumentTypeRecord) => {
    setDocTypeToDelete(docType);
  };

  const confirmDeleteDocType = () => {
    if (docTypeToDelete) {
      deleteDocTypeMutation.mutate(docTypeToDelete.id);
      setDocTypeToDelete(null);
    }
  };
  
  const handleAssignFolder = (docType: DocumentTypeRecord) => {
    setSelectedDocType(docType);
    setSelectedFolderIdForAssign("");
    setIsAssignFolderDialogOpen(true);
  };
  
  // Wizard handlers
  const openWizard = () => {
    setWizardData(defaultWizardData);
    setWizardStep("module");
    setCreatedFolderId(null);
    setCreatedDocTypeId(null);
    setIsWizardOpen(true);
  };
  
  const closeWizard = () => {
    setIsWizardOpen(false);
    setWizardStep("module");
    setWizardData(defaultWizardData);
    setCreatedFolderId(null);
    setCreatedDocTypeId(null);
  };
  
  const wizardNextStep = async () => {
    if (wizardStep === "module") {
      if (!wizardData.module) {
        toast({ title: "Validation error", description: "Please select a module", variant: "destructive" });
        return;
      }
      setWizardStep("folder");
    } else if (wizardStep === "folder") {
      if (wizardData.createNewFolder) {
        if (!wizardData.newFolderName) {
          toast({ title: "Validation error", description: "Please enter folder name", variant: "destructive" });
          return;
        }
        setWizardLoading(true);
        try {
          const response = await apiRequest("POST", "/api/folder-templates", {
            name: wizardData.newFolderName,
            module: wizardData.module,
            description: "",
            parentId: null,
            isRequired: false,
            sortOrder: 0,
            isActive: true,
          });
          const newFolder = await response.json();
          setCreatedFolderId(newFolder.id);
          setWizardData(prev => ({ ...prev, folderId: newFolder.id, folderName: newFolder.name }));
          queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
          setWizardStep("doctype");
        } catch (error) {
          toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
        } finally {
          setWizardLoading(false);
        }
      } else {
        if (!wizardData.folderId) {
          toast({ title: "Validation error", description: "Please select a folder", variant: "destructive" });
          return;
        }
        setWizardStep("doctype");
      }
    } else if (wizardStep === "doctype") {
      if (!wizardData.docTypeName) {
        toast({ title: "Validation error", description: "Please enter template type name", variant: "destructive" });
        return;
      }
      setWizardLoading(true);
      try {
        const response = await apiRequest("POST", "/api/document-types", {
          name: wizardData.docTypeName,
          module: wizardData.module,
          description: wizardData.docTypeDescription || undefined,
          isRequired: wizardData.isRequired,
          renewalPeriodMonths: wizardData.renewalPeriodMonths,
          sortOrder: 0,
          isActive: true,
        });
        const newDocType = await response.json();
        setCreatedDocTypeId(newDocType.id);
        const folderId = createdFolderId || wizardData.folderId;
        await apiRequest("POST", "/api/folder-document-type-rules", {
          folderTemplateId: folderId,
          documentTypeId: newDocType.id,
          isRequired: wizardData.isRequired,
          sortOrder: 0,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
        queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
        setWizardStep("template");
      } catch (error) {
        toast({ title: "Error", description: "Failed to create template type", variant: "destructive" });
      } finally {
        setWizardLoading(false);
      }
    } else if (wizardStep === "template") {
      if (wizardData.addTemplate) {
        if (!wizardData.templateName || !wizardData.templateFileName) {
          toast({ title: "Validation error", description: "Please enter template name and file name", variant: "destructive" });
          return;
        }
        setWizardLoading(true);
        try {
          const folderId = createdFolderId || wizardData.folderId;
          await apiRequest("POST", "/api/document-templates", {
            name: wizardData.templateName,
            description: wizardData.templateDescription || undefined,
            module: wizardData.module,
            folderTemplateId: folderId,
            fileName: wizardData.templateFileName,
            fileSize: 1024,
            mimeType: "application/octet-stream",
            sortOrder: 0,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
          setWizardStep("complete");
        } catch (error) {
          toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
        } finally {
          setWizardLoading(false);
        }
      } else {
        setWizardStep("complete");
      }
    }
  };
  
  const wizardPrevStep = () => {
    if (wizardStep === "folder") setWizardStep("module");
    else if (wizardStep === "doctype") setWizardStep("folder");
    else if (wizardStep === "template") setWizardStep("doctype");
  };
  
  const getWizardFoldersForModule = () => {
    return sortFoldersHierarchically(
      folderTemplates.filter(f => f.module === wizardData.module && f.isActive)
    );
  };
  
  const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
  
  // Template card component
  const TemplateCard = ({ template, showFolder = false, isDraggable = false, dragHandleProps = {} }: { 
    template: DocumentTemplate; 
    showFolder?: boolean;
    isDraggable?: boolean;
    dragHandleProps?: Record<string, unknown>;
  }) => {
    const FileIcon = getFileIcon(template.mimeType);
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate" data-testid={`template-card-${template.id}`}>
        <div className="flex items-center gap-3">
          {isDraggable && isAdmin && (
            <div 
              {...dragHandleProps} 
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
              data-testid={`drag-handle-${template.id}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="p-2 rounded-md bg-muted">
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{template.name}</p>
              {template.isRequired && (
                <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs py-0" title="This document is required for compliance">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Compliance
                </Badge>
              )}
              {template.requiresApproval === false ? (
                <Badge variant="outline" className="text-green-600 border-green-600 text-xs py-0" title="Documents are automatically marked compliant">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Auto-Compliant
                </Badge>
              ) : (
                <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs py-0" title="Documents require client approval">
                  <Clock className="h-3 w-3 mr-1" />
                  Needs Approval
                </Badge>
              )}
              {template.renewalPeriodMonths && (
                <Badge variant="outline" className="text-xs py-0">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {template.renewalPeriodMonths}mo
                </Badge>
              )}
              {(template as any).visibility === "private" && (
                <Badge variant="outline" className="text-purple-600 border-purple-600 text-xs py-0">
                  Private
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{template.fileName}</span>
              <span>•</span>
              <span>{formatFileSize(template.fileSize)}</span>
              {template.createdAt && (
                <>
                  <span>•</span>
                  <span data-testid={`text-uploaded-card-${template.id}`}>
                    {new Date(template.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </>
              )}
              {showFolder && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    {getFolderName(template.folderTemplateId)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-template-actions-${template.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {template.fileUrl && (
                  <>
                    {template.mimeType === "application/pdf" && (
                      <DropdownMenuItem onClick={() => {
                        setPreviewTemplate(template);
                        setIsPreviewDialogOpen(true);
                      }} data-testid={`button-preview-template-${template.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => downloadFile(template.fileUrl, template.fileName)} data-testid={`link-download-template-${template.id}`}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => {
                      setVersionUploadTemplate(template);
                      setNewVersionFile(null);
                      setVersionChangeNote("");
                      setIsVersionUploadDialogOpen(true);
                    }} data-testid={`button-upload-version-${template.id}`}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New Version
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={() => {
                  setSelectedTemplate(template);
                  setIsVersionHistoryDialogOpen(true);
                }} data-testid={`button-version-history-${template.id}`}>
                  <History className="h-4 w-4 mr-2" />
                  Version History
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDeleteTemplate(template)} className="text-amber-600 dark:text-amber-400" data-testid={`button-archive-template-${template.id}`}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => handlePermanentDeleteTemplate(template)} className="text-destructive focus:text-destructive" data-testid={`button-permanent-delete-template-${template.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  };

  // Sortable template card wrapper for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );
  
  // Folder tree renderer
  const renderFolderTree = (folder: FolderTemplate, depth: number = 0, moduleContext?: ModuleType) => {
    const children = getChildFolders(folder.id);
    const templatesInFolder = getTemplatesForFolder(folder.id);
    const hasContent = children.length > 0 || templatesInFolder.length > 0;
    const folderModule = folder.module || moduleContext || "health_safety";
    const ModuleIcon = moduleIcons[folderModule];
    const totalTemplatesInTree = getTotalTemplatesInFolderTree(folder.id);
    
    // Root level folders get gradient styling
    const isRootLevel = depth === 0;
    const isFolderOver = overDropId === `folder-header-${folder.id}` || overDropId === `folder-${folder.id}`;
    
    return (
      <DroppableFolderAccordionItem key={folder.id} folderId={folder.id} isOver={isAdmin && isFolderOver && activeTemplateId !== null}>
      <AccordionItem 
        value={folder.id} 
        className={`border rounded-lg mb-2 overflow-hidden ${isRootLevel ? moduleBorderColors[folderModule] : "border-border"}`}
      >
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger
            className={`flex flex-1 items-center gap-2 py-3 px-4 hover:no-underline text-left transition-all [&[data-state=open]_.chevron]:rotate-180 ${isRootLevel ? `bg-gradient-to-r ${moduleGradients[folderModule]}` : ""}`}
          >
            {isRootLevel ? (
              <ModuleIcon className={`h-4 w-4 ${moduleColors[folderModule]}`} />
            ) : (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            )}
            <span className={`font-medium ${isRootLevel ? moduleColors[folderModule] : ""}`}>{folder.name}</span>
            {(folder as any).isLocked && (
              <Lock className="h-3 w-3 text-muted-foreground ml-1" title="System-managed folder" />
            )}
            {(folder as any).toolkitFolderId && !(folder as any).isLocked && (
              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4 text-muted-foreground">Toolkit</Badge>
            )}
            {totalTemplatesInTree > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalTemplatesInTree}
              </Badge>
            )}
            <ChevronDown className="chevron h-4 w-4 ml-auto shrink-0 text-muted-foreground transition-transform duration-200" />
          </AccordionPrimitive.Trigger>
          {isAdmin && (
            <div className={`flex items-center gap-1 pr-2 ${isRootLevel ? `bg-gradient-to-r ${moduleGradients[folderModule]}` : ""}`}>
              {!(folder as any).isLocked && !(folder as any).toolkitFolderId && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditFolder(folder)} data-testid={`button-folder-edit-${folder.id}`}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {!(folder as any).isLocked && !(folder as any).toolkitFolderId && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => handleDeleteFolder(folder)} data-testid={`button-folder-delete-${folder.id}`}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </AccordionPrimitive.Header>
        <AccordionContent className="pb-0">
          <DroppableFolderContent folderId={folder.id} isOver={overDropId === `folder-${folder.id}`}>
            <div className="px-4 py-2 space-y-2">
              {templatesInFolder.length === 0 && children.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  {isAdmin ? "Drop templates here to assign them to this folder." : "No templates in this folder"}
                </p>
              )}
              {templatesInFolder.map(template => (
                <DraggableTemplateCard
                  key={template.id}
                  template={template}
                  isAdmin={isAdmin}
                  renderCard={(dragHandleProps) => (
                    <TemplateCard
                      template={template}
                      isDraggable={isAdmin}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                />
              ))}
              {children.length > 0 && (
                <Accordion 
                  type="multiple" 
                  className="w-full"
                  value={openFolders}
                  onValueChange={setOpenFolders}
                >
                  {children.map(child => renderFolderTree(child, depth + 1, folderModule))}
                </Accordion>
              )}
            </div>
          </DroppableFolderContent>
        </AccordionContent>
      </AccordionItem>
      </DroppableFolderAccordionItem>
    );
  };
  
  const isLoading = templatesLoading || foldersLoading || docTypesLoading;
  
  return (
    <div className="p-6 space-y-6 dash-animate">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10 bg-background -mx-6 px-6 pb-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Template Library
          </h1>
          <p className="text-muted-foreground">
            Manage templates, folders, and template types - the "Document Bible"
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="files" data-testid="tab-files">
              <File className="h-4 w-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="folders" data-testid="tab-folders">
              <FolderTree className="h-4 w-4 mr-2" />
              Folders
            </TabsTrigger>
          </TabsList>
          
          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={openWizard} variant="outline" data-testid="button-setup-wizard">
                <Wand2 className="h-4 w-4 mr-2" />
                Setup Wizard
              </Button>
              {(activeTab === "templates" || activeTab === "files") && (
                <Button onClick={() => {
                  const module = selectedModule === "all" ? "health_safety" : selectedModule;
                  setBulkShared({ ...defaultBulkSharedSettings, module });
                  setIsTemplateDialogOpen(true);
                }} data-testid="button-add-template">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              )}
              {activeTab === "folders" && (
                <Button onClick={() => { setFolderFormData(defaultFolderFormData); setIsFolderDialogOpen(true); }} data-testid="button-add-folder">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Folder
                </Button>
              )}
              {activeTab === "document-types" && (
                <Button onClick={() => { setDocTypeFormData(defaultDocTypeFormData); setIsDocTypeDialogOpen(true); }} data-testid="button-add-document-type">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template Type
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Module Tabs - Enhanced Prominence */}
        <div className="grid w-full grid-cols-4 gap-2 p-1 rounded-xl bg-muted/50 border">
          {([
            { value: "all", label: "All Modules", Icon: Filter, color: "text-purple-600 dark:text-purple-400", activeStyle: "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700" },
            { value: "health_safety", label: "Health & Safety", Icon: moduleIcons.health_safety, color: "text-emerald-600 dark:text-emerald-400", activeStyle: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" },
            { value: "human_resources", label: "Human Resources", Icon: moduleIcons.human_resources, color: "text-blue-600 dark:text-blue-400", activeStyle: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" },
            { value: "employment_law", label: "Employment Law", Icon: moduleIcons.employment_law, color: "text-pink-600 dark:text-pink-400", activeStyle: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700" },
          ] as const).map(({ value, label, Icon, color, activeStyle }) => {
            const isActive = selectedModule === value;
            return (
              <button
                key={value}
                onClick={() => setSelectedModule(value as ModuleType | "all")}
                data-testid={`module-tab-${value}`}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 px-3 rounded-lg font-medium transition-all ${
                  isActive 
                    ? `${activeStyle} border shadow-sm ${color}` 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
                }`}
              >
                <Icon className={`h-5 w-5 sm:h-6 sm:w-6`} />
                <span className="text-xs sm:text-sm">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          {activeTab === "templates" && (
            <>
              <Select value={requiredFilter} onValueChange={(v) => setRequiredFilter(v as "all" | "required" | "optional")}>
                <SelectTrigger className="w-40" data-testid="select-required-filter">
                  <SelectValue placeholder="Compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compliance</SelectItem>
                  <SelectItem value="required">Required Only</SelectItem>
                  <SelectItem value="optional">Optional Only</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={renewalFilter} onValueChange={(v) => setRenewalFilter(v as "all" | "has_renewal" | "no_renewal")}>
                <SelectTrigger className="w-44" data-testid="select-renewal-filter">
                  <SelectValue placeholder="Renewal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Renewals</SelectItem>
                  <SelectItem value="has_renewal">Has Renewal Period</SelectItem>
                  <SelectItem value="no_renewal">No Renewal</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={approvalFilter} onValueChange={(v) => setApprovalFilter(v as "all" | "needs_approval" | "auto_compliant")}>
                <SelectTrigger className="w-44" data-testid="select-approval-filter">
                  <SelectValue placeholder="Approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approval</SelectItem>
                  <SelectItem value="needs_approval">Needs Approval</SelectItem>
                  <SelectItem value="auto_compliant">Auto-Compliant</SelectItem>
                </SelectContent>
              </Select>
              
              {folderTemplates.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={toggleAllFolders}
                  data-testid="button-toggle-all-folders"
                  className="whitespace-nowrap"
                >
                  {allFoldersExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Expand All
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : searchQuery ? (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>{filteredTemplates.length} templates found</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredTemplates.map(template => (
                  <TemplateCard key={template.id} template={template} showFolder />
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No templates match your search</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
            <div className="space-y-6">
              {modules.filter(m => selectedModule === "all" || selectedModule === m).map(module => {
                const ModuleIcon = moduleIcons[module];
                const rootFolders = getRootFolders(module);
                const moduleTemplateCount = templates.filter(t => t.module === module).length;
                const unassignedTemplates = getUnassignedTemplates(module);
                
                if (rootFolders.length === 0 && moduleTemplateCount === 0 && unassignedTemplates.length === 0) return null;
                
                return (
                  <Card key={module} className={moduleBgColors[module]}>
                    <CardHeader>
                      <CardTitle className={`flex items-center gap-2 ${moduleColors[module]}`}>
                        <ModuleIcon className="h-5 w-5" />
                        {moduleNames[module]}
                        <Badge variant="secondary" className="ml-2">
                          {moduleTemplateCount} templates
                        </Badge>
                      </CardTitle>
                      {isAdmin && (
                        <CardDescription>
                          Drag templates between folders to organise them.
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {rootFolders.length > 0 ? (
                        <Accordion 
                          type="multiple" 
                          className="w-full"
                          value={openFolders}
                          onValueChange={setOpenFolders}
                        >
                          {rootFolders.map(folder => renderFolderTree(folder))}
                        </Accordion>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No folder structure defined. 
                          {isAdmin && " Create folders in the Folders tab first."}
                        </p>
                      )}
                      {(unassignedTemplates.length > 0 || (isAdmin && activeTemplateId !== null)) && (
                        <DroppableUnassignedContent moduleId={module} isOver={overDropId === `__unassigned_${module}__`}>
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-muted-foreground/30">
                            <Inbox className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm text-muted-foreground">Unassigned</span>
                            <Badge variant="outline" className="text-xs ml-auto">{unassignedTemplates.length}</Badge>
                          </div>
                          <div className="px-4 py-2 space-y-2">
                            {unassignedTemplates.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-3 text-center">
                                Drop here to remove from folder
                              </p>
                            ) : (
                              unassignedTemplates.map(template => (
                                <DraggableTemplateCard
                                  key={template.id}
                                  template={template}
                                  isAdmin={isAdmin}
                                  renderCard={(dragHandleProps) => (
                                    <TemplateCard
                                      template={template}
                                      isDraggable={isAdmin}
                                      dragHandleProps={dragHandleProps}
                                    />
                                  )}
                                />
                              ))
                            )}
                          </div>
                        </DroppableUnassignedContent>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Archived Templates Section */}
              {isAdmin && archivedTemplates.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                  <CardHeader className="cursor-pointer" onClick={() => setShowArchived(!showArchived)}>
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" />
                      Archived Templates
                      <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400">
                        {archivedTemplates.length}
                      </Badge>
                      <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                    </CardTitle>
                    <CardDescription>
                      Templates that have been archived. Click to {showArchived ? 'hide' : 'view'}.
                    </CardDescription>
                  </CardHeader>
                  {showArchived && (
                    <CardContent className="space-y-3">
                      {archivedTemplates.map(template => {
                        const folder = folderTemplates.find(f => f.id === template.folderTemplateId);
                        return (
                          <div key={template.id} className="flex items-center justify-between p-3 rounded-md border bg-background">
                            <div className="flex-1">
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {folder?.name || 'Unknown folder'} • {moduleNames[template.module]}
                              </p>
                              {(template as any).deletedAt && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  Archived: {new Date((template as any).deletedAt).toLocaleDateString()}
                                  {(template as any).deletionReason && ` • Reason: ${(template as any).deletionReason}`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => restoreTemplateMutation.mutate(template.id)}
                                disabled={restoreTemplateMutation.isPending}
                                data-testid={`button-restore-template-${template.id}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                                onClick={() => handlePermanentDeleteTemplate(template)}
                                data-testid={`button-permanent-delete-archived-${template.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              )}

            </div>
          </DndContext>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <File className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No files found</p>
                  <p className="text-sm mt-1">Add templates to see their files listed here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((template) => {
                        const ModuleIcon = moduleIcons[template.module as ModuleType];
                        const folder = folderTemplates.find(f => f.id === template.folderTemplateId);
                        const ext = template.fileName.split(".").pop()?.toUpperCase() ?? "FILE";
                        return (
                          <TableRow key={template.id} data-testid={`row-file-${template.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">{template.name}</span>
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-6">{template.description}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-mono">{ext}</Badge>
                                <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={decodeURIComponent(template.fileName)}>
                                  {decodeURIComponent(template.fileName)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1.5 ${moduleColors[template.module as ModuleType]}`}>
                                <ModuleIcon className="h-4 w-4" />
                                <span className="text-sm">{moduleNames[template.module as ModuleType]}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {folder ? (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Folder className="h-3.5 w-3.5 flex-shrink-0" />
                                  {folder.name}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Unassigned</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm text-muted-foreground">{formatFileSize(template.fileSize)}</span>
                                {template.createdAt && (
                                  <span className="text-xs text-muted-foreground/70" data-testid={`text-uploaded-${template.id}`}>
                                    {new Date(template.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {template.visibility === "public" ? (
                                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">Public</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">Private</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-file-actions-${template.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {template.fileUrl && (
                                    <DropdownMenuItem onClick={() => downloadFile(template.fileUrl!, template.fileName)} data-testid={`button-file-download-${template.id}`}>
                                      <Download className="h-4 w-4 mr-2" />
                                      Download
                                    </DropdownMenuItem>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Folders Tab */}
        <TabsContent value="folders" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {folderTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No folder templates found</p>
                  <p className="text-sm mt-1">Create folders to define your document structure</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {folderTemplates
                      .filter(f => selectedModule === "all" || f.module === selectedModule)
                      .filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.code.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => {
                        if (a.module !== b.module) return a.module.localeCompare(b.module);
                        return a.sortOrder - b.sortOrder;
                      })
                      .map((folder) => {
                        const ModuleIcon = moduleIcons[folder.module];
                        return (
                          <TableRow key={folder.id} data-testid={`row-folder-${folder.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Folder className="h-4 w-4 text-amber-500" />
                                <span className="font-medium">{folder.name}</span>
                              </div>
                              {folder.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{folder.description}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{folder.code}</code>
                            </TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1.5 ${moduleColors[folder.module]}`}>
                                <ModuleIcon className="h-4 w-4" />
                                <span className="text-sm">{moduleNames[folder.module]}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {folder.parentId ? (
                                <span className="text-sm text-muted-foreground">{getParentName(folder.parentId) || "—"}</span>
                              ) : (
                                <Badge variant="outline" className="text-xs">Root</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {folder.isActive ? (
                                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isAdmin && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-folder-actions-${folder.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!(folder as any).isLocked && !(folder as any).toolkitFolderId && (
                                      <DropdownMenuItem onClick={() => handleEditFolder(folder)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                    )}
                                    {!(folder as any).isLocked && !(folder as any).toolkitFolderId && (
                                      <DropdownMenuItem onClick={() => handleDeleteFolder(folder)} className="text-red-600 dark:text-red-400">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                    {((folder as any).isLocked || (folder as any).toolkitFolderId) && (
                                      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                                        <Lock className="h-3 w-3 mr-2" />
                                        System-managed
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Template Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewTemplate?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {decodeURIComponent(previewTemplate?.fileName || "")} • {formatFileSize(previewTemplate?.fileSize || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewTemplate?.fileUrl && (
              <PdfViewer url={previewTemplate.fileUrl} />
            )}
          </div>
          <div className="px-5 py-3 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)} data-testid="button-close-preview">
              Close
            </Button>
            <Button onClick={() => previewTemplate && downloadFile(previewTemplate.fileUrl, previewTemplate.fileName)} data-testid="button-preview-download-footer">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Create Dialog — multi-file */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setBulkFileItems([]);
          setBulkShared(defaultBulkSharedSettings);
        }
        setIsTemplateDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Document Templates</DialogTitle>
            <DialogDescription>Set shared settings, then select one or more files. Each file gets its own name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* ── Shared settings ── */}
            <div className="space-y-2">
              <Label htmlFor="bulk-module">Module</Label>
              <Select
                value={bulkShared.module}
                onValueChange={(v) => setBulkShared({ ...bulkShared, module: v as ModuleType, folderTemplateId: "", toolkitFolderId: "", createNewToolkitFolder: false, newToolkitFolderName: "" })}
              >
                <SelectTrigger id="bulk-module" data-testid="select-bulk-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_safety">Health & Safety</SelectItem>
                  <SelectItem value="human_resources">Human Resources</SelectItem>
                  <SelectItem value="employment_law">Employment Law</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="space-y-0.5">
                <Label className="font-medium text-sm">Visibility</Label>
                <p className="text-xs text-muted-foreground">Public templates will appear in the Toolkit</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{bulkShared.visibility === "public" ? "Public" : "Private"}</span>
                <Switch
                  checked={bulkShared.visibility === "public"}
                  onCheckedChange={(checked) => setBulkShared({ ...bulkShared, visibility: checked ? "public" : "private", toolkitFolderId: "", createNewToolkitFolder: false, newToolkitFolderName: "" })}
                  data-testid="switch-bulk-visibility"
                />
              </div>
            </div>

            {/* Toolkit Folder (public only) */}
            {bulkShared.visibility === "public" && (
              <div className="space-y-2">
                <Label>Toolkit Folder <span className="text-destructive">*</span></Label>
                <Select value={bulkShared.toolkitFolderId} onValueChange={(v) => setBulkShared({ ...bulkShared, toolkitFolderId: v, createNewToolkitFolder: false })}>
                  <SelectTrigger data-testid="select-bulk-toolkit-folder"><SelectValue placeholder="Select a Toolkit folder" /></SelectTrigger>
                  <SelectContent>
                    {toolkitFolders.filter(f => f.module === bulkShared.module).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {toolkitFolders.filter(f => f.module === bulkShared.module).length === 0 && (
                  <p className="text-xs text-muted-foreground">No Toolkit folders available for this module.</p>
                )}
              </div>
            )}

            {/* Template Library Folder — hidden for public (auto-assigned from toolkit folder) */}
            {bulkShared.visibility !== "public" && (
            <div className="space-y-2">
              <Label>Template Library Folder <span className="text-destructive">*</span></Label>
              <Select value={bulkShared.folderTemplateId} onValueChange={(v) => setBulkShared({ ...bulkShared, folderTemplateId: v, createNewFolder: false })}>
                <SelectTrigger data-testid="select-bulk-template-folder"><SelectValue placeholder="Select a folder" /></SelectTrigger>
                <SelectContent>
                  {sortFoldersHierarchically(folderTemplates.filter(f => f.module === bulkShared.module && f.isActive)).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.parentId ? "└ " : ""}{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {folderTemplates.filter(f => f.module === bulkShared.module && f.isActive).length === 0 && (
                <p className="text-xs text-muted-foreground">No folders available for this module.</p>
              )}
            </div>
            )}
            {bulkShared.visibility === "public" && bulkShared.toolkitFolderId && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border text-xs text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Template Library folder will be automatically set to <strong>Toolkit → {toolkitFolders.find(f => f.id === bulkShared.toolkitFolderId)?.name}</strong></span>
              </div>
            )}

            {/* Compliance Settings */}
            <div className="space-y-4 p-3 border rounded-md bg-muted/30">
              <p className="text-sm font-medium">Compliance Settings</p>
              <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                <div className="space-y-0.5">
                  <Label className="font-medium text-sm">Client Approval</Label>
                  <p className="text-xs text-muted-foreground">Needs client sign-off</p>
                </div>
                <Switch
                  checked={bulkShared.requiresApproval}
                  onCheckedChange={(checked) => setBulkShared({ ...bulkShared, requiresApproval: checked })}
                  data-testid="switch-bulk-requires-approval"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-renewal" className="text-sm">Renewal Period</Label>
                <Select
                  value={bulkShared.renewalPeriodMonths != null ? String(bulkShared.renewalPeriodMonths) : "none"}
                  onValueChange={(val) => setBulkShared({ ...bulkShared, renewalPeriodMonths: val === "none" ? null : parseInt(val) })}
                >
                  <SelectTrigger data-testid="select-bulk-renewal">
                    <SelectValue placeholder="No renewal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No renewal</SelectItem>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How often documents from this template need renewal</p>
              </div>
            </div>

            {/* ── File picker ── */}
            <div className="space-y-2">
              <Label>Template Files <span className="text-destructive">*</span></Label>
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept=".doc,.docx,.pdf,.xls,.xlsx,.txt,.rtf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleBulkFileSelect(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-md p-6 text-center hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
                data-testid="button-bulk-file-picker"
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to select files</p>
                <p className="text-xs text-muted-foreground mt-1">Word, PDF, Excel — up to 50 MB each. Select multiple files at once.</p>
              </button>
            </div>

            {/* ── Per-file list ── */}
            {bulkFileItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Files ({bulkFileItems.filter(i => i.status === "ready" || i.status === "done").length} of {bulkFileItems.length} ready)</p>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {bulkFileItems.map((item) => (
                    <div key={item.id} className="border rounded-md p-3 space-y-2 bg-muted/10" data-testid={`bulk-file-item-${item.id}`}>
                      <div className="flex items-center gap-2">
                        {item.status === "uploading" && (
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        {item.status === "ready" && <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                        {item.status === "creating" && (
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                        )}
                        {item.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                        {item.status === "error" && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                        <span className="text-xs text-muted-foreground truncate flex-1">{item.fileName}</span>
                        {item.status !== "creating" && item.status !== "done" && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => setBulkFileItems(prev => prev.filter(i => i.id !== item.id))}
                            data-testid={`button-remove-bulk-file-${item.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {item.status === "error" && (
                        <p className="text-xs text-destructive">{item.error}</p>
                      )}
                      {(item.status === "ready" || item.status === "creating" || item.status === "done") && (
                        <div className="grid grid-cols-1 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Template Name <span className="text-destructive">*</span></Label>
                            <Input
                              value={item.name}
                              onChange={(e) => setBulkFileItems(prev => prev.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))}
                              placeholder="Enter template name..."
                              className="h-8 text-sm"
                              disabled={item.status === "creating" || item.status === "done"}
                              data-testid={`input-bulk-name-${item.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Description (Optional)</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => setBulkFileItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value.slice(0, 150) } : i))}
                              placeholder="Brief description..."
                              className="h-8 text-sm"
                              maxLength={150}
                              disabled={item.status === "creating" || item.status === "done"}
                              data-testid={`input-bulk-description-${item.id}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setIsTemplateDialogOpen(false);
              setBulkFileItems([]);
              setBulkShared(defaultBulkSharedSettings);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkCreate}
              disabled={
                isBulkCreating ||
                bulkFileItems.filter(i => i.status === "ready").length === 0 ||
                bulkFileItems.some(i => i.status === "uploading") ||
                bulkFileItems.filter(i => i.status === "ready").some(i => !i.name.trim())
              }
              data-testid="button-bulk-create-templates"
            >
              {isBulkCreating
                ? "Creating..."
                : `Create ${bulkFileItems.filter(i => i.status === "ready").length > 1
                    ? `${bulkFileItems.filter(i => i.status === "ready").length} Templates`
                    : "Template"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template Edit Dialog */}
      <Dialog open={isEditTemplateDialogOpen} onOpenChange={setIsEditTemplateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                value={templateFormData.name}
                onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                data-testid="input-edit-template-name"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-template-description">Description</Label>
                <span className={`text-xs ${templateFormData.description.length > 150 ? "text-destructive" : "text-muted-foreground"}`}>
                  {templateFormData.description.length}/150
                </span>
              </div>
              <Textarea
                id="edit-template-description"
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value.slice(0, 150) })}
                rows={2}
                maxLength={150}
                data-testid="input-edit-template-description"
              />
            </div>
            {templateFormData.visibility === "public" && (
              <div className="space-y-2">
                <Label htmlFor="edit-template-synopsis">Synopsis</Label>
                <p className="text-xs text-muted-foreground">
                  Shown to users before they download — explain what this template is for and when to use it.
                </p>
                <Textarea
                  id="edit-template-synopsis"
                  value={templateFormData.synopsis}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, synopsis: e.target.value })}
                  rows={4}
                  placeholder="e.g. Use this template for new starters who are joining on a full-time permanent basis. It covers pay, hours, holiday entitlement and notice periods."
                  data-testid="input-edit-template-synopsis"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-template-placeholders">Placeholders</Label>
              <Input
                id="edit-template-placeholders"
                value={templateFormData.placeholders}
                onChange={(e) => setTemplateFormData({ ...templateFormData, placeholders: e.target.value })}
                data-testid="input-edit-template-placeholders"
              />
            </div>
            {/* Visibility toggle */}
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="edit-template-visibility" className="font-medium text-sm">Visibility</Label>
                <p className="text-xs text-muted-foreground">Public templates will appear in the Toolkit</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {templateFormData.visibility === "public" ? "Public" : "Private"}
                </span>
                <Switch
                  id="edit-template-visibility"
                  checked={templateFormData.visibility === "public"}
                  onCheckedChange={(checked) => setTemplateFormData({ ...templateFormData, visibility: checked ? "public" : "private", toolkitFolderId: "", createNewToolkitFolder: false, newToolkitFolderName: "" })}
                  data-testid="switch-edit-template-visibility"
                />
              </div>
            </div>
            {/* Toolkit Folder — shown only when public */}
            {templateFormData.visibility === "public" && (
              <div className="space-y-2">
                <Label>Toolkit Folder <span className="text-destructive">*</span></Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!templateFormData.createNewToolkitFolder ? "default" : "outline"}
                    onClick={() => setTemplateFormData({ ...templateFormData, createNewToolkitFolder: false, newToolkitFolderName: "" })}
                    data-testid="button-edit-select-existing-toolkit-folder"
                  >
                    Select Existing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={templateFormData.createNewToolkitFolder ? "default" : "outline"}
                    onClick={() => setTemplateFormData({ ...templateFormData, createNewToolkitFolder: true, toolkitFolderId: "" })}
                    data-testid="button-edit-create-new-toolkit-folder"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create New
                  </Button>
                </div>
                {!templateFormData.createNewToolkitFolder ? (
                  <>
                    <Select
                      value={templateFormData.toolkitFolderId}
                      onValueChange={(v) => setTemplateFormData({ ...templateFormData, toolkitFolderId: v })}
                    >
                      <SelectTrigger data-testid="select-edit-toolkit-folder">
                        <SelectValue placeholder="No folder (unassigned)" />
                      </SelectTrigger>
                      <SelectContent>
                        {toolkitFolders.filter(f => f.module === templateFormData.module).map(folder => (
                          <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {toolkitFolders.filter(f => f.module === templateFormData.module).length === 0 && (
                      <p className="text-xs text-muted-foreground">No Toolkit folders yet. Click "Create New" to add one.</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1 p-3 border rounded-md bg-muted/30">
                    <Label htmlFor="edit-new-toolkit-folder-name" className="text-sm">Toolkit Folder Name</Label>
                    <Input
                      id="edit-new-toolkit-folder-name"
                      value={templateFormData.newToolkitFolderName}
                      onChange={(e) => setTemplateFormData({ ...templateFormData, newToolkitFolderName: e.target.value })}
                      placeholder="e.g., HR Policies"
                      data-testid="input-edit-new-toolkit-folder-name"
                    />
                  </div>
                )}
              </div>
            )}
            {/* Auto-assigned library folder info for public templates */}
            {templateFormData.visibility === "public" && templateFormData.toolkitFolderId && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/40 border text-xs text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Template Library folder will be automatically set to <strong>Toolkit → {toolkitFolders.find(f => f.id === templateFormData.toolkitFolderId)?.name}</strong></span>
              </div>
            )}
            {/* Compliance Settings */}
            <div className="space-y-4 p-3 border rounded-md bg-muted/30">
              <p className="text-sm font-medium">Compliance Settings</p>
              <div className="flex items-center justify-between p-3 bg-background rounded-md border">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-template-requiresApproval" className="font-medium text-sm">Client Approval</Label>
                  <p className="text-xs text-muted-foreground">Needs client sign-off</p>
                </div>
                <Switch
                  id="edit-template-requiresApproval"
                  checked={templateFormData.requiresApproval}
                  onCheckedChange={(checked) => setTemplateFormData({ ...templateFormData, requiresApproval: checked })}
                  data-testid="switch-edit-template-requires-approval"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-template-renewal" className="text-sm">Renewal Period</Label>
                <Select
                  value={templateFormData.renewalPeriodMonths != null ? String(templateFormData.renewalPeriodMonths) : "none"}
                  onValueChange={(val) => setTemplateFormData({ ...templateFormData, renewalPeriodMonths: val === "none" ? null : parseInt(val) })}
                >
                  <SelectTrigger data-testid="select-edit-template-renewal">
                    <SelectValue placeholder="No renewal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No renewal</SelectItem>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How often documents from this template need renewal</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTemplate} disabled={updateTemplateMutation.isPending} data-testid="button-update-template">
              {updateTemplateMutation.isPending ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Upload Dialog */}
      <Dialog open={isVersionUploadDialogOpen} onOpenChange={setIsVersionUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload New Version
            </DialogTitle>
            <DialogDescription>
              Upload a new version of "{versionUploadTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">Current version: <strong>v{versionUploadTemplate?.version}</strong></p>
              <p className="text-sm text-muted-foreground">File: {decodeURIComponent(versionUploadTemplate?.fileName || "")}</p>
            </div>
            <div className="space-y-2">
              <Label>New File</Label>
              {newVersionFile ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{decodeURIComponent(newVersionFile.fileName)}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(newVersionFile.fileSize)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewVersionFile(null)}
                    data-testid="button-remove-version-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <SimpleFileUpload
                  onUploadComplete={(result) => setNewVersionFile(result)}
                  onError={(msg) => toast({ title: "Upload failed", description: msg, variant: "destructive" })}
                  accept=".doc,.docx,.pdf,.xls,.xlsx,.txt,.rtf"
                  maxSizeMB={50}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="version-change-note">Change Note (optional)</Label>
              <Input
                id="version-change-note"
                value={versionChangeNote}
                onChange={(e) => setVersionChangeNote(e.target.value)}
                placeholder="e.g., Updated compliance requirements"
                data-testid="input-version-change-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVersionUploadDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!versionUploadTemplate || !newVersionFile) return;
                uploadVersionMutation.mutate({
                  templateId: versionUploadTemplate.id,
                  data: {
                    fileName: newVersionFile.fileName,
                    fileUrl: newVersionFile.objectPath,
                    fileSize: newVersionFile.fileSize,
                    mimeType: newVersionFile.mimeType,
                    changeNote: versionChangeNote || undefined,
                  },
                });
              }}
              disabled={!newVersionFile || uploadVersionMutation.isPending}
              data-testid="button-upload-version"
            >
              {uploadVersionMutation.isPending ? "Uploading..." : "Upload Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={isVersionHistoryDialogOpen} onOpenChange={setIsVersionHistoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - All versions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templateVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No version history available</p>
            ) : (
              templateVersions.map((version) => (
                <div key={version.id} className="flex items-start gap-3 p-3 border rounded-md">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                    v{version.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{decodeURIComponent(version.fileName)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(version.fileSize)} • {new Date(version.createdAt).toLocaleDateString()} • Uploaded by: {version.uploadedBy}
                    </p>
                    {version.changeNote && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{version.changeNote}"</p>
                    )}
                  </div>
                  {version.fileUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => downloadFile(version.fileUrl, version.fileName)}
                      data-testid={`button-download-version-${version.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVersionHistoryDialogOpen(false)} data-testid="button-close-version-history">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Archive Template
            </DialogTitle>
            <DialogDescription>
              This action will archive "{templateToDelete?.name}" and remove it from active use. 
              The template and all its versions will be preserved in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-reason" className="text-sm font-medium">
                Reason for archiving <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Please provide a reason for archiving this template (minimum 5 characters)..."
                className="min-h-[80px]"
                data-testid="input-delete-reason"
              />
              {deleteReason.trim().length > 0 && deleteReason.trim().length < 5 && (
                <p className="text-xs text-destructive">Reason must be at least 5 characters</p>
              )}
            </div>
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">This action will:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Remove the template from active use</li>
                <li>Preserve all version history</li>
                <li>Create an audit record with your reason</li>
                <li>Allow recovery by administrators if needed</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setTemplateToDelete(null);
                setDeleteReason("");
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteTemplate}
              disabled={deleteReason.trim().length < 5 || deleteTemplateMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteTemplateMutation.isPending ? "Archiving..." : "Archive Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={isPermanentDeleteDialogOpen} onOpenChange={setIsPermanentDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Permanently Delete Template
            </DialogTitle>
            <DialogDescription>
              This will <strong>permanently remove</strong> "{templateToPermanentlyDelete?.name}" and all its version history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="permanent-delete-reason" className="text-sm font-medium">
                Reason for deletion <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="permanent-delete-reason"
                value={permanentDeleteReason}
                onChange={(e) => setPermanentDeleteReason(e.target.value)}
                placeholder="Please provide a reason for permanently deleting this template (minimum 5 characters)..."
                className="min-h-[80px]"
                data-testid="input-permanent-delete-reason"
              />
              {permanentDeleteReason.trim().length > 0 && permanentDeleteReason.trim().length < 5 && (
                <p className="text-xs text-destructive">Reason must be at least 5 characters</p>
              )}
            </div>
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
              <p className="font-medium text-destructive mb-1">Warning — this action is irreversible:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>The template and all versions are permanently removed</li>
                <li>Documents already generated from this template are not affected</li>
                <li>This cannot be recovered</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPermanentDeleteDialogOpen(false);
                setTemplateToPermanentlyDelete(null);
                setPermanentDeleteReason("");
              }}
              data-testid="button-cancel-permanent-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmPermanentDeleteTemplate}
              disabled={permanentDeleteReason.trim().length < 5 || permanentDeleteTemplateMutation.isPending}
              data-testid="button-confirm-permanent-delete"
            >
              {permanentDeleteTemplateMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Create Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Define a new folder template for organizing documents</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={folderFormData.name}
                onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                placeholder="e.g., Fire Safety Documents"
                data-testid="input-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-module">Module</Label>
              <Select 
                value={folderFormData.module} 
                onValueChange={(v) => setFolderFormData({ ...folderFormData, module: v as ModuleType, parentId: null })}
              >
                <SelectTrigger data-testid="select-folder-module">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_safety">Health & Safety</SelectItem>
                  <SelectItem value="human_resources">Human Resources</SelectItem>
                  <SelectItem value="employment_law">Employment Law</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-parent">Parent Folder (optional)</Label>
              <Select 
                value={folderFormData.parentId || "none"} 
                onValueChange={(v) => setFolderFormData({ ...folderFormData, parentId: v === "none" ? null : v })}
              >
                <SelectTrigger data-testid="select-folder-parent">
                  <SelectValue placeholder="Select parent folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root level)</SelectItem>
                  {parentFolderOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-description">Description</Label>
              <Textarea
                id="folder-description"
                value={folderFormData.description}
                onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                placeholder="Brief description of this folder's purpose"
                className="resize-none"
                data-testid="input-folder-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-sortOrder">Sort Order</Label>
              <Input
                id="folder-sortOrder"
                type="number"
                value={folderFormData.sortOrder}
                onChange={(e) => setFolderFormData({ ...folderFormData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-folder-sort"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending} data-testid="button-save-folder">
              {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Folder Edit Dialog */}
      <Dialog open={isEditFolderDialogOpen} onOpenChange={setIsEditFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
            <DialogDescription>Update folder template details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Name</Label>
              <Input
                id="edit-folder-name"
                value={folderFormData.name}
                onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                data-testid="input-edit-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-description">Description</Label>
              <Textarea
                id="edit-folder-description"
                value={folderFormData.description}
                onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                className="resize-none"
                data-testid="input-edit-folder-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder-sortOrder">Sort Order</Label>
              <Input
                id="edit-folder-sortOrder"
                type="number"
                value={folderFormData.sortOrder}
                onChange={(e) => setFolderFormData({ ...folderFormData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-folder-sort"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-folder-isActive">Active</Label>
              <Switch
                id="edit-folder-isActive"
                checked={folderFormData.isActive}
                onCheckedChange={(checked) => setFolderFormData({ ...folderFormData, isActive: checked })}
                data-testid="switch-edit-folder-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateFolder} disabled={updateFolderMutation.isPending} data-testid="button-update-folder">
              {updateFolderMutation.isPending ? "Updating..." : "Update Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Document Type Create Dialog */}
      <Dialog open={isDocTypeDialogOpen} onOpenChange={setIsDocTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Template Type</DialogTitle>
            <DialogDescription>Create a new template type for compliance tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doctype-name">Name</Label>
              <Input
                id="doctype-name"
                value={docTypeFormData.name}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, name: e.target.value })}
                placeholder="Fire Risk Assessment"
                data-testid="input-doctype-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-module">Module <span className="text-red-500">*</span></Label>
              <Select
                value={docTypeFormData.module}
                onValueChange={(v) => setDocTypeFormData({ ...docTypeFormData, module: v as ModuleType, folderTemplateId: "" })}
              >
                <SelectTrigger data-testid="select-doctype-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health_safety">Health & Safety</SelectItem>
                  <SelectItem value="human_resources">Human Resources</SelectItem>
                  <SelectItem value="employment_law">Employment Law</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-folder">Folder <span className="text-red-500">*</span></Label>
              <Select
                value={docTypeFormData.folderTemplateId}
                onValueChange={(v) => setDocTypeFormData({ ...docTypeFormData, folderTemplateId: v })}
              >
                <SelectTrigger data-testid="select-doctype-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {sortFoldersHierarchically(
                    folderTemplates.filter(f => f.module === docTypeFormData.module && f.isActive)
                  ).map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-amber-500" />
                          {folder.parentId ? "└ " : ""}{folder.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {folderTemplates.filter(f => f.module === docTypeFormData.module && f.isActive).length === 0 && (
                <p className="text-xs text-muted-foreground">No folders available for this module. Create a folder first.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-description">Description (optional)</Label>
              <Textarea
                id="doctype-description"
                value={docTypeFormData.description}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, description: e.target.value })}
                placeholder="Description of this template type"
                className="resize-none"
                data-testid="input-doctype-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-renewal">Renewal Period</Label>
              <Select
                value={docTypeFormData.renewalPeriodMonths != null ? String(docTypeFormData.renewalPeriodMonths) : "none"}
                onValueChange={(val) => setDocTypeFormData({
                  ...docTypeFormData,
                  renewalPeriodMonths: val === "none" ? null : parseInt(val),
                })}
              >
                <SelectTrigger data-testid="select-doctype-renewal">
                  <SelectValue placeholder="No renewal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No renewal</SelectItem>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="doctype-isRequired">Required document</Label>
              <Switch
                id="doctype-isRequired"
                checked={docTypeFormData.isRequired}
                onCheckedChange={(checked) => setDocTypeFormData({ ...docTypeFormData, isRequired: checked })}
                data-testid="switch-doctype-required"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDocTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDocType} disabled={createDocTypeMutation.isPending} data-testid="button-save-doctype">
              {createDocTypeMutation.isPending ? "Creating..." : "Create Template Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Document Type Edit Dialog */}
      <Dialog open={isEditDocTypeDialogOpen} onOpenChange={setIsEditDocTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template Type</DialogTitle>
            <DialogDescription>Update template type details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-doctype-name">Name</Label>
              <Input
                id="edit-doctype-name"
                value={docTypeFormData.name}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, name: e.target.value })}
                data-testid="input-edit-doctype-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-doctype-description">Description</Label>
              <Textarea
                id="edit-doctype-description"
                value={docTypeFormData.description}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, description: e.target.value })}
                className="resize-none"
                data-testid="input-edit-doctype-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-doctype-renewal">Renewal Period</Label>
              <Select
                value={docTypeFormData.renewalPeriodMonths != null ? String(docTypeFormData.renewalPeriodMonths) : "none"}
                onValueChange={(val) => setDocTypeFormData({
                  ...docTypeFormData,
                  renewalPeriodMonths: val === "none" ? null : parseInt(val),
                })}
              >
                <SelectTrigger data-testid="select-edit-doctype-renewal">
                  <SelectValue placeholder="No renewal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No renewal</SelectItem>
                  {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-doctype-isRequired">Required document</Label>
              <Switch
                id="edit-doctype-isRequired"
                checked={docTypeFormData.isRequired}
                onCheckedChange={(checked) => setDocTypeFormData({ ...docTypeFormData, isRequired: checked })}
                data-testid="switch-edit-doctype-required"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-doctype-isActive">Active</Label>
              <Switch
                id="edit-doctype-isActive"
                checked={docTypeFormData.isActive}
                onCheckedChange={(checked) => setDocTypeFormData({ ...docTypeFormData, isActive: checked })}
                data-testid="switch-edit-doctype-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDocTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateDocType} disabled={updateDocTypeMutation.isPending} data-testid="button-update-doctype">
              {updateDocTypeMutation.isPending ? "Updating..." : "Update Template Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Folder Dialog */}
      <Dialog open={isAssignFolderDialogOpen} onOpenChange={setIsAssignFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Folder</DialogTitle>
            <DialogDescription>
              Assign "{selectedDocType?.name}" to a folder template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Folder</Label>
              <Select value={selectedFolderIdForAssign} onValueChange={setSelectedFolderIdForAssign}>
                <SelectTrigger data-testid="select-assign-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {availableFoldersForDocType.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignFolderDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedDocType && selectedFolderIdForAssign) {
                  assignFolderMutation.mutate({
                    folderTemplateId: selectedFolderIdForAssign,
                    documentTypeId: selectedDocType.id,
                  });
                }
              }}
              disabled={!selectedFolderIdForAssign || assignFolderMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignFolderMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Setup Wizard Dialog */}
      <Dialog open={isWizardOpen} onOpenChange={(open) => { if (!open) closeWizard(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Setup Wizard
            </DialogTitle>
            <DialogDescription>
              Step-by-step guide to create a complete document structure
            </DialogDescription>
          </DialogHeader>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {["module", "folder", "doctype", "template"].map((step, index) => {
              const stepLabels = { module: "Module", folder: "Folder", doctype: "Type", template: "Template" };
              const steps: WizardStep[] = ["module", "folder", "doctype", "template"];
              const currentIndex = steps.indexOf(wizardStep);
              const stepIndex = index;
              const isComplete = stepIndex < currentIndex || wizardStep === "complete";
              const isCurrent = step === wizardStep;
              
              return (
                <div key={step} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    isComplete ? "bg-primary border-primary text-primary-foreground" :
                    isCurrent ? "border-primary text-primary" :
                    "border-muted-foreground/30 text-muted-foreground"
                  }`}>
                    {isComplete ? <Check className="h-4 w-4" /> : <span className="text-sm font-medium">{index + 1}</span>}
                  </div>
                  <span className={`text-sm ${isCurrent ? "font-medium" : "text-muted-foreground"}`}>
                    {stepLabels[step as keyof typeof stepLabels]}
                  </span>
                  {index < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
          
          <div className="min-h-[300px] py-4">
            {/* Step 1: Module Selection */}
            {wizardStep === "module" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select Module</h3>
                <p className="text-sm text-muted-foreground">Choose which compliance module this template type belongs to.</p>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {modules.map(module => {
                    const ModuleIcon = moduleIcons[module];
                    const isSelected = wizardData.module === module;
                    return (
                      <button
                        key={module}
                        onClick={() => setWizardData(prev => ({ ...prev, module, folderId: "", folderName: "" }))}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`wizard-module-${module}`}
                      >
                        <div className={`flex flex-col items-center gap-2 ${moduleColors[module]}`}>
                          <ModuleIcon className="h-8 w-8" />
                          <span className="font-medium text-sm">{moduleNames[module]}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Step 2: Folder Selection */}
            {wizardStep === "folder" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select or Create Folder</h3>
                <p className="text-sm text-muted-foreground">
                  Choose an existing folder or create a new one for {moduleNames[wizardData.module]}.
                </p>
                
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    variant={!wizardData.createNewFolder ? "default" : "outline"}
                    onClick={() => setWizardData(prev => ({ ...prev, createNewFolder: false }))}
                    data-testid="wizard-use-existing-folder"
                  >
                    Use Existing Folder
                  </Button>
                  <Button
                    variant={wizardData.createNewFolder ? "default" : "outline"}
                    onClick={() => setWizardData(prev => ({ ...prev, createNewFolder: true, folderId: "" }))}
                    data-testid="wizard-create-new-folder"
                  >
                    Create New Folder
                  </Button>
                </div>
                
                {!wizardData.createNewFolder ? (
                  <div className="space-y-2 pt-4">
                    <Label>Select Folder</Label>
                    <Select 
                      value={wizardData.folderId} 
                      onValueChange={(v) => {
                        const folder = folderTemplates.find(f => f.id === v);
                        setWizardData(prev => ({ ...prev, folderId: v, folderName: folder?.name || "" }));
                      }}
                    >
                      <SelectTrigger data-testid="wizard-select-folder">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {getWizardFoldersForModule().map(folder => (
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-amber-500" />
                              {folder.parentId ? "└ " : ""}{folder.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getWizardFoldersForModule().length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        No folders exist for this module. Please create a new folder.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-folder-name">Folder Name</Label>
                      <Input
                        id="wizard-folder-name"
                        value={wizardData.newFolderName}
                        onChange={(e) => setWizardData(prev => ({ ...prev, newFolderName: e.target.value }))}
                        placeholder="e.g., Fire Safety Documents"
                        data-testid="wizard-input-folder-name"
                      />
                      <p className="text-xs text-muted-foreground">A unique code (FLD-XXXXX) will be generated automatically</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Step 3: Template Type */}
            {wizardStep === "doctype" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Create Template Type</h3>
                <p className="text-sm text-muted-foreground">
                  Define the template type that will be stored in "{wizardData.folderName || wizardData.newFolderName}".
                </p>
                
                <div className="pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-doctype-name">Template Type Name</Label>
                    <Input
                      id="wizard-doctype-name"
                      value={wizardData.docTypeName}
                      onChange={(e) => setWizardData(prev => ({ ...prev, docTypeName: e.target.value }))}
                      placeholder="e.g., Fire Risk Assessment"
                      data-testid="wizard-input-doctype-name"
                    />
                    <p className="text-xs text-muted-foreground">A unique code (TPL-XXXXX) will be generated automatically</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="wizard-doctype-description">Description (optional)</Label>
                  <Textarea
                    id="wizard-doctype-description"
                    value={wizardData.docTypeDescription}
                    onChange={(e) => setWizardData(prev => ({ ...prev, docTypeDescription: e.target.value }))}
                    placeholder="Brief description of this template type"
                    className="resize-none"
                    data-testid="wizard-input-doctype-description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wizard-doctype-renewal">Renewal Period</Label>
                    <Select
                      value={wizardData.renewalPeriodMonths != null ? String(wizardData.renewalPeriodMonths) : "none"}
                      onValueChange={(val) => setWizardData(prev => ({
                        ...prev,
                        renewalPeriodMonths: val === "none" ? null : parseInt(val),
                      }))}
                    >
                      <SelectTrigger data-testid="select-wizard-doctype-renewal">
                        <SelectValue placeholder="No renewal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No renewal</SelectItem>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
                          <SelectItem key={m} value={String(m)}>
                            {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      id="wizard-doctype-required"
                      checked={wizardData.isRequired}
                      onCheckedChange={(checked) => setWizardData(prev => ({ ...prev, isRequired: checked }))}
                      data-testid="wizard-switch-doctype-required"
                    />
                    <Label htmlFor="wizard-doctype-required">Required document</Label>
                  </div>
                </div>
              </div>
            )}
            
            {/* Step 4: Template (optional) */}
            {wizardStep === "template" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Add Template (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Would you like to add a template file for "{wizardData.docTypeName}"?
                </p>
                
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    variant={wizardData.addTemplate ? "default" : "outline"}
                    onClick={() => setWizardData(prev => ({ ...prev, addTemplate: true }))}
                    data-testid="wizard-add-template-yes"
                  >
                    Yes, add a template
                  </Button>
                  <Button
                    variant={!wizardData.addTemplate ? "default" : "outline"}
                    onClick={() => setWizardData(prev => ({ ...prev, addTemplate: false }))}
                    data-testid="wizard-add-template-no"
                  >
                    Skip for now
                  </Button>
                </div>
                
                {wizardData.addTemplate && (
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-template-name">Template Name</Label>
                      <Input
                        id="wizard-template-name"
                        value={wizardData.templateName}
                        onChange={(e) => setWizardData(prev => ({ ...prev, templateName: e.target.value }))}
                        placeholder="e.g., Fire Risk Assessment Template"
                        data-testid="wizard-input-template-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-template-filename">File Name</Label>
                      <Input
                        id="wizard-template-filename"
                        value={wizardData.templateFileName}
                        onChange={(e) => setWizardData(prev => ({ ...prev, templateFileName: e.target.value }))}
                        placeholder="e.g., fire_risk_assessment_template.docx"
                        data-testid="wizard-input-template-filename"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="wizard-template-description">Description (optional)</Label>
                        <span className="text-xs text-muted-foreground">
                          {wizardData.templateDescription.length}/150
                        </span>
                      </div>
                      <Textarea
                        id="wizard-template-description"
                        value={wizardData.templateDescription}
                        onChange={(e) => setWizardData(prev => ({ ...prev, templateDescription: e.target.value.slice(0, 150) }))}
                        placeholder="Brief description of this template"
                        className="resize-none"
                        maxLength={150}
                        data-testid="wizard-input-template-description"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Complete Step */}
            {wizardStep === "complete" && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Setup Complete!</h3>
                <p className="text-muted-foreground max-w-md">
                  {wizardData.createNewFolder 
                    ? `Created folder "${wizardData.newFolderName}" with template type "${wizardData.docTypeName}"`
                    : `Added template type "${wizardData.docTypeName}" to folder "${wizardData.folderName}"`
                  }
                  {wizardData.addTemplate && ` and template "${wizardData.templateName}"`}.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            {wizardStep !== "complete" && wizardStep !== "module" && (
              <Button variant="outline" onClick={wizardPrevStep} disabled={wizardLoading}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {wizardStep === "complete" ? (
              <Button onClick={closeWizard} data-testid="wizard-button-done">
                Done
              </Button>
            ) : (
              <Button onClick={wizardNextStep} disabled={wizardLoading} data-testid="wizard-button-next">
                {wizardLoading ? "Processing..." : wizardStep === "template" ? "Finish" : "Next"}
                {!wizardLoading && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Delete Confirmation */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanent Deletion - Review Required
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to permanently delete the folder template <strong className="text-foreground">"{folderToDelete?.name}"</strong>.
                </p>
                
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800 dark:text-red-200 space-y-2">
                      <p className="font-semibold">This action is irreversible and will:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>Permanently remove this folder from the template library</li>
                        <li>Delete all document templates contained within this folder</li>
                        <li>Affect future site compliance structure</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Recommended:</strong> Review this folder's contents and confirm with your team before proceeding. Consider whether templates should be moved to another folder first.
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  This action is restricted to administrators only and will be logged in the audit trail.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel data-testid="button-cancel-delete-folder">Cancel & Review</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteFolder}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "I Understand, Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Doc Type Delete Confirmation */}
      <AlertDialog open={!!docTypeToDelete} onOpenChange={(open) => !open && setDocTypeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the document type <strong>"{docTypeToDelete?.name}"</strong>?
              <span className="block mt-2 text-foreground">
                This will remove the document type and its folder assignments. Existing documents of this type will not be affected.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-doctype">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDocType}
              disabled={deleteDocTypeMutation.isPending}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-doctype"
            >
              {deleteDocTypeMutation.isPending ? "Deleting..." : "Yes, Delete Document Type"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
