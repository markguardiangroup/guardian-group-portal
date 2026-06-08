import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, PackageOpen, Pencil, Trash2, Tag, ChevronDown } from "lucide-react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";

type Source = { id: string; code: string; label: string; isActive: boolean };

type BadgeType = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

type Service = {
  id: string;
  productCode: string;
  title: string;
  description: string | null;
  module: "health_safety" | "human_resources" | "employment_law";
  sourceId: string | null;
  serviceType: string | null;
  pricePeriod: string | null;
  badgeTypeId: string | null;
  badgeTypeLabel: string | null;
  isMultiService: boolean;
  priceGbp: string;
  benchmarkPriceGbp: string | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
  components?: Service[];
};

type ServiceModule = "health_safety" | "human_resources" | "employment_law";

type ServicePayload = {
  productCode: string;
  title: string;
  description: string;
  module: ServiceModule;
  sourceId: string;
  serviceType: string;
  pricePeriod: string;
  badgeTypeId: string | null;
  isMultiService: boolean;
  priceGbp: string;
  benchmarkPriceGbp: string;
  isActive: boolean;
  sortOrder: number;
};

type FormData = Omit<ServicePayload, "module"> & { module: ServiceModule | "" };

const EMPTY_FORM: FormData = {
  productCode: "",
  title: "",
  description: "",
  module: "",
  sourceId: "",
  serviceType: "",
  pricePeriod: "",
  badgeTypeId: null,
  isMultiService: false,
  priceGbp: "",
  benchmarkPriceGbp: "",
  isActive: true,
  sortOrder: 0,
};

const MODULE_LABELS: Record<string, string> = {
  health_safety: "H&S",
  human_resources: "HR",
  employment_law: "EL",
};

const MODULE_COLORS: Record<string, string> = {
  health_safety: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  human_resources: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  employment_law: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  retained: "Retained",
  recurring: "Recurring",
  pay_as_you_go: "Pay As You Go",
  subscription: "Subscription",
  training: "Training",
};

const PRICE_PERIOD_LABELS: Record<string, string> = {
  one_off: "One Off",
  monthly: "Monthly",
  annually: "Annually",
};

const ALL_MODULES = [
  { value: "all", label: "All Modules" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "human_resources", label: "Human Resources" },
  { value: "employment_law", label: "Employment Law" },
];

export default function AdminServices() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isDeveloper = user?.role === "developer";
  const hasServicesPermission = (user?.role === "consultant" || user?.role === "administrator") && !!(user.consultantPermissions as { services?: boolean } | null)?.services;
  const canManage = isDeveloper || hasServicesPermission;

  // Main service catalogue filters
  const [moduleFilter, setModuleFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [badgeTypeFilter, setBadgeTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());

  // Badge Types management
  const [btDialogOpen, setBtDialogOpen] = useState(false);
  const [btEditTarget, setBtEditTarget] = useState<BadgeType | null>(null);
  const [btDeleteTarget, setBtDeleteTarget] = useState<BadgeType | null>(null);
  const [btForm, setBtForm] = useState({ label: "", sortOrder: 0, isActive: true });

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services", "all"],
    queryFn: async () => {
      const res = await fetch("/api/services", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources", "includeInactive"],
    queryFn: async () => {
      const res = await fetch("/api/sources?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const { data: badgeTypes = [] } = useQuery<BadgeType[]>({
    queryKey: ["/api/badge-types"],
    queryFn: async () => {
      const res = await fetch("/api/badge-types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch badge types");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServicePayload) => {
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        description: data.description || null,
        benchmarkPriceGbp: data.benchmarkPriceGbp || null,
        serviceType: data.serviceType || null,
        pricePeriod: data.pricePeriod || null,
      });
      return res.json();
    },
    onSuccess: async (newSvc: Service) => {
      // Save component links for multi-services
      if (newSvc.isMultiService && selectedComponentIds.size > 0) {
        await Promise.allSettled(Array.from(selectedComponentIds).map(cId =>
          apiRequest("POST", `/api/services/${newSvc.id}/components`, { componentServiceId: cId })
        ));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setSelectedComponentIds(new Set());
      toast({ title: "Service created", description: "The new service has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create service", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, newComponentIds, oldComponentIds }: { id: string; data: Partial<ServicePayload>; newComponentIds: Set<string>; oldComponentIds: Set<string> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, {
        ...data,
        description: data.description ?? null,
        benchmarkPriceGbp: data.benchmarkPriceGbp || null,
        serviceType: data.serviceType || null,
        pricePeriod: data.pricePeriod || null,
      });
      const svc = await res.json();
      // Sync component links
      const toAdd = Array.from(newComponentIds).filter(c => !oldComponentIds.has(c));
      const toRemove = Array.from(oldComponentIds).filter(c => !newComponentIds.has(c));
      await Promise.allSettled([
        ...toAdd.map(cId => apiRequest("POST", `/api/services/${id}/components`, { componentServiceId: cId })),
        ...toRemove.map(cId => apiRequest("DELETE", `/api/services/${id}/components/${cId}`)),
      ]);
      return svc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDialogOpen(false);
      setEditingService(null);
      setForm(EMPTY_FORM);
      setSelectedComponentIds(new Set());
      toast({ title: "Service updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update service", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/services"] }),
    onError: (error: Error) => {
      toast({ title: "Failed to update service", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDeleteTarget(null);
      toast({ title: "Service deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete service", description: error.message, variant: "destructive" });
    },
  });

  // Badge Type mutations
  const btCreateMutation = useMutation({
    mutationFn: async (data: typeof btForm) => {
      const res = await apiRequest("POST", "/api/badge-types", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge-types"] });
      setBtDialogOpen(false);
      setBtEditTarget(null);
      setBtForm({ label: "", sortOrder: 0, isActive: true });
      toast({ title: "Badge type created" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create badge type", description: error.message, variant: "destructive" });
    },
  });

  const btUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof btForm> }) => {
      const res = await apiRequest("PATCH", `/api/badge-types/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setBtDialogOpen(false);
      setBtEditTarget(null);
      setBtForm({ label: "", sortOrder: 0, isActive: true });
      toast({ title: "Badge type updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update badge type", description: error.message, variant: "destructive" });
    },
  });

  const btDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/badge-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/badge-types"] });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setBtDeleteTarget(null);
      toast({ title: "Badge type deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete badge type", description: error.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setSelectedComponentIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = (svc: Service) => {
    setEditingService(svc);
    setForm({
      productCode: svc.productCode,
      title: svc.title,
      description: svc.description ?? "",
      module: svc.module,
      sourceId: svc.sourceId ?? "",
      serviceType: svc.serviceType ?? "",
      pricePeriod: svc.pricePeriod ?? "",
      badgeTypeId: svc.badgeTypeId ?? null,
      isMultiService: svc.isMultiService,
      priceGbp: svc.priceGbp,
      benchmarkPriceGbp: svc.benchmarkPriceGbp ?? "",
      isActive: svc.isActive,
      sortOrder: svc.sortOrder ?? 0,
    });
    setSelectedComponentIds(new Set(svc.components?.map(c => c.id) ?? []));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.module || !form.sourceId || !form.serviceType || !form.pricePeriod) return;
    const payload: ServicePayload = { ...form, module: form.module };
    if (editingService) {
      const oldComponentIds = new Set(editingService.components?.map(c => c.id) ?? []);
      updateMutation.mutate({ id: editingService.id, data: payload, newComponentIds: selectedComponentIds, oldComponentIds });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openBtCreate = () => {
    setBtEditTarget(null);
    setBtForm({ label: "", sortOrder: 0, isActive: true });
    setBtDialogOpen(true);
  };

  const openBtEdit = (bt: BadgeType) => {
    setBtEditTarget(bt);
    setBtForm({ label: bt.label, sortOrder: bt.sortOrder, isActive: bt.isActive });
    setBtDialogOpen(true);
  };

  const handleBtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (btEditTarget) {
      btUpdateMutation.mutate({ id: btEditTarget.id, data: btForm });
    } else {
      btCreateMutation.mutate(btForm);
    }
  };

  // Filter services
  const filtered = services.filter(s => {
    if (moduleFilter !== "all" && s.module !== moduleFilter) return false;
    if (serviceTypeFilter !== "all" && s.serviceType !== serviceTypeFilter) return false;
    if (badgeTypeFilter === "__no_badge" && s.badgeTypeId !== null) return false;
    if (badgeTypeFilter !== "all" && badgeTypeFilter !== "__no_badge" && s.badgeTypeId !== badgeTypeFilter) return false;
    if (sourceFilter !== "all" && s.sourceId !== sourceFilter) return false;
    return true;
  });

  const getSourceLabel = (sourceId: string | null) => {
    if (!sourceId) return "—";
    const src = sources.find(s => s.id === sourceId);
    return src ? src.code : "—";
  };

  // Available single services for multi-service component picker
  const availableComponents = services.filter(s =>
    !s.isMultiService &&
    s.sourceId === form.sourceId &&
    s.module === form.module &&
    (!editingService || s.id !== editingService.id)
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div id="page-content" className="p-6 space-y-6 max-w-6xl dash-animate">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage the services catalogue used for company assignments and pricing.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} data-testid="button-add-service">
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        )}
      </div>

      {/* Module filter tabs */}
      <div className="flex flex-wrap gap-2">
        {ALL_MODULES.map(m => (
          <button
            key={m.value}
            data-testid={`filter-module-${m.value}`}
            onClick={() => setModuleFilter(m.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              moduleFilter === m.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Additional filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="filter-service-type">
            <SelectValue placeholder="Service Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="retained">Retained</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="pay_as_you_go">Pay As You Go</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="training">Training</SelectItem>
          </SelectContent>
        </Select>

        <Select value={badgeTypeFilter} onValueChange={setBadgeTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="filter-badge-type">
            <SelectValue placeholder="Badge Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Badges</SelectItem>
            <SelectItem value="__no_badge">No Badge</SelectItem>
            {badgeTypes.map(bt => (
              <SelectItem key={bt.id} value={bt.id}>{bt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="filter-source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.filter(s => s.isActive).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.code} — {s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Services table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            {moduleFilter === "all" ? "All Services" : ALL_MODULES.find(m => m.value === moduleFilter)?.label}
          </CardTitle>
          <CardDescription>
            {filtered.length} service{filtered.length !== 1 ? "s" : ""}.
            {!canManage && " Viewing in read-only mode."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FetchingOverlay />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No services found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">Code</th>
                    <th className="pb-2 pr-3 font-medium">Title</th>
                    <th className="pb-2 pr-3 font-medium">Module</th>
                    <th className="pb-2 pr-3 font-medium">Source</th>
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium">Badge</th>
                    <th className="pb-2 pr-3 font-medium">Period</th>
                    <th className="pb-2 pr-3 font-medium">Kind</th>
                    <th className="pb-2 pr-3 font-medium text-right">Price (£)</th>
                    {canManage && <th className="pb-2 pr-3 font-medium text-center">Active</th>}
                    {!canManage && <th className="pb-2 pr-3 font-medium text-center">Status</th>}
                    {canManage && <th className="pb-2 font-medium"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((svc) => (
                    <tr key={svc.id} data-testid={`row-service-${svc.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded" data-testid={`text-service-code-${svc.id}`}>
                          {svc.productCode}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-medium" data-testid={`text-service-title-${svc.id}`}>
                        {svc.title}
                        {svc.description && (
                          <p className="text-xs text-muted-foreground font-normal truncate max-w-[180px]">{svc.description}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[svc.module]}`}>
                          {MODULE_LABELS[svc.module]}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground text-xs">{getSourceLabel(svc.sourceId)}</td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {svc.serviceType ? SERVICE_TYPE_LABELS[svc.serviceType] ?? svc.serviceType : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        {svc.badgeTypeLabel ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium" data-testid={`badge-type-${svc.id}`}>
                            <Tag className="h-3 w-3" />
                            {svc.badgeTypeLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {svc.pricePeriod ? PRICE_PERIOD_LABELS[svc.pricePeriod] ?? svc.pricePeriod : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        {svc.isMultiService ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                data-testid={`chip-multi-${svc.id}`}
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                Multi
                                {(svc.components?.length ?? 0) > 0 && <ChevronDown className="h-3 w-3" />}
                              </button>
                            </PopoverTrigger>
                            {(svc.components?.length ?? 0) > 0 && (
                              <PopoverContent className="w-64 p-3" side="right">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Component services:</p>
                                <ul className="space-y-1">
                                  {svc.components!.map(c => (
                                    <li key={c.id} className="text-xs flex items-center gap-2">
                                      <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{c.productCode}</span>
                                      <span>{c.title}</span>
                                    </li>
                                  ))}
                                </ul>
                              </PopoverContent>
                            )}
                          </Popover>
                        ) : (
                          <span data-testid={`chip-single-${svc.id}`} className="inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                            Single
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {parseFloat(svc.priceGbp).toFixed(2)}
                      </td>
                      {canManage ? (
                        <td className="py-3 pr-3 text-center">
                          <Switch
                            checked={svc.isActive}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: svc.id, isActive: checked })}
                            data-testid={`switch-service-active-${svc.id}`}
                            aria-label={`Toggle ${svc.title} active`}
                          />
                        </td>
                      ) : (
                        <td className="py-3 pr-3 text-center">
                          <Badge variant={svc.isActive ? "default" : "secondary"}>
                            {svc.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      )}
                      {canManage && (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(svc)}
                              data-testid={`button-edit-service-${svc.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(svc)}
                              data-testid={`button-delete-service-${svc.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badge Types Management (admin only) */}
      {isDeveloper && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Badge Types
                </CardTitle>
                <CardDescription>
                  Manage the badge type labels that can be assigned to services.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openBtCreate} data-testid="button-add-badge-type">
                <Plus className="h-4 w-4 mr-2" />
                Add Badge Type
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {badgeTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No badge types yet. Add one above.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-4 font-medium">Label</th>
                    <th className="pb-2 pr-4 font-medium text-center">Sort</th>
                    <th className="pb-2 pr-4 font-medium text-center">Active</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {badgeTypes.map(bt => (
                    <tr key={bt.id} data-testid={`row-badge-type-${bt.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                          <Tag className="h-3 w-3" />
                          {bt.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-center text-muted-foreground">{bt.sortOrder}</td>
                      <td className="py-2.5 pr-4 text-center">
                        <Switch
                          checked={bt.isActive}
                          onCheckedChange={(checked) => btUpdateMutation.mutate({ id: bt.id, data: { isActive: checked } })}
                          data-testid={`switch-badge-type-active-${bt.id}`}
                          aria-label={`Toggle ${bt.label} active`}
                        />
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openBtEdit(bt)} data-testid={`button-edit-badge-type-${bt.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setBtDeleteTarget(bt)} data-testid={`button-delete-badge-type-${bt.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingService(null); setForm(EMPTY_FORM); setSelectedComponentIds(new Set()); } else { setDialogOpen(true); }}}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update the service details below." : "Fill in the details for the new service."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="svc-code">Product Code *</Label>
                <Input
                  id="svc-code"
                  data-testid="input-service-code"
                  value={form.productCode}
                  onChange={e => setForm(f => ({ ...f, productCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. HS-001"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-module">Module *</Label>
                <Select
                  value={form.module}
                  onValueChange={v => setForm(f => ({ ...f, module: v as ServiceModule, sourceId: "", badgeTypeId: null }))}
                  required
                >
                  <SelectTrigger id="svc-module" data-testid="select-service-module">
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health_safety">Health & Safety</SelectItem>
                    <SelectItem value="human_resources">Human Resources</SelectItem>
                    <SelectItem value="employment_law">Employment Law</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-title">Title *</Label>
              <Input
                id="svc-title"
                data-testid="input-service-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Service title"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-description">Description</Label>
              <Textarea
                id="svc-description"
                data-testid="input-service-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-source">Source *</Label>
              <Select
                value={form.sourceId}
                onValueChange={v => setForm(f => ({ ...f, sourceId: v }))}
                required
              >
                <SelectTrigger id="svc-source" data-testid="select-service-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.filter(s => s.isActive || s.id === form.sourceId).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.label}{!s.isActive ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="svc-service-type">Service Type *</Label>
                <Select
                  value={form.serviceType}
                  onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}
                  required
                >
                  <SelectTrigger id="svc-service-type" data-testid="select-service-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retained">Retained</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="pay_as_you_go">Pay As You Go</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-price-period">Price Period *</Label>
                <Select
                  value={form.pricePeriod}
                  onValueChange={v => setForm(f => ({ ...f, pricePeriod: v }))}
                  required
                >
                  <SelectTrigger id="svc-price-period" data-testid="select-price-period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_off">One Off</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-badge-type">Badge Type (optional)</Label>
              <Select
                value={form.badgeTypeId ?? "none"}
                onValueChange={v => setForm(f => ({ ...f, badgeTypeId: v === "none" ? null : v }))}
              >
                <SelectTrigger id="svc-badge-type" data-testid="select-badge-type">
                  <SelectValue placeholder="No badge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No badge</SelectItem>
                  {badgeTypes.filter(bt => bt.isActive || bt.id === form.badgeTypeId).map(bt => (
                    <SelectItem key={bt.id} value={bt.id}>{bt.label}{!bt.isActive ? " (inactive)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="svc-price">Price (£) *</Label>
                <Input
                  id="svc-price"
                  data-testid="input-service-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.priceGbp}
                  onChange={e => setForm(f => ({ ...f, priceGbp: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="svc-benchmark">Benchmark (£)</Label>
                <Input
                  id="svc-benchmark"
                  data-testid="input-service-benchmark"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.benchmarkPriceGbp}
                  onChange={e => setForm(f => ({ ...f, benchmarkPriceGbp: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-center">
              <div className="space-y-1">
                <Label htmlFor="svc-sort">Sort Order</Label>
                <Input
                  id="svc-sort"
                  data-testid="input-service-sort"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={e => { const n = Number(e.target.value); setForm(f => ({ ...f, sortOrder: isNaN(n) ? 0 : Math.max(0, Math.floor(n)) })); }}
                  onBlur={e => { if (e.target.value === "" || isNaN(Number(e.target.value))) setForm(f => ({ ...f, sortOrder: 0 })); }}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch
                  id="svc-active"
                  data-testid="switch-service-active-form"
                  checked={form.isActive}
                  onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="svc-active">Active</Label>
              </div>
            </div>

            {/* Single / Multi toggle */}
            <div className="flex items-center gap-3 rounded-md border p-3 bg-muted/30">
              <Switch
                id="svc-multi"
                data-testid="switch-service-multi"
                checked={form.isMultiService}
                onCheckedChange={v => { setForm(f => ({ ...f, isMultiService: v })); setSelectedComponentIds(new Set()); }}
              />
              <div>
                <Label htmlFor="svc-multi" className="font-medium cursor-pointer">Multi-service</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this service bundles multiple single services together.
                </p>
              </div>
            </div>

            {/* Component picker (only when multi and source+module selected) */}
            {form.isMultiService && form.sourceId && form.module && (
              <div className="space-y-2">
                <Label>Component Services</Label>
                {availableComponents.length === 0 ? (
                  <p className="text-xs text-muted-foreground border rounded-md p-3 text-center">
                    No single services found for this source and module.
                  </p>
                ) : (
                  <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                    {availableComponents.map(svc => (
                      <label
                        key={svc.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                        data-testid={`component-option-${svc.id}`}
                      >
                        <Checkbox
                          checked={selectedComponentIds.has(svc.id)}
                          onCheckedChange={(checked) => {
                            setSelectedComponentIds(prev => {
                              const next = new Set(prev);
                              checked ? next.add(svc.id) : next.delete(svc.id);
                              return next;
                            });
                          }}
                        />
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{svc.productCode}</span>
                        <span className="text-sm">{svc.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingService(null); setForm(EMPTY_FORM); setSelectedComponentIds(new Set()); }}>
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-save-service"
                disabled={isPending || !form.module || !form.sourceId || !form.serviceType || !form.pricePeriod}
              >
                {isPending ? "Saving…" : editingService ? "Save Changes" : "Add Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete service confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.title}</strong> ({deleteTarget?.productCode}). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-service"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Badge Type Add/Edit Dialog */}
      <Dialog open={btDialogOpen} onOpenChange={(open) => { if (!open) { setBtDialogOpen(false); setBtEditTarget(null); setBtForm({ label: "", sortOrder: 0, isActive: true }); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{btEditTarget ? "Edit Badge Type" : "Add Badge Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBtSubmit} noValidate className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="bt-label">Label *</Label>
              <Input
                id="bt-label"
                data-testid="input-badge-type-label"
                value={btForm.label}
                onChange={e => setBtForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Premium"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bt-sort">Sort Order</Label>
              <Input
                id="bt-sort"
                data-testid="input-badge-type-sort"
                type="number"
                min="0"
                value={btForm.sortOrder}
                onChange={e => { const n = Number(e.target.value); setBtForm(f => ({ ...f, sortOrder: isNaN(n) ? 0 : Math.max(0, Math.floor(n)) })); }}
                onBlur={e => { if (e.target.value === "" || isNaN(Number(e.target.value))) setBtForm(f => ({ ...f, sortOrder: 0 })); }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="bt-active"
                data-testid="switch-badge-type-active"
                checked={btForm.isActive}
                onCheckedChange={v => setBtForm(f => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="bt-active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setBtDialogOpen(false); setBtEditTarget(null); }}>Cancel</Button>
              <Button type="submit" data-testid="button-save-badge-type" disabled={btCreateMutation.isPending || btUpdateMutation.isPending}>
                {btCreateMutation.isPending || btUpdateMutation.isPending ? "Saving…" : btEditTarget ? "Save Changes" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Badge Type confirmation */}
      <AlertDialog open={!!btDeleteTarget} onOpenChange={(open) => { if (!open) setBtDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Badge Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the badge type <strong>{btDeleteTarget?.label}</strong>. Services using this badge will have it cleared. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => btDeleteTarget && btDeleteMutation.mutate(btDeleteTarget.id)}
              data-testid="button-confirm-delete-badge-type"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
