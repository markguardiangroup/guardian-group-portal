import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2,
  HardHat, 
  Users, 
  Scale,
  CheckCircle,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EntityWithSites, EntityModuleAccess, ModuleType, ModuleAccessStatus } from "@shared/schema";

const modules: { module: ModuleType; name: string; icon: typeof HardHat; color: string; bgColor: string }[] = [
  { 
    module: "health_safety", 
    name: "Health & Safety", 
    icon: HardHat,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  { 
    module: "human_resources", 
    name: "Human Resources", 
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  { 
    module: "employment_law", 
    name: "Employment Law", 
    icon: Scale,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
];

const statusConfig: Record<ModuleAccessStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  active: { label: "Active", icon: CheckCircle, color: "text-emerald-600" },
  visible: { label: "Visible (Can Request)", icon: Eye, color: "text-amber-600" },
  hidden: { label: "Hidden", icon: EyeOff, color: "text-muted-foreground" },
};

function EntityAccessCard({ 
  entity,
  moduleAccess,
  onUpdateAccess,
  isUpdating,
}: { 
  entity: EntityWithSites;
  moduleAccess: EntityModuleAccess[];
  onUpdateAccess: (entityId: string, module: ModuleType, status: ModuleAccessStatus, notes?: string) => void;
  isUpdating: boolean;
}) {
  const [editDialog, setEditDialog] = useState<{ 
    open: boolean; 
    module: ModuleType | null;
    currentStatus: ModuleAccessStatus;
    newStatus: ModuleAccessStatus;
  }>({ open: false, module: null, currentStatus: "hidden", newStatus: "hidden" });
  const [notes, setNotes] = useState("");

  const getModuleStatus = (module: ModuleType): ModuleAccessStatus => {
    const access = moduleAccess.find(a => a.module === module);
    return (access?.status as ModuleAccessStatus) || "hidden";
  };

  const openEditDialog = (module: ModuleType) => {
    const currentStatus = getModuleStatus(module);
    setEditDialog({ open: true, module, currentStatus, newStatus: currentStatus });
    setNotes("");
  };

  const handleSave = () => {
    if (!editDialog.module) return;
    onUpdateAccess(entity.id, editDialog.module, editDialog.newStatus, notes || undefined);
    setEditDialog({ open: false, module: null, currentStatus: "hidden", newStatus: "hidden" });
    setNotes("");
  };

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-entity-access-${entity.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">{entity.name}</CardTitle>
              <CardDescription>
                {entity.sites?.length || 0} site{entity.sites?.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.map(({ module, name, icon: Icon, color, bgColor }) => {
            const status = getModuleStatus(module);
            const StatusIcon = statusConfig[status].icon;
            
            return (
              <div 
                key={module} 
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`row-module-${entity.id}-${module}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded ${bgColor}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={status === "active" ? "default" : "outline"}
                    className={status === "active" ? "" : statusConfig[status].color}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[status].label}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(module)}
                    data-testid={`button-edit-${entity.id}-${module}`}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={editDialog.open} onOpenChange={(open) => {
        if (!open) setEditDialog({ open: false, module: null, currentStatus: "hidden", newStatus: "hidden" });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Module Access</DialogTitle>
            <DialogDescription>
              Change access status for {entity.name}
            </DialogDescription>
          </DialogHeader>
          
          {editDialog.module && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                {(() => {
                  const moduleConfig = modules.find(m => m.module === editDialog.module);
                  if (!moduleConfig) return null;
                  const Icon = moduleConfig.icon;
                  return (
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${moduleConfig.bgColor}`}>
                        <Icon className={`h-5 w-5 ${moduleConfig.color}`} />
                      </div>
                      <div>
                        <p className="font-medium">{moduleConfig.name}</p>
                        <p className="text-sm text-muted-foreground">{entity.name}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Access Status</label>
                <Select 
                  value={editDialog.newStatus} 
                  onValueChange={(value) => setEditDialog(prev => ({ ...prev, newStatus: value as ModuleAccessStatus }))}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        Active - Full access to module
                      </div>
                    </SelectItem>
                    <SelectItem value="visible">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-amber-600" />
                        Visible - Can request access
                      </div>
                    </SelectItem>
                    <SelectItem value="hidden">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                        Hidden - Not visible to entity
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes about this change..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  data-testid="input-access-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditDialog({ open: false, module: null, currentStatus: "hidden", newStatus: "hidden" })}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isUpdating || editDialog.newStatus === editDialog.currentStatus}
              data-testid="button-save-access"
            >
              {isUpdating ? "Saving..." : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EntityModuleAccess() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: entities = [], isLoading: entitiesLoading } = useQuery<EntityWithSites[]>({
    queryKey: ["/api/entities"],
  });

  const { data: allModuleAccess = [], isLoading: accessLoading } = useQuery<EntityModuleAccess[]>({
    queryKey: ["/api/all-module-access"],
    enabled: false,
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ entityId, module, status, notes }: { 
      entityId: string; 
      module: ModuleType; 
      status: ModuleAccessStatus;
      notes?: string;
    }) => {
      return apiRequest("POST", `/api/entities/${entityId}/module-access`, { module, status, notes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/entities/${variables.entityId}/module-access`] });
      toast({
        title: "Access Updated",
        description: "Module access has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update module access. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isAdmin = user?.role === "admin" || user?.role === "consultant";

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators and consultants can manage entity module access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (entitiesLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Entity Module Access</h1>
        <p className="mt-1 text-muted-foreground">
          Manage which modules each entity can access
        </p>
      </div>

      <div className="rounded-md bg-muted/50 p-4">
        <h3 className="font-medium">Access Status Levels</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span><strong>Active:</strong> Full module access</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-600" />
            <span><strong>Visible:</strong> Can request access</span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <span><strong>Hidden:</strong> Module not shown</span>
          </div>
        </div>
      </div>

      {entities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Entities</h3>
            <p className="text-muted-foreground text-center mt-1">
              Create entities first to manage their module access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entities.map((entity) => (
            <EntityAccessCardWithData 
              key={entity.id} 
              entity={entity}
              onUpdateAccess={(entityId, module, status, notes) => {
                updateAccessMutation.mutate({ entityId, module, status, notes });
              }}
              isUpdating={updateAccessMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityAccessCardWithData({ 
  entity, 
  onUpdateAccess,
  isUpdating,
}: { 
  entity: EntityWithSites;
  onUpdateAccess: (entityId: string, module: ModuleType, status: ModuleAccessStatus, notes?: string) => void;
  isUpdating: boolean;
}) {
  const { data: moduleAccess = [] } = useQuery<EntityModuleAccess[]>({
    queryKey: [`/api/entities/${entity.id}/module-access`],
  });

  return (
    <EntityAccessCard 
      entity={entity}
      moduleAccess={moduleAccess}
      onUpdateAccess={onUpdateAccess}
      isUpdating={isUpdating}
    />
  );
}
