import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import type { Site, ModuleType } from "@shared/schema";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  uploadScope: z.enum(["site", "company"]),
  siteId: z.string().optional(),
  folderId: z.string().min(1, "Please select a folder"),
  requiresApproval: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
  complianceMode: z.enum(["none", "renewal", "expiry"]).default("none"),
  renewalPeriodMonths: z.number().nullable().optional(),
}).refine((data) => {
  if (data.uploadScope === "site" && !data.siteId) {
    return false;
  }
  return true;
}, {
  message: "Please select a site",
  path: ["siteId"],
}).refine((data) => {
  if (data.complianceMode === "renewal" && !data.renewalPeriodMonths) {
    return false;
  }
  return true;
}, {
  message: "Please select a renewal period",
  path: ["renewalPeriodMonths"],
}).refine((data) => {
  if (data.complianceMode === "expiry" && !data.expiryDate) {
    return false;
  }
  return true;
}, {
  message: "Please select an expiry date",
  path: ["expiryDate"],
});

type DocumentUploadForm = z.infer<typeof documentUploadSchema>;

const moduleLabels: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  support: "Support",
  reports: "Reports",
};

const modulePaths: Record<ModuleType, string> = {
  health_safety: "/health-safety/documents",
  human_resources: "/human-resources/documents",
  employment_law: "/employment-law",
  training: "/training/documents",
  support: "/support",
  reports: "/reports",
};

interface DocumentFolder {
  id: string;
  name: string;
  siteId: string;
  module: string;
  parentId?: string | null;
  sortOrder?: number;
  templateId?: string | null;
}

export default function DocumentUpload() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  
  const isAdminOrConsultant = user?.role === "admin" || user?.role === "consultant";

  // Detect module from URL path
  const getModuleFromPath = (): ModuleType => {
    if (location.includes("/health-safety")) return "health_safety";
    if (location.includes("/human-resources")) return "human_resources";
    if (location.includes("/employment-law")) return "employment_law";
    if (location.includes("/training")) return "training";
    return "health_safety"; // default
  };
  
  const initialModule = getModuleFromPath();
  const isModulePreselected = location.includes("/health-safety") || 
    location.includes("/human-resources") || 
    location.includes("/employment-law") || 
    location.includes("/training");

  interface SiteWithCompany extends Site {
    companyName?: string | null;
  }

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const form = useForm<DocumentUploadForm>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      title: "",
      description: "",
      module: initialModule,
      uploadScope: "site",
      siteId: "",
      folderId: "",
      requiresApproval: true,
      isRequired: false,
      reviewDate: "",
      expiryDate: "",
      complianceMode: "none",
      renewalPeriodMonths: null,
    },
  });

  const selectedModule = form.watch("module");
  const selectedSiteId = form.watch("siteId");
  const uploadScope = form.watch("uploadScope");
  const requiresApproval = form.watch("requiresApproval");
  const complianceMode = form.watch("complianceMode");
  const renewalPeriodMonths = form.watch("renewalPeriodMonths");

  useEffect(() => {
    if (user && !isAdminOrConsultant) {
      navigate("/");
    }
  }, [user, isAdminOrConsultant]);

  useEffect(() => {
    setSelectedApproverId("");
  }, [selectedSiteId]);

  // Get unique companies from sites
  const companies = sites 
    ? Array.from(new Set(sites.map(s => s.companyName).filter((c): c is string => !!c)))
    : [];

  // Filter sites by selected company
  const filteredSites = sites?.filter(site => 
    selectedCompany && site.companyName === selectedCompany
  );

  const selectedCompanyId = selectedCompany
    ? sites?.find(s => s.companyName === selectedCompany)?.companyId || ""
    : "";

  interface UserWithAssignments {
    id: string;
    fullName: string;
    role: string;
    status: string;
    companyId?: string | null;
    siteAssignments?: { siteId: string; siteName: string }[];
  }

  const { data: allUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: isAdminOrConsultant,
  });

  const companyClientUsers = allUsers?.filter(
    u => u.role === "client" && u.companyId === selectedCompanyId
  ) || [];

  const companySiteIds = filteredSites?.map(s => s.id) || [];
  const companyConsultantUsers = allUsers?.filter(
    u => u.role === "consultant" && u.siteAssignments?.some(a => companySiteIds.includes(a.siteId))
  ) || [];

  const hasNoClients = selectedCompany && companyClientUsers.length === 0;
  const hasNoConsultants = selectedCompany && companyConsultantUsers.length === 0;

  const sitesWithNoClients = selectedCompany && !hasNoClients
    ? (filteredSites || []).filter(site => {
        return !companyClientUsers.some(u =>
          u.siteAssignments?.some(a => a.siteId === site.id)
        );
      })
    : [];

  const sitesWithNoConsultants = selectedCompany && !hasNoConsultants
    ? (filteredSites || []).filter(site => {
        return !companyConsultantUsers.some(u =>
          u.siteAssignments?.some(a => a.siteId === site.id)
        );
      })
    : [];

  const siteClientUsers = (() => {
    if (!allUsers || !selectedSiteId) return [];
    return allUsers.filter(
      u => u.role === "client" && 
        u.siteAssignments?.some(a => a.siteId === selectedSiteId)
    );
  })();

  // Provision folders mutation
  const provisionFoldersMutation = useMutation({
    mutationFn: async ({ siteId, module }: { siteId: string; module: string }) => {
      const res = await fetch("/api/folders/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, module }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to provision folders");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", selectedSiteId] });
    },
  });

  // For company scope, use the first site in the company to load folder structure
  const firstCompanySiteId = uploadScope === "company" && selectedCompany
    ? filteredSites?.[0]?.id || ""
    : "";
  const folderSiteId = uploadScope === "site" ? selectedSiteId : firstCompanySiteId;

  // Fetch folders for selected site (or first site in company for company scope)
  const { data: siteFolders, refetch: refetchFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", folderSiteId],
    queryFn: async () => {
      if (!folderSiteId) return [];
      const res = await fetch(`/api/folders?siteId=${folderSiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const folders = await res.json();
      
      // Always call provision to sync any missing template folders
      try {
        await provisionFoldersMutation.mutateAsync({ siteId: folderSiteId, module: selectedModule });
        // Refetch after provisioning in case new folders were created
        const newRes = await fetch(`/api/folders?siteId=${folderSiteId}`, {
          credentials: "include",
        });
        if (newRes.ok) return newRes.json();
      } catch (e) {
        console.error("Failed to provision folders:", e);
      }
      
      return folders;
    },
    enabled: !!folderSiteId,
  });

  // Filter and sort folders hierarchically by selected module
  const moduleFolders = (() => {
    const filtered = siteFolders?.filter(f => f.module === selectedModule) || [];
    // Sort hierarchically: parents first, then children immediately after their parent
    const result: DocumentFolder[] = [];
    const parentFolders = filtered.filter(f => !f.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const parent of parentFolders) {
      result.push(parent);
      const children = filtered.filter(f => f.parentId === parent.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      result.push(...children);
    }
    return result;
  })();

  const mutation = useMutation({
    mutationFn: async (data: DocumentUploadForm) => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const uploadResponse = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(selectedFile.name),
        },
        body: selectedFile,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;
      
      if (data.uploadScope === "company" && selectedCompany) {
        const companySites = sites?.filter(s => s.companyName === selectedCompany) || [];
        const results = [];
        
        const selectedFolder = moduleFolders.find(f => f.id === data.folderId);
        const selectedFolderName = selectedFolder?.name || "";
        
        for (const site of companySites) {
          try {
            await fetch("/api/folders/provision", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ siteId: site.id, module: data.module }),
              credentials: "include",
            });
          } catch (e) {
            console.error(`Failed to provision folders for site ${site.id}:`, e);
          }
          
          let siteFolderId = data.folderId;
          try {
            const foldersRes = await fetch(`/api/folders?siteId=${site.id}`, { credentials: "include" });
            if (foldersRes.ok) {
              const siteFoldersList = await foldersRes.json();
              const matchingFolder = siteFoldersList.find((f: DocumentFolder) => f.name === selectedFolderName && f.module === data.module);
              if (matchingFolder) {
                siteFolderId = matchingFolder.id;
              }
            }
          } catch (e) {
            console.error(`Failed to fetch folders for site ${site.id}:`, e);
          }
          
          const formData: Record<string, any> = {
            title: data.title,
            description: data.description,
            module: data.module,
            siteId: site.id,
            folderId: siteFolderId,
            requiresApproval: data.requiresApproval,
            isRequired: data.isRequired,
            reviewDate: data.reviewDate,
            expiryDate: data.complianceMode === "expiry" && data.expiryDate ? data.expiryDate : undefined,
            renewalDate: data.complianceMode === "renewal" && data.renewalPeriodMonths
              ? new Date(new Date().setMonth(new Date().getMonth() + data.renewalPeriodMonths)).toISOString()
              : undefined,
            type: "supporting_document",
            fileName: selectedFile.name,
            fileUrl,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type || "application/pdf",
          };
          const result = await apiRequest("POST", "/api/documents", formData);
          results.push(result);
        }
        return results;
      } else {
        const formData: Record<string, any> = {
          title: data.title,
          description: data.description,
          module: data.module,
          siteId: data.siteId,
          folderId: data.folderId || undefined,
          requiresApproval: data.requiresApproval,
          isRequired: data.isRequired,
          reviewDate: data.reviewDate,
          expiryDate: data.complianceMode === "expiry" && data.expiryDate ? data.expiryDate : undefined,
          renewalDate: data.complianceMode === "renewal" && data.renewalPeriodMonths
            ? new Date(new Date().setMonth(new Date().getMonth() + data.renewalPeriodMonths)).toISOString()
            : undefined,
          type: "supporting_document",
          fileName: selectedFile.name,
          fileUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/pdf",
          notifyUserIds: data.requiresApproval && selectedApproverId ? [selectedApproverId] : [],
        };
        return apiRequest("POST", "/api/documents", formData);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      const siteCount = variables.uploadScope === "company" && selectedCompany
        ? sites?.filter(s => s.companyName === selectedCompany).length || 0
        : 1;
      toast({
        title: "Document Uploaded",
        description: siteCount > 1 
          ? `Document uploaded to ${siteCount} sites in ${selectedCompany}.`
          : "Your document has been uploaded successfully.",
      });
      navigate(modulePaths[variables.module as ModuleType] || "/documents");
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const onSubmit = (data: DocumentUploadForm) => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    if (data.requiresApproval && data.uploadScope === "site" && data.siteId && !selectedApproverId) {
      toast({
        title: "Client Approver Required",
        description: "Please select a client approver for this document.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          data-testid="button-back"
          onClick={() => navigate(modulePaths[selectedModule] || "/documents")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Upload External Document</h1>
          <p className="mt-1 text-muted-foreground">
            Upload a third-party or externally created document
          </p>
        </div>
      </div>

      {isAdminOrConsultant && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Looking to create a document from a template?</p>
                  <p className="text-sm text-muted-foreground">
                    Use the Template Library to create standardized compliance documents with pre-filled site details.
                  </p>
                </div>
              </div>
              <Link href={`/create-from-template?returnTo=${encodeURIComponent(location)}&module=${initialModule}`}>
                <Button data-testid="button-create-from-template">
                  Create from Template
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
              <CardDescription>Provide information about the document</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Document title" {...field} data-testid="input-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description of the document"
                            {...field}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="module"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={isModulePreselected}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-module">
                                <SelectValue placeholder="Select module" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(moduleLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isModulePreselected && (
                            <FormDescription>
                              Module is set based on where you navigated from
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                                      </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select 
                        value={selectedCompany} 
                        onValueChange={(value) => {
                          setSelectedCompany(value);
                          form.setValue("siteId", "");
                          form.setValue("folderId", "");
                          form.setValue("uploadScope", "site");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company} value={company as string}>
                              {company}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the company to upload documents for
                      </FormDescription>
                    </FormItem>

                    <FormField
                      control={form.control}
                      name="uploadScope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apply To</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              if (value === "company") {
                                form.setValue("siteId", "");
                                form.setValue("folderId", "");
                              }
                            }} 
                            value={field.value}
                            disabled={!selectedCompany}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-upload-scope">
                                <SelectValue placeholder="Select scope" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="site">Single Site</SelectItem>
                              <SelectItem value="company">
                                All Sites in Company {selectedCompany ? `(${sites?.filter(s => s.companyName === selectedCompany).length || 0} sites)` : ""}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {uploadScope === "company" && selectedCompany
                              ? `Document will be uploaded to all ${sites?.filter(s => s.companyName === selectedCompany).length || 0} sites in ${selectedCompany}`
                              : "Upload to a specific site"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {isAdminOrConsultant && selectedCompany && (hasNoClients || hasNoConsultants || sitesWithNoClients.length > 0 || sitesWithNoConsultants.length > 0) && (
                    <div className="space-y-2">
                      {hasNoClients && (
                        <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-no-clients">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">No client users assigned</p>
                            <p className="text-sm text-muted-foreground">
                              There are no client users assigned to {selectedCompany}. Documents uploaded will not be visible to any client users until they are assigned to this company.
                            </p>
                          </div>
                        </div>
                      )}
                      {!hasNoClients && sitesWithNoClients.length > 0 && (
                        <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-sites-no-clients">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Sites with no client users assigned</p>
                            <p className="text-sm text-muted-foreground">
                              The following sites have no client users assigned: {sitesWithNoClients.map(s => s.name).join(", ")}. Documents for these sites will not be visible to clients.
                            </p>
                          </div>
                        </div>
                      )}
                      {hasNoConsultants && (
                        <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-no-consultants">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">No consultant users assigned</p>
                            <p className="text-sm text-muted-foreground">
                              There are no consultants assigned to sites in {selectedCompany}. Document approvals and reviews will not be possible until a consultant is assigned.
                            </p>
                          </div>
                        </div>
                      )}
                      {!hasNoConsultants && sitesWithNoConsultants.length > 0 && (
                        <div className="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3" data-testid="warning-sites-no-consultants">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Sites with no consultant assigned</p>
                            <p className="text-sm text-muted-foreground">
                              The following sites have no consultant assigned: {sitesWithNoConsultants.map(s => s.name).join(", ")}. Approvals and reviews won't be possible for these sites.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {uploadScope === "site" && (
                    <FormField
                      control={form.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("folderId", "");
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-site">
                                <SelectValue placeholder="Select site" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredSites?.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.name} {site.companyName ? `(${site.companyName})` : ""}
                                </SelectItem>
                              ))}
                              {(!filteredSites || filteredSites.length === 0) && (
                                <SelectItem value="no-sites" disabled>
                                  No sites available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {((uploadScope === "site" && selectedSiteId) || (uploadScope === "company" && selectedCompany)) && (
                    <FormField
                      control={form.control}
                      name="folderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Folder *</FormLabel>
                          {provisionFoldersMutation.isPending ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              Setting up folders...
                            </div>
                          ) : moduleFolders.length > 0 ? (
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-folder">
                                  <SelectValue placeholder="Select a folder" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {moduleFolders.map((folder) => (
                                  <SelectItem key={folder.id} value={folder.id}>
                                    {folder.parentId ? "└ " : ""}{folder.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="text-sm text-muted-foreground py-2">
                              No folders available for this module. Please wait while folders are being set up...
                            </div>
                          )}
                          <FormDescription>
                            Select a folder to organise this document
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="requiresApproval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Process</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => field.onChange(true)}
                            data-testid="approval-required-button"
                            className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                              field.value
                                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                : "border-muted bg-muted/30 hover:bg-muted/50"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <XCircle className={`h-3.5 w-3.5 ${field.value ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                              Client approval
                            </span>
                            <span className="text-xs text-muted-foreground leading-tight">
                              Needs review before becoming compliant
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => field.onChange(false)}
                            data-testid="no-approval-button"
                            className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                              !field.value
                                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                                : "border-muted bg-muted/30 hover:bg-muted/50"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className={`h-3.5 w-3.5 ${!field.value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                              Auto-approve
                            </span>
                            <span className="text-xs text-muted-foreground leading-tight">
                              Marked compliant immediately on upload
                            </span>
                          </button>
                        </div>
                      </FormItem>
                    )}
                  />

                  {requiresApproval && uploadScope === "site" && selectedSiteId && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-1">
                        Client Approver
                        <span className="text-destructive">*</span>
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Select the client user who will review and approve this document
                      </p>
                      {siteClientUsers.length > 0 ? (
                        <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                          <SelectTrigger
                            className={!selectedApproverId ? "border-destructive" : ""}
                            data-testid="select-client-approver"
                          >
                            <SelectValue placeholder="Select a client approver…" />
                          </SelectTrigger>
                          <SelectContent>
                            {siteClientUsers.map((u) => (
                              <SelectItem
                                key={u.id}
                                value={u.id}
                                disabled={u.status !== "active"}
                                data-testid={`option-approver-${u.id}`}
                              >
                                <span className="flex items-center gap-2">
                                  {u.fullName}
                                  {u.status !== "active" && (
                                    <span className="text-xs text-muted-foreground">(not active)</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                          <Users className="h-4 w-4 shrink-0" />
                          No client users are assigned to this site. Assign users in User Management first.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compliance Section */}
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Compliance</h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="isRequired"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 flex-1">
                              <FormLabel className="text-sm font-medium text-foreground">
                                Required for Compliance
                              </FormLabel>
                              <p className="text-xs text-muted-foreground leading-snug">
                                Mark this document as required. If it is not compliant and up to date, it will count against the compliance score for this site.
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="toggle-is-required"
                                className="shrink-0 mt-0.5"
                              />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="reviewDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>When should this document be reviewed by?</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="date" className="pl-10" {...field} data-testid="input-review-date" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Compliance Tracking</Label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "none" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-none">
                        <input type="radio" name="complianceModeRadio" value="none" checked={complianceMode === "none"}
                          onChange={() => { form.setValue("complianceMode", "none"); form.setValue("renewalPeriodMonths", null); form.setValue("expiryDate", ""); }}
                          className="accent-primary" />
                        <span className="text-sm">No expiry or renewal</span>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "renewal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-renewal">
                        <input type="radio" name="complianceModeRadio" value="renewal" checked={complianceMode === "renewal"}
                          onChange={() => { form.setValue("complianceMode", "renewal"); form.setValue("expiryDate", ""); }}
                          className="accent-primary mt-1" />
                        <div className="flex-1 space-y-2">
                          <span className="text-sm">Renewal period</span>
                          {complianceMode === "renewal" && (
                            <Select
                              value={renewalPeriodMonths != null ? String(renewalPeriodMonths) : ""}
                              onValueChange={(val) => form.setValue("renewalPeriodMonths", parseInt(val))}
                            >
                              <SelectTrigger className="h-9" data-testid="select-compliance-renewal-period">
                                <SelectValue placeholder="Select period" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,30,36,48,60].map(m => (
                                  <SelectItem key={m} value={String(m)}>
                                    {m} {m === 1 ? "month" : "months"}{m === 24 ? " (2 years)" : m === 36 ? " (3 years)" : m === 48 ? " (4 years)" : m === 60 ? " (5 years)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </label>
                      <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "expiry" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-expiry">
                        <input type="radio" name="complianceModeRadio" value="expiry" checked={complianceMode === "expiry"}
                          onChange={() => { form.setValue("complianceMode", "expiry"); form.setValue("renewalPeriodMonths", null); }}
                          className="accent-primary mt-1" />
                        <div className="flex-1 space-y-2">
                          <span className="text-sm">Expiry date</span>
                          {complianceMode === "expiry" && (
                            <FormField
                              control={form.control}
                              name="expiryDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <div className="relative">
                                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                      <Input type="date" className="pl-10 h-9" {...field} data-testid="input-expiry-date" />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => navigate(modulePaths[selectedModule] || "/documents")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} data-testid="button-upload">
                      {mutation.isPending ? (
                        "Uploading..."
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Document
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>Drag and drop or click to select</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : selectedFile
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                      <CheckCircle className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="mt-3 font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 font-medium">Drop file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <label className="absolute inset-0 cursor-pointer">
                      <input
                        type="file"
                        className="sr-only"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        data-testid="input-file"
                      />
                    </label>
                  </>
                )}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Supported formats: PDF, Word, Excel, PowerPoint
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Upload Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Maximum file size: 25MB</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Use descriptive file names</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Set review dates for compliance tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>All uploads are logged for audit purposes</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
