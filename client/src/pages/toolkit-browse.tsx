import { useState, type ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PdfViewer } from "@/components/pdf-viewer";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  HardHat,
  Briefcase,
  Scale,
  Search,
  BookMarked,
  FolderPlus,
  AlertTriangle,
  Flame,
  HeartPulse,
  FlaskConical,
  Zap,
  Car,
  Leaf,
  Monitor,
  Wrench,
  ShieldAlert,
  CalendarMinus,
  Clock,
  Baby,
  Gavel,
  MessageSquareWarning,
  UserMinus,
  UserPlus,
  TrendingUp,
  Banknote,
  CalendarDays,
  FileSignature,
  BookOpen,
  Lock,
  Timer,
  Heart,
  UserX,
  ArrowLeftRight,
  ClipboardList,
  Users,
  Building2,
  Stethoscope,
  GraduationCap,
  Activity,
  Compass,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

type ModuleType = "health_safety" | "human_resources" | "employment_law";

interface ToolkitTemplate {
  id: string;
  name: string;
  description: string | null;
  synopsis: string | null;
  module: ModuleType;
  toolkitFolderId: string | null;
  fileName: string;
  fileUrl: string | null;
  fileSize: number;
  mimeType: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  visibility: string;
}

interface ToolkitFolder {
  id: string;
  name: string;
  module: string;
  sortOrder: number;
  templates: ToolkitTemplate[];
}

interface ToolkitData {
  folders: ToolkitFolder[];
  unassigned: ToolkitTemplate[];
}

interface PathwayNode {
  question: string;
  answers: Array<{
    label: string;
    description?: string;
    next?: PathwayNode | null;
    templateIds?: string[];
  }>;
}

interface DocumentPathway {
  id: string;
  title: string;
  description: string | null;
  module: ModuleType | null;
  tree: PathwayNode;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type ModuleConfig = {
  label: string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  cardColor: string;
  btnClass: string;
};

const MODULE_CONFIG: Record<ModuleType, ModuleConfig> = {
  health_safety: {
    label: "Health & Safety",
    Icon: HardHat,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    cardColor: "border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white border-0",
  },
  human_resources: {
    label: "Human Resources",
    Icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    cardColor: "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
    btnClass: "bg-blue-600 hover:bg-blue-700 text-white border-0",
  },
  employment_law: {
    label: "Employment Law",
    Icon: Scale,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/40",
    cardColor: "border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600",
    btnClass: "bg-pink-600 hover:bg-pink-700 text-white border-0",
  },
};

const MODULES: ModuleType[] = ["health_safety", "human_resources", "employment_law"];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  return FolderOpen;
}

async function downloadTemplate(template: ToolkitTemplate) {
  if (!template.fileUrl) return;
  try {
    await apiRequest("POST", "/api/toolkit/download", { templateId: template.id });
    const response = await fetch(template.fileUrl, { credentials: "include" });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = template.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    if (template.fileUrl) window.open(template.fileUrl, "_blank");
  }
}

function TemplateRow({ template, btnClass, onPreview }: { template: ToolkitTemplate; btnClass: string; onPreview?: () => void }) {
  const [popping, setPopping] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  const confirmDownload = () => {
    setPopping(true);
    setShowDownloadDialog(false);
    downloadTemplate(template);
  };

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
        data-testid={`row-template-${template.id}`}
      >
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" data-testid={`text-template-name-${template.id}`}>
            {template.name}
          </p>
          {template.description && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground truncate cursor-default">{template.description}</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm text-xs z-[200] whitespace-normal break-words">
                {template.description}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {template.mimeType === "application/pdf" && onPreview && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPreview}
            data-testid={`button-preview-${template.id}`}
            className="shrink-0"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => setShowDownloadDialog(true)}
          disabled={!template.fileUrl}
          data-testid={`button-download-${template.id}`}
          className={`shrink-0 ${btnClass}${popping ? " download-btn-pop" : ""}`}
          onAnimationEnd={() => setPopping(false)}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download
        </Button>
      </div>

      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className="max-w-md" data-testid={`dialog-download-${template.id}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" />
              {template.name}
            </DialogTitle>
          </DialogHeader>
          {template.synopsis ? (
            <div className="text-sm text-muted-foreground leading-relaxed py-1" data-testid={`text-synopsis-${template.id}`}>
              {template.synopsis}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-1 italic">
              No synopsis available for this template.
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDownloadDialog(false)}
              data-testid={`button-cancel-download-${template.id}`}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDownload}
              data-testid={`button-confirm-download-${template.id}`}
              className={btnClass}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Pathway Wizard step state
interface WizardStep {
  node: PathwayNode;
  selectedAnswerIndex: number | null;
}

type WizardAnimDir = "forward" | "backward";

function PathwayWizard({
  pathway,
  allTemplates,
  selectedModule,
  onClose,
  onPreview,
}: {
  pathway: DocumentPathway;
  allTemplates: ToolkitTemplate[];
  selectedModule: ModuleType;
  onClose: () => void;
  onPreview: (t: ToolkitTemplate) => void;
}) {
  const [steps, setSteps] = useState<WizardStep[]>([{ node: pathway.tree, selectedAnswerIndex: null }]);
  const [results, setResults] = useState<string[] | null>(null);
  const [animDir, setAnimDir] = useState<WizardAnimDir>("forward");
  const [animKey, setAnimKey] = useState(0);

  const currentStep = steps[steps.length - 1];
  const { color, btnClass } = MODULE_CONFIG[selectedModule];
  const modConfig = MODULE_CONFIG[selectedModule];

  const advance = (dir: WizardAnimDir, fn: () => void) => {
    setAnimDir(dir);
    setAnimKey(k => k + 1);
    fn();
  };

  const handleAnswer = (idx: number) => {
    const answer = currentStep.node.answers[idx];
    const newSteps = steps.map((s, i) => i === steps.length - 1 ? { ...s, selectedAnswerIndex: idx } : s);

    if (answer.templateIds !== undefined && !answer.next) {
      advance("forward", () => {
        setSteps(newSteps);
        setResults(answer.templateIds ?? []);
      });
    } else if (answer.next) {
      advance("forward", () => {
        setSteps([...newSteps, { node: answer.next!, selectedAnswerIndex: null }]);
      });
    } else {
      advance("forward", () => {
        setSteps(newSteps);
        setResults([]);
      });
    }
  };

  const handleBack = () => {
    if (results !== null) {
      advance("backward", () => {
        setResults(null);
        setSteps(steps.map((s, i) => i === steps.length - 1 ? { ...s, selectedAnswerIndex: null } : s));
      });
    } else if (steps.length > 1) {
      advance("backward", () => {
        setSteps(steps.slice(0, -1));
      });
    }
  };

  const handleReset = () => {
    advance("backward", () => {
      setSteps([{ node: pathway.tree, selectedAnswerIndex: null }]);
      setResults(null);
    });
  };

  const recommendedTemplates = results !== null
    ? allTemplates.filter(t => results.includes(t.id))
    : [];

  const slideClass = animDir === "forward"
    ? "animate-in slide-in-from-right-4 fade-in duration-200"
    : "animate-in slide-in-from-left-4 fade-in duration-200";

  return (
    <div className="flex flex-col h-full">
      {/* Progress breadcrumb */}
      <div className="px-6 pt-4 pb-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs ${steps.length === 1 && results === null ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            Start
          </span>
          {steps.slice(1).map((s, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className={`text-xs ${i === steps.length - 2 && results === null ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {steps[i].node.answers[steps[i].selectedAnswerIndex!]?.label}
              </span>
            </span>
          ))}
          {results !== null && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Results
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div key={animKey} className={slideClass}>
          {results !== null ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base">Recommended Templates</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Based on your answers, here are the most relevant templates for you.
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 shrink-0 text-xs font-medium px-2 py-1 rounded-full ${modConfig.bg} ${color}`}>
                  <modConfig.Icon className="h-3 w-3" />
                  {modConfig.label}
                </span>
              </div>
              {recommendedTemplates.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No specific templates found.</p>
                  <p className="text-xs mt-1">Try browsing folders above, or start over with different answers.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {recommendedTemplates.map((template) => (
                    <TemplateRow
                      key={template.id}
                      template={template}
                      btnClass={btnClass}
                      onPreview={template.mimeType === "application/pdf" ? () => onPreview(template) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-base leading-snug">{currentStep.node.question}</h3>
              </div>
              <div className="grid gap-2">
                {currentStep.node.answers.map((answer, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(idx)}
                    data-testid={`button-pathway-answer-${idx}`}
                    className={`group flex items-start gap-3 rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5 transition-all ${
                      currentStep.selectedAnswerIndex === idx ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
                      currentStep.selectedAnswerIndex === idx ? "border-primary bg-primary" : "border-muted-foreground/40 group-hover:border-primary"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug">{answer.label}</p>
                      {answer.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{answer.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 bg-background">
        <Button
          variant="ghost"
          size="sm"
          onClick={steps.length > 1 || results !== null ? handleBack : onClose}
          data-testid="button-pathway-back"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {steps.length <= 1 && results === null ? "Close" : "Back"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          data-testid="button-pathway-reset"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

export default function ToolkitBrowse() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [selectedModule, setSelectedModule] = useState<ModuleType>("health_safety");
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<ToolkitFolder | null>(null);
  const [sheetSearch, setSheetSearch] = useState("");
  const [isFolderClosing, setIsFolderClosing] = useState(false);

  const closeFolderDialog = () => {
    setIsFolderClosing(true);
  };

  const handleFolderAnimationEnd = () => {
    if (isFolderClosing) {
      setIsFolderClosing(false);
      setSelectedFolder(null);
      setSheetSearch("");
    }
  };

  // Create folder dialog
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // PDF preview
  const [previewToolkitTemplate, setPreviewToolkitTemplate] = useState<ToolkitTemplate | null>(null);

  // Pathway wizard — uses a Sheet
  const [showFinderSheet, setShowFinderSheet] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<DocumentPathway | null>(null);

  const { data: toolkit, isLoading } = useQuery<ToolkitData>({
    queryKey: ["/api/toolkit"],
  });

  const { data: pathways } = useQuery<DocumentPathway[]>({
    queryKey: ["/api/toolkit/pathways", selectedModule],
    queryFn: async () => {
      const res = await fetch(`/api/toolkit/pathways?module=${selectedModule}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch pathways");
      return res.json();
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, module }: { name: string; module: ModuleType }) =>
      apiRequest("POST", "/api/toolkit/folders", { name, module }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
      setShowCreateFolder(false);
      setNewFolderName("");
      toast({ title: "Folder created", description: "The new folder has been added to the Toolkit." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create folder.", variant: "destructive" }),
  });

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({ name: newFolderName.trim(), module: selectedModule });
  };

  const filteredFolders = (toolkit?.folders ?? []).filter(f => f.module === selectedModule);

  const visibleFolders = search.trim()
    ? filteredFolders.filter(f =>
        f.templates.some(t => t.name.toLowerCase().includes(search.toLowerCase()))
      )
    : filteredFolders;

  const sheetTemplates = selectedFolder
    ? (sheetSearch.trim()
        ? selectedFolder.templates.filter(t =>
            t.name.toLowerCase().includes(sheetSearch.toLowerCase())
          )
        : selectedFolder.templates)
    : [];

  // All templates across all folders + unassigned — pathway templateIds may reference
  // any template regardless of module or folder assignment
  const allModuleTemplates = [
    ...(toolkit?.folders ?? []).flatMap(f => f.templates),
    ...(toolkit?.unassigned ?? []),
  ];

  const activePathways = (pathways ?? []).filter(p => p.isActive);
  const pathwaysLoaded = pathways !== undefined;

  const openFinder = () => {
    if (activePathways.length === 1) {
      setSelectedPathway(activePathways[0]);
    } else {
      setSelectedPathway(null);
    }
    setShowFinderSheet(true);
  };

  const bannerStyle =
    selectedModule === "health_safety"
      ? { background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }
      : selectedModule === "human_resources"
      ? { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }
      : { background: "linear-gradient(135deg, #db2777 0%, #be185d 100%)" };

  return (
    <div className="theme-toolkit">
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <BookMarked className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Toolkit
                <span className="font-normal text-muted-foreground text-2xl"> — Browse Templates</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                Browse and download document templates organised by category.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <Button
                onClick={() => setShowCreateFolder(true)}
                data-testid="button-create-folder"
                className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            )}
          </div>
        </div>
      </div>
    <div className="space-y-7 p-6 dash-animate">

      {/* Find a Document — prominent banner */}
      <div
        className="relative overflow-hidden rounded-xl p-5 sm:p-6 text-white shadow-md cursor-pointer group"
        style={bannerStyle}
        onClick={openFinder}
        data-testid="button-find-document"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && openFinder()}
      >
        {/* Decorative large background icon */}
        <Compass
          className="absolute -right-8 -top-8 h-44 w-44 opacity-[0.07] pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/20 shrink-0 group-hover:bg-white/30 transition-colors">
              <Compass className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-0.5">
                Guided Template Finder
              </p>
              <h2 className="text-base sm:text-lg font-bold leading-snug">
                Not sure which template you need?
              </h2>
              <p className="text-sm text-white/80 mt-0.5 leading-relaxed">
                Answer a few quick questions and we'll point you to the right template.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-4 py-2.5 font-semibold text-sm sm:ml-4">
            Find a Template
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Module tabs */}
      <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-muted/50 border">
        {MODULES.map((mod) => {
          const { label, Icon, color } = MODULE_CONFIG[mod];
          const isActive = selectedModule === mod;
          return (
            <button
              key={mod}
              onClick={() => { setSelectedModule(mod); setSearch(""); }}
              data-testid={`tab-module-${mod}`}
              className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-3.5 px-3 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                isActive
                  ? `bg-background border shadow-sm ${color}`
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search folders and templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading toolkit...</div>
      ) : visibleFolders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookMarked className="h-10 w-10 mx-auto mb-3 opacity-30" />
          {search.trim() ? (
            <>
              <p className="font-medium">No folders match your search.</p>
              <p className="text-sm mt-1">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No templates available for this module yet.</p>
              {isAdmin && <p className="text-sm mt-1">Use "New Folder" to create folders, then add templates via the Template Library.</p>}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleFolders.map((folder) => {
            const { color, cardColor } = MODULE_CONFIG[folder.module as ModuleType];
            const FolderIcon = getFolderIcon(folder.name);
            const matchCount = search.trim()
              ? folder.templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).length
              : folder.templates.length;
            const iconBg =
              folder.module === "health_safety"
                ? "bg-emerald-100 dark:bg-emerald-900/40"
                : folder.module === "human_resources"
                ? "bg-blue-100 dark:bg-blue-900/40"
                : "bg-pink-100 dark:bg-pink-900/40";
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => { setSelectedFolder(folder); setSheetSearch(""); }}
                data-testid={`button-folder-${folder.id}`}
                className={`group relative flex flex-col items-start gap-4 rounded-xl border bg-card p-5 text-left hover:shadow-lg transition-all duration-200 ${cardColor}`}
              >
                <div className={`p-3 rounded-xl ${iconBg} transition-transform group-hover:scale-110 duration-200`}>
                  <FolderIcon className={`h-7 w-7 ${color}`} />
                </div>
                <div className="flex-1 min-w-0 w-full space-y-1.5">
                  <p className="font-semibold text-sm leading-snug" data-testid={`text-folder-name-${folder.id}`}>
                    {folder.name}
                  </p>
                  <p className={`text-xs font-medium ${color}`}>
                    {matchCount} {matchCount === 1 ? "file" : "files"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Folder files Dialog */}
      <Dialog
        open={selectedFolder !== null || isFolderClosing}
        onOpenChange={(o) => { if (!o) closeFolderDialog(); }}
      >
        <DialogContent
          className={`toolkit-folder-dialog max-w-2xl w-full p-0 gap-0 overflow-hidden${isFolderClosing ? " toolkit-closing" : ""}`}
          onAnimationEnd={handleFolderAnimationEnd}
        >
          {selectedFolder && (
            <>
              <DialogHeader className="px-6 py-5 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FolderOpen className={`h-5 w-5 ${MODULE_CONFIG[selectedFolder.module as ModuleType].color}`} />
                  </div>
                  <div>
                    <DialogTitle className="text-base">{selectedFolder.name}</DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      {MODULE_CONFIG[selectedFolder.module as ModuleType].label} · {selectedFolder.templates.length} {selectedFolder.templates.length === 1 ? "file" : "files"}
                    </DialogDescription>
                  </div>
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    className="pl-9 h-8 text-sm"
                    data-testid="input-dialog-search"
                  />
                </div>
              </DialogHeader>

              <div className="overflow-y-auto max-h-[60vh]">
                {sheetTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {sheetSearch.trim() ? "No files match your search." : "No files in this folder yet."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {sheetTemplates.map((template) => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        btnClass={MODULE_CONFIG[selectedFolder.module as ModuleType].btnClass}
                        onPreview={template.mimeType === "application/pdf" ? () => setPreviewToolkitTemplate(template) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={(o) => { if (!o) { setShowCreateFolder(false); setNewFolderName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Toolkit Folder</DialogTitle>
            <DialogDescription>
              Create a folder for organising templates in the <strong>{MODULE_CONFIG[selectedModule].label}</strong> module.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Risk Assessments"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              data-testid="input-folder-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-confirm-create-folder"
            >
              {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewToolkitTemplate} onOpenChange={(o) => { if (!o) setPreviewToolkitTemplate(null); }}>
        <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{previewToolkitTemplate?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewToolkitTemplate?.fileUrl && (
              <PdfViewer url={previewToolkitTemplate.fileUrl} />
            )}
          </div>
          <div className="px-5 py-3 border-t shrink-0 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewToolkitTemplate(null)} data-testid="button-close-pdf-preview">
              Close
            </Button>
            <Button
              onClick={() => previewToolkitTemplate && downloadTemplate(previewToolkitTemplate)}
              data-testid="button-download-from-pdf-preview"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guided Finder Sheet */}
      <Sheet open={showFinderSheet} onOpenChange={(o) => { if (!o) { setShowFinderSheet(false); setSelectedPathway(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0">
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              Find a Template
            </SheetTitle>
            <SheetDescription>
              Answer a few quick questions and we'll point you to the right template.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Pathway selection — when multiple pathways or none loaded yet */}
            {!selectedPathway ? (
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {!pathwaysLoaded ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : activePathways.length === 0 ? (
                  // No pathways configured for this module
                  <div className="flex flex-col items-center text-center gap-4 py-10">
                    <div className="p-3 rounded-full bg-muted">
                      <Compass className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <div>
                      <p className="font-semibold">No guided pathways available yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        A guided document finder has not been configured for{" "}
                        <strong>{MODULE_CONFIG[selectedModule].label}</strong> yet.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      In the meantime, browse the folders on this page or contact your administrator for help finding the right document.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFinderSheet(false)}
                      data-testid="button-finder-close-no-pathways"
                    >
                      <BookMarked className="h-4 w-4 mr-2" />
                      Browse Folders Instead
                    </Button>
                  </div>
                ) : (
                  // Multiple pathways — show a picker
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Choose a topic to get started:</p>
                    {activePathways.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPathway(p)}
                        data-testid={`button-pathway-picker-${p.id}`}
                        className="w-full flex items-center gap-3 p-4 rounded-lg border hover:border-primary hover:bg-primary/5 text-left transition-all group"
                      >
                        <Compass className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{p.title}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <PathwayWizard
                pathway={selectedPathway}
                allTemplates={allModuleTemplates}
                selectedModule={selectedModule}
                onClose={() => setShowFinderSheet(false)}
                onPreview={(t) => { setPreviewToolkitTemplate(t); }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </div>
  );
}
