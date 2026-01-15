import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  Folder,
  FolderTree,
  MoreVertical,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  Filter,
  Link as LinkIcon,
  FileText,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FolderTemplate, DocumentTypeRecord, FolderDocumentTypeRule, ModuleType } from "@shared/schema";

const moduleIcons: Record<ModuleType, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
};

const moduleNames: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const moduleColors: Record<ModuleType, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<ModuleType, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

type FormData = {
  name: string;
  code: string;
  module: ModuleType;
  description: string;
  parentId: string | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
};

const initialFormData: FormData = {
  name: "",
  code: "",
  module: "health_safety",
  description: "",
  parentId: null,
  isRequired: false,
  sortOrder: 0,
  isActive: true,
};

type RuleWithDocType = FolderDocumentTypeRule & { documentType?: DocumentTypeRecord };

export default function FolderTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleType | "all">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FolderTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
  const [isRuleRequired, setIsRuleRequired] = useState(false);

  const { data: folderTemplates, isLoading } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });

  const { data: documentTypes } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });

  const { data: templateRules, refetch: refetchRules } = useQuery<RuleWithDocType[]>({
    queryKey: ["/api/folder-templates", selectedTemplate?.id, "rules"],
    queryFn: async () => {
      if (!selectedTemplate) return [];
      const response = await fetch(`/api/folder-templates/${selectedTemplate.id}/rules`);
      if (!response.ok) throw new Error("Failed to fetch rules");
      return response.json();
    },
    enabled: !!selectedTemplate && showRulesDialog,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/folder-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      setShowCreateDialog(false);
      setFormData(initialFormData);
      toast({
        title: "Folder template created",
        description: "The folder template has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder template",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      return apiRequest("PATCH", `/api/folder-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      setShowEditDialog(false);
      setSelectedTemplate(null);
      toast({
        title: "Folder template updated",
        description: "The folder template has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update folder template",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/folder-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
      toast({
        title: "Folder template deleted",
        description: "The folder template has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete folder template",
        variant: "destructive",
      });
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: async (data: { documentTypeId: string; isRequired: boolean }) => {
      return apiRequest("POST", `/api/folder-templates/${selectedTemplate?.id}/rules`, data);
    },
    onSuccess: () => {
      refetchRules();
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      setSelectedDocTypeId("");
      setIsRuleRequired(false);
      toast({
        title: "Document type linked",
        description: "The document type has been linked to this folder template.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link document type",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/folder-template-rules/${ruleId}`);
    },
    onSuccess: () => {
      refetchRules();
      queryClient.invalidateQueries({ queryKey: ["/api/folder-document-type-rules"] });
      toast({
        title: "Document type unlinked",
        description: "The document type has been removed from this folder template.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unlink document type",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = useMemo(() => {
    if (!folderTemplates) return [];
    
    return folderTemplates.filter((template) => {
      const matchesSearch = 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      const matchesModule = moduleFilter === "all" || template.module === moduleFilter;
      
      return matchesSearch && matchesModule;
    }).sort((a, b) => {
      if (a.module !== b.module) {
        return a.module.localeCompare(b.module);
      }
      return a.sortOrder - b.sortOrder;
    });
  }, [folderTemplates, searchQuery, moduleFilter]);

  const availableDocTypes = useMemo(() => {
    if (!documentTypes || !selectedTemplate || !templateRules) return [];
    
    const linkedTypeIds = new Set(templateRules.map(r => r.documentTypeId));
    return documentTypes.filter(dt => 
      dt.module === selectedTemplate.module && 
      dt.isActive && 
      !linkedTypeIds.has(dt.id)
    );
  }, [documentTypes, selectedTemplate, templateRules]);

  const parentOptions = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter(t => 
      t.module === formData.module && 
      t.id !== selectedTemplate?.id &&
      !t.parentId
    );
  }, [folderTemplates, formData.module, selectedTemplate]);

  const handleEdit = (template: FolderTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      code: template.code,
      module: template.module,
      description: template.description || "",
      parentId: template.parentId,
      isRequired: template.isRequired,
      sortOrder: template.sortOrder,
      isActive: template.isActive,
    });
    setShowEditDialog(true);
  };

  const handleDelete = (template: FolderTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const handleManageRules = (template: FolderTemplate) => {
    setSelectedTemplate(template);
    setShowRulesDialog(true);
  };

  const handleAddRule = () => {
    if (!selectedDocTypeId) return;
    addRuleMutation.mutate({
      documentTypeId: selectedDocTypeId,
      isRequired: isRuleRequired,
    });
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId || !folderTemplates) return null;
    const parent = folderTemplates.find(t => t.id === parentId);
    return parent?.name || null;
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              <p>Only administrators can access folder template management.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FolderTree className="h-6 w-6" />
            Folder Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Define master folder structures that can be applied to all sites
          </p>
        </div>
        <Button onClick={() => {
          setFormData(initialFormData);
          setShowCreateDialog(true);
        }} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search folder templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-templates"
              />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-module-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="health_safety">Health &amp; Safety</SelectItem>
                <SelectItem value="human_resources">Human Resources</SelectItem>
                <SelectItem value="employment_law">Employment Law</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No folder templates found</p>
              <p className="text-sm mt-1">Create templates to define your folder structure</p>
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
                {filteredTemplates.map((template) => {
                  const ModuleIcon = moduleIcons[template.module];
                  return (
                    <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{template.name}</span>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {template.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${moduleColors[template.module]}`}>
                          <ModuleIcon className="h-4 w-4" />
                          <span className="text-sm">{moduleNames[template.module]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.parentId ? (
                          <span className="text-sm text-muted-foreground">
                            {getParentName(template.parentId) || "—"}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Root</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.isRequired ? (
                          <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Required
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.isActive ? (
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-template-actions-${template.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleManageRules(template)}>
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Manage Document Types
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEdit(template)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(template)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder Template</DialogTitle>
            <DialogDescription>
              Define a new folder template that can be applied to all sites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fire Safety Documents"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="e.g., fire_safety_docs"
                data-testid="input-template-code"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select 
                value={formData.module} 
                onValueChange={(v) => setFormData({ ...formData, module: v as ModuleType, parentId: null })}
              >
                <SelectTrigger data-testid="select-template-module">
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
              <Label htmlFor="parent">Parent Folder (optional)</Label>
              <Select 
                value={formData.parentId || "none"} 
                onValueChange={(v) => setFormData({ ...formData, parentId: v === "none" ? null : v })}
              >
                <SelectTrigger data-testid="select-template-parent">
                  <SelectValue placeholder="Select parent folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root level)</SelectItem>
                  {parentOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this folder's purpose"
                className="resize-none"
                data-testid="input-template-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-template-sort"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isRequired">Required folder</Label>
              <Switch
                id="isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                data-testid="switch-template-required"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Active</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-template-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || !formData.code || createMutation.isPending}
              data-testid="button-confirm-create-template"
            >
              {createMutation.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Folder Template</DialogTitle>
            <DialogDescription>
              Update the folder template settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                data-testid="input-edit-template-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent">Parent Folder (optional)</Label>
              <Select 
                value={formData.parentId || "none"} 
                onValueChange={(v) => setFormData({ ...formData, parentId: v === "none" ? null : v })}
              >
                <SelectTrigger data-testid="select-edit-template-parent">
                  <SelectValue placeholder="Select parent folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root level)</SelectItem>
                  {parentOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="resize-none"
                data-testid="input-edit-template-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sortOrder">Sort Order</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-template-sort"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isRequired">Required folder</Label>
              <Switch
                id="edit-isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                data-testid="switch-edit-template-required"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">Active</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-template-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedTemplate && updateMutation.mutate({ id: selectedTemplate.id, data: formData })}
              disabled={!formData.name || !formData.code || updateMutation.isPending}
              data-testid="button-confirm-edit-template"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{selectedTemplate?.name}&rdquo;? This action cannot be undone.
              Any child templates and linked document type rules will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-template"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Document Types for &ldquo;{selectedTemplate?.name}&rdquo;
            </DialogTitle>
            <DialogDescription>
              Link document types that should be organized in this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Document Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Document Type</Label>
                    <Select value={selectedDocTypeId} onValueChange={setSelectedDocTypeId}>
                      <SelectTrigger data-testid="select-rule-doctype">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDocTypes.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No available document types
                          </div>
                        ) : (
                          availableDocTypes.map((dt) => (
                            <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ruleRequired"
                      checked={isRuleRequired}
                      onCheckedChange={setIsRuleRequired}
                    />
                    <Label htmlFor="ruleRequired" className="text-sm">Required</Label>
                  </div>
                  <Button 
                    onClick={handleAddRule}
                    disabled={!selectedDocTypeId || addRuleMutation.isPending}
                    data-testid="button-add-rule"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Linked Document Types</Label>
              {!templateRules || templateRules.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground border rounded-md">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No document types linked yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templateRules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`rule-${rule.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{rule.documentType?.name || "Unknown"}</span>
                        {rule.isRequired && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                        disabled={deleteRuleMutation.isPending}
                        data-testid={`button-delete-rule-${rule.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRulesDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
