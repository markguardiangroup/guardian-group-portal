import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
} from "lucide-react";
import { Link } from "wouter";
import type { Site, DocumentTypeRecord, ModuleType } from "@shared/schema";

const documentUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  module: z.enum(["health_safety", "human_resources", "employment_law"]),
  documentTypeId: z.string().min(1, "Please select a document type"),
  siteId: z.string().min(1, "Please select a site"),
  folderId: z.string().optional(),
  reviewDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

type DocumentUploadForm = z.infer<typeof documentUploadSchema>;

const moduleLabels: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const modulePaths: Record<ModuleType, string> = {
  health_safety: "/health-safety/documents",
  human_resources: "/human-resources/documents",
  employment_law: "/employment-law",
};

interface FolderTemplate {
  id: string;
  name: string;
  code: string;
  module: string;
  parentId: string | null;
  isActive: boolean;
}

interface FolderDocumentTypeRule {
  id: string;
  folderTemplateId: string;
  documentTypeId: string;
}

interface DocumentFolder {
  id: string;
  name: string;
  siteId: string;
  module: string;
}

export default function DocumentUpload() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  interface SiteWithCompany extends Site {
    companyName?: string | null;
  }

  const { data: sites } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: documentTypes } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });

  const { data: folderTemplates } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });

  const { data: folderRules } = useQuery<FolderDocumentTypeRule[]>({
    queryKey: ["/api/folder-document-type-rules"],
  });

  const form = useForm<DocumentUploadForm>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      title: "",
      description: "",
      module: "health_safety",
      documentTypeId: "",
      siteId: "",
      folderId: "",
      reviewDate: "",
      expiryDate: "",
    },
  });

  const selectedModule = form.watch("module");
  const selectedSiteId = form.watch("siteId");
  const selectedDocTypeId = form.watch("documentTypeId");

  // Get unique companies from sites
  const companies = sites 
    ? Array.from(new Set(sites.map(s => s.companyName).filter((c): c is string => !!c)))
    : [];

  // Filter sites by selected company
  const filteredSites = sites?.filter(site => 
    selectedCompany === "all" || site.companyName === selectedCompany
  );

  const filteredDocumentTypes = documentTypes?.filter(
    (dt) => dt.module === selectedModule && dt.isActive
  );

  // Fetch folders for selected site
  const { data: siteFolders } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const res = await fetch(`/api/folders?siteId=${selectedSiteId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSiteId,
  });

  // Filter folders by selected module
  const moduleFolders = siteFolders?.filter(f => f.module === selectedModule) || [];

  // Auto-select folder based on document type's assigned folder
  const suggestedFolderId = (() => {
    if (!selectedDocTypeId || !folderRules || !folderTemplates || !siteFolders) return null;
    
    // Find rule for this document type
    const rule = folderRules.find(r => r.documentTypeId === selectedDocTypeId);
    if (!rule) return null;
    
    // Find template name
    const template = folderTemplates.find(t => t.id === rule.folderTemplateId);
    if (!template) return null;
    
    // Find matching site folder by name
    const matchingFolder = siteFolders.find(f => f.name === template.name && f.module === selectedModule);
    return matchingFolder?.id || null;
  })();

  const mutation = useMutation({
    mutationFn: async (data: DocumentUploadForm) => {
      const selectedDocType = documentTypes?.find((dt) => dt.id === data.documentTypeId);
      const formData = {
        ...data,
        type: selectedDocType?.code || "policy",
        fileName: selectedFile?.name || "document.pdf",
        fileSize: selectedFile?.size || 0,
        mimeType: selectedFile?.type || "application/pdf",
      };
      return apiRequest("POST", "/api/documents", formData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded successfully.",
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
          <h1 className="text-3xl font-semibold">Upload Document</h1>
          <p className="mt-1 text-muted-foreground">
            Add a new compliance document to the system
          </p>
        </div>
      </div>

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
                            onValueChange={(value) => {
                              field.onChange(value);
                              form.setValue("documentTypeId", "");
                            }} 
                            value={field.value}
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="documentTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-document-type">
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredDocumentTypes?.map((docType) => (
                                <SelectItem key={docType.id} value={docType.id}>
                                  {docType.name}
                                  {docType.isRequired && " *"}
                                </SelectItem>
                              ))}
                              {(!filteredDocumentTypes || filteredDocumentTypes.length === 0) && (
                                <SelectItem value="no-doc-types" disabled>
                                  No document types available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Document types marked with * are required for compliance
                          </FormDescription>
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
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="All companies" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Companies</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company} value={company as string}>
                              {company}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Filter sites by company
                      </FormDescription>
                    </FormItem>

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
                                  {site.name} {selectedCompany === "all" && site.companyName ? `(${site.companyName})` : ""}
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
                  </div>

                  {selectedSiteId && moduleFolders.length > 0 && (
                    <FormField
                      control={form.control}
                      name="folderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Folder</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                            value={field.value || suggestedFolderId || "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-folder">
                                <SelectValue placeholder="Select folder (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No folder</SelectItem>
                              {moduleFolders.map((folder) => (
                                <SelectItem key={folder.id} value={folder.id}>
                                  {folder.name}
                                  {suggestedFolderId === folder.id && " (suggested)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {suggestedFolderId 
                              ? "Folder auto-selected based on document type assignment" 
                              : "Optionally organize this document in a folder"}
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
