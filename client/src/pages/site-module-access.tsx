import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { 
  Building2,
  HardHat, 
  Users, 
  Scale,
  CheckCircle,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Settings2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SiteWithDetails, SiteModuleAccess, ModuleType, ModuleAccessStatus } from "@shared/schema";

const modules: { module: ModuleType; name: string; shortName: string; icon: typeof HardHat; color: string; bgColor: string }[] = [
  { 
    module: "health_safety", 
    name: "Health & Safety", 
    shortName: "H&S",
    icon: HardHat,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  { 
    module: "human_resources", 
    name: "Human Resources", 
    shortName: "HR",
    icon: Users,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  { 
    module: "employment_law", 
    name: "Employment Law", 
    shortName: "EL",
    icon: Scale,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
];

const statusOptions: { value: ModuleAccessStatus; label: string; icon: typeof CheckCircle; color: string }[] = [
  { value: "active", label: "Active", icon: CheckCircle, color: "text-emerald-600" },
  { value: "visible", label: "Visible", icon: Eye, color: "text-amber-600" },
  { value: "hidden", label: "Hidden", icon: EyeOff, color: "text-muted-foreground" },
];

const ITEMS_PER_PAGE = 20;

function StatusBadge({ status }: { status: ModuleAccessStatus }) {
  const config = statusOptions.find(s => s.value === status) || statusOptions[2];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={status === "active" ? "default" : "outline"}
      className={status !== "active" ? config.color : ""}
    >
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function StatusDropdown({ 
  siteId,
  module,
  currentStatus,
  onUpdate,
  disabled,
}: {
  siteId: string;
  module: ModuleType;
  currentStatus: ModuleAccessStatus;
  onUpdate: (siteId: string, module: ModuleType, status: ModuleAccessStatus) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" data-testid={`dropdown-status-${siteId}-${module}`}>
          <StatusBadge status={currentStatus} />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statusOptions.map(option => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem 
              key={option.value}
              onClick={() => onUpdate(siteId, module, option.value)}
              disabled={option.value === currentStatus}
              data-testid={`option-${option.value}-${siteId}-${module}`}
            >
              <Icon className={`h-4 w-4 mr-2 ${option.color}`} />
              {option.label}
              {option.value === currentStatus && <span className="ml-auto text-xs text-muted-foreground">(current)</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SiteModuleAccess() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterModule, setFilterModule] = useState<ModuleType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ModuleAccessStatus | "all">("all");
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());

  const { data: sites = [], isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });

  const updateAccessMutation = useMutation({
    mutationFn: async ({ siteId, module, status }: { 
      siteId: string; 
      module: ModuleType; 
      status: ModuleAccessStatus;
    }) => {
      return apiRequest("POST", `/api/sites/${siteId}/module-access`, { module, status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/sites/${variables.siteId}/module-access`] });
      toast({
        title: "Access Updated",
        description: "Module access has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update module access.",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ siteIds, module, status }: { 
      siteIds: string[]; 
      module: ModuleType; 
      status: ModuleAccessStatus;
    }) => {
      await Promise.all(
        siteIds.map(siteId => 
          apiRequest("POST", `/api/sites/${siteId}/module-access`, { module, status })
        )
      );
    },
    onSuccess: () => {
      sites.forEach(e => {
        queryClient.invalidateQueries({ queryKey: [`/api/sites/${e.id}/module-access`] });
      });
      setSelectedEntities(new Set());
      toast({
        title: "Bulk Update Complete",
        description: `Updated ${selectedEntities.size} sites.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Some updates failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isAdmin = user?.role === "admin" || user?.role === "consultant";

  const filteredEntities = useMemo(() => {
    return sites.filter(entity => {
      if (search && !entity.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [entities, search]);

  const totalPages = Math.ceil(filteredEntities.length / ITEMS_PER_PAGE);
  const paginatedEntities = filteredEntities.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const toggleSelectAll = () => {
    if (selectedEntities.size === paginatedEntities.length) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(paginatedEntities.map(e => e.id)));
    }
  };

  const toggleSelectEntity = (siteId: string) => {
    const newSelected = new Set(selectedEntities);
    if (newSelected.has(siteId)) {
      newSelected.delete(siteId);
    } else {
      newSelected.add(siteId);
    }
    setSelectedEntities(newSelected);
  };

  const handleBulkUpdate = (module: ModuleType, status: ModuleAccessStatus) => {
    bulkUpdateMutation.mutate({
      siteIds: Array.from(selectedEntities),
      module,
      status,
    });
  };

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

  if (sitesLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Entity Module Access</h1>
        <p className="mt-1 text-muted-foreground">
          Manage which modules each entity can access ({sites.length} entities)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
            data-testid="input-search-entities"
          />
        </div>

        {selectedEntities.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-actions">
                <Settings2 className="h-4 w-4 mr-2" />
                Bulk Actions ({selectedEntities.size})
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {modules.map(mod => {
                const Icon = mod.icon;
                return (
                  <div key={mod.module}>
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${mod.color}`} />
                      {mod.shortName}
                    </DropdownMenuLabel>
                    {statusOptions.map(status => {
                      const StatusIcon = status.icon;
                      return (
                        <DropdownMenuItem 
                          key={`${mod.module}-${status.value}`}
                          onClick={() => handleBulkUpdate(mod.module, status.value)}
                          data-testid={`bulk-${mod.module}-${status.value}`}
                        >
                          <StatusIcon className={`h-4 w-4 mr-2 ${status.color}`} />
                          Set {mod.shortName} to {status.label}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-sm flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span><strong>Active:</strong> Full access</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-amber-600" />
          <span><strong>Visible:</strong> Can request</span>
        </div>
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          <span><strong>Hidden:</strong> Not shown</span>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedEntities.size === paginatedEntities.length && paginatedEntities.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              <TableHead>Entity</TableHead>
              {modules.map(mod => {
                const Icon = mod.icon;
                return (
                  <TableHead key={mod.module} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Icon className={`h-4 w-4 ${mod.color}`} />
                      <span className="hidden sm:inline">{mod.shortName}</span>
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEntities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search ? "No entities match your search." : "No entities found."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedEntities.map(entity => (
                <EntityRow
                  key={entity.id}
                  entity={entity}
                  isSelected={selectedEntities.has(entity.id)}
                  onToggleSelect={() => toggleSelectEntity(entity.id)}
                  onUpdateAccess={(module, status) => {
                    updateAccessMutation.mutate({ siteId: entity.id, module, status });
                  }}
                  isUpdating={updateAccessMutation.isPending}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredEntities.length)} of {filteredEntities.length} entities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntityRow({ 
  entity, 
  isSelected,
  onToggleSelect,
  onUpdateAccess,
  isUpdating,
}: { 
  entity: SiteWithDetails;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdateAccess: (module: ModuleType, status: ModuleAccessStatus) => void;
  isUpdating: boolean;
}) {
  const { data: moduleAccess = [] } = useQuery<SiteModuleAccess[]>({
    queryKey: [`/api/sites/${entity.id}/module-access`],
  });

  const getModuleStatus = (module: ModuleType): ModuleAccessStatus => {
    const access = moduleAccess.find(a => a.module === module);
    return (access?.status as ModuleAccessStatus) || "hidden";
  };

  return (
    <TableRow data-testid={`row-entity-${entity.id}`}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          data-testid={`checkbox-${entity.id}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{entity.name}</p>
            <p className="text-xs text-muted-foreground">
              {entity.sites?.length || 0} site{entity.sites?.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </TableCell>
      {modules.map(mod => (
        <TableCell key={mod.module} className="text-center">
          <StatusDropdown
            siteId={entity.id}
            module={mod.module}
            currentStatus={getModuleStatus(mod.module)}
            onUpdate={(_, module, status) => onUpdateAccess(module, status)}
            disabled={isUpdating}
          />
        </TableCell>
      ))}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-actions-${entity.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              modules.forEach(m => onUpdateAccess(m.module, "active"));
            }}>
              <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
              Activate All Modules
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              modules.forEach(m => onUpdateAccess(m.module, "hidden"));
            }}>
              <EyeOff className="h-4 w-4 mr-2 text-muted-foreground" />
              Hide All Modules
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
