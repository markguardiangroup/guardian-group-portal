import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search,
  HardHat, 
  Users, 
  Scale,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DocumentTypeRecord, ModuleType } from "@shared/schema";

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
  isRequired: boolean;
  renewalPeriodMonths: number | null;
  sortOrder: number;
  isActive: boolean;
};

const initialFormData: FormData = {
  name: "",
  code: "",
  module: "health_safety",
  description: "",
  isRequired: false,
  renewalPeriodMonths: null,
  sortOrder: 0,
  isActive: true,
};

export default function DocumentTypesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleType | "all">("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentTypeRecord | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const { data: documentTypes, isLoading } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/document-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      setShowCreateDialog(false);
      setFormData(initialFormData);
      toast({
        title: "Document type created",
        description: "The document type has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create document type",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      return apiRequest("PATCH", `/api/document-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      setShowEditDialog(false);
      setSelectedType(null);
      toast({
        title: "Document type updated",
        description: "The document type has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document type",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/document-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-types"] });
      setShowDeleteDialog(false);
      setSelectedType(null);
      toast({
        title: "Document type deleted",
        description: "The document type has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document type",
        variant: "destructive",
      });
    },
  });

  const filteredTypes = useMemo(() => {
    if (!documentTypes) return [];
    
    return documentTypes.filter((type) => {
      const matchesSearch = 
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (type.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      const matchesModule = moduleFilter === "all" || type.module === moduleFilter;
      
      return matchesSearch && matchesModule;
    }).sort((a, b) => {
      if (a.module !== b.module) {
        return a.module.localeCompare(b.module);
      }
      return a.sortOrder - b.sortOrder;
    });
  }, [documentTypes, searchQuery, moduleFilter]);

  const handleEdit = (type: DocumentTypeRecord) => {
    setSelectedType(type);
    setFormData({
      name: type.name,
      code: type.code,
      module: type.module,
      description: type.description || "",
      isRequired: type.isRequired,
      renewalPeriodMonths: type.renewalPeriodMonths,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
    });
    setShowEditDialog(true);
  };

  const handleDelete = (type: DocumentTypeRecord) => {
    setSelectedType(type);
    setShowDeleteDialog(true);
  };

  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);
  };

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only administrators can manage document types.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Document Types</h1>
          <p className="text-muted-foreground mt-1">
            Manage the master list of document types for compliance tracking
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-document-type">
          <Plus className="h-4 w-4 mr-2" />
          Add Document Type
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search document types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as ModuleType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-module-filter">
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No document types found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || moduleFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "Get started by adding your first document type"}
              </p>
              {!searchQuery && moduleFilter === "all" && (
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document Type
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((type) => {
                  const ModuleIcon = moduleIcons[type.module];
                  return (
                    <TableRow key={type.id} data-testid={`row-document-type-${type.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{type.name}</div>
                          {type.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {type.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {type.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${moduleColors[type.module]}`}>
                          <ModuleIcon className="h-4 w-4" />
                          <span className="text-sm">{moduleNames[type.module]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {type.isRequired ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Required
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Optional</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {type.renewalPeriodMonths ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {type.renewalPeriodMonths} months
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {type.isActive ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${type.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(type)} data-testid={`button-edit-${type.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(type)}
                              className="text-red-600"
                              data-testid={`button-delete-${type.id}`}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Document Type</DialogTitle>
            <DialogDescription>
              Create a new document type for compliance tracking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    code: generateCode(name),
                  });
                }}
                placeholder="Fire Risk Assessment"
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="fire_risk_assessment"
                data-testid="input-code"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select
                value={formData.module}
                onValueChange={(v) => setFormData({ ...formData, module: v as ModuleType })}
              >
                <SelectTrigger data-testid="select-module">
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
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Guidance for clients about this document type..."
                rows={3}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewalPeriod">Renewal Period (months)</Label>
                <Input
                  id="renewalPeriod"
                  type="number"
                  min="1"
                  value={formData.renewalPeriodMonths ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="12"
                  data-testid="input-renewal-period"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                  data-testid="input-sort-order"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isRequired">Required Document</Label>
                <p className="text-xs text-muted-foreground">
                  Entities must have this document for compliance
                </p>
              </div>
              <Switch
                id="isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                data-testid="switch-required"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || !formData.code || createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document Type</DialogTitle>
            <DialogDescription>
              Update the document type details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <code className="block text-sm bg-muted px-3 py-2 rounded">
                {formData.code}
              </code>
              <p className="text-xs text-muted-foreground">
                Code cannot be changed after creation
              </p>
            </div>
            <div className="space-y-2">
              <Label>Module</Label>
              <div className={`flex items-center gap-2 ${moduleColors[formData.module]}`}>
                {moduleIcons[formData.module] && (() => {
                  const Icon = moduleIcons[formData.module];
                  return <Icon className="h-4 w-4" />;
                })()}
                <span>{moduleNames[formData.module]}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Module cannot be changed after creation
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-renewalPeriod">Renewal Period (months)</Label>
                <Input
                  id="edit-renewalPeriod"
                  type="number"
                  min="1"
                  value={formData.renewalPeriodMonths ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      renewalPeriodMonths: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  data-testid="input-edit-renewal-period"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sortOrder">Sort Order</Label>
                <Input
                  id="edit-sortOrder"
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                  data-testid="input-edit-sort-order"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-isRequired">Required Document</Label>
                <p className="text-xs text-muted-foreground">
                  Entities must have this document for compliance
                </p>
              </div>
              <Switch
                id="edit-isRequired"
                checked={formData.isRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                data-testid="switch-edit-required"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive types won't appear in document upload options
                </p>
              </div>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedType) {
                  updateMutation.mutate({
                    id: selectedType.id,
                    data: {
                      name: formData.name,
                      description: formData.description || undefined,
                      isRequired: formData.isRequired,
                      renewalPeriodMonths: formData.renewalPeriodMonths,
                      sortOrder: formData.sortOrder,
                      isActive: formData.isActive,
                    },
                  });
                }
              }}
              disabled={!formData.name || updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedType?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedType && deleteMutation.mutate(selectedType.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
