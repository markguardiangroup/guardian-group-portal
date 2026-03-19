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
  Globe,
  Search,
  X,
  GitBranch,
  FileText,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  Tag,
} from "lucide-react";

type PathwayModuleType = "health_safety" | "human_resources" | "employment_law" | "all";

interface PathwayAnswer {
  label: string;
  description?: string;
  next?: PathwayNode;
  templateIds?: string[];
}

interface PathwayNode {
  question: string;
  answers: PathwayAnswer[];
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

const DEFAULT_TREE: PathwayNode = {
  question: "What type of document do you need?",
  answers: [
    { label: "Policy", description: "Formal written policy document", templateIds: [] },
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
};

// ---------- TemplatePicker ----------
function TemplatePicker({
  selectedIds,
  onChange,
  allTemplates,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  allTemplates: ToolkitTemplateRef[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = allTemplates.filter((t) => selectedIds.includes(t.id));
  const available = allTemplates.filter(
    (t) =>
      !selectedIds.includes(t.id) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <Badge
              key={t.id}
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1 py-1 text-xs"
              data-testid={`badge-template-${t.id}`}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate">{t.name}</span>
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== t.id))}
                className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
                data-testid={`button-remove-template-${t.id}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <div
          className="flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors text-xs text-muted-foreground"
          onClick={() => setOpen(!open)}
          data-testid="button-open-template-picker"
        >
          <Plus className="h-3 w-3" />
          Add template
        </div>

        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 w-72 rounded-lg border bg-popover shadow-lg">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-7 h-7 text-xs"
                  data-testid="input-template-picker-search"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {search ? "No templates match your search." : "All templates already added."}
                </p>
              ) : (
                available.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/60 text-xs flex items-center gap-2"
                    onClick={() => {
                      onChange([...selectedIds, t.id]);
                      setSearch("");
                      setOpen(false);
                    }}
                    data-testid={`option-template-${t.id}`}
                  >
                    <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))
              )}
            </div>
            <div className="p-1 border-t">
              <button
                type="button"
                className="w-full text-xs text-muted-foreground py-1 hover:text-foreground"
                onClick={() => { setOpen(false); setSearch(""); }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- AnswerEditor ----------
function AnswerEditor({
  answer,
  index,
  onChange,
  onDelete,
  depth,
  allTemplates,
}: {
  answer: PathwayAnswer;
  index: number;
  onChange: (updated: PathwayAnswer) => void;
  onDelete: () => void;
  depth: number;
  allTemplates: ToolkitTemplateRef[];
}) {
  const isLeaf = !answer.next;
  const [collapsed, setCollapsed] = useState(false);

  const switchToLeaf = () => onChange({ label: answer.label, description: answer.description, templateIds: [] });
  const switchToBranch = () =>
    onChange({
      label: answer.label,
      description: answer.description,
      next: { question: "", answers: [{ label: "", templateIds: [] }] },
    });

  return (
    <div
      className="rounded-lg border bg-card"
      data-testid={`answer-editor-${depth}-${index}`}
    >
      {/* Answer header */}
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <Input
            value={answer.label}
            onChange={(e) => onChange({ ...answer, label: e.target.value })}
            placeholder="Answer label, e.g. Yes / A new employee is starting"
            className="h-8 text-sm font-medium"
            data-testid={`input-answer-label-${depth}-${index}`}
          />
          {!collapsed && (
            <Input
              value={answer.description ?? ""}
              onChange={(e) =>
                onChange({ ...answer, description: e.target.value || undefined })
              }
              placeholder="Optional description shown under the answer"
              className="h-7 text-xs"
              data-testid={`input-answer-desc-${depth}-${index}`}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 mt-0.5 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          data-testid={`button-delete-answer-${depth}-${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Type toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={switchToLeaf}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isLeaf
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:bg-muted/50"
              }`}
              data-testid={`button-leaf-${depth}-${index}`}
            >
              <Tag className="h-3 w-3" />
              Attach templates
            </button>
            <button
              type="button"
              onClick={switchToBranch}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                !isLeaf
                  ? "bg-primary text-primary-foreground"
                  : "border text-muted-foreground hover:bg-muted/50"
              }`}
              data-testid={`button-branch-${depth}-${index}`}
            >
              <GitBranch className="h-3 w-3" />
              Follow-up question
            </button>
          </div>

          {/* Leaf: template picker */}
          {isLeaf && (
            <div className="pl-1">
              <TemplatePicker
                selectedIds={answer.templateIds ?? []}
                onChange={(ids) => onChange({ ...answer, templateIds: ids })}
                allTemplates={allTemplates}
              />
              {(answer.templateIds ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No templates attached yet — users will see an empty result at this endpoint.
                </p>
              )}
            </div>
          )}

          {/* Branch: nested node editor */}
          {!isLeaf && answer.next && (
            <div className="border-l-2 border-muted pl-3 ml-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <ArrowDown className="h-3 w-3" />
                Follow-up question
              </div>
              <NodeEditor
                node={answer.next}
                onChange={(updated) => onChange({ ...answer, next: updated })}
                depth={depth + 1}
                allTemplates={allTemplates}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- NodeEditor ----------
function NodeEditor({
  node,
  onChange,
  depth,
  allTemplates,
}: {
  node: PathwayNode;
  onChange: (updated: PathwayNode) => void;
  depth: number;
  allTemplates: ToolkitTemplateRef[];
}) {
  const addAnswer = () =>
    onChange({ ...node, answers: [...node.answers, { label: "", templateIds: [] }] });

  const updateAnswer = (i: number, updated: PathwayAnswer) => {
    const answers = [...node.answers];
    answers[i] = updated;
    onChange({ ...node, answers });
  };

  const deleteAnswer = (i: number) =>
    onChange({ ...node, answers: node.answers.filter((_, j) => j !== i) });

  return (
    <div className="space-y-2">
      <Input
        value={node.question}
        onChange={(e) => onChange({ ...node, question: e.target.value })}
        placeholder="Question shown to the user, e.g. What are you looking for?"
        className="font-medium"
        data-testid={`input-question-${depth}`}
      />

      <div className="space-y-2 pl-2">
        {node.answers.map((answer, i) => (
          <AnswerEditor
            key={i}
            answer={answer}
            index={i}
            onChange={(updated) => updateAnswer(i, updated)}
            onDelete={() => deleteAnswer(i)}
            depth={depth}
            allTemplates={allTemplates}
          />
        ))}

        <button
          type="button"
          onClick={addAnswer}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md border border-dashed hover:border-border hover:bg-muted/30 transition-colors w-full"
          data-testid={`button-add-answer-${depth}`}
        >
          <Plus className="h-3 w-3" />
          Add answer
        </button>
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function AdminPathways() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editPathway, setEditPathway] = useState<DocumentPathway | null>(null);
  const [deletePathwayId, setDeletePathwayId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formModule, setFormModule] = useState<PathwayModuleType>("health_safety");
  const [formTree, setFormTree] = useState<PathwayNode>(DEFAULT_TREE);
  const [formActive, setFormActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);

  const { data: pathways, isLoading } = useQuery<DocumentPathway[]>({
    queryKey: ["/api/toolkit/pathways"],
  });

  const { data: toolkitData } = useQuery<ToolkitDataRef>({
    queryKey: ["/api/toolkit"],
  });

  const allTemplates: ToolkitTemplateRef[] = [
    ...(toolkitData?.folders ?? []).flatMap((f) => f.templates),
    ...(toolkitData?.unassigned ?? []),
  ];

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
    setFormTree(DEFAULT_TREE);
    setFormActive(true);
    setFormSortOrder(0);
    setShowForm(true);
  };

  const openEdit = (p: DocumentPathway) => {
    setEditPathway(p);
    setFormTitle(p.title);
    setFormDesc(p.description ?? "");
    setFormModule(p.module ?? "all");
    setFormTree(p.tree);
    setFormActive(p.isActive);
    setFormSortOrder(p.sortOrder ?? 0);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditPathway(null);
  };

  const handleSubmit = () => {
    if (!formTitle.trim()) return;
    if (!formTree.question || !Array.isArray(formTree.answers)) {
      toast({ title: "Error", description: "The tree must have at least one question.", variant: "destructive" });
      return;
    }

    const payload: PathwayPayload = {
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      module: formModule === "all" ? null : formModule,
      tree: formTree,
      isActive: formActive,
      sortOrder: formSortOrder,
    };

    if (editPathway) {
      updateMutation.mutate({ id: editPathway.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!user || user.role !== "admin") {
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
        <DialogContent className="max-w-3xl w-full max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPathway ? "Edit Pathway" : "New Pathway"}</DialogTitle>
            <DialogDescription>
              {editPathway
                ? "Update the guided finder pathway."
                : "Build a decision-tree pathway to help users find the right templates."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Title + Module */}
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

            {/* Description + Sort */}
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

            {/* Visual tree editor */}
            <div className="space-y-2">
              <Label>Decision Tree</Label>
              <p className="text-xs text-muted-foreground">
                Build the flow below. Each question has answers — an answer can either attach templates (shown to the user as results) or branch into a follow-up question.
              </p>
              <div className="rounded-lg border bg-muted/10 p-4">
                <NodeEditor
                  node={formTree}
                  onChange={setFormTree}
                  depth={0}
                  allTemplates={allTemplates}
                />
              </div>
            </div>

            {/* Active toggle */}
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
