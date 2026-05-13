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
import { Plus, PackageOpen, Pencil, Trash2 } from "lucide-react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";

type Source = { id: string; code: string; label: string; isActive: boolean };

type Service = {
  id: string;
  productCode: string;
  title: string;
  description: string | null;
  module: "health_safety" | "human_resources" | "employment_law";
  sourceId: string | null;
  priceGbp: string;
  benchmarkPriceGbp: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
};

type FormData = {
  productCode: string;
  title: string;
  description: string;
  module: "health_safety" | "human_resources" | "employment_law" | "";
  sourceId: string;
  priceGbp: string;
  benchmarkPriceGbp: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM: FormData = {
  productCode: "",
  title: "",
  description: "",
  module: "",
  sourceId: "",
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

const ALL_MODULES = [
  { value: "all", label: "All Modules" },
  { value: "health_safety", label: "Health & Safety" },
  { value: "human_resources", label: "Human Resources" },
  { value: "employment_law", label: "Employment Law" },
];

export default function AdminServices() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [moduleFilter, setModuleFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources", "includeInactive"],
    queryFn: async () => {
      const res = await fetch("/api/sources?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<FormData, "module"> & { module: string }) => {
      const res = await apiRequest("POST", "/api/services", {
        ...data,
        sourceId: data.sourceId || null,
        description: data.description || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: "Service created", description: "The new service has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create service", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const res = await apiRequest("PATCH", `/api/services/${id}`, {
        ...data,
        sourceId: data.sourceId || null,
        description: data.description || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setDialogOpen(false);
      setEditingService(null);
      setForm(EMPTY_FORM);
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

  const openCreate = () => {
    setEditingService(null);
    setForm(EMPTY_FORM);
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
      priceGbp: svc.priceGbp,
      benchmarkPriceGbp: svc.benchmarkPriceGbp,
      isActive: svc.isActive,
      sortOrder: svc.sortOrder,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.module) return;
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, data: form });
    } else {
      createMutation.mutate(form as any);
    }
  };

  const filtered = moduleFilter === "all"
    ? services
    : services.filter(s => s.module === moduleFilter);

  const getSourceLabel = (sourceId: string | null) => {
    if (!sourceId) return "—";
    const src = sources.find(s => s.id === sourceId);
    return src ? src.code : "—";
  };

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
        {isAdmin && (
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

      {/* Services table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            {moduleFilter === "all" ? "All Services" : ALL_MODULES.find(m => m.value === moduleFilter)?.label}
          </CardTitle>
          <CardDescription>
            {filtered.length} service{filtered.length !== 1 ? "s" : ""}.
            {!isAdmin && " Viewing in read-only mode."}
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
                    <th className="pb-2 pr-4 font-medium">Code</th>
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Module</th>
                    <th className="pb-2 pr-4 font-medium">Source</th>
                    <th className="pb-2 pr-4 font-medium text-right">Price (£)</th>
                    <th className="pb-2 pr-4 font-medium text-right">Benchmark (£)</th>
                    {isAdmin && <th className="pb-2 pr-4 font-medium text-center">Active</th>}
                    {!isAdmin && <th className="pb-2 pr-4 font-medium text-center">Status</th>}
                    {isAdmin && <th className="pb-2 font-medium"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((svc) => (
                    <tr key={svc.id} data-testid={`row-service-${svc.id}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded" data-testid={`text-service-code-${svc.id}`}>
                          {svc.productCode}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium" data-testid={`text-service-title-${svc.id}`}>
                        {svc.title}
                        {svc.description && (
                          <p className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">{svc.description}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODULE_COLORS[svc.module]}`}>
                          {MODULE_LABELS[svc.module]}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{getSourceLabel(svc.sourceId)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {parseFloat(svc.priceGbp).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {parseFloat(svc.benchmarkPriceGbp).toFixed(2)}
                      </td>
                      {isAdmin ? (
                        <td className="py-3 pr-4 text-center">
                          <Switch
                            checked={svc.isActive}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: svc.id, isActive: checked })}
                            data-testid={`switch-service-active-${svc.id}`}
                            aria-label={`Toggle ${svc.title} active`}
                          />
                        </td>
                      ) : (
                        <td className="py-3 pr-4 text-center">
                          <Badge variant={svc.isActive ? "default" : "secondary"}>
                            {svc.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      )}
                      {isAdmin && (
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingService(null); setForm(EMPTY_FORM); } else { setDialogOpen(true); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update the service details below." : "Fill in the details for the new service."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  onValueChange={v => setForm(f => ({ ...f, module: v as any }))}
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
              <Label htmlFor="svc-source">Source</Label>
              <Select
                value={form.sourceId || "__none__"}
                onValueChange={v => setForm(f => ({ ...f, sourceId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="svc-source" data-testid="select-service-source">
                  <SelectValue placeholder="Select source (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {sources.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.code} — {s.label}</SelectItem>
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
                <Label htmlFor="svc-benchmark">Benchmark (£) *</Label>
                <Input
                  id="svc-benchmark"
                  data-testid="input-service-benchmark"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.benchmarkPriceGbp}
                  onChange={e => setForm(f => ({ ...f, benchmarkPriceGbp: e.target.value }))}
                  placeholder="0.00"
                  required
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
                  onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingService(null); setForm(EMPTY_FORM); }}>
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="button-save-service"
                disabled={isPending || !form.module}
              >
                {isPending ? "Saving…" : editingService ? "Save Changes" : "Add Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
    </div>
  );
}
