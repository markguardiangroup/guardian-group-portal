import { useState } from "react";
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
  Download,
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
} from "lucide-react";
import { format } from "date-fns";

type ModuleType = "health_safety" | "human_resources" | "employment_law";

interface ToolkitTemplate {
  id: string;
  name: string;
  description: string | null;
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

const MODULE_CONFIG: Record<ModuleType, { label: string; Icon: any; color: string; cardColor: string; btnClass: string }> = {
  health_safety: {
    label: "Health & Safety",
    Icon: HardHat,
    color: "text-emerald-600 dark:text-emerald-400",
    cardColor: "border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white border-0",
  },
  human_resources: {
    label: "Human Resources",
    Icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    cardColor: "border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600",
    btnClass: "bg-blue-600 hover:bg-blue-700 text-white border-0",
  },
  employment_law: {
    label: "Employment Law",
    Icon: Scale,
    color: "text-pink-600 dark:text-pink-400",
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

function getMimeLabel(mimeType: string) {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word") || mimeType.includes("docx")) return "Word";
  if (mimeType.includes("excel") || mimeType.includes("xlsx")) return "Excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("pptx")) return "PowerPoint";
  if (mimeType.includes("text")) return "Text";
  return "File";
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

function TemplateRow({ template, btnClass }: { template: ToolkitTemplate; btnClass: string }) {
  const [popping, setPopping] = useState(false);

  const handleDownload = () => {
    setPopping(true);
    downloadTemplate(template);
  };

  return (
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
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{getMimeLabel(template.mimeType)}</Badge>
          <Badge variant="secondary" className="text-xs">v{template.version}</Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(template.updatedAt), "d MMM yyyy")}
          </span>
          <span className="text-xs text-muted-foreground">{formatBytes(template.fileSize)}</span>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleDownload}
        disabled={!template.fileUrl}
        data-testid={`button-download-${template.id}`}
        className={`shrink-0 ${btnClass}${popping ? " download-btn-pop" : ""}`}
        onAnimationEnd={() => setPopping(false)}
      >
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Download
      </Button>
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

  const { data: toolkit, isLoading } = useQuery<ToolkitData>({
    queryKey: ["/api/toolkit"],
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BookMarked className="h-7 w-7 text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Browse Templates</h1>
            <p className="text-muted-foreground text-sm">
              Browse and download document templates organised by category.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowCreateFolder(true)}
            data-testid="button-create-folder"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        )}
      </div>

      {/* Module tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/50 border">
        {MODULES.map((mod) => {
          const { label, Icon, color } = MODULE_CONFIG[mod];
          const isActive = selectedModule === mod;
          return (
            <button
              key={mod}
              onClick={() => { setSelectedModule(mod); setSearch(""); }}
              data-testid={`tab-module-${mod}`}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 px-2 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                isActive
                  ? `bg-background border shadow-sm ${color}`
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
              }`}
            >
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
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
    </div>
  );
}
