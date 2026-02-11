import { useState } from "react";
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
  Calendar,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import type { Site, ModuleType } from "@shared/schema";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law", "training", "support"]),
  uploadScope: z.enum(["site", "company"]),
  siteId: z.string().optional(),
  folderId: z.string().min(1, "Please select a folder"),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
}).refine((data) => {
  // If scope is "site", require siteId
  if (data.uploadScope === "site" && !data.siteId) {
    return false;
  }
  return true;
}, {
  message: "Please select a site",
  path: ["siteId"],
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
      reviewDate: "",
      expiryDate: "",
    },
  });

  const selectedModule = form.watch("module");
  const selectedSiteId = form.watch("siteId");
  const uploadScope = form.watch("uploadScope");

  // Get unique companies from sites
  const companies = sites 
    ? Array.from(new Set(sites.map(s => s.companyName).filter((c): c is string => !!c)))
    : [];

  // Filter sites by selected company
  const filteredSites = sites?.filter(site => 
    selectedCompany && site.companyName === selectedCompany
  );

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
      
      if (data.uploadScope === "company" && selectedCompany) {
        // Upload to all sites in the company
        const companySites = sites?.filter(s => s.companyName === selectedCompany) || [];
        const results = [];
        
        // Find the selected folder name from the reference site's folders
        const selectedFolder = moduleFolders.find(f => f.id === data.folderId);
        const selectedFolderName = selectedFolder?.name || "";
        
        for (const site of companySites) {
          // Provision folders for this site using plain fetch (not React mutation)
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
          
          // Fetch this site's folders and find the matching one by name
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
          
          const formData = {
            title: data.title,
            description: data.description,
            module: data.module,
            siteId: site.id,
            folderId: siteFolderId,
            reviewDate: data.reviewDate,
            expiryDate: data.expiryDate,
            type: "supporting_document",
            fileName: selectedFile?.name || "document.pdf",
            fileSize: selectedFile?.size || 0,
            mimeType: selectedFile?.type || "application/pdf",
          };
          const result = await apiRequest("POST", "/api/documents", formData);
          results.push(result);
        }
        return results;
      } else {
        // Upload to single site
        const formData = {
          title: data.title,
          description: data.description,
          module: data.module,
          siteId: data.siteId,
          folderId: data.folderId || undefined,
          reviewDate: data.reviewDate,
          expiryDate: data.expiryDate,
          type: "supporting_document",
          fileName: selectedFile?.name || "document.pdf",
          fileSize: selectedFile?.size || 0,
          mimeType: selectedFile?.type || "application/pdf",
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
              <Link href="/create-from-template">
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
                            Select a folder to organize this document
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="reviewDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Review Date</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="date" className="pl-10" {...field} data-testid="input-review-date" />
                            </div>
                          </FormControl>
                          <FormDescription>When should this document be reviewed?</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry Date</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="date" className="pl-10" {...field} data-testid="input-expiry-date" />
                            </div>
                          </FormControl>
                          <FormDescription>When does this document expire?</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
