import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  Folder,
  FolderOpen,
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
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FolderTemplate, DocumentTemplate, ModuleType } from "@shared/schema";

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

type FormData = {
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

const defaultFormData: FormData = {
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

export default function TemplateLibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<ModuleType | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });
  
  const { data: folderTemplates = [], isLoading: foldersLoading } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: Partial<FormData>) => {
      return apiRequest("POST", "/api/document-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setIsCreateDialogOpen(false);
      setFormData(defaultFormData);
      toast({
        title: "Template created",
        description: "The document template has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      return apiRequest("PATCH", `/api/document-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      toast({
        title: "Template updated",
        description: "The document template has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        variant: "destructive",
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/document-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      toast({
        title: "Template deleted",
        description: "The document template has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });
  
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
  
  const handleCreate = () => {
    if (!formData.name || !formData.folderTemplateId || !formData.fileName) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      module: formData.module,
      folderTemplateId: formData.folderTemplateId,
      fileName: formData.fileName,
      fileSize: formData.fileSize || 1024,
      mimeType: formData.mimeType || "application/octet-stream",
      placeholders: formData.placeholders || undefined,
      sortOrder: formData.sortOrder,
    });
  };
  
  const handleEdit = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setFormData({
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
    setIsEditDialogOpen(true);
  };
  
  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        placeholders: formData.placeholders || undefined,
        sortOrder: formData.sortOrder,
      },
    });
  };
  
  const handleDelete = (template: DocumentTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteMutation.mutate(template.id);
    }
  };
  
  const modules: ModuleType[] = ["health_safety", "human_resources", "employment_law"];
  
  const renderFolderTree = (folder: FolderTemplate, depth: number = 0) => {
    const children = getChildFolders(folder.id);
    const templatesInFolder = getTemplatesForFolder(folder.id);
    const ModuleIcon = moduleIcons[folder.module] || Folder;
    const hasContent = children.length > 0 || templatesInFolder.length > 0;
    
    return (
      <AccordionItem key={folder.id} value={folder.id} className="border-0">
        <AccordionTrigger 
          className="py-2 hover:no-underline"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{folder.name}</span>
            {templatesInFolder.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {templatesInFolder.length}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <div style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
            {templatesInFolder.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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
  
  if (templatesLoading || foldersLoading) {
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
            Document templates organized by module and folder - the "Document Bible"
          </p>
        </div>
        
        {isAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
        
        <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v as ModuleType | "all")}>
          <SelectTrigger className="w-48" data-testid="select-module-filter">
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
      
      {searchQuery ? (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>{filteredTemplates.length} templates found</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredTemplates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
                showFolder
                getFolderName={getFolderName}
              />
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                No templates match your search
              </p>
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
                      {isAdmin && " Create folders in the Folder Hub first."}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Document Template</DialogTitle>
            <DialogDescription>
              Upload a new template to the Document Bible
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fire Risk Assessment Template"
                data-testid="input-template-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select 
                value={formData.module} 
                onValueChange={(v) => {
                  setFormData({ ...formData, module: v as ModuleType, folderTemplateId: "" });
                }}
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
              <Label htmlFor="folder">Folder</Label>
              <Select 
                value={formData.folderTemplateId} 
                onValueChange={(v) => setFormData({ ...formData, folderTemplateId: v })}
              >
                <SelectTrigger data-testid="select-template-folder">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folderTemplates
                    .filter(f => f.module === formData.module && f.isActive)
                    .map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.parentId ? "└ " : ""}{folder.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={formData.fileName}
                onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                placeholder="e.g., fire_risk_assessment_template.docx"
                data-testid="input-template-filename"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when to use this template..."
                rows={2}
                data-testid="input-template-description"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="placeholders">Placeholders (Optional)</Label>
              <Input
                id="placeholders"
                value={formData.placeholders}
                onChange={(e) => setFormData({ ...formData, placeholders: e.target.value })}
                placeholder='["COMPANY_NAME", "SITE_ADDRESS", "DATE"]'
                data-testid="input-template-placeholders"
              />
              <p className="text-xs text-muted-foreground">
                JSON array of placeholder names that will be auto-filled
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createMutation.isPending}
              data-testid="button-save-template"
            >
              {createMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-template-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                data-testid="input-edit-template-description"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-placeholders">Placeholders</Label>
              <Input
                id="edit-placeholders"
                value={formData.placeholders}
                onChange={(e) => setFormData({ ...formData, placeholders: e.target.value })}
                data-testid="input-edit-template-placeholders"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={updateMutation.isPending}
              data-testid="button-update-template"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateCardProps {
  template: DocumentTemplate;
  isAdmin: boolean;
  onEdit: (template: DocumentTemplate) => void;
  onDelete: (template: DocumentTemplate) => void;
  showFolder?: boolean;
  getFolderName?: (folderId: string) => string;
}

function TemplateCard({ template, isAdmin, onEdit, onDelete, showFolder, getFolderName }: TemplateCardProps) {
  const FileIcon = getFileIcon(template.mimeType);
  const ModuleIcon = moduleIcons[template.module] || FileText;
  
  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg border bg-background hover-elevate transition-colors"
      data-testid={`template-card-${template.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded bg-muted">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{template.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{template.fileName}</span>
            <span>•</span>
            <span>{formatFileSize(template.fileSize)}</span>
            <span>•</span>
            <span>v{template.version}</span>
            {showFolder && getFolderName && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Folder className="h-3 w-3" />
                  {getFolderName(template.folderTemplateId)}
                </span>
              </>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {template.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={moduleColors[template.module]}>
          <ModuleIcon className="h-3 w-3 mr-1" />
          {moduleNames[template.module]}
        </Badge>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-template-menu-${template.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid={`button-download-template-${template.id}`}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem data-testid={`button-view-versions-${template.id}`}>
              <History className="h-4 w-4 mr-2" />
              Version History
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(template)} data-testid={`button-edit-template-${template.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem data-testid={`button-upload-version-${template.id}`}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Version
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive" 
                  onClick={() => onDelete(template)}
                  data-testid={`button-delete-template-${template.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
