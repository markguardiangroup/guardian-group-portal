import { useQuery, useMutation } from "@tanstack/react-query";
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
  Clock,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FolderTemplate, DocumentTemplate, DocumentTypeRecord, FolderDocumentTypeRule, ModuleType } from "@shared/schema";

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

type TemplateFormData = {
  name: string;
  description: string;
  module: ModuleType;
  folderTemplateId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  placeholders: string;
  sortOrder: number;
};

type FolderFormData = {
  name: string;
  code: string;
  module: ModuleType;
  description: string;
  parentId: string | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
};

type DocTypeFormData = {
  name: string;
  code: string;
  module: ModuleType;
  description: string;
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  sortOrder: number;
  isActive: boolean;
};

const defaultTemplateFormData: TemplateFormData = {
  name: "",
  description: "",
  module: "health_safety",
  folderTemplateId: "",
  fileName: "",
  fileSize: 0,
  mimeType: "",
  placeholders: "",
  sortOrder: 0,
};

const defaultFolderFormData: FolderFormData = {
  name: "",
  code: "",
  module: "health_safety",
  description: "",
  parentId: null,
  isRequired: false,
  sortOrder: 0,
  isActive: true,
};

const defaultDocTypeFormData: DocTypeFormData = {
  name: "",
  code: "",
  module: "health_safety",
  description: "",
  isRequired: false,
  renewalPeriodMonths: null,
  sortOrder: 0,
  isActive: true,
};

type RuleWithDocType = FolderDocumentTypeRule & { documentType?: DocumentTypeRecord };

export default function TemplateLibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleType | "all">("all");
  
  // Template dialogs
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState<TemplateFormData>(defaultTemplateFormData);
  
  // Folder dialogs
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isEditFolderDialogOpen, setIsEditFolderDialogOpen] = useState(false);
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderTemplate | null>(null);
  const [folderFormData, setFolderFormData] = useState<FolderFormData>(defaultFolderFormData);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
  const [isRuleRequired, setIsRuleRequired] = useState(false);
  
  // Document type dialogs
  const [isDocTypeDialogOpen, setIsDocTypeDialogOpen] = useState(false);
  const [isEditDocTypeDialogOpen, setIsEditDocTypeDialogOpen] = useState(false);
  const [isAssignFolderDialogOpen, setIsAssignFolderDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeRecord | null>(null);
  const [docTypeFormData, setDocTypeFormData] = useState<DocTypeFormData>(defaultDocTypeFormData);
  const [selectedFolderIdForAssign, setSelectedFolderIdForAssign] = useState<string>("");
  
  // Queries
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });
  
  const { data: folderTemplates = [], isLoading: foldersLoading } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });
  
  const { data: documentTypes = [], isLoading: docTypesLoading } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });
  
  const { data: folderRules = [] } = useQuery<FolderDocumentTypeRule[]>({
    queryKey: ["/api/folder-document-type-rules"],
  });
  
  const { data: templateRules, refetch: refetchRules } = useQuery<RuleWithDocType[]>({
    queryKey: ["/api/folder-templates", selectedFolder?.id, "rules"],
    queryFn: async () => {
      if (!selectedFolder) return [];
      const response = await fetch(`/api/folder-templates/${selectedFolder.id}/rules`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      return response.json();
    },
    enabled: !!selectedFolder && isRulesDialogOpen,
  });
  
  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<TemplateFormData>) => {
      return apiRequest("POST", "/api/document-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
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
      setIsEditTemplateDialogOpen(false);
      setSelectedTemplate(null);
      toast({ title: "Template updated", description: "The document template has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update template", variant: "destructive" });
    },
  });
  
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/document-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({ title: "Template deleted", description: "The document template has been deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete template", variant: "destructive" });
    },
  });
  
  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: async (data: FolderFormData) => {
      return apiRequest("POST", "/api/folder-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
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
      toast({ title: "Folder deleted", description: "The folder template has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete folder", variant: "destructive" });
    },
  });
  
  const addRuleMutation = useMutation({
    mutationFn: async (data: { documentTypeId: string; isRequired: boolean }) => {
      return apiRequest("POST", `/api/folder-templates/${selectedFolder?.id}/rules`, data);
    },
    onSuccess: () => {
      refetchRules();
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      setSelectedDocTypeId("");
      setIsRuleRequired(false);
      toast({ title: "Document type linked", description: "The document type has been linked to this folder." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to link document type", variant: "destructive" });
    },
  });
  
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/folder-template-rules/${ruleId}`);
    },
    onSuccess: () => {
      refetchRules();
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      toast({ title: "Document type unlinked", description: "The document type has been removed from this folder." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to unlink document type", variant: "destructive" });
    },
  });
  
  // Document type mutations
  const createDocTypeMutation = useMutation({
    mutationFn: async (data: DocTypeFormData) => {
      return apiRequest("POST", "/api/document-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      setIsDocTypeDialogOpen(false);
      setDocTypeFormData(defaultDocTypeFormData);
      toast({ title: "Document type created", description: "The document type has been created successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create document type", variant: "destructive" });
    },
  });
  
  const updateDocTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DocTypeFormData> }) => {
      return apiRequest("PATCH", `/api/document-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      setIsEditDocTypeDialogOpen(false);
      setSelectedDocType(null);
      toast({ title: "Document type updated", description: "The document type has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update document type", variant: "destructive" });
    },
  });
  
  const deleteDocTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/document-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      toast({ title: "Document type deleted", description: "The document type has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete document type", variant: "destructive" });
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
      setIsAssignFolderDialogOpen(false);
      setSelectedDocType(null);
      setSelectedFolderIdForAssign("");
      toast({ title: "Folder assigned", description: "The document type has been assigned to the folder." });
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
    return result;
  }, [templates, selectedModule, searchQuery]);
  
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
  
  const availableDocTypesForFolder = useMemo(() => {
    if (!documentTypes || !selectedFolder || !templateRules) return [];
    const linkedTypeIds = new Set(templateRules.map(r => r.documentTypeId));
    return documentTypes.filter(dt => 
      dt.module === selectedFolder.module && 
      dt.isActive && 
      !linkedTypeIds.has(dt.id)
    );
  }, [documentTypes, selectedFolder, templateRules]);
  
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
    return filteredTemplates.filter(t => t.folderTemplateId === folderId);
  };
  
  const getRootFolders = (module: ModuleType) => {
    return filteredFolders.filter(f => f.module === module && !f.parentId);
  };
  
  const getChildFolders = (parentId: string) => {
    return filteredFolders.filter(f => f.parentId === parentId);
  };
  
  const getFolderName = (folderId: string) => {
    return folderTemplates.find(f => f.id === folderId)?.name || "Unknown";
  };
  
  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    return folderTemplates.find(t => t.id === parentId)?.name || null;
  };
  
  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);
  };
  
  // Template handlers
  const handleCreateTemplate = () => {
    if (!templateFormData.name || !templateFormData.folderTemplateId || !templateFormData.fileName) {
      toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createTemplateMutation.mutate({
      name: templateFormData.name,
      description: templateFormData.description || undefined,
      module: templateFormData.module,
      folderTemplateId: templateFormData.folderTemplateId,
      fileName: templateFormData.fileName,
      fileSize: templateFormData.fileSize || 1024,
      mimeType: templateFormData.mimeType || "application/octet-stream",
      placeholders: templateFormData.placeholders || undefined,
      sortOrder: templateFormData.sortOrder,
    });
  };
  
  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormData({
      name: template.name,
      description: template.description || "",
      module: template.module,
      folderTemplateId: template.folderTemplateId,
      fileName: template.fileName,
      fileSize: template.fileSize,
      mimeType: template.mimeType,
      placeholders: template.placeholders || "",
      sortOrder: template.sortOrder,
    });
    setIsEditTemplateDialogOpen(true);
  };
  
  const handleUpdateTemplate = () => {
    if (!selectedTemplate) return;
    updateTemplateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: templateFormData.name,
        description: templateFormData.description || undefined,
        placeholders: templateFormData.placeholders || undefined,
        sortOrder: templateFormData.sortOrder,
      },
    });
  };
  
  const handleDeleteTemplate = (template: DocumentTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteTemplateMutation.mutate(template.id);
    }
  };
  
  // Folder handlers
  const handleCreateFolder = () => {
    if (!folderFormData.name || !folderFormData.code) {
      toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createFolderMutation.mutate(folderFormData);
  };
  
  const handleEditFolder = (folder: FolderTemplate) => {
    setSelectedFolder(folder);
    setFolderFormData({
      name: folder.name,
      code: folder.code,
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
    if (confirm(`Are you sure you want to delete "${folder.name}"?`)) {
      deleteFolderMutation.mutate(folder.id);
    }
  };
  
  const handleManageRules = (folder: FolderTemplate) => {
    setSelectedFolder(folder);
    setIsRulesDialogOpen(true);
  };
  
  const handleAddRule = () => {
    if (!selectedDocTypeId) return;
    addRuleMutation.mutate({
      documentTypeId: selectedDocTypeId,
      isRequired: isRuleRequired,
    });
  };
  
  // Document type handlers
  const handleCreateDocType = () => {
    if (!docTypeFormData.name || !docTypeFormData.code) {
      toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createDocTypeMutation.mutate(docTypeFormData);
  };
  
  const handleEditDocType = (docType: DocumentTypeRecord) => {
    setSelectedDocType(docType);
    setDocTypeFormData({
      name: docType.name,
      code: docType.code,
      module: docType.module,
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
      data: docTypeFormData,
    });
  };
  
  const handleDeleteDocType = (docType: DocumentTypeRecord) => {
    if (confirm(`Are you sure you want to delete "${docType.name}"?`)) {
      deleteDocTypeMutation.mutate(docType.id);
    }
  };
  
  const handleAssignFolder = (docType: DocumentTypeRecord) => {
    setSelectedDocType(docType);
    setSelectedFolderIdForAssign("");
    setIsAssignFolderDialogOpen(true);
  };
  
  const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
  
  // Template card component
  const TemplateCard = ({ template, showFolder = false }: { template: DocumentTemplate; showFolder?: boolean }) => {
    const FileIcon = getFileIcon(template.mimeType);
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate" data-testid={`template-card-${template.id}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <FileIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{template.name}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{template.fileName}</span>
              <span>•</span>
              <span>{formatFileSize(template.fileSize)}</span>
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
          <Button variant="outline" size="sm" asChild>
            <Link href={`/create-from-template?templateId=${template.id}`} data-testid={`button-use-template-${template.id}`}>
              <Upload className="h-3 w-3 mr-1" />
              Use
            </Link>
          </Button>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-template-actions-${template.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDeleteTemplate(template)} className="text-red-600 dark:text-red-400">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    );
  };
  
  // Folder tree renderer
  const renderFolderTree = (folder: FolderTemplate, depth: number = 0) => {
    const children = getChildFolders(folder.id);
    const templatesInFolder = getTemplatesForFolder(folder.id);
    const hasContent = children.length > 0 || templatesInFolder.length > 0;
    
    return (
      <AccordionItem key={folder.id} value={folder.id} className="border-0">
        <AccordionTrigger 
          className="py-2 hover:no-underline"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{folder.name}</span>
            {templatesInFolder.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {templatesInFolder.length}
              </Badge>
            )}
            {isAdmin && (
              <div className="ml-auto mr-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleManageRules(folder)} data-testid={`button-folder-rules-${folder.id}`}>
                  <LinkIcon className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditFolder(folder)} data-testid={`button-folder-edit-${folder.id}`}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600" onClick={() => handleDeleteFolder(folder)} data-testid={`button-folder-delete-${folder.id}`}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <div style={{ paddingLeft: `${(depth + 1) * 16}px` }} className="space-y-2">
            {templatesInFolder.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
            {children.length > 0 && (
              <Accordion type="multiple" className="w-full">
                {children.map(child => renderFolderTree(child, depth + 1))}
              </Accordion>
            )}
            {!hasContent && (
              <p className="text-sm text-muted-foreground py-2">No templates in this folder</p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };
  
  const isLoading = templatesLoading || foldersLoading || docTypesLoading;
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Template Library
          </h1>
          <p className="text-muted-foreground">
            Manage templates, folders, and document types - the "Document Bible"
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
            <TabsTrigger value="folders" data-testid="tab-folders">
              <FolderTree className="h-4 w-4 mr-2" />
              Folders
            </TabsTrigger>
            <TabsTrigger value="document-types" data-testid="tab-document-types">
              <File className="h-4 w-4 mr-2" />
              Document Types
            </TabsTrigger>
          </TabsList>
          
          {isAdmin && (
            <div className="flex gap-2">
              {activeTab === "templates" && (
                <Button onClick={() => setIsTemplateDialogOpen(true)} data-testid="button-add-template">
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
                  Add Document Type
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v as ModuleType | "all")}>
            <SelectTrigger className="w-48" data-testid="select-module-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              <SelectItem value="health_safety">Health & Safety</SelectItem>
              <SelectItem value="human_resources">Human Resources</SelectItem>
              <SelectItem value="employment_law">Employment Law</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {searchQuery ? (
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
            <div className="space-y-6">
              {modules.filter(m => selectedModule === "all" || selectedModule === m).map(module => {
                const ModuleIcon = moduleIcons[module];
                const rootFolders = getRootFolders(module);
                const moduleTemplateCount = templates.filter(t => t.module === module).length;
                
                if (rootFolders.length === 0 && moduleTemplateCount === 0) return null;
                
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
                    </CardHeader>
                    <CardContent>
                      {rootFolders.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                          {rootFolders.map(folder => renderFolderTree(folder))}
                        </Accordion>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          No folder structure defined. 
                          {isAdmin && " Create folders in the Folders tab first."}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
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
                      <TableHead>Required</TableHead>
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
                              {folder.isRequired ? (
                                <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Required</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Optional</span>
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
                                    <DropdownMenuItem onClick={() => handleManageRules(folder)}>
                                      <LinkIcon className="h-4 w-4 mr-2" />
                                      Manage Document Types
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEditFolder(folder)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteFolder(folder)} className="text-red-600 dark:text-red-400">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
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
        
        {/* Document Types Tab */}
        <TabsContent value="document-types" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {documentTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No document types found</p>
                  <p className="text-sm mt-1">Create document types for compliance tracking</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Folder</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Renewal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocTypes.map((docType) => {
                      const ModuleIcon = moduleIcons[docType.module];
                      return (
                        <TableRow key={docType.id} data-testid={`row-doctype-${docType.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{docType.name}</div>
                              {docType.description && (
                                <div className="text-sm text-muted-foreground line-clamp-1">{docType.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{docType.code}</code>
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-2 ${moduleColors[docType.module]}`}>
                              <ModuleIcon className="h-4 w-4" />
                              <span className="text-sm">{moduleNames[docType.module]}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {docTypeToFolders.get(docType.id)?.length ? (
                              <div className="flex items-center gap-1 text-sm">
                                <FolderOpen className="h-3 w-3 text-muted-foreground" />
                                <span>{docTypeToFolders.get(docType.id)!.join(", ")}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {docType.isRequired ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Required
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">Optional</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {docType.renewalPeriodMonths ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {docType.renewalPeriodMonths} months
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {docType.isActive ? (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-doctype-actions-${docType.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditDocType(docType)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAssignFolder(docType)}>
                                    <FolderPlus className="h-4 w-4 mr-2" />
                                    Assign to Folder
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteDocType(docType)} className="text-red-600 dark:text-red-400">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
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
      
      {/* Template Create Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Document Template</DialogTitle>
            <DialogDescription>Upload a new template to the Document Bible</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateFormData.name}
                onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                placeholder="e.g., Fire Risk Assessment Template"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-module">Module</Label>
              <Select 
                value={templateFormData.module} 
                onValueChange={(v) => setTemplateFormData({ ...templateFormData, module: v as ModuleType, folderTemplateId: "" })}
              >
                <SelectTrigger data-testid="select-template-module">
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
              <Label htmlFor="template-folder">Folder</Label>
              <Select 
                value={templateFormData.folderTemplateId} 
                onValueChange={(v) => setTemplateFormData({ ...templateFormData, folderTemplateId: v })}
              >
                <SelectTrigger data-testid="select-template-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folderTemplates
                    .filter(f => f.module === templateFormData.module && f.isActive)
                    .map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.parentId ? "└ " : ""}{folder.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-fileName">File Name</Label>
              <Input
                id="template-fileName"
                value={templateFormData.fileName}
                onChange={(e) => setTemplateFormData({ ...templateFormData, fileName: e.target.value })}
                placeholder="e.g., fire_risk_assessment_template.docx"
                data-testid="input-template-filename"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description (Optional)</Label>
              <Textarea
                id="template-description"
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                placeholder="Brief description of when to use this template..."
                rows={2}
                data-testid="input-template-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-placeholders">Placeholders (Optional)</Label>
              <Input
                id="template-placeholders"
                value={templateFormData.placeholders}
                onChange={(e) => setTemplateFormData({ ...templateFormData, placeholders: e.target.value })}
                placeholder='["COMPANY_NAME", "SITE_ADDRESS", "DATE"]'
                data-testid="input-template-placeholders"
              />
              <p className="text-xs text-muted-foreground">JSON array of placeholder names that will be auto-filled</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending} data-testid="button-save-template">
              {createTemplateMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template Edit Dialog */}
      <Dialog open={isEditTemplateDialogOpen} onOpenChange={setIsEditTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
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
              <Label htmlFor="edit-template-description">Description</Label>
              <Textarea
                id="edit-template-description"
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                rows={2}
                data-testid="input-edit-template-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-placeholders">Placeholders</Label>
              <Input
                id="edit-template-placeholders"
                value={templateFormData.placeholders}
                onChange={(e) => setTemplateFormData({ ...templateFormData, placeholders: e.target.value })}
                data-testid="input-edit-template-placeholders"
              />
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
              <Label htmlFor="folder-code">Code</Label>
              <Input
                id="folder-code"
                value={folderFormData.code}
                onChange={(e) => setFolderFormData({ ...folderFormData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="e.g., fire_safety_docs"
                data-testid="input-folder-code"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="folder-isRequired">Required folder</Label>
              <Switch
                id="folder-isRequired"
                checked={folderFormData.isRequired}
                onCheckedChange={(checked) => setFolderFormData({ ...folderFormData, isRequired: checked })}
                data-testid="switch-folder-required"
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
              <Label htmlFor="edit-folder-isRequired">Required folder</Label>
              <Switch
                id="edit-folder-isRequired"
                checked={folderFormData.isRequired}
                onCheckedChange={(checked) => setFolderFormData({ ...folderFormData, isRequired: checked })}
                data-testid="switch-edit-folder-required"
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
      
      {/* Folder Rules Dialog */}
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Document Types</DialogTitle>
            <DialogDescription>
              Link document types to "{selectedFolder?.name}" folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Add Document Type</Label>
                <Select value={selectedDocTypeId} onValueChange={setSelectedDocTypeId}>
                  <SelectTrigger data-testid="select-rule-doctype">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocTypesForFolder.map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <Switch
                  id="rule-required"
                  checked={isRuleRequired}
                  onCheckedChange={setIsRuleRequired}
                />
                <Label htmlFor="rule-required" className="text-sm">Required</Label>
              </div>
              <Button onClick={handleAddRule} disabled={!selectedDocTypeId || addRuleMutation.isPending} data-testid="button-add-rule">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {templateRules && templateRules.length > 0 ? (
              <div className="space-y-2">
                <Label>Linked Document Types</Label>
                {templateRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{rule.documentType?.name || "Unknown"}</span>
                      {rule.isRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                      disabled={deleteRuleMutation.isPending}
                      data-testid={`button-remove-rule-${rule.id}`}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No document types linked to this folder yet
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRulesDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Document Type Create Dialog */}
      <Dialog open={isDocTypeDialogOpen} onOpenChange={setIsDocTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Document Type</DialogTitle>
            <DialogDescription>Create a new document type for compliance tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doctype-name">Name</Label>
              <Input
                id="doctype-name"
                value={docTypeFormData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDocTypeFormData({ ...docTypeFormData, name, code: generateCode(name) });
                }}
                placeholder="Fire Risk Assessment"
                data-testid="input-doctype-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-code">Code</Label>
              <Input
                id="doctype-code"
                value={docTypeFormData.code}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, code: e.target.value })}
                placeholder="fire_risk_assessment"
                data-testid="input-doctype-code"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-module">Module</Label>
              <Select
                value={docTypeFormData.module}
                onValueChange={(v) => setDocTypeFormData({ ...docTypeFormData, module: v as ModuleType })}
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
              <Label htmlFor="doctype-description">Description (optional)</Label>
              <Textarea
                id="doctype-description"
                value={docTypeFormData.description}
                onChange={(e) => setDocTypeFormData({ ...docTypeFormData, description: e.target.value })}
                placeholder="Description of this document type"
                className="resize-none"
                data-testid="input-doctype-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctype-renewal">Renewal Period (months)</Label>
              <Input
                id="doctype-renewal"
                type="number"
                min="1"
                value={docTypeFormData.renewalPeriodMonths ?? ""}
                onChange={(e) => setDocTypeFormData({
                  ...docTypeFormData,
                  renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null,
                })}
                placeholder="Leave empty if no renewal required"
                data-testid="input-doctype-renewal"
              />
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
              {createDocTypeMutation.isPending ? "Creating..." : "Create Document Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Document Type Edit Dialog */}
      <Dialog open={isEditDocTypeDialogOpen} onOpenChange={setIsEditDocTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document Type</DialogTitle>
            <DialogDescription>Update document type details</DialogDescription>
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
              <Label htmlFor="edit-doctype-renewal">Renewal Period (months)</Label>
              <Input
                id="edit-doctype-renewal"
                type="number"
                min="1"
                value={docTypeFormData.renewalPeriodMonths ?? ""}
                onChange={(e) => setDocTypeFormData({
                  ...docTypeFormData,
                  renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null,
                })}
                data-testid="input-edit-doctype-renewal"
              />
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
              {updateDocTypeMutation.isPending ? "Updating..." : "Update Document Type"}
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
    </div>
  );
}
