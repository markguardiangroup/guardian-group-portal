import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Info,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  BookOpen,
  Flame,
  HeartPulse,
  Zap,
  Car,
  Leaf,
  Monitor,
  Wrench,
  ShieldAlert,
  Activity,
  HardHat,
  GraduationCap,
  CalendarMinus,
  Baby,
  Gavel,
  MessageSquareWarning,
  UserX,
  UserPlus,
  TrendingUp,
  Banknote,
  CalendarDays,
  FileSignature,
  Lock,
  Timer,
  Heart,
  ArrowLeftRight,
  Scale,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

const moduleColors: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<string, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

const moduleBorderColors: Record<string, string> = {
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
};

const moduleGradients: Record<string, string> = {
  health_safety: "from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/10",
  human_resources: "from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:via-blue-500/10",
  employment_law: "from-pink-500/10 via-pink-500/5 to-transparent dark:from-pink-500/20 dark:via-pink-500/10",
};

const FOLDER_ICON_MAP: { keywords: string[]; Icon: any }[] = [
  { keywords: ["fire", "evacuation", "emergency"], Icon: Flame },
  { keywords: ["risk", "hazard", "coshh", "chemical", "substance"], Icon: AlertTriangle },
  { keywords: ["first aid", "first-aid", "medical", "health surveillance", "occupational health", "welfare"], Icon: HeartPulse },
  { keywords: ["electrical", "electric"], Icon: Zap },
  { keywords: ["vehicle", "driving", "transport", "fleet"], Icon: Car },
  { keywords: ["environmental", "environment", "eco"], Icon: Leaf },
  { keywords: ["display screen", "dse", "computer", "screen"], Icon: Monitor },
  { keywords: ["manual handling", "lifting", "equipment", "maintenance", "plant"], Icon: Wrench },
  { keywords: ["lone worker", "lone working", "security"], Icon: ShieldAlert },
  { keywords: ["noise", "vibration", "radiation"], Icon: Activity },
  { keywords: ["construction", "building", "site safety"], Icon: HardHat },
  { keywords: ["training", "induction", "learning"], Icon: GraduationCap },
  { keywords: ["absence short", "short term"], Icon: CalendarMinus },
  { keywords: ["absence long", "long term", "long-term sickness"], Icon: Clock },
  { keywords: ["adoption", "maternity", "paternity", "parental", "shared parental"], Icon: Baby },
  { keywords: ["disciplinary", "misconduct", "capability"], Icon: Gavel },
  { keywords: ["grievance", "complaint", "bullying", "harassment"], Icon: MessageSquareWarning },
  { keywords: ["redundancy", "dismissal", "termination", "leaving"], Icon: UserX },
  { keywords: ["recruitment", "onboarding", "new starter"], Icon: UserPlus },
  { keywords: ["performance", "appraisal", "review"], Icon: TrendingUp },
  { keywords: ["pay", "wage", "salary", "payroll", "expenses"], Icon: Banknote },
  { keywords: ["holiday", "leave", "annual", "flexitime", "time off"], Icon: CalendarDays },
  { keywords: ["contract", "offer letter", "terms"], Icon: FileSignature },
  { keywords: ["handbook", "policy", "procedure", "guideline"], Icon: BookOpen },
  { keywords: ["gdpr", "data protection", "privacy", "confidential"], Icon: Lock },
  { keywords: ["working time", "hours", "overtime", "shift"], Icon: Timer },
  { keywords: ["wellbeing", "mental health", "stress"], Icon: Heart },
  { keywords: ["tupe", "transfer"], Icon: ArrowLeftRight },
  { keywords: ["discrimination", "equality", "diversity"], Icon: Scale },
  { keywords: ["audit", "inspection", "checklist", "assessment"], Icon: ClipboardList },
  { keywords: ["workforce", "staffing", "headcount"], Icon: Users },
  { keywords: ["premises", "workplace", "office"], Icon: Building2 },
  { keywords: ["occupational", "stethoscope", "clinic"], Icon: Stethoscope },
];

function getFolderIcon(folderName: string): any {
  const lower = folderName.toLowerCase();
  for (const { keywords, Icon } of FOLDER_ICON_MAP) {
    if (keywords.some(k => lower.includes(k))) return Icon;
  }
  return Folder;
}

type Step = "template" | "site" | "placeholders" | "complete";

export default function CreateFromTemplate() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  
  const urlParams = new URLSearchParams(searchString);
  const preselectedTemplateId = urlParams.get("templateId");
  const preselectedSiteId = urlParams.get("siteId");
  const returnTo = urlParams.get("returnTo") || "/template-library";
  const preselectedModule = urlParams.get("module") || "all";
  
  const [currentStep, setCurrentStep] = useState<Step>(preselectedTemplateId ? "site" : "template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(preselectedTemplateId || "");
  const [selectedSiteId, setSelectedSiteId] = useState<string>(preselectedSiteId || "");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(true);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [reviewDate, setReviewDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>(preselectedModule);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [siteSearch, setSiteSearch] = useState("");
  const [showToolkitTemplates, setShowToolkitTemplates] = useState(false);

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

  // Sync requiresApproval from template whenever the selected template changes
  useEffect(() => {
    if (selectedTemplate) {
      setRequiresApproval(selectedTemplate.requiresApproval !== false);
    }
  }, [selectedTemplateId]);

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
      const res = await fetch(`/api/folders?siteId=${selectedSiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSiteId,
  });

  const { data: siteUsers = [] } = useQuery<Array<{ id: string; fullName: string; email: string; role: string; status: string }>>({
    queryKey: ["/api/sites", selectedSiteId, "users"],
    queryFn: async () => {
      if (!selectedSiteId) return [];
      const res = await fetch(`/api/sites/${selectedSiteId}/users`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedSiteId,
  });

  const siteClientUsers = siteUsers.filter(u => u.role === "client");

  // Filter and sort folders hierarchically: parents first, then children immediately after
  const moduleFolders = (() => {
    const filtered = siteFolders.filter(f => f.module === selectedTemplate?.module);
    const result: typeof siteFolders = [];
    const parentFolders = filtered.filter(f => !f.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const parent of parentFolders) {
      result.push(parent);
      const children = filtered.filter(f => f.parentId === parent.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      result.push(...children);
    }
    return result;
  })();

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

  const companies = useMemo(() => {
    return Array.from(new Set(sites.map(s => s.companyName).filter((c): c is string => !!c)));
  }, [sites]);

  // Build a map of folderTemplateId -> folder name for quick lookup
  const folderTemplateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ft of folderTemplates) {
      map.set(ft.id, ft.name);
    }
    return map;
  }, [folderTemplates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (!t.isActive) return false;
      if (!showToolkitTemplates && t.visibility === "public") return false;
      if (selectedModule !== "all" && t.module !== selectedModule) return false;
      if (templateSearch) {
        const search = templateSearch.toLowerCase();
        return t.name.toLowerCase().includes(search) || 
               (t.description?.toLowerCase().includes(search));
      }
      return true;
    });
  }, [templates, selectedModule, templateSearch, showToolkitTemplates]);

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
    setSelectedApproverId("");
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
      if (!selectedFolderId) {
        throw new Error("Please select a folder");
      }
      if (requiresApproval && !selectedApproverId) {
        throw new Error("Please select a client approver");
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
        requiresApproval,
        notifyUserIds: requiresApproval && selectedApproverId ? [selectedApproverId] : [],
        reviewDate: reviewDate || undefined,
        expiryDate: expiryDate || undefined,
      };

      return apiRequest("POST", "/api/documents", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
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
      <div className="flex items-center gap-4 flex-wrap">
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
          <SelectTrigger className="w-56" data-testid="select-module-filter">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="health_safety">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Health & Safety
              </span>
            </SelectItem>
            <SelectItem value="human_resources">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Human Resources
              </span>
            </SelectItem>
            <SelectItem value="employment_law">
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                Employment Law
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Toolkit templates</span>
          <Switch
            checked={showToolkitTemplates}
            onCheckedChange={setShowToolkitTemplates}
            data-testid="toggle-toolkit-templates"
          />
        </div>
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
        <TooltipProvider>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => {
              const ModuleIcon = moduleIcons[template.module] || FileText;
              const isSelected = selectedTemplateId === template.id;
              const iconBg = moduleBgColors[template.module] || "bg-muted";
              const iconColor = moduleColors[template.module] || "";
              const borderColor = moduleBorderColors[template.module] || "";
              const folderName = template.folderTemplateId ? folderTemplateMap.get(template.folderTemplateId) : null;
              const FolderIcon = folderName ? getFolderIcon(folderName) : Folder;
              const showModuleBadge = selectedModule === "all";

              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer hover-elevate transition-all relative overflow-hidden flex flex-col ${
                    isSelected
                      ? `ring-2 ${borderColor ? `ring-current ${iconColor}` : "ring-primary"}`
                      : ""
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                  data-testid={`template-card-${template.id}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${moduleGradients[template.module] || ""} pointer-events-none`} />
                  <CardContent className="p-3 relative flex flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-md shrink-0 ${iconBg}`}>
                        <ModuleIcon className={`h-4 w-4 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium leading-snug line-clamp-2 break-words">{template.name}</h3>
                      </div>
                      {isSelected && (
                        <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor || "text-primary"}`} />
                      )}
                    </div>

                    {template.description ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground line-clamp-2 cursor-default leading-relaxed">
                            {template.description}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-normal text-xs">
                          {template.description}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-1">
                      {folderName && (
                        <Badge variant="outline" className="text-xs">
                          <FolderIcon className="h-3 w-3 mr-1 shrink-0" />
                          {folderName}
                        </Badge>
                      )}
                      {showModuleBadge && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${iconColor} ${borderColor}`}
                        >
                          <ModuleIcon className="h-3 w-3 mr-1 shrink-0" />
                          {moduleLabels[template.module] || template.module}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TooltipProvider>
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
        <Card className={`relative overflow-hidden border ${moduleBorderColors[selectedTemplate.module] || ""}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${moduleGradients[selectedTemplate.module] || ""} pointer-events-none`} />
          <CardContent className="p-4 relative">
            <div className="flex items-center gap-3">
              {(() => {
                const ModuleIcon = moduleIcons[selectedTemplate.module] || FileText;
                return (
                  <div className={`p-2 rounded-md ${moduleBgColors[selectedTemplate.module] || "bg-muted"}`}>
                    <ModuleIcon className={`h-5 w-5 ${moduleColors[selectedTemplate.module] || ""}`} />
                  </div>
                );
              })()}
              <div>
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className={`text-sm ${moduleColors[selectedTemplate.module] || "text-muted-foreground"}`}>
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
                <Label htmlFor="folder">Folder *</Label>
                <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                  <SelectTrigger className="mt-1" data-testid="select-folder">
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    {moduleFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.parentId ? "└ " : ""}{folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Required - select a folder to organize this document</p>
              </div>
            )}

            <div className="pt-2">
              <Label className="text-sm font-medium">Approval Process</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Set from the template preference — override here if needed
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequiresApproval(true)}
                  data-testid="approval-required-button"
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                    requiresApproval
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                      : "border-muted bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <XCircle className={`h-3.5 w-3.5 ${requiresApproval ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                    Client approval
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    Needs review before becoming compliant
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequiresApproval(false)}
                  data-testid="no-approval-button"
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors ${
                    !requiresApproval
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-muted bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${!requiresApproval ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                    Auto-approve
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    Marked compliant immediately on upload
                  </span>
                </button>
              </div>

              {requiresApproval && (
                <div className="mt-3">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    Client Approver
                    <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Select the client user who will review and approve this document
                  </p>
                  {siteClientUsers.length > 0 ? (
                    <Select
                      value={selectedApproverId}
                      onValueChange={setSelectedApproverId}
                    >
                      <SelectTrigger
                        className={`mt-1 ${requiresApproval && !selectedApproverId ? "border-destructive" : ""}`}
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
                    <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground mt-1">
                      <Users className="h-4 w-4 shrink-0" />
                      No client users are assigned to this site. Assign users in User Management first.
                    </div>
                  )}
                </div>
              )}
            </div>

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

            <div className="pt-4 border-t space-y-4">
              <div>
                <Label htmlFor="reviewDate" className="text-sm font-medium">
                  When should this document be reviewed by?
                </Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reviewDate"
                    type="date"
                    className="pl-10"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    data-testid="input-review-date"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Optional — sets the compliance review reminder date</p>
              </div>

              <div>
                <Label htmlFor="expiryDate" className="text-sm font-medium">Expiry Date</Label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="expiryDate"
                    type="date"
                    className="pl-10"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    data-testid="input-expiry-date"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Optional — when does this document expire?</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedTemplate && (
            <Card className="border-muted bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  Compliance Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-start gap-2.5 text-sm">
                  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">
                      {selectedTemplate.renewalPeriodMonths
                        ? `Renews every ${selectedTemplate.renewalPeriodMonths} month${selectedTemplate.renewalPeriodMonths === 1 ? "" : "s"}`
                        : "No renewal period"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedTemplate.renewalPeriodMonths
                        ? requiresApproval
                          ? `Renewal date will be set to ${selectedTemplate.renewalPeriodMonths} months from final approval`
                          : `Renewal date will be set to ${selectedTemplate.renewalPeriodMonths} months from today`
                        : "This document does not have an automatic renewal schedule"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

  const returnToLabel = (() => {
    if (returnTo.includes("/health-safety")) return "Health & Safety";
    if (returnTo.includes("/human-resources")) return "Human Resources";
    if (returnTo.includes("/employment-law")) return "Employment Law";
    if (returnTo.includes("/template-library")) return "Template Library";
    return "Back";
  })();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(returnTo)}
          data-testid="button-back-library"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-sm text-muted-foreground mb-0.5">{returnToLabel}</p>
          <h1 className="text-3xl font-semibold">Create from Template</h1>
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
