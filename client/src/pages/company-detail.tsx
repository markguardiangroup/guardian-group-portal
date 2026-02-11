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
} from "@/components/ui/dialog";
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
} from "lucide-react";
import type { Company, SiteWithDetails, ComplianceSummary, User } from "@shared/schema";

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

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addSiteDialogOpen, setAddSiteDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    companyNumber: "",
    website: "",
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
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    contactUserId: "", // ID of selected user for contact
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
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!companyId,
  });

  // Filter to get only client users from this company
  const companyUsers = allUsers.filter(
    (u) => u.role === "client" && u.companyId === companyId && u.status !== "inactive"
  );

  // Handler to select a user as site contact
  const handleSelectSiteContactUser = (userId: string) => {
    if (userId === "none") {
      // Clear contact fields
      setNewSiteForm({
        ...newSiteForm,
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
      setNewSiteForm({
        ...newSiteForm,
        contactUserId: userId,
        contactName: selectedUser.fullName || "",
        contactPosition: selectedUser.jobTitle || "",
        contactPhone: selectedUser.phone || selectedUser.mobile || "",
        contactEmail: selectedUser.email || "",
      });
    }
  };

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
    navigate(`/sites/${siteId}`);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const response = await apiRequest("PATCH", `/api/companies/${companyId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditDialogOpen(false);
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

  const createSiteMutation = useMutation({
    mutationFn: async (data: typeof newSiteForm) => {
      const response = await apiRequest("POST", "/api/sites", { ...data, companyId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setAddSiteDialogOpen(false);
      setNewSiteForm({
        name: "",
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
      toast({
        title: "Validation error",
        description: "Site name is required.",
        variant: "destructive",
      });
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
      setEditForm({
        name: company.name || "",
        companyNumber: company.companyNumber || "",
        website: company.website || "",
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
        status: company.status || "active",
      });
      setEditDialogOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast({
        title: "Validation error",
        description: "Company name is required.",
        variant: "destructive",
      });
      return;
    }
    updateCompanyMutation.mutate(editForm);
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
    <div className="space-y-6 p-8">
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {company.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {company.website}
                </a>
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
            {(company.contactName || company.contactPhone || company.contactEmail) && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Primary Contact</p>
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
              </div>
            )}
            {!company.addressLine1 && !company.city && !company.contactName && !company.contactPhone && !company.contactEmail && (
              <p className="text-sm text-muted-foreground">No contact details available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {aggregatedCompliance.totalDocuments > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Compliance</span>
                  <span className="text-sm text-muted-foreground">{complianceScore}%</span>
                </div>
                <Progress value={complianceScore} className="h-2 mb-4" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xl font-semibold">{aggregatedCompliance.totalDocuments}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                      {aggregatedCompliance.compliantDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Compliant</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {aggregatedCompliance.reviewRequired}
                    </p>
                    <p className="text-xs text-muted-foreground">Review</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                      {aggregatedCompliance.overdueDocuments}
                    </p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No compliance data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ModuleAccessCard companyId={companyId!} />

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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
                <Label htmlFor="edit-name">Company Name *</Label>
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

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-address-line1">Address Line 1</Label>
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
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-edit-company-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-county">County</Label>
                    <Input
                      id="edit-county"
                      value={editForm.county}
                      onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-edit-company-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-postal-code">Postal Code</Label>
                    <Input
                      id="edit-postal-code"
                      value={editForm.postalCode}
                      onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                      placeholder="Postal code"
                      data-testid="input-edit-company-postal-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input
                      id="edit-country"
                      value={editForm.country}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-edit-company-country"
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
              <Label htmlFor="new-site-name">Site Name *</Label>
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
                  <Label htmlFor="new-site-address-line1">Address Line 1</Label>
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
                    <Label htmlFor="new-site-city">City</Label>
                    <Input
                      id="new-site-city"
                      value={newSiteForm.city}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-new-site-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-site-county">County</Label>
                    <Input
                      id="new-site-county"
                      value={newSiteForm.county}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-new-site-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-site-postalCode">Postal Code</Label>
                    <Input
                      id="new-site-postalCode"
                      value={newSiteForm.postalCode}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, postalCode: e.target.value })}
                      placeholder="Postal Code"
                      data-testid="input-new-site-postalCode"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-site-country">Country</Label>
                    <Input
                      id="new-site-country"
                      value={newSiteForm.country}
                      onChange={(e) => setNewSiteForm({ ...newSiteForm, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-new-site-country"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Primary Site Contact (Optional)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Select a registered user from this company to be the primary contact for this site.
              </p>
              
              {companyUsers.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-site-contact-user">Select Contact</Label>
                    <Select
                      value={newSiteForm.contactUserId || "none"}
                      onValueChange={handleSelectSiteContactUser}
                    >
                      <SelectTrigger id="new-site-contact-user" data-testid="select-site-contact-user">
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

                  {newSiteForm.contactUserId && (
                    <div className="rounded-md border p-3 bg-muted/50">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">Contact Details (from user profile)</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          <span className="font-medium">{newSiteForm.contactName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>{" "}
                          <span className="font-medium">{newSiteForm.contactPosition || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>{" "}
                          <span className="font-medium">{newSiteForm.contactPhone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium">{newSiteForm.contactEmail || "—"}</span>
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
                    You can add users in the <strong>Users</strong> section and then assign them as site contacts.
                  </p>
                </div>
              )}
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
    </div>
  );
}
