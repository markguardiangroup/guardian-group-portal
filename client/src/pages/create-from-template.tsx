import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  CheckCircle2,
  XCircle,
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
  X,
  ChevronRight,
  Check,
  Info,
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
  parentId?: string | null;
  sortOrder?: number | null;
  templateId?: string | null;
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
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>(preselectedSiteId ? [preselectedSiteId] : []);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [documentTitle, setDocumentTitle] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(true);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [reviewDate, setReviewDate] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [complianceMode, setComplianceMode] = useState<"none" | "renewal" | "expiry">("none");
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState<number | null>(null);
  const [documentComments, setDocumentComments] = useState<string>("");
  const [reviewDateInteracted, setReviewDateInteracted] = useState(false);
  const [reviewDateBlurred, setReviewDateBlurred] = useState(false);
  const [expiryDateInteracted, setExpiryDateInteracted] = useState(false);
  const [expiryDateBlurred, setExpiryDateBlurred] = useState(false);
  const reviewDateRef = useRef<HTMLInputElement>(null);
  const expiryDateRef = useRef<HTMLInputElement>(null);

  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>(preselectedModule);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [siteSearch, setSiteSearch] = useState("");
  const [expandedSitePickerCompanies, setExpandedSitePickerCompanies] = useState<Set<string>>(new Set());
  const [showToolkitTemplates, setShowToolkitTemplates] = useState(false);
  const [showSiteConfirmDialog, setShowSiteConfirmDialog] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: requiredTemplateIds = [] } = useQuery<string[]>({
    queryKey: ["/api/required-template-ids"],
  });

  const requiredTemplateIdSet = useMemo(() => new Set(requiredTemplateIds), [requiredTemplateIds]);

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
  const primarySiteId = selectedSiteIds[0] ?? "";
  const selectedSite = sites.find(s => s.id === primarySiteId);
  const selectedSiteObjects = sites.filter(s => selectedSiteIds.includes(s.id));

  // Sync requiresApproval from template whenever the selected template changes
  useEffect(() => {
    if (selectedTemplate) {
      setRequiresApproval(selectedTemplate.requiresApproval !== false);
      if (selectedTemplate.renewalPeriodMonths) {
        setComplianceMode("renewal");
        setRenewalPeriodMonths(selectedTemplate.renewalPeriodMonths);
        setExpiryDate("");
        setExpiryDateInteracted(false);
        setExpiryDateBlurred(false);
      } else {
        setComplianceMode("none");
        setRenewalPeriodMonths(null);
      }
    }
  }, [selectedTemplateId, selectedTemplate]);

  const templatePlaceholders: string[] = useMemo(() => {
    if (!selectedTemplate?.placeholders) return [];
    try {
      return JSON.parse(selectedTemplate.placeholders);
    } catch {
      return [];
    }
  }, [selectedTemplate]);

  const { data: siteFolders = [] } = useQuery<DocumentFolder[]>({
    queryKey: ["/api/folders", primarySiteId],
    queryFn: async () => {
      if (!primarySiteId) return [];
      const res = await fetch(`/api/folders?siteId=${primarySiteId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!primarySiteId,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; fullName: string; email: string; role: string; status: string; siteAssignments?: { siteId: string }[] }>>({
    queryKey: ["/api/users"],
  });

  const siteClientUsers = useMemo(() => {
    if (selectedSiteIds.length === 0) return [];
    return allUsers.filter(u =>
      u.role === "client" &&
      selectedSiteIds.every(siteId => u.siteAssignments?.some(a => a.siteId === siteId))
    );
  }, [allUsers, selectedSiteIds]);

  // Filter and sort folders hierarchically: parents first, then children immediately after
  const moduleFolders = (() => {
    const validTemplateIds = new Set(folderTemplates.map(ft => ft.id));
    const forModule = siteFolders.filter(f => f.module === selectedTemplate?.module);
    // Toolkit root folders have sortOrder < 0; exclude them and all their children
    const toolkitRootIds = new Set(forModule.filter(f => (f.sortOrder ?? 0) < 0).map(f => f.id));
    // Only show folders whose template still exists (filter out orphaned folders from deleted templates)
    const filtered = forModule.filter(f =>
      (f.sortOrder ?? 0) >= 0 &&
      !toolkitRootIds.has(f.parentId ?? "") &&
      (!f.templateId || validTemplateIds.has(f.templateId))
    );
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
      queryClient.refetchQueries({ queryKey: ["/api/folders", primarySiteId] });
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
      if (showToolkitTemplates ? t.visibility !== "public" : t.visibility === "public") return false;
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
      if (siteSearch) {
        const search = siteSearch.toLowerCase();
        return s.name.toLowerCase().includes(search) ||
               s.address?.toLowerCase().includes(search) ||
               (s.companyName && s.companyName.toLowerCase().includes(search));
      }
      return true;
    });
  }, [sites, siteSearch]);

  const sitesByCompany = useMemo(() => {
    const grouped: Record<string, { companyId: string; companyName: string; sites: typeof filteredSites }> = {};
    for (const site of filteredSites) {
      const key = site.companyId || "other";
      if (!grouped[key]) grouped[key] = { companyId: key, companyName: site.companyName || "Other", sites: [] };
      grouped[key].sites.push(site);
    }
    return Object.values(grouped).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [filteredSites]);

  // Auto-expand the company accordion for all currently selected sites
  useEffect(() => {
    if (selectedSiteIds.length > 0 && sites.length > 0) {
      for (const siteId of selectedSiteIds) {
        const site = sites.find(s => s.id === siteId);
        if (site?.companyId) {
          setExpandedSitePickerCompanies(prev => {
            if (prev.has(site.companyId)) return prev;
            const next = new Set(prev);
            next.add(site.companyId);
            return next;
          });
        }
      }
    }
  }, [selectedSiteIds, sites]);

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

  const handleToggleSite = (siteId: string) => {
    setSelectedSiteIds(prev => {
      const isSelected = prev.includes(siteId);
      let next: string[];
      if (isSelected) {
        next = prev.filter(id => id !== siteId);
      } else {
        const site = sites.find(s => s.id === siteId);
        const selectedCompanyId = prev.length > 0 ? sites.find(s => s.id === prev[0])?.companyId : null;
        if (selectedCompanyId && site?.companyId !== selectedCompanyId) {
          next = [siteId];
        } else {
          next = [...prev, siteId];
        }
      }
      setSelectedApproverId("");
      setSelectedFolderId("");
      if (next.length > 0) {
        const site = sites.find(s => s.id === next[0]);
        if (site) {
          populatePlaceholders(site);
          setDocumentTitle(selectedTemplate?.name || "");
        }
      }
      return next;
    });
  };

  // Auto-set folder after the primary site's folders have loaded
  useEffect(() => {
    if (!selectedTemplate || !primarySiteId || siteFolders.length === 0) return;
    if (selectedTemplate.toolkitFolderId) return; // toolkit templates stay blank
    if (!selectedTemplate.folderTemplateId) return;
    const folderTemplate = folderTemplates.find(ft => ft.id === selectedTemplate.folderTemplateId);
    if (!folderTemplate) return;
    const matchingFolder = siteFolders.find(f => f.name === folderTemplate.name);
    if (matchingFolder) setSelectedFolderId(matchingFolder.id);
  }, [siteFolders, primarySiteId]);

  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || selectedSiteIds.length === 0 || !selectedFile) {
        throw new Error("Missing required data");
      }
      if (!selectedFolderId) {
        throw new Error("Please select a folder");
      }
      if (requiresApproval && !selectedApproverId) {
        throw new Error("Please select a client approver");
      }

      // Step 1: Upload the file once to object storage
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

      // Step 2: Create a document record for each selected site
      const docType = documentTypes.find(dt => dt.id === selectedTemplate.documentTypeId);
      const selectedFolder = siteFolders.find(f => f.id === selectedFolderId);
      const selectedFolderName = selectedFolder?.name || "";

      const results = [];
      for (const siteId of selectedSiteIds) {
        // Provision folders for this site in case they don't exist yet
        try {
          await fetch("/api/folders/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteId, module: selectedTemplate.module }),
            credentials: "include",
          });
        } catch (e) {
          console.error(`Failed to provision folders for site ${siteId}:`, e);
        }

        // Find the matching folder for this site by name
        let siteFolderId = selectedFolderId;
        if (selectedFolderName) {
          try {
            const foldersRes = await fetch(`/api/folders?siteId=${siteId}`, { credentials: "include" });
            if (foldersRes.ok) {
              const siteFoldersList = await foldersRes.json();
              const matchingFolder = siteFoldersList.find((f: DocumentFolder) =>
                f.name === selectedFolderName && f.module === selectedTemplate.module
              );
              if (matchingFolder) siteFolderId = matchingFolder.id;
            }
          } catch (e) {
            console.error(`Failed to fetch folders for site ${siteId}:`, e);
          }
        }

        const formData = {
          title: documentTitle || selectedTemplate.name,
          comments: documentComments || null,
          module: selectedTemplate.module,
          documentTypeId: selectedTemplate.documentTypeId,
          siteId,
          folderId: siteFolderId || undefined,
          type: docType?.code || "policy",
          fileName: selectedFile.name,
          fileUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          source: "template" as const,
          templateId: selectedTemplate.id,
          templateVersion: selectedTemplate.version,
          requiresApproval,
          notifyUserIds: requiresApproval && selectedApproverId ? [selectedApproverId] : [],
          reviewDate: reviewDate || undefined,
          expiryDate: complianceMode === "expiry" && expiryDate ? expiryDate : undefined,
          renewalDate: complianceMode === "renewal" && renewalPeriodMonths
            ? new Date(new Date().setMonth(new Date().getMonth() + renewalPeriodMonths)).toISOString()
            : undefined,
        };

        const result = await apiRequest("POST", "/api/documents", formData);
        results.push(result);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/documents"] });
      queryClient.refetchQueries({ queryKey: ["/api/documents/module"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard"] });
      queryClient.removeQueries({ queryKey: ["/api/modules/summary"] });
      queryClient.removeQueries({ queryKey: ["/api/missing-required-templates"] });
      queryClient.refetchQueries({ queryKey: ["/api/sites"] });
      queryClient.refetchQueries({ queryKey: ["/api/folders"] });
      const count = selectedSiteIds.length;
      toast({
        title: count > 1 ? "Documents Created" : "Document Created",
        description: count > 1
          ? `Documents have been created from the template and uploaded to ${count} sites.`
          : "Document has been created from the template and uploaded to the site.",
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

  const isDateInPast = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isReviewDateInvalid = (reviewDateBlurred && !reviewDate) || isDateInPast(reviewDate);
  const isExpiryDateInvalid = (expiryDateBlurred && !expiryDate) || isDateInPast(expiryDate);

  const handleComplete = () => {
    setSubmitAttempted(true);
    if (!documentTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter a document title.", variant: "destructive" });
      return;
    }
    if (moduleFolders.length > 0 && !selectedFolderId) {
      toast({ title: "Folder Required", description: "Please select a folder.", variant: "destructive" });
      return;
    }
    const reviewRefEmpty = reviewDateRef.current ? reviewDateRef.current.value === "" : !reviewDate;
    const expiryRefEmpty = expiryDateRef.current ? expiryDateRef.current.value === "" : !expiryDate;
    if (reviewDateInteracted && reviewRefEmpty) {
      setReviewDateBlurred(true);
      toast({ title: "Invalid Review Date", description: "Please enter a complete review date.", variant: "destructive" });
      return;
    }
    if (reviewDate && isDateInPast(reviewDate)) {
      toast({ title: "Invalid Review Date", description: "Review date must be today or in the future.", variant: "destructive" });
      return;
    }
    if (complianceMode === "expiry") {
      if (expiryDateInteracted && expiryRefEmpty) {
        setExpiryDateBlurred(true);
        toast({ title: "Invalid Expiry Date", description: "Please enter a complete expiry date.", variant: "destructive" });
        return;
      }
      if (expiryDate && isDateInPast(expiryDate)) {
        toast({ title: "Invalid Expiry Date", description: "Expiry date must be today or in the future.", variant: "destructive" });
        return;
      }
    }
    if (complianceMode === "renewal" && !renewalPeriodMonths) {
      toast({ title: "Renewal Period Required", description: "Please select a renewal period.", variant: "destructive" });
      return;
    }
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please upload the completed document.", variant: "destructive" });
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
      { key: "placeholders", label: "Customise & Upload" },
    ];

    return (
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, index) => {
          const isActive = currentStep === step.key;
          const isComplete = 
            (step.key === "template" && selectedTemplateId) ||
            (step.key === "site" && selectedSiteIds.length > 0);
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
          <div
              key={`${selectedModule}-${templateSearch}-${showToolkitTemplates}`}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              style={{ gridAutoRows: selectedModule === "all" ? "10rem" : "8.5rem" }}
            >
            {filteredTemplates.map((template, index) => {
              const ModuleIcon = moduleIcons[template.module] || FileText;
              const isSelected = selectedTemplateId === template.id;
              const iconBg = moduleBgColors[template.module] || "bg-muted";
              const iconColor = moduleColors[template.module] || "";
              const borderColor = moduleBorderColors[template.module] || "";
              const folderName = template.folderTemplateId ? folderTemplateMap.get(template.folderTemplateId) : null;
              const FolderIcon = folderName ? getFolderIcon(folderName) : Folder;
              const showModuleBadge = selectedModule === "all";
              const isRequired = requiredTemplateIdSet.has(template.id);

              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer hover-elevate transition-all flex flex-col ${
                    isSelected
                      ? `ring-2 ring-primary`
                      : ""
                  }`}
                  style={{ animation: "slideUpFade 0.28s ease both", animationDelay: `${index * 40}ms` }}
                  onClick={() => setSelectedTemplateId(template.id)}
                  onDoubleClick={() => { setSelectedTemplateId(template.id); goToStep("site"); }}
                  data-testid={`template-card-${template.id}`}
                >
                  <CardContent className="p-3 flex flex-col flex-1 gap-1.5">
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-md shrink-0 ${iconBg}`}>
                        <FolderIcon className={`h-4 w-4 ${iconColor}`} />
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
                          <p className="text-xs text-muted-foreground line-clamp-2 cursor-pointer leading-relaxed">
                            {template.description}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-normal text-xs">
                          {template.description}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-1 mt-auto">
                      {isRequired && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                          <Shield className="h-3 w-3 mr-1 shrink-0" />
                          Required
                        </Badge>
                      )}
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
    <div className="flex gap-6 items-start">
    <Card className="flex-1 max-w-2xl">
      <CardHeader>
        <CardTitle>Select Site(s)</CardTitle>
        <CardDescription>
          {selectedTemplate ? (
            <span className="flex items-center gap-2">
              {(() => {
                const ModuleIcon = moduleIcons[selectedTemplate.module] || FileText;
                return <ModuleIcon className={`h-3.5 w-3.5 shrink-0 ${moduleColors[selectedTemplate.module] || "text-muted-foreground"}`} />;
              })()}
              <span>{selectedTemplate.name}</span>
              <span className="text-muted-foreground">·</span>
              <span>{moduleLabels[selectedTemplate.module]}</span>
            </span>
          ) : "Choose one or more sites to create this document for"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected sites badges */}
        {selectedSiteIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSiteIds.map(siteId => {
              const sel = sites.find(s => s.id === siteId);
              if (!sel) return null;
              return (
                <div key={siteId} className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm" data-testid={`badge-site-${siteId}`}>
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-medium">{sel.name}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSite(siteId)}
                    className="text-muted-foreground hover:text-foreground ml-0.5"
                    data-testid={`button-remove-site-${siteId}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search companies or sites…"
            value={siteSearch}
            onChange={(e) => setSiteSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            data-testid="input-site-search"
          />
        </div>

        {sitesLoading ? (
          <div className="space-y-2">
            {[1, 2].map((g) => (
              <Skeleton key={g} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : filteredSites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching sites found.</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1 rounded-md border p-1" data-testid="site-picker-list">
            {(() => {
              const selectedCompanyId = selectedSiteIds.length > 0 ? sites.find(s => s.id === selectedSiteIds[0])?.companyId : null;
              return sitesByCompany.map(({ companyId, companyName, sites: companySites }) => {
              const isOpen = siteSearch.trim() !== "" || expandedSitePickerCompanies.has(companyId);
              const isLockedCompany = !!selectedCompanyId && companyId !== selectedCompanyId;
              const toggleExpand = () => {
                setExpandedSitePickerCompanies(prev => {
                  const next = new Set(prev);
                  if (next.has(companyId)) next.delete(companyId);
                  else next.add(companyId);
                  return next;
                });
              };
              return (
                <div key={companyId} className="rounded-md border">
                  <div className={`flex items-center rounded-md ${isLockedCompany ? "" : "hover:bg-muted/50"}`}>
                    <button
                      type="button"
                      onClick={toggleExpand}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-left"
                      data-testid={`button-picker-toggle-company-${companyId}`}
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${isLockedCompany ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{companyName}</span>
                      <span className={`text-xs ${isLockedCompany ? "text-muted-foreground/40" : "text-muted-foreground"}`}>({companySites.length})</span>
                    </button>
                    {companySites.length > 1 && (() => {
                      const allSelected = companySites.every(s => selectedSiteIds.includes(s.id));
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setSelectedSiteIds(prev => prev.filter(id => !companySites.some(s => s.id === id)));
                            } else {
                              setSelectedSiteIds(prev => {
                                const base = isLockedCompany ? [] : prev.filter(id => !companySites.some(s => s.id === id));
                                const toAdd = companySites.map(s => s.id);
                                return [...base, ...toAdd];
                              });
                              setSelectedApproverId("");
                              setSelectedFolderId("");
                            }
                          }}
                          className="px-3 py-2 text-xs text-primary hover:text-primary/80 shrink-0"
                          data-testid={`button-select-all-company-${companyId}`}
                        >
                          {allSelected ? "Deselect all" : "Select all"}
                        </button>
                      );
                    })()}
                  </div>
                  {isOpen && (
                    <div className="border-t">
                      {companySites.map((site) => {
                        const isSelected = selectedSiteIds.includes(site.id);
                        const isDisabled = isLockedCompany;
                        return (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => handleToggleSite(site.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left last:rounded-b-md transition-colors ${
                              isSelected ? "bg-primary/10 text-primary" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/50"
                            }`}
                            data-testid={`site-card-${site.id}`}
                          >
                            <span className="text-sm pl-5">{site.name}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              });
            })()}
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-6 flex justify-between">
        <Button variant="outline" onClick={() => goToStep("template")} data-testid="button-back-template">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => setShowSiteConfirmDialog(true)}
          disabled={selectedSiteIds.length === 0}
          data-testid="button-next-placeholders"
        >
          Continue{selectedSiteIds.length > 1 ? ` (${selectedSiteIds.length} sites)` : ""}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </Card>

    {/* Guidance panel — right column */}
    <div className="w-72 shrink-0 hidden lg:block sticky top-6">
      <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          How to select sites
        </div>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            Click a company name to expand and see its sites
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            Select individual sites, or use <strong className="text-foreground font-medium">&nbsp;Select all&nbsp;</strong> to pick every site under a company at once
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
            Multi-site creation is limited to one company at a time — selecting a site from a different company will clear your current selection
          </li>
        </ul>
      </div>
    </div>
  </div>
  );

  const renderPlaceholdersStep = () => (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Details</CardTitle>
            <CardDescription>Customise the document for this site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="documentTitle">
                Document Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="documentTitle"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter document title"
                className={`mt-1 ${!documentTitle.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`}
                data-testid="input-document-title"
              />
            </div>

            {moduleFolders.length > 0 && (
              <div>
                <Label htmlFor="folder">Folder *</Label>
                <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                  <SelectTrigger
                    className={`mt-1 ${!selectedFolderId ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    data-testid="select-folder"
                  >
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

            {selectedTemplate?.description && (
              <div>
                <Label className="text-sm font-medium">Template Description</Label>
                <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="text-template-description">
                  {selectedTemplate.description}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="documentComments">Comments</Label>
              <Textarea
                id="documentComments"
                value={documentComments}
                onChange={(e) => setDocumentComments(e.target.value)}
                placeholder="Add any comments about this document"
                className="mt-1"
                data-testid="textarea-comments"
              />
            </div>

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
                    {selectedSiteIds.length > 1
                      ? `Select a client user with access to all ${selectedSiteIds.length} selected sites`
                      : "Select the client user who will review and approve this document"}
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
                      {selectedSiteIds.length > 1
                        ? "No client users have access to all selected sites. Assign users in User Management first."
                        : "No client users are assigned to this site. Assign users in User Management first."}
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
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={reviewDateRef}
                    id="reviewDate"
                    type="date"
                    className={`pl-10 ${reviewDate || reviewDateBlurred ? "pr-8" : ""} ${isReviewDateInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    onKeyDown={() => setReviewDateInteracted(true)}
                    onInput={() => setReviewDateInteracted(true)}
                    onBlur={() => { if (reviewDateInteracted) setReviewDateBlurred(true); }}
                    data-testid="input-review-date"
                  />
                  {(reviewDate || reviewDateBlurred) && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setReviewDate("");
                        setReviewDateInteracted(false);
                        setReviewDateBlurred(false);
                        if (reviewDateRef.current) reviewDateRef.current.value = "";
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-clear-review-date"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {reviewDateBlurred && !reviewDate ? (
                  <p className="text-xs text-destructive mt-1">Review date is incomplete — please finish entering or clear it</p>
                ) : isDateInPast(reviewDate) ? (
                  <p className="text-xs text-destructive mt-1">Review date must be today or in the future</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Optional — sets the compliance review reminder date</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Compliance Tracking</Label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "none" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-none">
                    <input type="radio" name="complianceMode" value="none" checked={complianceMode === "none"}
                      onChange={() => { setComplianceMode("none"); setRenewalPeriodMonths(null); setExpiryDate(""); setExpiryDateInteracted(false); setExpiryDateBlurred(false); }}
                      className="accent-primary" />
                    <span className="text-sm">No expiry or renewal</span>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${complianceMode === "renewal" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`} data-testid="radio-compliance-renewal">
                    <input type="radio" name="complianceMode" value="renewal" checked={complianceMode === "renewal"}
                      onChange={() => { setComplianceMode("renewal"); setExpiryDate(""); setExpiryDateInteracted(false); setExpiryDateBlurred(false); if (!renewalPeriodMonths && selectedTemplate?.renewalPeriodMonths) setRenewalPeriodMonths(selectedTemplate.renewalPeriodMonths); }}
                      className="accent-primary mt-1" />
                    <div className="flex-1 space-y-2">
                      <span className="text-sm">Renewal period</span>
                      {complianceMode === "renewal" && (
                        <Select
                          value={renewalPeriodMonths != null ? String(renewalPeriodMonths) : ""}
                          onValueChange={(val) => setRenewalPeriodMonths(parseInt(val))}
                        >
                          <SelectTrigger className="h-9" data-testid="select-compliance-renewal-period">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(m => (
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
                    <input type="radio" name="complianceMode" value="expiry" checked={complianceMode === "expiry"}
                      onChange={() => { setComplianceMode("expiry"); setRenewalPeriodMonths(null); }}
                      className="accent-primary mt-1" />
                    <div className="flex-1 space-y-2">
                      <span className="text-sm">Expiry date</span>
                      {complianceMode === "expiry" && (
                        <div>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                              ref={expiryDateRef}
                              id="expiryDate"
                              type="date"
                              className={`pl-10 h-9 ${expiryDate || expiryDateBlurred ? "pr-8" : ""} ${isExpiryDateInvalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              onKeyDown={() => setExpiryDateInteracted(true)}
                              onInput={() => setExpiryDateInteracted(true)}
                              onBlur={() => { if (expiryDateInteracted) setExpiryDateBlurred(true); }}
                              data-testid="input-expiry-date"
                            />
                            {(expiryDate || expiryDateBlurred) && (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setExpiryDate("");
                                  setExpiryDateInteracted(false);
                                  setExpiryDateBlurred(false);
                                  if (expiryDateRef.current) expiryDateRef.current.value = "";
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                data-testid="button-clear-expiry-date"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {expiryDateBlurred && !expiryDate ? (
                            <p className="text-xs text-destructive mt-1">Expiry date is incomplete — please finish entering or clear it</p>
                          ) : isDateInPast(expiryDate) ? (
                            <p className="text-xs text-destructive mt-1">Expiry date must be today or in the future</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
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
        <Button variant="outline" onClick={() => { goToStep("site"); setSubmitAttempted(false); }} data-testid="button-back-site">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!selectedFile || createDocumentMutation.isPending || isReviewDateInvalid || isExpiryDateInvalid}
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
        <h2 className="text-2xl font-semibold mb-2">
          {selectedSiteIds.length > 1 ? "Documents Created Successfully" : "Document Created Successfully"}
        </h2>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {selectedSiteIds.length > 1 ? (
            <>The document has been created and uploaded to <span className="font-medium">{selectedSiteIds.length} sites</span>.</>
          ) : (
            <>The document has been created from the template and uploaded to{" "}<span className="font-medium">{selectedSite?.name}</span>.</>
          )}
        </p>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setCurrentStep("template");
              setSelectedTemplateId("");
              setSelectedSiteIds([]);
              setSelectedFolderId("");
              setPlaceholderValues({});
              setDocumentTitle("");
              setSelectedFile(null);
              setSubmitAttempted(false);
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

      {/* Site selection confirmation dialog */}
      <Dialog open={showSiteConfirmDialog} onOpenChange={setShowSiteConfirmDialog}>
        <DialogContent data-testid="dialog-site-confirm">
          <DialogHeader>
            <DialogTitle>Confirm your selection</DialogTitle>
            <DialogDescription>
              Please confirm the template and site before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Template summary */}
            {selectedTemplate && (
              <div className={`flex items-center gap-3 rounded-md border p-3 ${moduleBorderColors[selectedTemplate.module] || ""}`}>
                <div className={`p-2 rounded-md shrink-0 ${moduleBgColors[selectedTemplate.module] || "bg-muted"}`}>
                  {(() => {
                    const ModuleIcon = moduleIcons[selectedTemplate.module] || FileText;
                    return <ModuleIcon className={`h-4 w-4 ${moduleColors[selectedTemplate.module] || ""}`} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{selectedTemplate.name}</p>
                  <p className={`text-xs mt-0.5 ${moduleColors[selectedTemplate.module] || "text-muted-foreground"}`}>
                    {moduleLabels[selectedTemplate.module]}
                  </p>
                </div>
              </div>
            )}

            {/* Site(s) summary */}
            {selectedSiteObjects.length > 0 && (
              <div className="space-y-1.5">
                {selectedSiteObjects.map(site => (
                  <div key={site.id} className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{site.name}</p>
                      {site.companyName && (
                        <p className="text-xs text-muted-foreground mt-0.5">{site.companyName}</p>
                      )}
                      {site.address && (
                        <p className="text-xs text-muted-foreground">{site.address}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSiteConfirmDialog(false)}
              data-testid="button-confirm-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowSiteConfirmDialog(false);
                if (moduleFolders.length === 0 && selectedTemplate && primarySiteId) {
                  provisionFoldersMutation.mutate({
                    siteId: primarySiteId,
                    module: selectedTemplate.module,
                  });
                }
                goToStep("placeholders");
              }}
              data-testid="button-confirm-continue"
            >
              Confirm & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
