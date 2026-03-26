import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Users,
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Company, SiteWithDetails, ComplianceSummary, User, CompanyRequiredTemplate } from "@shared/schema";

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
  support: boolean;
  reports: boolean;
}

type CompanyWithSites = Company & {
  sites: SiteWithDetails[];
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
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

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
                    {[site.addressLine1, site.city, site.postalCode].filter(Boolean).join(", ")}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleAccessCard({ companyId }: { companyId: string }) {
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

  const handleToggle = (module: keyof CompanyModuleAccess, enabled: boolean) => {
    updateMutation.mutate({ [module]: enabled });
  };

  const modules = [
    { key: "healthSafety" as const, label: "Health & Safety", icon: Shield, color: "text-emerald-600 dark:text-emerald-400" },
    { key: "humanResources" as const, label: "Human Resources", icon: Heart, color: "text-blue-600 dark:text-blue-400" },
    { key: "employmentLaw" as const, label: "Employment Law", icon: Briefcase, color: "text-purple-600 dark:text-purple-400" },
    { key: "support" as const, label: "Support", icon: HelpCircle, color: "text-orange-600 dark:text-orange-400" },
    { key: "reports" as const, label: "Reports", icon: FileText, color: "text-slate-600 dark:text-slate-400" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          Enable or disable modules for this company. Changes apply to all sites and users.
        </p>
        {modules.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <Label htmlFor={`module-${key}`} className="font-medium">{label}</Label>
            </div>
            <Switch
              id={`module-${key}`}
              checked={moduleAccess?.[key] ?? false}
              onCheckedChange={(checked) => handleToggle(key, checked)}
              disabled={!isAdmin || updateMutation.isPending}
              data-testid={`switch-module-${key}`}
            />
          </div>
        ))}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground mt-4">
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

const MODULE_ICON: Record<string, typeof Shield> = {
  health_safety: Shield,
  human_resources: Users,
  employment_law: Briefcase,
};

const MODULE_COLOR: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

function RequiredDocumentsCard({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);

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
    .filter(([, { key }]) => moduleAccess?.[key])
    .map(([mod]) => mod);

  const requiredIds = new Set(requiredTemplates.map(rt => rt.templateId));
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "required-templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
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

  const availableToAdd = allTemplates.filter(t => {
    if (!t.isActive || t.visibility !== "private") return false;
    if (requiredIds.has(t.id)) return false;
    return true;
  });

  const filteredAvailable = availableToAdd.filter(t => {
    if (moduleFilter && t.module !== moduleFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isPending = addMutation.isPending || removeMutation.isPending;

  if (requiredLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </CardContent>
        </Card>
      </div>
    );
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
        <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) { setSearch(""); setModuleFilter(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-requirement">
              <Plus className="mr-2 h-4 w-4" />
              Add Requirement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Required Document</DialogTitle>
              <DialogDescription>
                Choose a document template to require across all sites. This will count towards each site's compliance score until the document is uploaded. Sites can individually override this requirement.
              </DialogDescription>
            </DialogHeader>
            {enabledModules.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                <button
                  onClick={() => setModuleFilter(null)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${moduleFilter === null ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}
                  data-testid="filter-module-all"
                >
                  All
                </button>
                {enabledModules.map(mod => {
                  const ModIcon = MODULE_ICON[mod] || FileText;
                  const isActive = moduleFilter === mod;
                  return (
                    <button
                      key={mod}
                      onClick={() => setModuleFilter(isActive ? null : mod)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${isActive ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}
                      data-testid={`filter-module-${mod}`}
                    >
                      <ModIcon className="h-3 w-3" />
                      {MODULE_LABELS[mod] || mod}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-template-search-add"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {filteredAvailable.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No templates available</p>
              ) : filteredAvailable.map(t => {
                const ModIcon = MODULE_ICON[t.module] || FileText;
                return (
                  <button
                    key={t.id}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted transition-colors"
                    onClick={() => addMutation.mutate(t.id)}
                    disabled={isPending}
                    data-testid={`option-template-${t.id}`}
                  >
                    <ModIcon className={`h-4 w-4 shrink-0 ${MODULE_COLOR[t.module] || "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{MODULE_LABELS[t.module] || t.module}</p>
                    </div>
                  </button>
                );
              })}
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
              {[...requiredIds].map(templateId => {
                const tmpl = templateMap.get(templateId);
                if (!tmpl) return null;
                const ModIcon = MODULE_ICON[tmpl.module] || FileText;
                return (
                  <div key={templateId} className="flex items-center gap-3 px-4 py-3" data-testid={`row-required-${templateId}`}>
                    <div className="p-1.5 rounded-md bg-muted shrink-0">
                      <ModIcon className={`h-4 w-4 ${MODULE_COLOR[tmpl.module] || ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tmpl.name}</p>
                      <p className={`text-xs ${MODULE_COLOR[tmpl.module] || "text-muted-foreground"}`}>
                        {MODULE_LABELS[tmpl.module] || tmpl.module}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate(templateId)}
                      disabled={isPending}
                      title="Remove requirement"
                      data-testid={`button-remove-requirement-${templateId}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormOriginal, setEditFormOriginal] = useState<Record<string, string> | null>(null);
  const [unsavedChangesOpen, setUnsavedChangesOpen] = useState(false);
  const [addSiteDialogOpen, setAddSiteDialogOpen] = useState(false);
  const [changePrimaryContactOpen, setChangePrimaryContactOpen] = useState(false);
  const [selectedNewContactId, setSelectedNewContactId] = useState("");
  const [primaryContactConflict, setPrimaryContactConflict] = useState<{
    oldUserId: string;
    oldUserName: string;
    newUserId: string;
  } | null>(null);
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
    status: "active" as "active" | "inactive" | "pending",
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
      const response = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch company");
      return response.json();
    },
    enabled: !!companyId,
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

  // Filter to get only client users from this company (used for contact dropdowns)
  const companyUsers = allUsers.filter(
    (u) => u.role === "client" && u.companyId === companyId && u.status !== "inactive"
  );

  // All users tab: clients in this company + non-pro consultants assigned to any of this company's sites
  const companySiteIds = new Set((company?.sites || []).map((s: SiteWithDetails) => s.id));
  const tabConsultants = allUsers.filter(u =>
    u.role === "consultant" &&
    u.consultantTier !== "pro" &&
    (u.siteAssignments || []).some(a => companySiteIds.has(a.siteId))
  );
  const tabClients = allUsers.filter(u => u.role === "client" && u.companyId === companyId);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditFormOriginal(null);
      setEditDialogOpen(false);
      setUnsavedChangesOpen(false);
      toast({
        title: "Company updated",
        description: "The company details have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update company. Please try again.",
        variant: "destructive",
      });
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

  const openEditDialog = () => {
    if (company) {
      // Try to find the user whose details match the current contact
      const matchingUser = companyUsers.find(
        (u) => u.email === company.contactEmail || u.fullName === company.contactName
      );
      const initial = {
        name: company.name || "",
        companyNumber: company.companyNumber || "",
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
      };
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
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
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
        acc.reviewRequired += site.complianceSummary.reviewRequired;
        acc.overdueDocuments += site.complianceSummary.overdueDocuments;
      }
      return acc;
    },
    { totalDocuments: 0, compliantDocuments: 0, reviewRequired: 0, overdueDocuments: 0 }
  );

  const complianceScore = aggregatedCompliance.totalDocuments > 0
    ? Math.round((aggregatedCompliance.compliantDocuments / aggregatedCompliance.totalDocuments) * 100)
    : 0;

  return (
    <div className="space-y-6 p-8 dash-animate">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/companies")} data-testid="button-back">
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
                <p className="text-sm text-muted-foreground">Company No: {company.companyNumber}</p>
              )}
              {company.searchTag && (isAdmin || user?.role === "consultant") && (
                <p className="text-sm text-muted-foreground">Search Tag: {company.searchTag}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={company.status === "active" ? "default" : "secondary"}>
            {company.status}
          </Badge>
          {isAdmin && (
            <Button onClick={openEditDialog} data-testid="button-edit-company">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Company
            </Button>
          )}
        </div>
      </div>

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
                    <div className="space-y-1.5 text-sm">
                      {company.contactName && (
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{company.contactName}{company.contactPosition && ` - ${company.contactPosition}`}</span>
                        </div>
                      )}
                      {company.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{company.contactPhone}</span>
                        </div>
                      )}
                      {company.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{company.contactEmail}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No primary contact set</p>
                  )}
                </div>
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
          <ModuleAccessCard companyId={companyId!} />
        </TabsContent>

        {/* Required Documents Tab */}
        {(isAdmin || user?.role === "consultant") && (
          <TabsContent value="required-documents" className="mt-6">
            <RequiredDocumentsCard companyId={companyId!} />
          </TabsContent>
        )}

        {/* Sites Tab */}
        <TabsContent value="sites" className="mt-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sites ({sites.length})</h2>
              {isAdmin && (
                <Button size="sm" onClick={() => setAddSiteDialogOpen(true)} data-testid="button-add-site">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Site
                </Button>
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
                  {isAdmin && (
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
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                  {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block">{u.fullName}</span>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                                    {u.consultantTier ? (u.consultantTier.charAt(0).toUpperCase() + u.consultantTier.slice(1)) : "Standard"}
                                  </Badge>
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
                          return (
                            <div key={u.id} data-testid={`row-client-${u.id}`}>
                              <div className="flex items-center gap-4 px-4 py-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                  {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium truncate">{u.fullName}</span>
                                    {isPrimary && (
                                      <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shrink-0">
                                        Primary Contact
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
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
                <Label htmlFor="edit-company-number">Company Number</Label>
                <Input
                  id="edit-company-number"
                  value={editForm.companyNumber}
                  onChange={(e) => setEditForm({ ...editForm, companyNumber: e.target.value })}
                  placeholder="e.g., 12345678"
                  data-testid="input-edit-company-number"
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
                onValueChange={(value: "active" | "inactive" | "pending") => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger id="edit-status" data-testid="select-edit-company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
    </div>
  );
}
