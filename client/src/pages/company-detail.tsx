import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useAddressSync } from "@/hooks/use-address-sync";
import {
  Building2,
  Ban,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Users,
  UserPlus,
  User as UserIcon,
  Settings,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Shield,
  Heart,
  Briefcase,
  HelpCircle,
  FileText,
  Pencil,
  Globe,
  Plus,
  Search,
  X,
  ChevronDown,
  UserCheck,
  Clock,
  HardHat,
  Scale,
  BarChart2,
  GraduationCap,
  BookOpen,
  RefreshCw,
  MoreVertical,
  Smartphone,
  Activity,
  Send,
  RotateCcw,
  LogIn,
  MessageSquare,
  LockKeyhole,
  Eye,
  PackageOpen,
  Network,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { Company, SiteWithDetails, ComplianceSummary, User, CompanyRequiredTemplate } from "@shared/schema";
import { CreateClientUserDialog } from "@/components/create-client-user-dialog";

interface DocumentTemplate {
  id: string;
  name: string;
  module: string;
  visibility: "public" | "private";
  isActive: boolean;
  isRequired: boolean;
  requiresApproval: boolean;
  folderTemplateId: string | null;
}

interface CompanyModuleAccess {
  healthSafety: boolean;
  humanResources: boolean;
  employmentLaw: boolean;
  training: boolean;
  toolkit: boolean;
  support: boolean;
  reports: boolean;
  inherited?: {
    healthSafety: boolean;
    humanResources: boolean;
    employmentLaw: boolean;
    training: boolean;
    toolkit: boolean;
    support: boolean;
    reports: boolean;
  };
}

type CompanyWithSites = Company & {
  sites: SiteWithDetails[];
  isGroupOwner?: boolean;
  groupOwnerName?: string | null;
  groupOwnerId?: string | null;
  groupMembers?: Company[];
  computedSources?: string[] | null;
};

interface SiteAssignment {
  siteId: string;
  siteName: string;
  companyName: string;
  isPrimary: boolean;
}

interface UserWithAssignments {
  id: string;
  referenceNumber?: string | null;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "consultant" | "client";
  companyId: string | null;
  status: "active" | "inactive" | "invited" | "site_required" | "invite_required" | "locked";
  lastLogin: string | null;
  consultantTier?: string | null;
  clientPermissionRole?: string | null;
  siteAssignments?: SiteAssignment[];
  sources?: string[] | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  consultant: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  client: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  consultant: "Consultant",
  client: "Client",
};

function ComplianceIndicator({ summary }: { summary?: ComplianceSummary }) {
  if (!summary) {
    return <Badge variant="secondary">No data</Badge>;
  }

  const score = summary.complianceScore;

  if (score >= 90) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {score}% Compliant
        </span>
      </div>
    );
  }

  if (score >= 70) {
    return (
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {score}% Compliant
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <XCircle className="h-4 w-4 text-red-500" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">
        {score}% Compliant
      </span>
    </div>
  );
}

function SiteCard({ site, onManage }: { site: SiteWithDetails; onManage: (id: string) => void }) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium">{site.name}</h4>
                {(site.addressLine1 || site.city) && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[site.addressLine1, site.addressLine2, site.city, site.county, site.postalCode].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ComplianceIndicator summary={site.complianceSummary} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManage(site.id)}
                  data-testid={`button-manage-site-${site.id}`}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {site.contactName && (
                <span className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  {site.contactName}{site.contactPosition && ` (${site.contactPosition})`}
                </span>
              )}
              {site.contactPhone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {site.contactPhone}
                </span>
              )}
              {site.assignedConsultants && site.assignedConsultants.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {site.assignedConsultants.length} consultant{site.assignedConsultants.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {site.companySources && site.companySources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {site.companySources.map((code) => (
                  <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-site-source-${site.id}-${code}`}>
                    {code}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleAccessCard({ companyId, groupOwnerId }: { companyId: string; groupOwnerId?: string | null }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: moduleAccess, isLoading } = useQuery<CompanyModuleAccess>({
    queryKey: ["/api/companies", companyId, "module-access"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/module-access`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch module access");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (modules: Partial<CompanyModuleAccess>) => {
      const response = await apiRequest("POST", `/api/companies/${companyId}/module-access`, modules);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "module-access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/module-access"] });
      if (groupOwnerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/companies", groupOwnerId, "module-access"] });
      }
      toast({
        title: "Module access updated",
        description: "The company's module access has been updated successfully.",
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

  const handleToggle = (module: keyof Omit<CompanyModuleAccess, "inherited">, enabled: boolean) => {
    updateMutation.mutate({ [module]: enabled });
  };

  const modules = [
    {
      key: "healthSafety" as const,
      label: "Health & Safety",
      icon: HardHat,
      iconClass: "text-emerald-700 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
      borderClass: "border-l-emerald-600 dark:border-l-emerald-500",
    },
    {
      key: "humanResources" as const,
      label: "Human Resources",
      icon: Users,
      iconClass: "text-blue-700 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      borderClass: "border-l-blue-600 dark:border-l-blue-500",
    },
    {
      key: "employmentLaw" as const,
      label: "Employment Law",
      icon: Scale,
      iconClass: "text-pink-700 dark:text-pink-400",
      bgClass: "bg-pink-50 dark:bg-pink-950/30",
      borderClass: "border-l-pink-600 dark:border-l-pink-500",
    },
    {
      key: "training" as const,
      label: "Training",
      icon: GraduationCap,
      iconClass: "text-purple-700 dark:text-purple-400",
      bgClass: "bg-purple-50 dark:bg-purple-950/30",
      borderClass: "border-l-purple-600 dark:border-l-purple-500",
    },
    {
      key: "toolkit" as const,
      label: "Toolkit",
      icon: BookOpen,
      iconClass: "text-amber-700 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      borderClass: "border-l-amber-600 dark:border-l-amber-500",
    },
    {
      key: "support" as const,
      label: "Support",
      icon: HelpCircle,
      iconClass: "text-cyan-700 dark:text-cyan-400",
      bgClass: "bg-cyan-50 dark:bg-cyan-950/30",
      borderClass: "border-l-cyan-600 dark:border-l-cyan-500",
    },
    {
      key: "reports" as const,
      label: "Reports",
      icon: BarChart2,
      iconClass: "text-indigo-700 dark:text-indigo-400",
      bgClass: "bg-indigo-50 dark:bg-indigo-950/30",
      borderClass: "border-l-indigo-600 dark:border-l-indigo-500",
    },
  ];

  if (isLoading) {
    return <FetchingOverlay />;
  }

  const hasAnyInherited = modules.some(({ key }) => moduleAccess?.inherited?.[key]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module Access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enable or disable modules for this company. Changes apply to all sites and users.
        </p>
        {hasAnyInherited && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/60 border px-3 py-2 mt-1">
            <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Modules marked <span className="font-medium">Inherited</span> are automatically enabled because one or more member companies have them active. They cannot be disabled here.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {modules.map(({ key, label, icon: Icon, iconClass, bgClass, borderClass }) => {
          const isInherited = moduleAccess?.inherited?.[key] ?? false;
          const enabled = (moduleAccess?.[key] ?? false) || isInherited;
          return (
            <div
              key={key}
              className={`flex items-center gap-2.5 rounded-lg border border-l-4 ${borderClass} px-3 py-2.5 transition-opacity ${enabled ? "" : "opacity-50"}`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${bgClass}`}>
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </div>
              <Label htmlFor={`module-${key}`} className={`font-medium text-sm flex-1 ${isInherited ? "cursor-default" : "cursor-pointer"}`}>{label}</Label>
              {isInherited && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted border rounded px-1.5 py-0.5 shrink-0" data-testid={`badge-inherited-${key}`}>
                  <LockKeyhole className="h-3 w-3" />
                  Inherited
                </span>
              )}
              <Switch
                id={`module-${key}`}
                checked={enabled}
                onCheckedChange={(checked) => handleToggle(key, checked)}
                disabled={!isAdmin || updateMutation.isPending || isInherited}
                data-testid={`switch-module-${key}`}
                className="shrink-0"
              />
            </div>
          );
        })}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground pt-1">
            Only administrators can modify module access.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const MODULE_MAP: Record<string, { key: keyof CompanyModuleAccess; label: string }> = {
  health_safety: { key: "healthSafety", label: "Health & Safety" },
  human_resources: { key: "humanResources", label: "Human Resources" },
  employment_law: { key: "employmentLaw", label: "Employment Law" },
};

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const MODULE_ICON: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
};

const MODULE_COLOR: Record<string, string> = {
  health_safety: "text-emerald-700 dark:text-emerald-400",
  human_resources: "text-blue-700 dark:text-blue-400",
  employment_law: "text-pink-700 dark:text-pink-400",
};

type ServiceEntry = {
  id: string;
  companyId: string;
  serviceId: string;
  assignedAt: string;
  assignedBy: string | null;
  service: {
    id: string;
    productCode: string;
    title: string;
    description: string | null;
    module: "health_safety" | "human_resources" | "employment_law";
    sourceId: string | null;
    priceGbp: string;
    benchmarkPriceGbp: string | null;
    isActive: boolean;
    sortOrder: number;
  };
};

type AllService = {
  id: string;
  productCode: string;
  title: string;
  description: string | null;
  module: "health_safety" | "human_resources" | "employment_law";
  priceGbp: string;
  benchmarkPriceGbp: string | null;
  isActive: boolean;
};

const SVC_MODULE_LABELS: Record<string, string> = {
  health_safety: "H&S",
  human_resources: "HR",
  employment_law: "EL",
};

const SVC_MODULE_COLORS: Record<string, string> = {
  health_safety: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  human_resources: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  employment_law: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function CompanyServicesTab({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ServiceEntry | null>(null);

  const toggleServiceId = (id: string) =>
    setSelectedServiceIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { data: assigned = [], isLoading } = useQuery<ServiceEntry[]>({
    queryKey: ["/api/companies", companyId, "services"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/services`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  const { data: allServices = [] } = useQuery<AllService[]>({
    queryKey: ["/api/services", "active", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/services?activeOnly=true&companyId=${companyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    enabled: canManage,
  });

  const assignedIds = new Set(assigned.map(a => a.serviceId));
  const available = allServices.filter(s => !assignedIds.has(s.id));

  const addMutation = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      for (const serviceId of serviceIds) {
        const res = await apiRequest("POST", `/api/companies/${companyId}/services`, { serviceId });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to assign service");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "services"] });
      setPickerOpen(false);
      setConfirmAssign(false);
      setSelectedServiceIds(new Set());
      toast({ title: "Service(s) assigned" });
    },
    onError: (error: Error) => {
      setConfirmAssign(false);
      toast({ title: "Failed to assign service", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      await apiRequest("DELETE", `/api/companies/${companyId}/services/${serviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "services"] });
      setRemoveTarget(null);
      toast({ title: "Service removed" });
    },
    onError: (error: Error) => {
      setRemoveTarget(null);
      toast({ title: "Failed to remove service", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assigned Services</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Services assigned to this company for billing and reference.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setPickerOpen(true)} data-testid="button-add-company-service" disabled={available.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        )}
      </div>

      {isLoading ? (
        <FetchingOverlay />
      ) : assigned.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PackageOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-medium">No services assigned</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManage ? "Use the Add Service button to assign services to this company." : "No services have been assigned to this company yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-muted/40">
              <tr className="border-b text-muted-foreground text-left">
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Module</th>
                <th className="px-4 py-2 font-medium text-right">Price (£)</th>
                <th className="px-4 py-2 font-medium text-right">Benchmark (£)</th>
                {canManage && <th className="px-4 py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {assigned.map((entry) => (
                <tr key={entry.id} data-testid={`row-company-service-${entry.serviceId}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                      {entry.service.productCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.service.title}
                      {!entry.service.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">inactive</span>
                      )}
                    </div>
                    {entry.service.description && (
                      <p className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">{entry.service.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SVC_MODULE_COLORS[entry.service.module]}`}>
                      {SVC_MODULE_LABELS[entry.service.module]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {parseFloat(entry.service.priceGbp).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {entry.service.benchmarkPriceGbp ? parseFloat(entry.service.benchmarkPriceGbp).toFixed(2) : "—"}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(entry)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-company-service-${entry.serviceId}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Remove service confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.service.title}</strong> ({removeTarget?.service.productCode}) from this company? The service record will remain in the catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.serviceId)}
              data-testid="button-confirm-remove-company-service"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign confirmation dialog */}
      <AlertDialog open={confirmAssign} onOpenChange={(open) => { if (!open) setConfirmAssign(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Service{selectedServiceIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Assign {selectedServiceIds.size} service{selectedServiceIds.size !== 1 ? "s" : ""} to this company?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => addMutation.mutate(Array.from(selectedServiceIds))}
              data-testid="button-confirm-assign-service"
            >
              {addMutation.isPending ? "Assigning…" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Service picker dialog */}
      {canManage && (
        <Dialog open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setSelectedServiceIds(new Set()); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Services</DialogTitle>
              <DialogDescription>Select one or more eligible services to assign to this company. Only services matching this company's sources and active modules are shown.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No eligible services available to assign.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {available.map(svc => {
                    const checked = selectedServiceIds.has(svc.id);
                    return (
                      <button
                        key={svc.id}
                        data-testid={`option-service-${svc.id}`}
                        onClick={() => toggleServiceId(svc.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors ${
                          checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              readOnly
                              checked={checked}
                              className="shrink-0 accent-primary pointer-events-none"
                              data-testid={`checkbox-service-${svc.id}`}
                            />
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">{svc.productCode}</span>
                            <span className="font-medium truncate">{svc.title}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SVC_MODULE_COLORS[svc.module]}`}>
                            {SVC_MODULE_LABELS[svc.module]}
                          </span>
                        </div>
                        <div className="mt-1 ml-5 flex gap-4 text-xs text-muted-foreground">
                          <span>Price: £{parseFloat(svc.priceGbp).toFixed(2)}</span>
                          {svc.benchmarkPriceGbp && <span>Benchmark: £{parseFloat(svc.benchmarkPriceGbp).toFixed(2)}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setPickerOpen(false); setSelectedServiceIds(new Set()); }}>Cancel</Button>
              <Button
                onClick={() => setConfirmAssign(true)}
                disabled={selectedServiceIds.size === 0 || addMutation.isPending}
                data-testid="button-confirm-add-service"
              >
                {selectedServiceIds.size > 1
                  ? `Assign ${selectedServiceIds.size} Services`
                  : "Assign Service"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RequiredDocumentsCard({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [addSelectedIds, setAddSelectedIds] = useState<Set<string>>(new Set());
  const [isSavingReqs, setIsSavingReqs] = useState(false);

  const { data: moduleAccess } = useQuery<CompanyModuleAccess>({
    queryKey: ["/api/companies", companyId, "module-access"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/module-access`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch module access");
      return response.json();
    },
  });

  const { data: allTemplates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: requiredTemplates = [], isLoading: requiredLoading } = useQuery<CompanyRequiredTemplate[]>({
    queryKey: ["/api/companies", companyId, "required-templates"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/required-templates`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch required templates");
      return response.json();
    },
  });

  const enabledModules = Object.entries(MODULE_MAP)
    .filter(([, { key }]) => (moduleAccess?.[key] || moduleAccess?.inherited?.[key]))
    .map(([mod]) => mod);

  const requiredIds = new Set(requiredTemplates.map(rt => rt.templateId));
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "required-templates"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids-by-company"], refetchType: "all" });
  };

  const addMutation = useMutation({
    mutationFn: async (templateId: string) =>
      apiRequest("POST", `/api/companies/${companyId}/required-templates`, { templateId }),
    onSuccess: () => { invalidate(); setAddOpen(false); setSearch(""); setModuleFilter(null); },
    onError: () => toast({ title: "Failed to add requirement", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (templateId: string) =>
      apiRequest("DELETE", `/api/companies/${companyId}/required-templates/${templateId}`),
    onSuccess: () => invalidate(),
    onError: () => toast({ title: "Failed to remove requirement", variant: "destructive" }),
  });

  const allPrivateActive = allTemplates.filter(t => t.isActive && t.visibility === "private");

  const isPending = addMutation.isPending || removeMutation.isPending;

  const closeAddDialog = () => {
    setAddOpen(false);
    setSearch("");
    setModuleFilter(null);
    setAddSelectedIds(new Set());
  };

  const inheritedTemplateIdSet = useMemo(
    () => new Set(requiredTemplates.filter(rt => rt.inheritedFromCompanyId).map(rt => rt.templateId)),
    [requiredTemplates],
  );

  const performSaveSelected = async () => {
    setIsSavingReqs(true);
    try {
      const toAdd = allPrivateActive.filter(t => addSelectedIds.has(t.id) && !requiredIds.has(t.id));
      const toRemove = allPrivateActive.filter(t => !addSelectedIds.has(t.id) && requiredIds.has(t.id));
      if (toAdd.length === 0 && toRemove.length === 0) { closeAddDialog(); return; }
      await Promise.all([
        ...toAdd.map(t => apiRequest("POST", `/api/companies/${companyId}/required-templates`, { templateId: t.id })),
        ...toRemove.map(t => apiRequest("DELETE", `/api/companies/${companyId}/required-templates/${t.id}`)),
      ]);
      invalidate();
      const parts = [];
      if (toAdd.length > 0) parts.push(`${toAdd.length} added`);
      if (toRemove.length > 0) parts.push(`${toRemove.length} removed`);
      toast({ title: `Requirements updated: ${parts.join(", ")}` });
      closeAddDialog();
    } catch {
      toast({ title: "Failed to update requirements", variant: "destructive" });
    } finally {
      setIsSavingReqs(false);
    }
  };

  const handleSaveSelected = async () => {
    // Member-level un-tick of inherited rows is allowed and reversible
    // (soft-remove + re-tick reactivates), so no confirmation needed.
    await performSaveSelected();
  };

  if (requiredLoading) {
    return <FetchingOverlay />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Required Documents</h3>
          <p className="text-sm text-muted-foreground">
            These documents will be required for compliance across every site in this company. Each document affects the compliance score for its site until it is uploaded. Individual sites can override this list to add or remove specific requirements.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={v => { if (!v) closeAddDialog(); else { setAddOpen(true); setAddSelectedIds(new Set(requiredIds)); } }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-requirement">
              <Plus className="mr-2 h-4 w-4" />
              Manage Requirements
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] h-[680px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle>Manage Required Documents</DialogTitle>
                <DialogDescription>
                  Tick to require a document across all sites. Untick to remove an existing requirement. Changes take effect when you save.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {enabledModules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No modules are enabled for this company.</p>
              ) : (
                <Tabs defaultValue={enabledModules[0]}>
                  <TabsList className="mb-4">
                    {enabledModules.map(mod => (
                      <TabsTrigger key={mod} value={mod} data-testid={`tab-req-${mod}`}>
                        {MODULE_LABELS[mod] || mod}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {enabledModules.map(mod => {
                    const moduleTemplates = allPrivateActive.filter(t => t.module === mod);
                    return (
                      <TabsContent key={mod} value={mod}>
                        {moduleTemplates.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">
                            No templates available for {MODULE_LABELS[mod] || mod}.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {moduleTemplates.map(t => {
                              // Inherited rows are tickable: unticking them
                              // soft-removes (struck-through) at this member
                              // company. Re-ticking reactivates the row.
                              const isInheritedRow = inheritedTemplateIdSet.has(t.id);
                              return (
                                <div key={t.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`req-${t.id}`}
                                    checked={addSelectedIds.has(t.id)}
                                    onCheckedChange={(checked) => {
                                      const newIds = new Set(addSelectedIds);
                                      if (checked) newIds.add(t.id); else newIds.delete(t.id);
                                      setAddSelectedIds(newIds);
                                    }}
                                    data-testid={`checkbox-req-${t.id}`}
                                  />
                                  <label
                                    htmlFor={`req-${t.id}`}
                                    className="text-sm font-medium leading-none flex items-center gap-2 cursor-pointer"
                                  >
                                    {t.name}
                                    {isInheritedRow && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                                        data-testid={`badge-inherited-checkbox-${t.id}`}
                                      >
                                        <Building2 className="h-3 w-3" />
                                        Inherited
                                      </Badge>
                                    )}
                                    {t.requiresApproval && (
                                      <Badge variant="outline" className="text-xs">Approval Required</Badge>
                                    )}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeAddDialog} data-testid="button-cancel-add-req">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSelected}
                  disabled={isSavingReqs}
                  data-testid="button-save-add-req"
                >
                  {isSavingReqs ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {requiredIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">No required documents</p>
              <p className="text-xs text-muted-foreground mt-1">Add requirements using the button above.</p>
            </div>
          ) : (
            <div className="divide-y">
              {requiredTemplates.map(rt => {
                const templateId = rt.templateId;
                const tmpl = templateMap.get(templateId);
                if (!tmpl) return null;
                const ModIcon = MODULE_ICON[tmpl.module] || FileText;
                const isInherited = !!rt.inheritedFromCompanyId;
                // Soft-removed inherited rows: the parent group dropped this
                // template, so we keep the row visible as a struck-through
                // "previously inherited, no longer required" entry rather
                // than deleting it. No remove (X) button — re-adding at the
                // group level reactivates it automatically.
                const isSoftRemoved = !!rt.removedAt;
                return (
                  <div
                    key={templateId}
                    className={`flex items-center gap-3 px-4 py-3 ${isSoftRemoved ? "opacity-60" : ""}`}
                    data-testid={`row-required-${templateId}`}
                  >
                    <div className="p-1.5 rounded-md bg-muted shrink-0">
                      <ModIcon className={`h-4 w-4 ${MODULE_COLOR[tmpl.module] || ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSoftRemoved ? "line-through text-muted-foreground" : ""}`}>
                        {tmpl.name}
                      </p>
                      <p className={`text-xs ${isSoftRemoved ? "text-muted-foreground" : MODULE_COLOR[tmpl.module] || "text-muted-foreground"}`}>
                        {isSoftRemoved
                          ? "No longer required by parent group"
                          : MODULE_LABELS[tmpl.module] || tmpl.module}
                      </p>
                    </div>
                    {isInherited && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                        data-testid={`badge-inherited-${templateId}`}
                      >
                        <Building2 className="h-3 w-3" />
                        Inherited
                      </Badge>
                    )}
                    {isSoftRemoved ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => addMutation.mutate(templateId)}
                        disabled={isPending}
                        title="Re-enable this requirement for this company"
                        data-testid={`button-restore-requirement-${templateId}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMutation.mutate(templateId)}
                        disabled={isPending}
                        title={
                          isInherited
                            ? "Mark as no longer required for this company (struck-through)"
                            : "Remove requirement"
                        }
                        data-testid={`button-remove-requirement-${templateId}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const fromParam = new URLSearchParams(searchString).get("from");
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isProConsultant = user?.role === "consultant" && user?.consultantTier === "pro";

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormOriginal, setEditFormOriginal] = useState<Record<string, string> | null>(null);
  const { captureSnapshot, onCompanyUpdated, AddressSyncDialog } = useAddressSync();
  const [unsavedChangesOpen, setUnsavedChangesOpen] = useState(false);
  const [addSiteDialogOpen, setAddSiteDialogOpen] = useState(false);
  const [assignConsultantOpen, setAssignConsultantOpen] = useState(false);
  const [assignConsultantId, setAssignConsultantId] = useState("");
  const [consultantSiteSelections, setConsultantSiteSelections] = useState<Record<string, boolean>>({});
  const [originalConsultantSites, setOriginalConsultantSites] = useState<Set<string>>(new Set());
  const [savingConsultantAssignments, setSavingConsultantAssignments] = useState(false);
  const [changePrimaryContactOpen, setChangePrimaryContactOpen] = useState(false);
  const [selectedNewContactId, setSelectedNewContactId] = useState("");
  const [primaryContactConflict, setPrimaryContactConflict] = useState<{
    oldUserId: string;
    oldUserName: string;
    newUserId: string;
  } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [addMembersDialogOpen, setAddMembersDialogOpen] = useState(false);
  const [addMembersSearch, setAddMembersSearch] = useState("");
  const [addMembersSelected, setAddMembersSelected] = useState<Set<string>>(new Set());
  const [memberToUnlink, setMemberToUnlink] = useState<{ id: string; name: string } | null>(null);
  const [inviteConfirmUser, setInviteConfirmUser] = useState<UserWithAssignments | null>(null);
  const [viewingUser, setViewingUser] = useState<UserWithAssignments | null>(null);

  const [showCreateClientUser, setShowCreateClientUser] = useState(false);
  const { data: userActivityLogs = [], isLoading: isActivityLoading } = useQuery<any[]>({
    queryKey: ["/api/users", viewingUser?.id, "activity"],
    queryFn: async () => {
      if (!viewingUser?.id) return [];
      const res = await fetch(`/api/users/${viewingUser.id}/activity`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingUser?.id,
    staleTime: 0,
  });
  const EMPLOYEE_RANGES = ["1-4", "5-9", "10-24", "25-49", "50-99", "100-249", "250-999", "1000+"];
  const INDUSTRY_OPTIONS = [
    "Agriculture & Forestry",
    "Communication",
    "Construction",
    "Education",
    "Financial Services",
    "Government",
    "Healthcare & Social Care",
    "Hospitality",
    "Leisure",
    "Manufacturing",
    "Mining & Quarrying",
    "Office & Professional Services",
    "Public Services",
    "Real Estate",
    "Retail",
    "Technology",
    "Transport & Logistics",
    "Utilities",
    "Wholesale & Distribution",
  ];

  const [editForm, setEditForm] = useState({
    name: "",
    companyNumber: "",
    internalCompanyNumber: "",
    website: "",
    industry: "",
    employeeRange: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    contactUserId: "",
    searchTag: "",
    status: "active" as "active" | "cancelled" | "pending",
    sources: [] as string[],
  });
  const [newSiteForm, setNewSiteForm] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    additionalUserIds: [] as string[],
  });

  const { data: company, isLoading, error } = useQuery<CompanyWithSites>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch company");
      return response.json();
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  // Fetch all users to filter for company users (clients in this company)
  const { data: allUsers = [] } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: !!companyId,
  });

  // Fetch company-level stats (document counts by module, cases, incidents)
  const { data: companyStats } = useQuery<{ documents: Record<string, number>; cases: number; incidents: number }>({
    queryKey: ["/api/companies", companyId, "stats"],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}/stats`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!companyId,
  });

  // Fetch group owner company to know its primary contact (for "Group Primary Contact" badge)
  const { data: groupOwnerCompany } = useQuery<{ id: string; contactUserId?: string | null }>({
    queryKey: ["/api/companies", company?.groupOwnerId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${company!.groupOwnerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch group owner");
      return res.json();
    },
    enabled: !!company?.groupOwnerId,
  });

  // Fetch Accelo links for this company (admin + consultant only)
  const { data: acceloLinks = [] } = useQuery<{ id: string; sourceCode: string; acceloId: string; acceloStanding: string | null; lastCheckedAt: string | null }[]>({
    queryKey: ["/api/companies", companyId, "accelo-links"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/accelo-links`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(companyId && (isAdmin || user?.role === "consultant")),
  });

  // Fetch key contacts for this company (all admins and consultants can view badges; only admin/pro can toggle)
  const isConsultant = user?.role === "consultant";
  const { data: companyKeyContacts = [] } = useQuery<{ id: string; userId: string; entityType: string; entityId: string }[]>({
    queryKey: ["/api/key-contacts", "company", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/key-contacts?entityType=company&entityId=${companyId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(companyId && (isAdmin || isConsultant)),
  });
  const companyKeyContactIds = new Set(companyKeyContacts.map((kc) => kc.userId));

  // Fetch key contacts for the group-owner company (when applicable, for cross-company badge display)
  const { data: groupOwnerKeyContacts = [] } = useQuery<{ id: string; userId: string }[]>({
    queryKey: ["/api/key-contacts", "company", company?.groupOwnerId ?? groupOwnerCompany?.id],
    queryFn: async () => {
      const goId = company?.groupOwnerId ?? groupOwnerCompany?.id;
      if (!goId) return [];
      const res = await fetch(`/api/key-contacts?entityType=company&entityId=${goId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(isAdmin || isConsultant) && !!(company?.groupOwnerId ?? groupOwnerCompany?.id),
  });
  const groupOwnerKeyContactIds = new Set(groupOwnerKeyContacts.map((kc) => kc.userId));

  const addKeyContactMutation = useMutation({
    mutationFn: async ({ userId, entityType, entityId }: { userId: string; entityType: string; entityId: string }) => {
      const res = await apiRequest("POST", "/api/key-contacts", { userId, entityType, entityId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-contacts"] });
      toast({ title: "Key contact added" });
    },
    onError: async (err: any) => {
      let msg = "Failed to add key contact";
      try { const d = await err?.response?.json?.(); if (d?.error) msg = d.error; } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const removeKeyContactMutation = useMutation({
    mutationFn: async ({ userId, entityType, entityId }: { userId: string; entityType: string; entityId: string }) => {
      await apiRequest("DELETE", `/api/key-contacts/${userId}/${entityType}/${entityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/key-contacts"] });
      toast({ title: "Key contact removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove key contact", variant: "destructive" });
    },
  });

  // All companies list (for GO admin picker – admin only); uses a large limit to get all
  const { data: allCompaniesData } = useQuery<{ companies: CompanyWithSites[]; total: number }>({
    queryKey: ["/api/companies", { limit: 1000, page: 1 }],
    queryFn: async () => {
      const res = await fetch("/api/companies?limit=1000&page=1", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: isAdmin || isProConsultant,
  });
  const allCompanies: CompanyWithSites[] = allCompaniesData?.companies ?? [];

  // Mutation to set/unset the group owner of the current company
  const setGroupOwnerMutation = useMutation({
    mutationFn: async (groupOwnerId: string | null) => {
      return await apiRequest("PATCH", `/api/companies/${companyId}/group-owner`, { groupOwnerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "required-templates"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids-by-company"], refetchType: "all" });
      toast({ title: "Group Owner updated" });
    },
    onError: async (err: unknown) => {
      let msg = "Failed to update Group Owner";
      try {
        const e = err as { response?: { json?: () => Promise<{ error?: string }> } };
        const d = await e.response?.json?.();
        if (d?.error) msg = d.error;
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  // Mutation to bulk-add multiple companies as members of the current GO
  const bulkAddGroupMembersMutation = useMutation({
    mutationFn: async (memberCompanyIds: string[]) => {
      const results = await Promise.allSettled(
        memberCompanyIds.map((id) =>
          apiRequest("PATCH", `/api/companies/${id}/group-owner`, { groupOwnerId: companyId })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return { succeeded, failed, total: memberCompanyIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids-by-company"], refetchType: "all" });
      if (data.failed === 0) {
        toast({ title: `${data.succeeded} ${data.succeeded === 1 ? "company" : "companies"} linked to group` });
      } else if (data.succeeded > 0) {
        toast({
          title: `${data.succeeded} linked, ${data.failed} failed`,
          description: "Some companies could not be linked. They may have already been assigned to another group.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to link companies", variant: "destructive" });
      }
      setAddMembersDialogOpen(false);
      setAddMembersSelected(new Set());
      setAddMembersSearch("");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Failed to link companies", variant: "destructive" });
      setAddMembersDialogOpen(false);
      setAddMembersSelected(new Set());
      setAddMembersSearch("");
    },
  });

  type Source = { id: string; code: string; label: string; isActive: boolean };
  const { data: availableSources = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await fetch("/api/sources", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filter to get only client users from this company (used for contact dropdowns)
  const companyUsers = allUsers.filter(
    (u) => u.role === "client" && u.companyId === companyId && u.status !== "inactive"
  );

  // All users tab: clients in this company + all consultants explicitly assigned to any of this company's sites
  const companySiteIds = new Set((company?.sites || []).map((s: SiteWithDetails) => s.id));
  const tabConsultants = allUsers.filter(u =>
    u.role === "consultant" &&
    (u.siteAssignments || []).some(a => companySiteIds.has(a.siteId))
  );
  // Include same-company clients AND cross-company clients assigned to any of this company's sites
  // (e.g. Group Owner primary contacts auto-assigned to member company sites)
  const tabClients = allUsers.filter(u =>
    u.role === "client" && (
      u.companyId === companyId ||
      (u.companyId !== companyId && (u.siteAssignments || []).some(a => companySiteIds.has(a.siteId)))
    )
  );
  const companyTabUsers = [...tabConsultants, ...tabClients];

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Handler to select a user as company contact
  const handleSelectCompanyContactUser = (userId: string) => {
    if (userId === "none") {
      setEditForm({
        ...editForm,
        contactUserId: "",
        contactName: "",
        contactPosition: "",
        contactPhone: "",
        contactEmail: "",
      });
      return;
    }
    
    const selectedUser = companyUsers.find((u) => u.id === userId);
    if (selectedUser) {
      setEditForm({
        ...editForm,
        contactUserId: userId,
        contactName: selectedUser.fullName || "",
        contactPosition: selectedUser.jobTitle || "",
        contactPhone: selectedUser.phone || selectedUser.mobile || "",
        contactEmail: selectedUser.email || "",
      });
    }
  };

  const handleManageSite = (siteId: string) => {
    navigate(`/sites/${siteId}?from=/companies/${companyId}`);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}`, data);
      return response.json();
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditFormOriginal(null);
      setEditDialogOpen(false);
      setUnsavedChangesOpen(false);
      toast({
        title: "Company updated",
        description: "The company details have been updated successfully.",
      });

      const newAddr = {
        addressLine1: variables.addressLine1, addressLine2: variables.addressLine2,
        city: variables.city, county: variables.county,
        postalCode: variables.postalCode, country: variables.country,
      };
      await onCompanyUpdated(companyId!, newAddr);
    },
    onError: (error: Error) => {
      let message = "Failed to update company. Please try again.";
      try { message = JSON.parse(error.message.replace(/^\d+: /, "")).error || message; } catch {}
      toast({ title: "Failed to update company", description: message, variant: "destructive" });
    },
  });

  const changePrimaryContactMutation = useMutation({
    mutationFn: async ({ newUserId }: { newUserId: string }) => {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}`, { contactUserId: newUserId || null });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setChangePrimaryContactOpen(false);
      setSelectedNewContactId("");
      toast({ title: "Primary contact updated", description: "The primary contact has been changed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update primary contact.", variant: "destructive" });
    },
  });

  const clearSiteAccessMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}/site-assignments`);
    },
    onError: () => {
      toast({ title: "Warning", description: "Could not remove old contact's site access.", variant: "destructive" });
    },
  });

  const handleChangePrimaryContactSave = () => {
    if (!selectedNewContactId) return;
    const existingContactUserId = company?.contactUserId;
    if (existingContactUserId && existingContactUserId !== selectedNewContactId) {
      const oldUser = companyUsers.find(u => u.id === existingContactUserId);
      setPrimaryContactConflict({
        oldUserId: existingContactUserId,
        oldUserName: oldUser?.fullName || company?.contactName || "the current contact",
        newUserId: selectedNewContactId,
      });
    } else {
      changePrimaryContactMutation.mutate({ newUserId: selectedNewContactId });
    }
  };

  const handleConflictResolve = async (removeAccess: boolean) => {
    if (!primaryContactConflict) return;
    if (removeAccess) {
      await clearSiteAccessMutation.mutateAsync(primaryContactConflict.oldUserId);
    }
    changePrimaryContactMutation.mutate({ newUserId: primaryContactConflict.newUserId });
    setPrimaryContactConflict(null);
  };

  const createSiteMutation = useMutation({
    mutationFn: async (data: typeof newSiteForm) => {
      const response = await apiRequest("POST", "/api/sites", { ...data, companyId });
      const site = await response.json();
      for (const userId of data.additionalUserIds) {
        try {
          await apiRequest("POST", `/api/sites/${site.id}/client-assignments`, { clientId: userId });
        } catch {}
      }
      return site;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddSiteDialogOpen(false);
      setNewSiteForm({
        name: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        county: "",
        postalCode: "",
        country: "",
        additionalUserIds: [],
      });
      toast({
        title: "Site created",
        description: "The new site has been added to this company.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create site. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/users/${userId}/resend-invite`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Invitation sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    },
  });

  const handleAddSiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteForm.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (!newSiteForm.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!newSiteForm.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!newSiteForm.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!newSiteForm.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!newSiteForm.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(newSiteForm.postalCode, newSiteForm.country)) {
      toast({ title: getPostcodeError(newSiteForm.country), variant: "destructive" });
      return;
    }
    createSiteMutation.mutate(newSiteForm);
  };

  const companySources = company?.sources || [];
  const allConsultants = allUsers.filter(u => {
    if (u.role !== "consultant") return false;
    if (companySources.length === 0) return true;
    const consultantSources = u.sources || [];
    if (consultantSources.length === 0) return true;
    return consultantSources.some((s: string) => companySources.includes(s));
  });

  const handleConsultantSelect = (consultantId: string) => {
    setAssignConsultantId(consultantId);
    const consultant = allConsultants.find(c => c.id === consultantId);
    if (!consultant) return;
    const assignedSiteIds = new Set(
      (consultant.siteAssignments || [])
        .filter((a: SiteAssignment) => companySiteIds.has(a.siteId))
        .map((a: SiteAssignment) => a.siteId)
    );
    const selections: Record<string, boolean> = {};
    (company?.sites || []).forEach((s: SiteWithDetails) => {
      selections[s.id] = assignedSiteIds.has(s.id);
    });
    setConsultantSiteSelections(selections);
    setOriginalConsultantSites(assignedSiteIds);
  };

  const handleSaveConsultantAssignments = async () => {
    if (!assignConsultantId) return;
    setSavingConsultantAssignments(true);
    try {
      const currentSites = company?.sites || [];
      const toAdd = currentSites.filter((s: SiteWithDetails) => consultantSiteSelections[s.id] && !originalConsultantSites.has(s.id));
      const toRemove = currentSites.filter((s: SiteWithDetails) => !consultantSiteSelections[s.id] && originalConsultantSites.has(s.id));
      await Promise.all([
        ...toAdd.map((s: SiteWithDetails) => apiRequest("POST", `/api/sites/${s.id}/consultants`, { consultantId: assignConsultantId })),
        ...toRemove.map((s: SiteWithDetails) => apiRequest("DELETE", `/api/sites/${s.id}/consultants/${assignConsultantId}`)),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Consultant site access updated successfully" });
      setAssignConsultantOpen(false);
      setAssignConsultantId("");
      setConsultantSiteSelections({});
      setOriginalConsultantSites(new Set());
    } catch {
      toast({ title: "Failed to update consultant access", variant: "destructive" });
    } finally {
      setSavingConsultantAssignments(false);
    }
  };

  const formatStatusDisplay = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}/status`, { status: newStatus });
      await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: `Status updated to ${formatStatusDisplay(newStatus)}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setStatusLoading(false);
    }
  };

  const openEditDialog = () => {
    if (company) {
      // Try to find the user whose details match the current contact
      const matchingUser = companyUsers.find(
        (u) => u.email === company.contactEmail || u.fullName === company.contactName
      );
      // For pro consultants, strip any out-of-scope sources from initial form state
      // to prevent legacy data silently blocking save.
      const allowedSources = isProConsultant && user?.sources ? user.sources : null;
      const initialSources = allowedSources
        ? (company.sources || []).filter((s) => allowedSources.includes(s))
        : company.sources || [];
      const initial = {
        name: company.name || "",
        companyNumber: company.companyNumber || "",
        internalCompanyNumber: company.internalCompanyNumber || "",
        website: company.website || "",
        industry: (company as any).industry || "",
        employeeRange: company.employeeRange || "",
        addressLine1: company.addressLine1 || "",
        addressLine2: company.addressLine2 || "",
        city: company.city || "",
        county: company.county || "",
        postalCode: company.postalCode || "",
        country: company.country || "",
        contactName: company.contactName || "",
        contactPosition: company.contactPosition || "",
        contactPhone: company.contactPhone || "",
        contactEmail: company.contactEmail || "",
        contactUserId: matchingUser?.id || "",
        searchTag: company.searchTag || "",
        status: company.status || "active",
        sources: initialSources,
      };
      captureSnapshot(company);
      setEditForm(initial);
      setEditFormOriginal(initial);
      setEditDialogOpen(true);
    }
  };

  const validateUKPostcode = (postcode: string): boolean => {
    const regex = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
    return regex.test(postcode.trim());
  };

  const validateEircode = (postcode: string): boolean => {
    const regex = /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i;
    return regex.test(postcode.trim());
  };

  const validatePostcode = (postcode: string, country: string): boolean => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return validateUKPostcode(postcode);
    if (country === "Ireland") return validateEircode(postcode);
    return postcode.trim().length > 0;
  };

  const getPostcodeError = (country: string): string => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return "Please enter a valid UK postcode (e.g., BT1 1AA, SW1A 1AA)";
    if (country === "Ireland") return "Please enter a valid Eircode (e.g., D02 AF30)";
    return "Please enter a valid postal code";
  };

  const COUNTRY_OPTIONS = [
    "England",
    "Ireland",
    "Northern Ireland",
    "Scotland",
    "Wales",
  ];

  const COUNTY_MAP: Record<string, string[]> = {
    "England": [
      "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire",
      "Cheshire", "City of London", "Cornwall", "County Durham", "Cumbria",
      "Derbyshire", "Devon", "Dorset", "East Riding of Yorkshire", "East Sussex",
      "Essex", "Gloucestershire", "Greater London", "Greater Manchester",
      "Hampshire", "Herefordshire", "Hertfordshire", "Isle of Wight", "Kent",
      "Lancashire", "Leicestershire", "Lincolnshire", "Merseyside", "Norfolk",
      "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire",
      "Oxfordshire", "Rutland", "Shropshire", "Somerset", "South Yorkshire",
      "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear", "Warwickshire",
      "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
    ],
    "Ireland": [
      "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
      "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick",
      "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly",
      "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
      "Wexford", "Wicklow",
    ],
    "Northern Ireland": [
      "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
    ],
    "Scotland": [
      "Aberdeen City", "Aberdeenshire", "Angus", "Argyll and Bute",
      "Clackmannanshire", "Dumfries and Galloway", "Dundee City",
      "East Ayrshire", "East Dunbartonshire", "East Lothian", "East Renfrewshire",
      "Edinburgh", "Falkirk", "Fife", "Glasgow City", "Highland",
      "Inverclyde", "Midlothian", "Moray", "North Ayrshire",
      "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
      "Renfrewshire", "Scottish Borders", "Shetland Islands",
      "South Ayrshire", "South Lanarkshire", "Stirling",
      "West Dunbartonshire", "West Lothian", "Western Isles",
    ],
    "Wales": [
      "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire",
      "Ceredigion", "Conwy", "Denbighshire", "Flintshire", "Gwynedd",
      "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot",
      "Newport", "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea",
      "Torfaen", "Vale of Glamorgan", "Wrexham",
    ],
  };

  const submitEditForm = () => {
    if (!editForm.name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    if (!editForm.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!editForm.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!editForm.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!editForm.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!editForm.postalCode.trim()) {
      toast({ title: "Postal Code is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(editForm.postalCode, editForm.country)) {
      toast({ title: getPostcodeError(editForm.country), variant: "destructive" });
      return;
    }
    if (!editForm.industry) {
      toast({ title: "Industry is required", variant: "destructive" });
      return;
    }
    if (!editForm.sources || editForm.sources.length === 0) {
      toast({ title: "At least one source is required", variant: "destructive" });
      return;
    }
    updateCompanyMutation.mutate(editForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitEditForm();
  };

  const isEditFormDirty =
    editFormOriginal !== null &&
    JSON.stringify(editForm) !== JSON.stringify(editFormOriginal);

  const handleEditDialogClose = (open: boolean) => {
    if (!open && isEditFormDirty) {
      setUnsavedChangesOpen(true);
    } else {
      setEditDialogOpen(open);
    }
  };

  if (isLoading) {
    return <FetchingOverlay />;
  }

  if (error || !company) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Company not found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The company you're looking for doesn't exist or you don't have access.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/companies")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Companies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sites = company.sites || [];
  
  const aggregatedCompliance = sites.reduce(
    (acc, site) => {
      if (site.complianceSummary) {
        acc.totalDocuments += site.complianceSummary.totalDocuments;
        acc.compliantDocuments += site.complianceSummary.compliantDocuments;
        acc.approvalRequired += site.complianceSummary.approvalRequired;
        acc.overdueDocuments += site.complianceSummary.overdueDocuments;
      }
      return acc;
    },
    { totalDocuments: 0, compliantDocuments: 0, approvalRequired: 0, overdueDocuments: 0 }
  );

  const complianceScore = aggregatedCompliance.totalDocuments > 0
    ? Math.round((aggregatedCompliance.compliantDocuments / aggregatedCompliance.totalDocuments) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 px-8 py-6 bg-background border-b">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{company.name}</h1>
                {company.referenceNumber && (
                  <Badge variant="outline" className="font-mono text-xs" data-testid="badge-company-reference">
                    {company.referenceNumber}
                  </Badge>
                )}
              </div>
              {company.companyNumber && (
                <p className="text-sm text-muted-foreground">Reg. No: {company.companyNumber}</p>
              )}
              {company.internalCompanyNumber && (
                <p className="text-sm text-muted-foreground">Internal No: {company.internalCompanyNumber}</p>
              )}
              {company.searchTag && (isAdmin || user?.role === "consultant") && (
                <p className="text-sm text-muted-foreground">Search Tag: {company.searchTag}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant={company.status === "on_hold" ? "ghost" : "outline"} 
                  size="sm"
                  className={company.status === "on_hold" ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-900" : ""}
                  data-testid={`button-status-${company.id}`}
                >
                  {formatStatusDisplay(company.status)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {["pending", "active", "on_hold", "cancelled"].map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={statusLoading || status === company.status}
                    data-testid={`menu-item-status-${status}-${company.id}`}
                  >
                    {formatStatusDisplay(status)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant={company.status === "active" ? "default" : "secondary"}>
              {formatStatusDisplay(company.status)}
            </Badge>
          )}
          {isAdmin && (
            <Button onClick={openEditDialog} data-testid="button-edit-company">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Company
            </Button>
          )}
        </div>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="module-access" data-testid="tab-module-access">
            <Settings className="mr-2 h-4 w-4" />
            Module Access
          </TabsTrigger>
          {(isAdmin || user?.role === "consultant") && (
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="mr-2 h-4 w-4" />
              Users {companyTabUsers.length > 0 && `(${companyTabUsers.length})`}
            </TabsTrigger>
          )}
          <TabsTrigger value="sites" data-testid="tab-sites">
            <MapPin className="mr-2 h-4 w-4" />
            Sites {sites.length > 0 && `(${sites.length})`}
          </TabsTrigger>
          {(isAdmin || user?.role === "consultant") && (
            <TabsTrigger value="required-documents" data-testid="tab-required-documents">
              <FileText className="mr-2 h-4 w-4" />
              Required Documents
            </TabsTrigger>
          )}
          {(isAdmin || user?.role === "consultant") && (
            <TabsTrigger value="services" data-testid="tab-services">
              <PackageOpen className="mr-2 h-4 w-4" />
              Services
            </TabsTrigger>
          )}
          {(isAdmin || isProConsultant) && (
            <TabsTrigger value="groups" data-testid="tab-groups">
              <Network className="mr-2 h-4 w-4" />
              Groups
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
                {(company as any).industry && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span><span className="text-muted-foreground">Industry:</span> {(company as any).industry}</span>
                  </div>
                )}
                {company.employeeRange && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span><span className="text-muted-foreground">Employees:</span> {company.employeeRange}</span>
                  </div>
                )}
                {(isAdmin || user?.role === "consultant") && (() => {
                  const displaySources = company.isGroupOwner && company.computedSources
                    ? company.computedSources
                    : company.sources;
                  return displaySources && displaySources.length > 0 ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground">
                          {company.isGroupOwner ? "Sources (computed from members): " : "Sources: "}
                        </span>
                        <span className="inline-flex flex-wrap gap-1 ml-1">
                          {displaySources.map((code: string) => (
                            <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-detail-source-${code}`}>
                              {code}
                            </Badge>
                          ))}
                        </span>
                      </div>
                    </div>
                  ) : null;
                })()}

                {(company.addressLine1 || company.city || company.postalCode) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Address</p>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        {company.addressLine1 && <p>{company.addressLine1}</p>}
                        {company.addressLine2 && <p>{company.addressLine2}</p>}
                        {(company.city || company.county) && (
                          <p>{[company.city, company.county].filter(Boolean).join(", ")}</p>
                        )}
                        {company.postalCode && <p>{company.postalCode}</p>}
                        {company.country && <p>{company.country}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {(isAdmin || user?.role === "consultant") && acceloLinks.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Accelo</p>
                    <div className="space-y-1.5">
                      {acceloLinks.map((link) => {
                        const s = (link.acceloStanding ?? "").toLowerCase();
                        const isActive = s === "active";
                        const isInactive = s === "inactive" || s === "prospect" || s === "churned" || s === "lost";
                        return (
                          <div key={link.sourceCode} className="flex items-center gap-2 text-sm flex-wrap" data-testid={`accelo-link-${link.sourceCode}`}>
                            <span className="text-muted-foreground font-mono text-xs">{link.sourceCode}</span>
                            <span className="text-xs text-muted-foreground">#{link.acceloId}</span>
                            <Badge
                              variant="outline"
                              className={
                                isActive
                                  ? "text-xs py-0 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                                  : isInactive
                                  ? "text-xs py-0 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                                  : "text-xs py-0 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                              }
                            >
                              {link.acceloStanding ?? "Unknown"}
                            </Badge>
                            {link.lastCheckedAt && (
                              <span className="text-xs text-muted-foreground">
                                checked {new Date(link.lastCheckedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Primary Contact</p>
                    {isAdmin && companyUsers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setSelectedNewContactId(company.contactUserId || "");
                          setChangePrimaryContactOpen(true);
                        }}
                        data-testid="button-change-primary-contact"
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {company.contactName ? "Change" : "Set"}
                      </Button>
                    )}
                  </div>
                  {(company.contactName || company.contactPhone || company.contactEmail) ? (
                    <div className="flex items-start gap-2 text-sm">
                      <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {company.contactName && (
                            <span className="font-medium truncate">{company.contactName}{company.contactPosition && ` - ${company.contactPosition}`}</span>
                          )}
                          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 shrink-0">
                            Primary Contact
                          </Badge>
                        </div>
                        {company.contactPhone && <p className="text-xs text-muted-foreground truncate">{company.contactPhone}</p>}
                        {company.contactEmail && <p className="text-xs text-muted-foreground truncate">{company.contactEmail}</p>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No primary contact set</p>
                  )}
                </div>

                {/* Key Contacts */}
                {(isAdmin || isConsultant) && companyKeyContacts.length > 0 && (() => {
                  const keyContactUsers = companyKeyContacts
                    .map((kc) => allUsers.find((u) => u.id === kc.userId))
                    .filter(Boolean) as typeof allUsers;
                  if (keyContactUsers.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Key Contacts</p>
                      <div className="space-y-2">
                        {keyContactUsers.map((u) => (
                          <div key={u.id} className="flex items-start gap-2 text-sm" data-testid={`key-contact-overview-${u.id}`}>
                            <UserCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium truncate">{u.fullName}</span>
                                <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 shrink-0">
                                  Key Contact
                                </Badge>
                              </div>
                              {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

          </div>


          {/* Module Document Summary */}
          {companyStats && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Document Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { key: "health_safety", label: "Health & Safety", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", extra: { label: "Incidents", count: companyStats.incidents } },
                    { key: "human_resources", label: "Human Resources", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
                    { key: "employment_law", label: "Employment Law", color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-200 dark:border-pink-800", extra: { label: "Cases", count: companyStats.cases } },
                    { key: "training", label: "Training", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800" },
                    { key: "support", label: "Support", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
                  ].map(({ key, label, color, bg, border, extra }) => (
                    <div key={key} className={`rounded-lg border p-3 ${bg} ${border}`} data-testid={`stat-module-${key}`}>
                      <p className={`text-2xl font-bold ${color}`}>{companyStats.documents[key] ?? 0}</p>
                      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
                      <p className="text-xs text-muted-foreground">documents</p>
                      {extra && (
                        <p className={`text-xs mt-1.5 font-medium ${color}`} data-testid={`stat-extra-${key}`}>
                          {extra.count} {extra.label}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Module Access Tab */}
        <TabsContent value="module-access" className="mt-6">
          <ModuleAccessCard companyId={companyId!} groupOwnerId={company?.groupOwnerId} />
        </TabsContent>

        {/* Required Documents Tab */}
        {(isAdmin || user?.role === "consultant") && (
          <TabsContent value="required-documents" className="mt-6">
            <RequiredDocumentsCard companyId={companyId!} />
          </TabsContent>
        )}

        {/* Services Tab */}
        {(isAdmin || user?.role === "consultant") && (
          <TabsContent value="services" className="mt-6">
            <CompanyServicesTab companyId={companyId!} canManage={isAdmin || !!(user?.consultantPermissions as { services?: boolean } | null)?.services} />
          </TabsContent>
        )}

        {/* Groups Tab — admin and Pro Consultant only */}
        {(isAdmin || isProConsultant) && (
          <TabsContent value="groups" className="mt-6">
            {(() => {
              const members = company.groupMembers ?? [];
              const hasGroupOwner = !!company.groupOwnerId;
              const isGroupOwnerCompany = company.isGroupOwner || members.length > 0;

              const eligibleToAdd = allCompanies.filter(
                (c) => c.id !== companyId && !c.groupOwnerId && !members.some((m) => m.id === c.id) && !c.isGroupOwner
              );

              const inheritedSources = Array.from(
                new Set(members.flatMap((m) => m.sources ?? []))
              ).sort();

              const filteredEligible = eligibleToAdd
                .filter((c) => c.name.toLowerCase().includes(addMembersSearch.toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name));

              const allFilteredSelected =
                filteredEligible.length > 0 && filteredEligible.every((c) => addMembersSelected.has(c.id));

              return (
                <>
                {/* Bulk-add members dialog — only used when this company is/can be a GO */}
                <Dialog open={addMembersDialogOpen} onOpenChange={(open) => {
                  setAddMembersDialogOpen(open);
                  if (!open) { setAddMembersSelected(new Set()); setAddMembersSearch(""); }
                }}>
                  <DialogContent className="max-w-md" data-testid="dialog-add-group-members">
                    <DialogHeader>
                      <DialogTitle>Add Member Companies</DialogTitle>
                      <DialogDescription>
                        Select one or more companies to link to this Group Owner.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Search companies..."
                          value={addMembersSearch}
                          onChange={(e) => setAddMembersSearch(e.target.value)}
                          data-testid="input-add-members-search"
                        />
                      </div>
                      {filteredEligible.length > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                          <span>{addMembersSelected.size} selected</span>
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-foreground transition-colors"
                            onClick={() => {
                              if (allFilteredSelected) {
                                setAddMembersSelected((prev) => {
                                  const next = new Set(prev);
                                  filteredEligible.forEach((c) => next.delete(c.id));
                                  return next;
                                });
                              } else {
                                setAddMembersSelected((prev) => {
                                  const next = new Set(prev);
                                  filteredEligible.forEach((c) => next.add(c.id));
                                  return next;
                                });
                              }
                            }}
                            data-testid="button-toggle-all-members"
                          >
                            {allFilteredSelected ? "Deselect all" : "Select all"}
                          </button>
                        </div>
                      )}
                      <div className="max-h-60 overflow-y-auto divide-y border rounded-md" data-testid="list-eligible-companies">
                        {filteredEligible.length === 0 ? (
                          <p className="text-sm text-muted-foreground p-3" data-testid="text-no-eligible-companies">
                            {eligibleToAdd.length === 0
                              ? "All eligible companies have already been added to a group."
                              : "No companies found."}
                          </p>
                        ) : (
                          filteredEligible.map((c) => {
                            const selected = addMembersSelected.has(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5" : ""}`}
                                onClick={() => {
                                  setAddMembersSelected((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                    return next;
                                  });
                                }}
                                data-testid={`add-member-option-${c.id}`}
                              >
                                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                                  {selected && <CheckCircle className="h-3 w-3" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{c.name}</p>
                                  {c.referenceNumber && (
                                    <p className="text-xs text-muted-foreground font-mono">{c.referenceNumber}</p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAddMembersDialogOpen(false)}
                        data-testid="button-cancel-add-members"
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={addMembersSelected.size === 0 || bulkAddGroupMembersMutation.isPending}
                        onClick={() => bulkAddGroupMembersMutation.mutate(Array.from(addMembersSelected))}
                        data-testid="button-confirm-add-members"
                      >
                        {bulkAddGroupMembersMutation.isPending
                          ? "Linking..."
                          : `Link ${addMembersSelected.size > 0 ? addMembersSelected.size : ""} ${addMembersSelected.size === 1 ? "Company" : "Companies"}`}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Card data-testid="card-group-members">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        Groups
                        {members.length > 0 && (
                          <Badge variant="secondary" className="ml-1">{members.length}</Badge>
                        )}
                      </CardTitle>
                      {/* Add Members button — only when this company is the GO */}
                      {(isAdmin || isProConsultant) && isGroupOwnerCompany && eligibleToAdd.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-sm gap-1"
                          onClick={() => {
                            setAddMembersSelected(new Set());
                            setAddMembersSearch("");
                            setAddMembersDialogOpen(true);
                          }}
                          data-testid="button-add-group-members"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Members
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* State 1: This company has a Group Owner (it's a member) */}
                    {hasGroupOwner ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">This company is a member of a group.</p>
                        {(isAdmin || isProConsultant) ? (
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Group Owner</label>
                            <Select
                              value={company.groupOwnerId ?? "none"}
                              onValueChange={(val) => {
                                const goId = val === "none" ? null : val;
                                setGroupOwnerMutation.mutate(goId);
                              }}
                              disabled={setGroupOwnerMutation.isPending}
                            >
                              <SelectTrigger className="h-9 text-sm w-[360px]" data-testid="select-group-owner">
                                <SelectValue placeholder="None (standalone)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None (remove from group)</SelectItem>
                                {allCompanies
                                  .filter(c => c.id !== companyId && c.isGroupOwner)
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id} data-testid={`go-option-${c.id}`}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <Link
                              href={`/companies/${company.groupOwnerId}`}
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                              data-testid="link-group-owner"
                            >
                              {company.groupOwnerName}
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : isGroupOwnerCompany ? (
                      /* State 2: This company is a Group Owner (has members) */
                      <>
                        {members.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No companies linked yet. Use "Add Members" to link companies to this Group Owner.</p>
                        ) : (
                          <div className="divide-y">
                            {members.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between py-2"
                                data-testid={`group-member-${member.id}`}
                              >
                                <div
                                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0"
                                  onClick={() => navigate(`/companies/${member.id}`)}
                                >
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                    <Building2 className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{member.name}</p>
                                    {member.referenceNumber && (
                                      <p className="text-xs text-muted-foreground font-mono">{member.referenceNumber}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge
                                    variant={member.status === "active" ? "default" : "secondary"}
                                    className="text-xs"
                                    data-testid={`badge-member-status-${member.id}`}
                                  >
                                    {member.status}
                                  </Badge>
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => setMemberToUnlink({ id: member.id, name: member.name })}
                                      disabled={setGroupOwnerMutation.isPending}
                                      data-testid={`button-remove-member-${member.id}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Inherited sources: computed union of all member sources */}
                        {inheritedSources.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                              <Shield className="h-3.5 w-3.5" />
                              Sources (inherited — union of all linked companies)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {inheritedSources.map((code) => (
                                <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-inherited-source-${code}`}>
                                  {code}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* State 3: Standalone company */
                      (isAdmin || isProConsultant) ? (
                        <div className="space-y-4">
                          {/* Option A: Join an existing group */}
                          <div className="rounded-lg border p-4 space-y-2.5">
                            <div>
                              <p className="text-sm font-medium">Join a group</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Assign this company as a member under an existing Group Owner.
                              </p>
                            </div>
                            <Select
                              value="none"
                              onValueChange={(val) => {
                                if (val !== "none") setGroupOwnerMutation.mutate(val);
                              }}
                              disabled={setGroupOwnerMutation.isPending}
                            >
                              <SelectTrigger className="h-9 text-sm w-[360px]" data-testid="select-group-owner">
                                <SelectValue placeholder="Select a Group Owner…" />
                              </SelectTrigger>
                              <SelectContent>
                                {allCompanies
                                  .filter(c => c.id !== companyId && c.isGroupOwner)
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id} data-testid={`go-option-${c.id}`}>
                                      {c.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Divider */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex-1 border-t" />
                            <span>or</span>
                            <div className="flex-1 border-t" />
                          </div>

                          {/* Option B: Become a Group Owner */}
                          {eligibleToAdd.length > 0 && (
                            <div className="rounded-lg border p-4 space-y-2.5">
                              <div>
                                <p className="text-sm font-medium">Become a Group Owner</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Link other companies under this one to make it a Group Owner.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-sm gap-1"
                                onClick={() => {
                                  setAddMembersSelected(new Set());
                                  setAddMembersSearch("");
                                  setAddMembersDialogOpen(true);
                                }}
                                data-testid="button-add-group-members"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Members
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">This company is not part of any group.</p>
                      )
                    )}
                  </CardContent>
                </Card>
                </>
              );
            })()}
          </TabsContent>
        )}

        {/* Sites Tab */}
        <TabsContent value="sites" className="mt-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sites ({sites.length})</h2>
              {(isAdmin || isProConsultant) && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAssignConsultantOpen(true)} data-testid="button-assign-consultant-sites">
                    <Users className="mr-2 h-4 w-4" />
                    Assign Consultant
                  </Button>
                  <Button size="sm" onClick={() => setAddSiteDialogOpen(true)} data-testid="button-add-site">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Site
                  </Button>
                </div>
              )}
            </div>
            {sites.length > 0 ? (
              <div className="space-y-3">
                {sites.map((site) => (
                  <SiteCard key={site.id} site={site} onManage={handleManageSite} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-base font-medium">No sites</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This company doesn't have any sites yet
                  </p>
                  {(isAdmin || isProConsultant) && (
                    <Button className="mt-4" size="sm" onClick={() => setAddSiteDialogOpen(true)} data-testid="button-add-first-site">
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Site
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Users Tab */}
        {(isAdmin || user?.role === "consultant") && (
          <TabsContent value="users" className="mt-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Users ({companyTabUsers.length})</h2>
                <div className="flex items-center gap-2">
                  {(isAdmin || isConsultant) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCreateClientUser(true)}
                      data-testid="button-create-client-user"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Client User
                    </Button>
                  )}
                  {(isAdmin || isProConsultant) && (
                    <Button size="sm" variant="outline" onClick={() => setAssignConsultantOpen(true)} data-testid="button-assign-consultant-users">
                      <Users className="mr-2 h-4 w-4" />
                      Assign Consultant
                    </Button>
                  )}
                </div>
              </div>
              {companyTabUsers.length > 0 ? (
                <Card>
                  {/* Consultants section */}
                  {tabConsultants.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-muted/40 border-b">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Consultants ({tabConsultants.length})
                        </p>
                      </div>
                      <div className="divide-y">
                        {tabConsultants.map((u) => {
                          const isExpanded = expandedUserId === u.id;
                          const relevantAssignments = (u.siteAssignments || []).filter(a => companySiteIds.has(a.siteId));
                          return (
                            <div key={u.id} data-testid={`row-consultant-${u.id}`}>
                              <div className="flex items-center gap-4 px-4 py-3">
                                <button
                                  className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity min-w-0 flex-1"
                                  onClick={() => setViewingUser(u)}
                                  data-testid={`button-view-consultant-${u.id}`}
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                    {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium truncate block hover:underline underline-offset-2">{u.fullName}</span>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                                    {u.consultantTier ? (u.consultantTier.charAt(0).toUpperCase() + u.consultantTier.slice(1)) : "Standard"}
                                  </Badge>
                                  {(isAdmin || isProConsultant) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => { handleConsultantSelect(u.id); setAssignConsultantOpen(true); }}
                                      data-testid={`button-edit-sites-${u.id}`}
                                    >
                                      Edit sites
                                    </Button>
                                  )}
                                  {relevantAssignments.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                      data-testid={`button-expand-user-${u.id}`}
                                    >
                                      <span className="font-medium">{relevantAssignments.length} {relevantAssignments.length === 1 ? "site" : "sites"}</span>
                                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">No sites</span>
                                  )}
                                </div>
                              </div>
                              {isExpanded && relevantAssignments.length > 0 && (
                                <div className="px-4 pb-3 bg-muted/30 border-t">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 mt-2 uppercase tracking-wide">Site Access</p>
                                  <div className="flex flex-wrap gap-2">
                                    {relevantAssignments.map(a => (
                                      <div key={a.siteId} className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-2.5 py-1.5">
                                        {a.isPrimary && <Shield className="h-3 w-3 text-amber-500 shrink-0" />}
                                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="font-medium">{a.siteName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Clients section */}
                  {tabConsultants.length > 0 && tabClients.length > 0 && <div className="border-t" />}
                  {tabClients.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-muted/40 border-b">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Clients ({tabClients.length})
                        </p>
                      </div>
                      <div className="divide-y">
                        {tabClients.map((u) => {
                          const isExpanded = expandedUserId === u.id;
                          const clientSites = u.siteAssignments || [];
                          const isPrimary = company?.contactUserId === u.id;
                          const isGroupPrimaryContact = !isPrimary &&
                            u.companyId !== companyId &&
                            !!groupOwnerCompany?.contactUserId &&
                            groupOwnerCompany.contactUserId === u.id;
                          return (
                            <div key={u.id} data-testid={`row-client-${u.id}`}>
                              <div className="flex items-center gap-4 px-4 py-3">
                                <button
                                  className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity min-w-0 flex-1"
                                  onClick={() => setViewingUser(u)}
                                  data-testid={`button-view-client-${u.id}`}
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                    {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium truncate hover:underline underline-offset-2">{u.fullName}</span>
                                      {isPrimary && (
                                        <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shrink-0">
                                          Primary Contact
                                        </Badge>
                                      )}
                                      {!isPrimary && companyKeyContactIds.has(u.id) && (
                                        <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 shrink-0" data-testid={`badge-key-contact-company-${u.id}`}>
                                          Key Contact
                                        </Badge>
                                      )}
                                      {!isPrimary && u.companyId !== companyId && groupOwnerKeyContactIds.has(u.id) && (
                                        <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-700 shrink-0" data-testid={`badge-key-contact-group-owner-${u.id}`}>
                                          Key Contact
                                        </Badge>
                                      )}
                                      {isGroupPrimaryContact && (
                                        <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 shrink-0" data-testid={`badge-group-primary-contact-${u.id}`}>
                                          Group Primary Contact
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  {u.companyId === companyId && isAdmin && (u.status === "invite_required" || u.status === "invited") ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setInviteConfirmUser(u)}
                                      className={
                                        u.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30" :
                                        u.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" : ""
                                      }
                                      data-testid={`button-send-invite-${u.id}`}
                                    >
                                      {u.status === "active" ? (
                                        <><UserCheck className="h-3 w-3 mr-1" />Active</>
                                      ) : u.status === "invited" ? (
                                        <><Clock className="h-3 w-3 mr-1" />Invited</>
                                      ) : u.status === "invite_required" ? (
                                        <><Mail className="h-3 w-3 mr-1" />Invite Required</>
                                      ) : u.status === "site_required" ? (
                                        <><AlertTriangle className="h-3 w-3 mr-1" />Site Required</>
                                      ) : u.status === "locked" ? (
                                        <><XCircle className="h-3 w-3 mr-1" />Locked</>
                                      ) : (
                                        <><XCircle className="h-3 w-3 mr-1" />Inactive</>
                                      )}
                                    </Button>
                                  ) : (
                                    <Badge
                                      variant={u.status === "active" ? "default" : "outline"}
                                      className={
                                        u.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400" :
                                        u.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400" :
                                        u.status === "site_required" ? "border-orange-500 text-orange-600 dark:text-orange-400" :
                                        u.status === "locked" ? "border-red-500 text-red-600 dark:text-red-400" : ""
                                      }
                                    >
                                      {u.status === "active" ? (
                                        <><UserCheck className="h-3 w-3 mr-1" />Active</>
                                      ) : u.status === "invited" ? (
                                        <><Clock className="h-3 w-3 mr-1" />Invited</>
                                      ) : u.status === "invite_required" ? (
                                        <><Mail className="h-3 w-3 mr-1" />Invite Required</>
                                      ) : u.status === "site_required" ? (
                                        <><AlertTriangle className="h-3 w-3 mr-1" />Site Required</>
                                      ) : u.status === "locked" ? (
                                        <><XCircle className="h-3 w-3 mr-1" />Locked</>
                                      ) : (
                                        <><XCircle className="h-3 w-3 mr-1" />Inactive</>
                                      )}
                                    </Badge>
                                  )}
                                  {!isPrimary && (isAdmin || isProConsultant) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`h-7 px-2 text-xs ${companyKeyContactIds.has(u.id) ? "text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => {
                                        if (companyKeyContactIds.has(u.id)) {
                                          removeKeyContactMutation.mutate({ userId: u.id, entityType: "company", entityId: companyId! });
                                        } else {
                                          addKeyContactMutation.mutate({ userId: u.id, entityType: "company", entityId: companyId! });
                                        }
                                      }}
                                      disabled={addKeyContactMutation.isPending || removeKeyContactMutation.isPending}
                                      data-testid={`button-key-contact-company-${u.id}`}
                                    >
                                      {companyKeyContactIds.has(u.id) ? "Remove Key Contact" : "Set as Key Contact"}
                                    </Button>
                                  )}
                                  {clientSites.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                      data-testid={`button-expand-user-${u.id}`}
                                    >
                                      <span className="font-medium">{clientSites.length} {clientSites.length === 1 ? "site" : "sites"}</span>
                                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">No sites</span>
                                  )}
                                </div>
                              </div>
                              {isExpanded && clientSites.length > 0 && (
                                <div className="px-4 pb-3 bg-muted/30 border-t">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 mt-2 uppercase tracking-wide">Site Access</p>
                                  <div className="flex flex-wrap gap-2">
                                    {clientSites.map(a => (
                                      <div key={a.siteId} className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-2.5 py-1.5">
                                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="font-medium">{a.siteName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-base font-medium">No users</h3>
                    <p className="mt-1 text-sm text-muted-foreground text-center">
                      No client users or consultants are currently assigned to this company
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={handleEditDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the company details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Company Name <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Enter company name"
                  data-testid="input-edit-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-company-number">Registered Company Number</Label>
                <Input
                  id="edit-company-number"
                  value={editForm.companyNumber}
                  onChange={(e) => setEditForm({ ...editForm, companyNumber: e.target.value })}
                  placeholder="e.g., 12345678"
                  data-testid="input-edit-company-number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-internal-company-number">Internal Company Number</Label>
                <Input
                  id="edit-internal-company-number"
                  value={editForm.internalCompanyNumber}
                  onChange={(e) => setEditForm({ ...editForm, internalCompanyNumber: e.target.value })}
                  placeholder="e.g., INT-001"
                  data-testid="input-edit-internal-company-number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                type="url"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://www.example.com"
                data-testid="input-edit-company-website"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-industry">Industry <span className="text-destructive">*</span></Label>
              <Select
                value={editForm.industry || undefined}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, industry: v }))}
              >
                <SelectTrigger id="edit-industry" data-testid="select-edit-industry">
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-employee-range">Number of Employees</Label>
              <Select
                value={editForm.employeeRange || undefined}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, employeeRange: v }))}
              >
                <SelectTrigger id="edit-employee-range" data-testid="select-edit-employee-range">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_RANGES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-search-tag">Search Tag</Label>
              <Input
                id="edit-search-tag"
                value={editForm.searchTag}
                onChange={(e) => setEditForm({ ...editForm, searchTag: e.target.value })}
                placeholder="e.g., site ID, keyword, or reference"
                data-testid="input-edit-company-search-tag"
              />
              <p className="text-xs text-muted-foreground">Used to find this company in dashboard search</p>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-address-line1"
                    value={editForm.addressLine1}
                    onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                    placeholder="Street address"
                    data-testid="input-edit-company-address-line1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address-line2">Address Line 2</Label>
                  <Input
                    id="edit-address-line2"
                    value={editForm.addressLine2}
                    onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-edit-company-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="edit-city"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-edit-company-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={editForm.country || ""}
                      onValueChange={(value) => setEditForm({ ...editForm, country: value, county: "" })}
                    >
                      <SelectTrigger id="edit-country" data-testid="select-edit-company-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={editForm.county || ""}
                      onValueChange={(value) => setEditForm({ ...editForm, county: value })}
                      disabled={!editForm.country}
                    >
                      <SelectTrigger id="edit-county" data-testid="select-edit-company-county">
                        <SelectValue placeholder={editForm.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[editForm.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-postal-code">Postal Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="edit-postal-code"
                      value={editForm.postalCode}
                      onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                      placeholder={editForm.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-edit-company-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

            {availableSources.length > 0 && !company?.isGroupOwner && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-1">Sources <span className="text-destructive">*</span></h4>
                <p className="text-xs text-muted-foreground mb-3">Select which brand sources are associated with this company. At least one source is required.</p>
                <div className="flex flex-wrap gap-2">
                  {availableSources.filter(s => s.isActive && (!isProConsultant || user?.sources?.includes(s.code))).map((source) => {
                    const selected = editForm.sources.includes(source.code);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => {
                          const updated = selected
                            ? editForm.sources.filter((c) => c !== source.code)
                            : [...editForm.sources, source.code];
                          setEditForm({ ...editForm, sources: updated });
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                        data-testid={`button-edit-source-${source.code}`}
                      >
                        {source.code}
                        <span className="text-[10px] opacity-70">{source.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Primary Contact (Optional)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Select a registered user from this company to be the primary contact.
              </p>
              
              {companyUsers.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-contact-user">Select Contact</Label>
                    <Select
                      value={editForm.contactUserId || "none"}
                      onValueChange={handleSelectCompanyContactUser}
                    >
                      <SelectTrigger id="edit-contact-user" data-testid="select-company-contact-user">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact selected</SelectItem>
                        {companyUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName} {u.jobTitle ? `- ${u.jobTitle}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.contactUserId && (
                    <div className="rounded-md border p-3 bg-muted/50">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">Contact Details (from user profile)</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          <span className="font-medium">{editForm.contactName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>{" "}
                          <span className="font-medium">{editForm.contactPosition || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>{" "}
                          <span className="font-medium">{editForm.contactPhone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium">{editForm.contactEmail || "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <UserIcon className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No users available in this company yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can add users in the <strong>Users</strong> section and then assign them as the primary contact.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value: "active" | "cancelled" | "pending") => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger id="edit-status" data-testid="select-edit-company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                data-testid="button-cancel-edit-company"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateCompanyMutation.isPending}
                data-testid="button-save-company"
              >
                {updateCompanyMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsavedChangesOpen} onOpenChange={setUnsavedChangesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them before leaving, or discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setUnsavedChangesOpen(false);
                setEditFormOriginal(null);
                setEditDialogOpen(false);
              }}
            >
              Discard Changes
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUnsavedChangesOpen(false);
                submitEditForm();
              }}
              disabled={updateCompanyMutation.isPending}
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToUnlink} onOpenChange={(open) => { if (!open) setMemberToUnlink(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink <strong>{memberToUnlink?.name}</strong> from this group? This will revoke the company's access to shared group data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-unlink-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-unlink-confirm"
              onClick={() => {
                if (!memberToUnlink) return;
                apiRequest("PATCH", `/api/companies/${memberToUnlink.id}/group-owner`, { groupOwnerId: null })
                  .then(() => {
                    // Invalidate the group owner's data (current page)
                    queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/companies"], refetchType: "all" });
                    // Invalidate the unlinked member's data so its compliance totals update
                    queryClient.invalidateQueries({ queryKey: ["/api/companies", memberToUnlink.id], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/companies", memberToUnlink.id, "required-templates"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/sites"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids"], refetchType: "all" });
                    queryClient.invalidateQueries({ queryKey: ["/api/required-template-ids-by-company"], refetchType: "all" });
                    toast({ title: `${memberToUnlink.name} unlinked from Group Owner` });
                    setMemberToUnlink(null);
                  })
                  .catch(() => {
                    toast({ title: "Failed to unlink company", variant: "destructive" });
                    setMemberToUnlink(null);
                  });
              }}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addSiteDialogOpen} onOpenChange={setAddSiteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              Add a new site location to this company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSiteSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-site-name">Site Name <span className="text-destructive">*</span></Label>
              <Input
                id="new-site-name"
                value={newSiteForm.name}
                onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                placeholder="e.g., Main Office, Warehouse, Factory"
                data-testid="input-new-site-name"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-site-address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="new-site-address-line1"
                    value={newSiteForm.addressLine1}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, addressLine1: e.target.value })}
                    placeholder="Street address"
                    data-testid="input-new-site-address-line1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-site-address-line2">Address Line 2</Label>
                  <Input
                    id="new-site-address-line2"
                    value={newSiteForm.addressLine2}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, addressLine2: e.target.value })}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-new-site-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-site-city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="new-site-city"
                      value={newSiteForm.city}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-new-site-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-site-country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={newSiteForm.country || ""}
                      onValueChange={(value) => setNewSiteForm({ ...newSiteForm, country: value, county: "" })}
                    >
                      <SelectTrigger id="new-site-country" data-testid="select-new-site-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-site-county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={newSiteForm.county || ""}
                      onValueChange={(value) => setNewSiteForm({ ...newSiteForm, county: value })}
                      disabled={!newSiteForm.country}
                    >
                      <SelectTrigger id="new-site-county" data-testid="select-new-site-county">
                        <SelectValue placeholder={newSiteForm.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[newSiteForm.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-site-postalCode">Postal Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="new-site-postalCode"
                      value={newSiteForm.postalCode}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, postalCode: e.target.value })}
                      placeholder={newSiteForm.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-new-site-postalCode"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-1">Site Management</h4>
              <p className="text-sm text-muted-foreground mb-3">
                The company's primary contact is automatically assigned. You can also add other users to manage this site.
              </p>

              {/* Company primary contact — read-only */}
              {(() => {
                const linkedUser = company?.contactUserId ? companyUsers.find(u => u.id === company.contactUserId) : null;
                const displayName = company?.contactName || linkedUser?.fullName;
                const displayPosition = company?.contactPosition || linkedUser?.jobTitle;
                const displayEmail = company?.contactEmail || linkedUser?.email;
                const displayPhone = company?.contactPhone || linkedUser?.phone || linkedUser?.mobile;
                return (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Company Primary Contact</p>
                    {displayName ? (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-start gap-3">
                        <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{displayName}</p>
                          {displayPosition && <p className="text-muted-foreground text-xs">{displayPosition}</p>}
                          <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-muted-foreground">
                            {displayEmail && <span>{displayEmail}</span>}
                            {displayPhone && <span>{displayPhone}</span>}
                          </div>
                          <p className="text-xs text-primary mt-1">Will be automatically assigned to this site</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
                        No primary contact set for this company.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Additional users */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Additional Users</p>
                {companyUsers.filter(u => u.id !== company?.contactUserId).length > 0 ? (
                  <div className="rounded-md border divide-y max-h-40 overflow-y-auto">
                    {companyUsers
                      .filter(u => u.id !== company?.contactUserId)
                      .map((u) => {
                        const checked = newSiteForm.additionalUserIds.includes(u.id);
                        return (
                          <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={checked}
                              data-testid={`checkbox-site-user-${u.id}`}
                              onChange={() => {
                                setNewSiteForm(prev => ({
                                  ...prev,
                                  additionalUserIds: checked
                                    ? prev.additionalUserIds.filter(id => id !== u.id)
                                    : [...prev.additionalUserIds, u.id],
                                }));
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">{u.fullName}</p>
                              {u.jobTitle && <p className="text-xs text-muted-foreground">{u.jobTitle}</p>}
                            </div>
                          </label>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No other users in this company.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddSiteDialogOpen(false)}
                data-testid="button-cancel-add-site"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSiteMutation.isPending}
                data-testid="button-save-new-site"
              >
                {createSiteMutation.isPending ? "Creating..." : "Add Site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Consultant to Sites dialog */}
      <Dialog open={assignConsultantOpen} onOpenChange={(v) => {
        setAssignConsultantOpen(v);
        if (!v) {
          setAssignConsultantId("");
          setConsultantSiteSelections({});
          setOriginalConsultantSites(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Assign Consultant to Sites</DialogTitle>
            <DialogDescription>
              Select a consultant, then choose which sites they should have access to. Ticked sites are already assigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Consultant</Label>
              <Select value={assignConsultantId} onValueChange={handleConsultantSelect}>
                <SelectTrigger data-testid="select-assign-consultant">
                  <SelectValue placeholder="Select a consultant…" />
                </SelectTrigger>
                <SelectContent>
                  {allConsultants.map((c) => (
                    <SelectItem key={c.id} value={c.id} data-testid={`option-consultant-${c.id}`}>
                      <span>{c.fullName}</span>
                      {c.consultantTier && (
                        <span className="ml-2 text-xs text-muted-foreground capitalize">({c.consultantTier})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignConsultantId && (
              <div className="space-y-1.5">
                <Label>Sites</Label>
                {(company?.sites || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">This company has no sites yet.</p>
                ) : (
                  <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                    {(company?.sites || []).map((site: SiteWithDetails) => {
                      const checked = !!consultantSiteSelections[site.id];
                      return (
                        <label
                          key={site.id}
                          htmlFor={`site-check-${site.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                          data-testid={`label-site-assignment-${site.id}`}
                        >
                          <input
                            id={`site-check-${site.id}`}
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setConsultantSiteSelections((prev) => ({ ...prev, [site.id]: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-border accent-primary"
                            data-testid={`checkbox-site-${site.id}`}
                          />
                          <span className="flex-1 text-sm font-medium">{site.name}</span>
                          {checked && originalConsultantSites.has(site.id) && (
                            <span className="text-xs text-muted-foreground">Already assigned</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignConsultantOpen(false)} data-testid="button-cancel-assign-consultant">
              Cancel
            </Button>
            <Button
              onClick={handleSaveConsultantAssignments}
              disabled={!assignConsultantId || savingConsultantAssignments}
              data-testid="button-save-consultant-assignments"
            >
              {savingConsultantAssignments ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Primary Contact dialog */}
      <Dialog open={changePrimaryContactOpen} onOpenChange={v => { setChangePrimaryContactOpen(v); if (!v) setSelectedNewContactId(""); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Change Primary Contact</DialogTitle>
            <DialogDescription>
              Select a registered user from this company to be the primary contact.
            </DialogDescription>
          </DialogHeader>
          {company?.contactName && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-start gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{company.contactName}</p>
                <p className="text-xs text-muted-foreground">Current primary contact</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Select new contact</Label>
            <Select value={selectedNewContactId || "none"} onValueChange={v => setSelectedNewContactId(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-new-primary-contact">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {companyUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}{u.jobTitle ? ` — ${u.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePrimaryContactOpen(false)}>Cancel</Button>
            <Button
              onClick={handleChangePrimaryContactSave}
              disabled={changePrimaryContactMutation.isPending}
              data-testid="button-save-primary-contact"
            >
              {changePrimaryContactMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Primary contact conflict dialog */}
      <AlertDialog open={!!primaryContactConflict} onOpenChange={v => { if (!v) setPrimaryContactConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existing Primary Contact</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <strong>{primaryContactConflict?.oldUserName}</strong> is currently the primary contact.
                  What would you like to do with their site access?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPrimaryContactConflict(null)}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleConflictResolve(false)}
              disabled={changePrimaryContactMutation.isPending}
              data-testid="button-keep-site-access"
            >
              Keep site access
            </Button>
            <AlertDialogAction
              onClick={() => handleConflictResolve(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-remove-site-access"
            >
              Remove all site access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Profile Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => { if (!open) setViewingUser(null); }}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Full profile information and activity history</DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-medium shrink-0">
                  {viewingUser.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewingUser.fullName}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant="outline" className={roleColors[viewingUser.role]}>
                      {roleLabels[viewingUser.role]}
                    </Badge>
                    {viewingUser.referenceNumber && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {viewingUser.referenceNumber}
                      </Badge>
                    )}
                    <Badge
                      variant={viewingUser.status === "active" ? "default" : "outline"}
                      className={
                        viewingUser.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400" :
                        viewingUser.status === "invite_required" ? "border-blue-500 text-blue-600 dark:text-blue-400" :
                        viewingUser.status === "site_required" ? "border-orange-500 text-orange-600 dark:text-orange-400" :
                        viewingUser.status === "locked" ? "border-red-500 text-red-600 dark:text-red-400" : ""
                      }
                    >
                      {viewingUser.status === "site_required" ? "Site Required" :
                       viewingUser.status === "invite_required" ? "Invite Required" :
                       viewingUser.status.charAt(0).toUpperCase() + viewingUser.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{viewingUser.email}</span>
                  </div>
                  {viewingUser.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingUser.phone}</span>
                    </div>
                  )}
                  {viewingUser.mobile && (
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span>{viewingUser.mobile}</span>
                    </div>
                  )}
                </div>
              </div>

              {(viewingUser.jobTitle || viewingUser.department) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Work Information</h4>
                  <div className="grid gap-2">
                    {viewingUser.jobTitle && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingUser.jobTitle}</span>
                      </div>
                    )}
                    {viewingUser.department && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{viewingUser.department}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingUser.siteAssignments && viewingUser.siteAssignments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Assigned Sites</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingUser.siteAssignments.map((a) => (
                      <Badge key={a.siteId} variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {a.siteName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Log */}
              {(() => {
                const EXCLUDED = ["login", "logout", "login_failed"];
                const filteredLogs = userActivityLogs.filter((l: any) => !EXCLUDED.includes(l.action));
                function getIconProps(action: string) {
                  switch (action) {
                    case "email_sent": return { icon: <Send className="h-3.5 w-3.5" />, bg: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
                    case "document_uploaded": return { icon: <FileText className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    case "document_approved": case "document_signed_off": return { icon: <CheckCircle className="h-3.5 w-3.5" />, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                    case "document_rejected": return { icon: <XCircle className="h-3.5 w-3.5" />, bg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
                    case "changes_requested": return { icon: <RotateCcw className="h-3.5 w-3.5" />, bg: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" };
                    case "user_activated": return { icon: <UserCheck className="h-3.5 w-3.5" />, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                    case "comment_added": return { icon: <MessageSquare className="h-3.5 w-3.5" />, bg: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" };
                    case "password_change": case "password_changed": case "password_reset": return { icon: <LockKeyhole className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    case "document_viewed": case "document_downloaded": return { icon: <Eye className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                    case "company_suspended": return { icon: <Ban className="h-3.5 w-3.5" />, bg: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
                    case "company_reactivated": return { icon: <CheckCircle className="h-3.5 w-3.5" />, bg: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                    default: return { icon: <Activity className="h-3.5 w-3.5" />, bg: "bg-muted text-muted-foreground" };
                  }
                }
                function getTimeLabel(createdAt: Date) {
                  const diffMs = Date.now() - createdAt.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);
                  if (diffMins < 1) return "Just now";
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffHours < 24) return `${diffHours}h ago`;
                  if (diffDays === 1) return "Yesterday";
                  if (diffDays < 7) return `${diffDays}d ago`;
                  return createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                }
                return (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Activity Log
                    </h4>
                    {isActivityLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3 items-start">
                            <div className="h-7 w-7 rounded-full bg-muted animate-pulse flex-shrink-0" />
                            <div className="flex-1 space-y-1.5 py-0.5">
                              <div className="h-3.5 bg-muted animate-pulse rounded w-3/4" />
                              <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">No activity recorded yet.</p>
                    ) : (
                      <div className="overflow-y-auto max-h-56 space-y-1 border rounded-md p-2 bg-muted/20">
                        {filteredLogs.slice(0, 50).map((log: any) => {
                          const { icon, bg } = getIconProps(log.action);
                          const isActor = log.userId === viewingUser.id;
                          const createdAt = new Date(log.createdAt);
                          return (
                            <div key={log.id} className="flex gap-2.5 items-start py-1.5 border-b border-border/50 last:border-0">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${bg}`}>
                                {icon}
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-sm leading-snug">
                                  {log.details || log.action}
                                  {!isActor && log.userName && (
                                    <span className="text-muted-foreground"> — by {log.userName}</span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5" title={createdAt.toLocaleString()}>
                                  {getTimeLabel(createdAt)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {filteredLogs.length > 50 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">
                            + {filteredLogs.length - 50} more events not shown
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invite Confirmation Dialog */}
      <Dialog open={!!inviteConfirmUser} onOpenChange={(open) => { if (!open) setInviteConfirmUser(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Send Invitation
            </DialogTitle>
            <DialogDescription>
              This will send an invitation email to the user so they can set up their account and log in.
            </DialogDescription>
          </DialogHeader>
          {inviteConfirmUser && (
            <div className="py-2 space-y-3">
              <div className="rounded-lg bg-muted/60 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{inviteConfirmUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{inviteConfirmUser.email}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to send an invitation to this user?
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteConfirmUser(null)} data-testid="button-cancel-invite">Cancel</Button>
            <Button
              onClick={() => {
                if (inviteConfirmUser) {
                  resendInviteMutation.mutate(inviteConfirmUser.id, {
                    onSuccess: () => setInviteConfirmUser(null),
                    onError: () => setInviteConfirmUser(null),
                  });
                }
              }}
              disabled={resendInviteMutation.isPending}
              data-testid="button-confirm-send-invite"
            >
              {resendInviteMutation.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {AddressSyncDialog}

      <CreateClientUserDialog
        open={showCreateClientUser}
        onOpenChange={setShowCreateClientUser}
        companyId={companyId!}
        companyName={company?.name}
        companyWebsite={company?.website}
        companySites={(company?.sites ?? []).map((s: SiteWithDetails) => ({ id: s.id, name: s.name }))}
        onCreated={() => { queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] }); }}
      />

      </div>
    </div>
  );
}
