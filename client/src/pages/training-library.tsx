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
import { 
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  Headphones,
  GraduationCap,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
  Building2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingModule, FolderTemplate, ModuleType } from "@shared/schema";

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

export default function TrainingLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeModule, setActiveModule] = useState<ModuleType>("health_safety");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<TrainingModule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    module: "health_safety" as ModuleType,
    folderTemplateId: "",
    provider: "",
    externalLink: "",
    duration: "",
    isRequired: false,
    renewalPeriodMonths: null as number | null,
  });

  // Fetch training modules
  const { data: trainingModules, isLoading: modulesLoading } = useQuery<TrainingModule[]>({
    queryKey: ["/api/training-modules"],
  });

  // Fetch folder templates for organization
  const { data: folderTemplates } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });

  // Create training module
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/training-modules", {
        ...data,
        folderTemplateId: data.folderTemplateId || undefined,
        renewalPeriodMonths: data.renewalPeriodMonths || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-modules"] });
      setShowAddDialog(false);
      resetForm();
      toast({
        title: "Training module created",
        description: "The training module has been added to the library.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create training module",
        variant: "destructive",
      });
    },
  });

  // Update training module
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest("PATCH", `/api/training-modules/${id}`, {
        ...data,
        folderTemplateId: data.folderTemplateId || null,
        renewalPeriodMonths: data.renewalPeriodMonths || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-modules"] });
      setEditingModule(null);
      resetForm();
      toast({
        title: "Training module updated",
        description: "The training module has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update training module",
        variant: "destructive",
      });
    },
  });

  // Delete training module
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-modules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-modules"] });
      toast({
        title: "Training module deleted",
        description: "The training module has been removed from the library.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete training module",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      module: activeModule,
      folderTemplateId: "",
      provider: "",
      externalLink: "",
      duration: "",
      isRequired: false,
      renewalPeriodMonths: null,
    });
  };

  const handleEdit = (module: TrainingModule) => {
    setFormData({
      title: module.title,
      description: module.description || "",
      module: module.module as ModuleType,
      folderTemplateId: module.folderTemplateId || "",
      provider: module.provider || "",
      externalLink: module.externalLink,
      duration: module.duration || "",
      isRequired: module.isRequired,
      renewalPeriodMonths: module.renewalPeriodMonths,
    });
    setEditingModule(module);
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.externalLink.trim()) {
      toast({
        title: "Validation error",
        description: "Title and external link are required.",
        variant: "destructive",
      });
      return;
    }

    if (editingModule) {
      updateMutation.mutate({ id: editingModule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filter modules by active tab and search
  const filteredModules = useMemo(() => {
    if (!trainingModules) return [];
    
    return trainingModules
      .filter((m) => m.module === activeModule)
      .filter((m) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query) ||
          m.provider?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [trainingModules, activeModule, searchQuery]);

  // Get folder templates for active module
  const moduleFolders = useMemo(() => {
    if (!folderTemplates) return [];
    return folderTemplates.filter((f) => f.module === activeModule && f.isActive);
  }, [folderTemplates, activeModule]);

  // Group modules by folder
  const groupedByFolder = useMemo(() => {
    const groups: Record<string, TrainingModule[]> = { unfiled: [] };
    
    moduleFolders.forEach((folder) => {
      groups[folder.id] = [];
    });
    
    filteredModules.forEach((module) => {
      if (module.folderTemplateId && groups[module.folderTemplateId]) {
        groups[module.folderTemplateId].push(module);
      } else {
        groups.unfiled.push(module);
      }
    });
    
    return groups;
  }, [filteredModules, moduleFolders]);

  const ModuleIcon = moduleIcons[activeModule];
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            Only administrators can manage the Training Library.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${moduleBgColors[activeModule]}`}>
              <GraduationCap className={`h-6 w-6 ${moduleColors[activeModule]}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Training Library</h1>
              <p className="text-sm text-muted-foreground">
                Manage training resources across all modules
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setFormData((prev) => ({ ...prev, module: activeModule }));
              setShowAddDialog(true);
            }}
            className="gap-2"
            data-testid="button-add-training"
          >
            <Plus className="h-4 w-4" />
            Add Training
          </Button>
        </div>

        {/* Module Tabs */}
        <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleType)}>
          <TabsList className="mx-6 mb-4">
            {(["health_safety", "human_resources", "employment_law"] as ModuleType[]).map((mod) => {
              const Icon = moduleIcons[mod];
              const count = trainingModules?.filter((m) => m.module === mod).length || 0;
              return (
                <TabsTrigger 
                  key={mod} 
                  value={mod} 
                  className="gap-2"
                  data-testid={`tab-${mod}`}
                >
                  <Icon className="h-4 w-4" />
                  {moduleNames[mod]}
                  <Badge variant="secondary" className="ml-1">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search training modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-training"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {modulesLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredModules.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No training modules yet</h3>
            <p className="text-muted-foreground mb-4">
              Add training resources for {moduleNames[activeModule]} module
            </p>
            <Button
              onClick={() => {
                resetForm();
                setFormData((prev) => ({ ...prev, module: activeModule }));
                setShowAddDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add First Training
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Unfiled modules first if any */}
            {groupedByFolder.unfiled.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className={`h-5 w-5 ${moduleColors[activeModule]}`} />
                    General Training
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrainingTable
                    modules={groupedByFolder.unfiled}
                    moduleColor={moduleColors[activeModule]}
                    onEdit={handleEdit}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Grouped by folder */}
            {moduleFolders.map((folder) => {
              const folderModules = groupedByFolder[folder.id] || [];
              if (folderModules.length === 0) return null;
              
              return (
                <Card key={folder.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className={`h-5 w-5 ${moduleColors[activeModule]}`} />
                      {folder.name}
                    </CardTitle>
                    {folder.description && (
                      <CardDescription>{folder.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <TrainingTable
                      modules={folderModules}
                      moduleColor={moduleColors[activeModule]}
                      onEdit={handleEdit}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={showAddDialog || !!editingModule} 
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingModule(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingModule ? "Edit Training Module" : "Add Training Module"}
            </DialogTitle>
            <DialogDescription>
              {editingModule 
                ? "Update the training module details." 
                : "Add a new training resource to the library."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Fire Safety Awareness"
                data-testid="input-training-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the training..."
                rows={3}
                data-testid="input-training-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Module</Label>
                <Select
                  value={formData.module}
                  onValueChange={(v) => setFormData((prev) => ({ 
                    ...prev, 
                    module: v as ModuleType,
                    folderTemplateId: "", // Reset folder when module changes
                  }))}
                >
                  <SelectTrigger data-testid="select-training-module">
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
                <Label>Folder (Optional)</Label>
                <Select
                  value={formData.folderTemplateId || "none"}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, folderTemplateId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-training-folder">
                    <SelectValue placeholder="Select folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {folderTemplates
                      ?.filter((f) => f.module === formData.module && f.isActive)
                      .map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalLink">External Link *</Label>
              <Input
                id="externalLink"
                type="url"
                value={formData.externalLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, externalLink: e.target.value }))}
                placeholder="https://training-provider.com/course"
                data-testid="input-training-link"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => setFormData((prev) => ({ ...prev, provider: e.target.value }))}
                  placeholder="e.g., IOSH, HSE"
                  data-testid="input-training-provider"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 2 hours, 1 day"
                  data-testid="input-training-duration"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Required Training</Label>
                <p className="text-sm text-muted-foreground">
                  Mark this training as mandatory
                </p>
              </div>
              <Switch
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isRequired: checked }))}
                data-testid="switch-training-required"
              />
            </div>

            {formData.isRequired && (
              <div className="space-y-2">
                <Label htmlFor="renewalPeriod">Renewal Period (months)</Label>
                <Input
                  id="renewalPeriod"
                  type="number"
                  min="1"
                  value={formData.renewalPeriodMonths || ""}
                  onChange={(e) => setFormData((prev) => ({ 
                    ...prev, 
                    renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  placeholder="e.g., 12"
                  data-testid="input-training-renewal"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingModule(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-training"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingModule
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Training table component
function TrainingTable({
  modules,
  moduleColor,
  onEdit,
  onDelete,
}: {
  modules: TrainingModule[];
  moduleColor: string;
  onEdit: (module: TrainingModule) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Training</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {modules.map((module) => (
          <TableRow key={module.id} data-testid={`row-training-${module.id}`}>
            <TableCell>
              <div className="space-y-1">
                <div className="font-medium flex items-center gap-2">
                  {module.title}
                  <a
                    href={module.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${moduleColor} hover:underline`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {module.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {module.description}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              {module.provider ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {module.provider}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {module.duration ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {module.duration}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {module.isRequired ? (
                <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                  Required
                  {module.renewalPeriodMonths && (
                    <span className="ml-1 opacity-75">
                      ({module.renewalPeriodMonths}mo)
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge variant="secondary">Recommended</Badge>
              )}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    data-testid={`button-training-menu-${module.id}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(module)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(module.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
