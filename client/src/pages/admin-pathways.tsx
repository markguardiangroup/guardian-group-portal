import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { type ComponentType } from "react";
import {
  Compass,
  Plus,
  Pencil,
  Trash2,
  HardHat,
  Briefcase,
  Scale,
  AlertCircle,
  CheckCircle2,
  Globe,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Search,
} from "lucide-react";

type PathwayModuleType = "health_safety" | "human_resources" | "employment_law" | "all";

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
  module: "health_safety" | "human_resources" | "employment_law" | null;
  tree: PathwayNode;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TreeStats {
  questionCount: number;
  endpointCount: number;
  maxDepth: number;
}

interface PathwayPayload {
  title: string;
  description: string | null;
  module: "health_safety" | "human_resources" | "employment_law" | null;
  tree: PathwayNode;
  isActive: boolean;
  sortOrder: number;
}

interface ToolkitTemplateRef {
  id: string;
  name: string;
  description: string | null;
  module: string;
  toolkitFolderId: string | null;
}

interface ToolkitFolderRef {
  id: string;
  name: string;
  module: string;
  templates: ToolkitTemplateRef[];
}

interface ToolkitDataRef {
  folders: ToolkitFolderRef[];
  unassigned: ToolkitTemplateRef[];
}

type AdminModuleConfig = { label: string; Icon: ComponentType<{ className?: string }>; color: string; bg: string };

const MODULE_CONFIG: Record<string, AdminModuleConfig> = {
  health_safety: {
    label: "Health & Safety",
    Icon: HardHat,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  human_resources: {
    label: "Human Resources",
    Icon: Briefcase,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/40",
  },
  employment_law: {
    label: "Employment Law",
    Icon: Scale,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/40",
  },
  all: {
    label: "All Modules",
    Icon: Globe,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/40",
  },
};

const DEFAULT_TREE_TEMPLATE = JSON.stringify({
  question: "What type of document do you need?",
  answers: [
    {
      label: "Policy",
      description: "Formal written policy document",
      templateIds: [],
    },
    {
      label: "Procedure",
      description: "Step-by-step procedure guide",
      next: {
        question: "Which area does this procedure cover?",
        answers: [
          { label: "General", templateIds: [] },
          { label: "Specific risk area", templateIds: [] },
        ],
      },
    },
  ],
}, null, 2);

function analyzeTree(node: PathwayNode, depth = 1): TreeStats {
  let questionCount = 1;
  let endpointCount = 0;
  let maxDepth = depth;

  for (const answer of node.answers) {
    if (answer.next) {
      const sub = analyzeTree(answer.next, depth + 1);
      questionCount += sub.questionCount;
      endpointCount += sub.endpointCount;
      maxDepth = Math.max(maxDepth, sub.maxDepth);
    } else {
      endpointCount++;
    }
  }

  return { questionCount, endpointCount, maxDepth };
}

export default function AdminPathways() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editPathway, setEditPathway] = useState<DocumentPathway | null>(null);
  const [deletePathwayId, setDeletePathwayId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formModule, setFormModule] = useState<PathwayModuleType>("health_safety");
  const [formTree, setFormTree] = useState(DEFAULT_TREE_TEMPLATE);
  const [formActive, setFormActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [treeStats, setTreeStats] = useState<TreeStats | null>(null);
  const [showTemplateRef, setShowTemplateRef] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: pathways, isLoading } = useQuery<DocumentPathway[]>({
    queryKey: ["/api/toolkit/pathways"],
  });

  const { data: toolkitData } = useQuery<ToolkitDataRef>({
    queryKey: ["/api/toolkit"],
  });

  const createMutation = useMutation({
    mutationFn: (data: PathwayPayload) => apiRequest("POST", "/api/toolkit/pathways", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit/pathways"] });
      toast({ title: "Pathway created", description: "The guided finder pathway has been created." });
      closeForm();
    },
    onError: () => toast({ title: "Error", description: "Failed to create pathway.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PathwayPayload }) =>
      apiRequest("PATCH", `/api/toolkit/pathways/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit/pathways"] });
      toast({ title: "Pathway updated", description: "Changes have been saved." });
      closeForm();
    },
    onError: () => toast({ title: "Error", description: "Failed to update pathway.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/toolkit/pathways/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit/pathways"] });
      toast({ title: "Pathway deleted", description: "The pathway has been removed." });
      setDeletePathwayId(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete pathway.", variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/toolkit/pathways/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit/pathways"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditPathway(null);
    setFormTitle("");
    setFormDesc("");
    setFormModule("health_safety");
    setFormTree(DEFAULT_TREE_TEMPLATE);
    setFormActive(true);
    setFormSortOrder(0);
    setTreeError(null);
    setTreeStats(null);
    setShowForm(true);
  };

  const openEdit = (p: DocumentPathway) => {
    setEditPathway(p);
    setFormTitle(p.title);
    setFormDesc(p.description ?? "");
    setFormModule(p.module ?? "all");
    setFormTree(JSON.stringify(p.tree, null, 2));
    setFormActive(p.isActive);
    setFormSortOrder(p.sortOrder ?? 0);
    setTreeError(null);
    setTreeStats(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditPathway(null);
    setTreeError(null);
    setTreeStats(null);
  };

  const handleValidate = () => {
    try {
      const parsed: PathwayNode = JSON.parse(formTree);
      if (!parsed.question || !Array.isArray(parsed.answers)) {
        throw new Error("Root node must have a 'question' string and 'answers' array.");
      }
      const stats = analyzeTree(parsed);
      setTreeStats(stats);
      setTreeError(null);
    } catch (e) {
      setTreeError(e instanceof Error ? e.message : "Invalid JSON");
      setTreeStats(null);
    }
  };

  const handleSubmit = () => {
    if (!formTitle.trim()) return;
    let parsedTree: PathwayNode;
    try {
      parsedTree = JSON.parse(formTree);
      if (!parsedTree.question || !Array.isArray(parsedTree.answers)) {
        throw new Error("Tree must have a 'question' string and 'answers' array.");
      }
      setTreeError(null);
    } catch (e) {
      setTreeError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      module: formModule === "all" ? null : formModule,
      tree: parsedTree,
      isActive: formActive,
      sortOrder: formSortOrder,
    };

    if (editPathway) {
      updateMutation.mutate({ id: editPathway.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 dash-animate p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Compass className="h-7 w-7 text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Manage Pathways</h1>
            <p className="text-muted-foreground text-sm">
              Create and manage guided document finder pathways for Toolkit users.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-create-pathway">
          <Plus className="h-4 w-4 mr-2" />
          New Pathway
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading pathways...</div>
      ) : !pathways || pathways.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Compass className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pathways created yet.</p>
          <p className="text-sm mt-1">Create a pathway to help users find the right templates.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pathways.map((pathway) => {
            const modKey = pathway.module ?? "all";
            const mod = MODULE_CONFIG[modKey] || MODULE_CONFIG.all;
            return (
              <div
                key={pathway.id}
                data-testid={`card-pathway-${pathway.id}`}
                className="flex items-center gap-4 rounded-xl border bg-card p-4"
              >
                <div className={`p-2.5 rounded-lg ${mod.bg} shrink-0`}>
                  <mod.Icon className={`h-5 w-5 ${mod.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" data-testid={`text-pathway-title-${pathway.id}`}>
                      {pathway.title}
                    </p>
                    <Badge variant={pathway.isActive ? "default" : "secondary"} className="text-xs">
                      {pathway.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${mod.color}`}>
                      {mod.label}
                    </Badge>
                  </div>
                  {pathway.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{pathway.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={pathway.isActive}
                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: pathway.id, isActive: checked })}
                    data-testid={`switch-pathway-active-${pathway.id}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(pathway)}
                    data-testid={`button-edit-pathway-${pathway.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletePathwayId(pathway.id)}
                    data-testid={`button-delete-pathway-${pathway.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPathway ? "Edit Pathway" : "New Pathway"}</DialogTitle>
            <DialogDescription>
              {editPathway
                ? "Update the guided finder pathway."
                : "Create a decision-tree pathway to help users find the right templates."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pathway-title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="pathway-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Find the Right HR Template"
                  data-testid="input-pathway-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pathway-module">Module</Label>
                <Select value={formModule} onValueChange={(v) => setFormModule(v as PathwayModuleType)}>
                  <SelectTrigger id="pathway-module" data-testid="select-pathway-module">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    <SelectItem value="health_safety">Health & Safety</SelectItem>
                    <SelectItem value="human_resources">Human Resources</SelectItem>
                    <SelectItem value="employment_law">Employment Law</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pathway-desc">Description</Label>
                <Input
                  id="pathway-desc"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description shown to users"
                  data-testid="input-pathway-desc"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pathway-sort">Sort Order</Label>
                <Input
                  id="pathway-sort"
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  data-testid="input-pathway-sort"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pathway-tree">
                  Decision Tree (JSON) <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleValidate}
                  data-testid="button-validate-tree"
                  className="h-7 text-xs"
                >
                  Validate & Preview
                </Button>
              </div>
              <Textarea
                id="pathway-tree"
                value={formTree}
                onChange={(e) => { setFormTree(e.target.value); setTreeError(null); setTreeStats(null); }}
                rows={16}
                className="font-mono text-xs"
                data-testid="textarea-pathway-tree"
                spellCheck={false}
              />
              {treeError && (
                <p className="text-xs text-destructive flex items-center gap-1" data-testid="text-tree-error">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {treeError}
                </p>
              )}
              {treeStats && !treeError && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-2" data-testid="text-tree-stats">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Valid JSON tree —</span>
                  <span><strong>{treeStats.questionCount}</strong> question{treeStats.questionCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span><strong>{treeStats.endpointCount}</strong> end point{treeStats.endpointCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>max depth <strong>{treeStats.maxDepth}</strong></span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Each node needs <code className="bg-muted px-1 rounded">question</code> and{" "}
                <code className="bg-muted px-1 rounded">answers</code>. Each answer can have{" "}
                <code className="bg-muted px-1 rounded">next</code> (branch) or{" "}
                <code className="bg-muted px-1 rounded">templateIds</code> (leaf).
              </p>
            </div>

            {/* Template Reference Panel */}
            <div className="rounded-lg border bg-muted/20">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
                onClick={() => setShowTemplateRef(!showTemplateRef)}
                data-testid="button-toggle-template-ref"
              >
                <span className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  Browse Template IDs
                </span>
                {showTemplateRef ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showTemplateRef && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Copy a template ID and paste it into the <code className="bg-muted px-1 rounded">templateIds</code> array in your JSON tree above.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="Search templates..."
                      className="pl-8 h-8 text-xs"
                      data-testid="input-template-search"
                    />
                  </div>
                  <div className="h-48 overflow-y-auto rounded-md border bg-background">
                    <div className="p-1 space-y-px">
                      {(() => {
                        const allRefs: (ToolkitTemplateRef & { folderName?: string })[] = [
                          ...(toolkitData?.folders ?? []).flatMap(f =>
                            f.templates.map(t => ({ ...t, folderName: f.name }))
                          ),
                          ...(toolkitData?.unassigned ?? []).map(t => ({ ...t, folderName: undefined })),
                        ];
                        const filtered = allRefs.filter(t =>
                          !templateSearch ||
                          t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
                          (t.folderName ?? "").toLowerCase().includes(templateSearch.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              No templates found.
                            </p>
                          );
                        }
                        return filtered.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 group"
                            data-testid={`row-template-ref-${t.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{t.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">{t.id}</p>
                            </div>
                            {t.folderName && (
                              <span className="text-[10px] text-muted-foreground shrink-0 hidden group-hover:inline">{t.folderName}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(t.id);
                                setCopiedId(t.id);
                                setTimeout(() => setCopiedId(null), 1800);
                              }}
                              className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                              title="Copy ID"
                              data-testid={`button-copy-template-id-${t.id}`}
                            >
                              {copiedId === t.id ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="pathway-active"
                checked={formActive}
                onCheckedChange={setFormActive}
                data-testid="switch-form-pathway-active"
              />
              <Label htmlFor="pathway-active" className="cursor-pointer">
                Active (visible to users)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formTitle.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-pathway"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editPathway
                ? "Save Changes"
                : "Create Pathway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePathwayId} onOpenChange={(o) => { if (!o) setDeletePathwayId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pathway?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the guided finder pathway. Users will no longer see this pathway in the "Find a Document" flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePathwayId && deleteMutation.mutate(deletePathwayId)}
              data-testid="button-confirm-delete-pathway"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Pathway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
