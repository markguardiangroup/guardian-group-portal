import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowRight,
  FileText,
  Building2,
  MapPin,
  Download,
  Upload,
  CheckCircle,
  Folder,
  Search,
  Shield,
  Users,
  Briefcase,
  Clock,
  AlertTriangle,
} from "lucide-react";
import type { Site, DocumentTypeRecord, ModuleType, DocumentTemplate as BaseDocumentTemplate } from "@shared/schema";

interface DocumentTemplate extends BaseDocumentTemplate {
  folderTemplateName?: string;
}

interface FolderTemplate {
  id: string;
  name: string;
  code: string;
  module: string;
  parentId: string | null;
  isActive: boolean;
}

interface DocumentFolder {
  id: string;
  name: string;
  siteId: string;
  module: string;
}

interface SiteWithCompany extends Site {
  companyName?: string | null;
}

const moduleLabels: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const moduleIcons: Record<string, typeof Shield> = {
  health_safety: Shield,
  human_resources: Users,
  employment_law: Briefcase,
};

const modulePaths: Record<string, string> = {
  health_safety: "/health-safety/documents",
  human_resources: "/human-resources/documents",
  employment_law: "/employment-law",
};

type Step = "template" | "site" | "placeholders" | "complete";

export default function CreateFromTemplate() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(searchString);
  const preselectedTemplateId = urlParams.get("templateId");
  const preselectedSiteId = urlParams.get("siteId");
  
  const [currentStep, setCurrentStep] = useState<Step>(preselectedTemplateId ? "site" : "template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(preselectedTemplateId || "");
  const [selectedSiteId, setSelectedSiteId] = useState<string>(preselectedSiteId || "");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [siteSearch, setSiteSearch] = useState("");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: folderTemplates = [] } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/folder-templates"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<SiteWithCompany[]>({
    queryKey: ["/api/sites"],
  });

  const { data: documentTypes = [] } = useQuery<DocumentTypeRecord[]>({
    queryKey: ["/api/document-types"],
  });

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedSite = sites.find(s => s.id === selectedSiteId);

  const templatePlaceholders: string[] = useMemo(() => {
    if (!selectedTemplate?.placeholders) return [];
    try {
      return JSON.parse(selectedTemplate.placeholders);
    } catch {
      return [];
    }
  }, [selectedTemplate]);

  const { data: siteFolders = [] } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const res = await fetch(`/api/folders?siteId=${selectedSiteId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSiteId,
  });

  const moduleFolders = siteFolders.filter(f => f.module === selectedTemplate?.module);

  const provisionFoldersMutation = useMutation({
    mutationFn: async ({ siteId, module }: { siteId: string; module: string }) => {
      const res = await fetch("/api/folders/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, module }),
      });
      if (!res.ok) throw new Error("Failed to provision folders");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", selectedSiteId] });
    },
  });

  const companies = useMemo(() => {
    return Array.from(new Set(sites.map(s => s.companyName).filter((c): c is string => !!c)));
  }, [sites]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (!t.isActive) return false;
      if (selectedModule !== "all" && t.module !== selectedModule) return false;
      if (templateSearch) {
        const search = templateSearch.toLowerCase();
        return t.name.toLowerCase().includes(search) || 
               (t.description?.toLowerCase().includes(search));
      }
      return true;
    });
  }, [templates, selectedModule, templateSearch]);

  const filteredSites = useMemo(() => {
    return sites.filter(s => {
      if (selectedCompany !== "all" && s.companyName !== selectedCompany) return false;
      if (siteSearch) {
        const search = siteSearch.toLowerCase();
        return s.name.toLowerCase().includes(search) ||
               s.address?.toLowerCase().includes(search);
      }
      return true;
    });
  }, [sites, selectedCompany, siteSearch]);

  const populatePlaceholders = (site: SiteWithCompany) => {
    const values: Record<string, string> = {};
    for (const placeholder of templatePlaceholders) {
      const key = placeholder.toUpperCase();
      if (key === "COMPANY_NAME" && site.companyName) {
        values[placeholder] = site.companyName;
      } else if (key === "SITE_NAME" || key === "SITE") {
        values[placeholder] = site.name;
      } else if (key === "SITE_ADDRESS" || key === "ADDRESS") {
        values[placeholder] = site.address || "";
      } else if (key === "SITE_PHONE" || key === "PHONE") {
        values[placeholder] = site.contactPhone || "";
      } else if (key === "DATE" || key === "CURRENT_DATE") {
        values[placeholder] = new Date().toLocaleDateString("en-GB");
      } else {
        values[placeholder] = "";
      }
    }
    setPlaceholderValues(values);
  };

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find(s => s.id === siteId);
    if (site) {
      populatePlaceholders(site);
      setDocumentTitle(selectedTemplate?.name || "");
      
      if (selectedTemplate?.folderTemplateId) {
        const folderTemplate = folderTemplates.find(ft => ft.id === selectedTemplate.folderTemplateId);
        if (folderTemplate) {
          const matchingFolder = siteFolders.find(f => f.name === folderTemplate.name);
          if (matchingFolder) {
            setSelectedFolderId(matchingFolder.id);
          }
        }
      }
    }
  };

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !selectedSite || !selectedFile) {
        throw new Error("Missing required data");
      }

      // Step 1: Upload the file to object storage
      const uploadResponse = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(selectedFile.name),
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const uploadResult = await uploadResponse.json();
      const fileUrl = uploadResult.objectPath;

      // Step 2: Create the document record with the file URL
      const docType = documentTypes.find(dt => dt.id === selectedTemplate.documentTypeId);

      const formData = {
        title: documentTitle || selectedTemplate.name,
        description: `Created from template: ${selectedTemplate.name}`,
        module: selectedTemplate.module,
        documentTypeId: selectedTemplate.documentTypeId,
        siteId: selectedSiteId,
        folderId: selectedFolderId || undefined,
        type: docType?.code || "policy",
        fileName: selectedFile.name,
        fileUrl: fileUrl,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        source: "template" as const,
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version,
      };

      return apiRequest("POST", "/api/documents", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Document Created",
        description: "Document has been created from the template and uploaded to the site.",
      });
      setCurrentStep("complete");
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "There was an error creating the document.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadTemplate = async () => {
    if (!selectedTemplate?.fileUrl || !selectedTemplate?.fileName) {
      toast({
        title: "Download Failed",
        description: "Template file not available.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch(`${selectedTemplate.fileUrl}?download=${encodeURIComponent(selectedTemplate.fileName)}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = decodeURIComponent(selectedTemplate.fileName);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template Downloaded",
        description: "Open the file, replace placeholder values, then upload the completed document.",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "There was a problem downloading the template.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleComplete = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please upload the completed document.",
        variant: "destructive",
      });
      return;
    }
    createDocumentMutation.mutate();
  };

  const goToStep = (step: Step) => {
    setCurrentStep(step);
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "template", label: "Select Template" },
      { key: "site", label: "Select Site" },
      { key: "placeholders", label: "Customize & Upload" },
    ];

    return (
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, index) => {
          const isActive = currentStep === step.key;
          const isComplete = 
            (step.key === "template" && selectedTemplateId) ||
            (step.key === "site" && selectedSiteId);
          const isPast = steps.findIndex(s => s.key === currentStep) > index;

          return (
            <div key={step.key} className="flex items-center gap-2">
              {index > 0 && (
                <div className={`h-px w-8 ${isPast || isActive ? "bg-primary" : "bg-border"}`} />
              )}
              <button
                onClick={() => {
                  if (isPast || isComplete) goToStep(step.key as Step);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isPast || isComplete
                    ? "bg-muted hover-elevate cursor-pointer"
                    : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                }`}
                disabled={!isPast && !isComplete && !isActive}
                data-testid={`step-${step.key}`}
              >
                <span className="font-medium">{index + 1}</span>
                <span>{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            className="pl-9"
            data-testid="input-template-search"
          />
        </div>
        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="w-48" data-testid="select-module-filter">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="health_safety">Health & Safety</SelectItem>
            <SelectItem value="human_resources">Human Resources</SelectItem>
            <SelectItem value="employment_law">Employment Law</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {templatesLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No templates found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const ModuleIcon = moduleIcons[template.module] || FileText;
            const isSelected = selectedTemplateId === template.id;

            return (
              <Card
                key={template.id}
                className={`cursor-pointer hover-elevate transition-colors ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedTemplateId(template.id)}
                data-testid={`template-card-${template.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-md">
                      <ModuleIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {moduleLabels[template.module] || template.module}
                        </Badge>
                        {template.folderTemplateName && (
                          <Badge variant="outline" className="text-xs">
                            <Folder className="h-3 w-3 mr-1" />
                            {template.folderTemplateName}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button
          onClick={() => goToStep("site")}
          disabled={!selectedTemplateId}
          data-testid="button-next-site"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderSiteStep = () => (
    <div className="space-y-4">
      {selectedTemplate && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div>
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {moduleLabels[selectedTemplate.module]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="pl-9"
            data-testid="input-site-search"
          />
        </div>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-48" data-testid="select-company-filter">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sitesLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filteredSites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sites found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredSites.map((site) => {
            const isSelected = selectedSiteId === site.id;

            return (
              <Card
                key={site.id}
                className={`cursor-pointer hover-elevate transition-colors ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => handleSelectSite(site.id)}
                data-testid={`site-card-${site.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-md">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium">{site.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {site.companyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {site.companyName}
                          </span>
                        )}
                        {site.address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" />
                            {site.address}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => goToStep("template")} data-testid="button-back-template">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => {
            if (moduleFolders.length === 0 && selectedTemplate) {
              provisionFoldersMutation.mutate({
                siteId: selectedSiteId,
                module: selectedTemplate.module,
              });
            }
            goToStep("placeholders");
          }}
          disabled={!selectedSiteId}
          data-testid="button-next-placeholders"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderPlaceholdersStep = () => (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Details</CardTitle>
            <CardDescription>Customize the document for this site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="documentTitle">Document Title</Label>
              <Input
                id="documentTitle"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
                className="mt-1"
                data-testid="input-document-title"
              />
            </div>

            {moduleFolders.length > 0 && (
              <div>
                <Label htmlFor="folder">Folder</Label>
                <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                  <SelectTrigger className="mt-1" data-testid="select-folder">
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {templatePlaceholders.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Placeholder Values</h4>
                  {templatePlaceholders.some(p => !placeholderValues[p]) && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Some values missing
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  These values will be pre-filled in the template. Review and adjust as needed.
                  Empty values will need to be manually filled in the downloaded document.
                </p>
                {templatePlaceholders.map((placeholder) => {
                  const isEmpty = !placeholderValues[placeholder];
                  return (
                    <div key={placeholder}>
                      <Label htmlFor={placeholder} className="text-sm flex items-center gap-2">
                        {placeholder.replace(/_/g, " ")}
                        {isEmpty && (
                          <span className="text-amber-600 text-xs">(empty - will need manual entry)</span>
                        )}
                      </Label>
                      <Input
                        id={placeholder}
                        value={placeholderValues[placeholder] || ""}
                        onChange={(e) =>
                          setPlaceholderValues((prev) => ({
                            ...prev,
                            [placeholder]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${placeholder.toLowerCase().replace(/_/g, " ")}`}
                        className={`mt-1 ${isEmpty ? "border-amber-300 focus-visible:ring-amber-500" : ""}`}
                        data-testid={`input-placeholder-${placeholder}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Download Template</CardTitle>
              <CardDescription>
                Download the template file, edit it with the site details, then upload the completed version
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadTemplate}
                data-testid="button-download-template"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <div className="mt-4 p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-2">Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Download the template file</li>
                  <li>Open it in Word/Excel</li>
                  <li>Replace placeholders with site details</li>
                  <li>Save the completed document</li>
                  <li>Upload below</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Completed Document</CardTitle>
              <CardDescription>
                Upload the edited document to the site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      data-testid="button-remove-file"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Click to upload</p>
                    <p className="text-sm text-muted-foreground">
                      PDF, Word, or Excel files
                    </p>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => goToStep("site")} data-testid="button-back-site">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!selectedFile || createDocumentMutation.isPending}
          data-testid="button-create-document"
        >
          {createDocumentMutation.isPending ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Create Document
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
          <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Document Created Successfully</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          The document has been created from the template and uploaded to{" "}
          <span className="font-medium">{selectedSite?.name}</span>.
        </p>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setCurrentStep("template");
              setSelectedTemplateId("");
              setSelectedSiteId("");
              setSelectedFolderId("");
              setPlaceholderValues({});
              setDocumentTitle("");
              setSelectedFile(null);
            }}
            data-testid="button-create-another"
          >
            Create Another Document
          </Button>
          <Button
            onClick={() => navigate(modulePaths[selectedTemplate?.module || "health_safety"] || "/documents")}
            data-testid="button-view-documents"
          >
            View Documents
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/template-library")}
          data-testid="button-back-library"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Create from Template</h1>
          <p className="mt-1 text-muted-foreground">
            Create a new document from a template and upload it to a client site
          </p>
        </div>
      </div>

      {currentStep !== "complete" && renderStepIndicator()}

      {currentStep === "template" && renderTemplateStep()}
      {currentStep === "site" && renderSiteStep()}
      {currentStep === "placeholders" && renderPlaceholdersStep()}
      {currentStep === "complete" && renderCompleteStep()}
    </div>
  );
}
