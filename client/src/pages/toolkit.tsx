import { useState, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Download,
  Upload,
  History,
  FileText,
  FolderOpen,
  Inbox,
  HardHat,
  Briefcase,
  Scale,
  Search,
  BookMarked,
  GripVertical,
  FolderPlus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";

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

interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  fileName: string;
  fileUrl: string | null;
  fileSize: number;
  mimeType: string | null;
  changeNote: string | null;
  uploadedBy: string;
  createdAt: string;
}

const MODULE_CONFIG: Record<ModuleType, { label: string; Icon: any; color: string }> = {
  health_safety: { label: "Health & Safety", Icon: HardHat, color: "text-emerald-600 dark:text-emerald-400" },
  human_resources: { label: "Human Resources", Icon: Briefcase, color: "text-blue-600 dark:text-blue-400" },
  employment_law: { label: "Employment Law", Icon: Scale, color: "text-pink-600 dark:text-pink-400" },
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

async function downloadTemplate(template: ToolkitTemplate) {
  if (!template.fileUrl) return;
  try {
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
    window.open(template.fileUrl, "_blank");
  }
}

async function downloadVersion(version: TemplateVersion) {
  if (!version.fileUrl) return;
  try {
    const response = await fetch(version.fileUrl, { credentials: "include" });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = version.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    if (version.fileUrl) window.open(version.fileUrl, "_blank");
  }
}

function DraggableTemplateRow({
  template,
  canEdit,
  onReplace,
  onHistory,
}: {
  template: ToolkitTemplate;
  canEdit: boolean;
  onReplace: (t: ToolkitTemplate) => void;
  onHistory: (t: ToolkitTemplate) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: template.id,
    data: { template },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-opacity ${isDragging ? "opacity-40" : "opacity-100"}`}
    >
      {canEdit && (
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          data-testid={`drag-handle-${template.id}`}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" data-testid={`text-template-name-${template.id}`}>{template.name}</p>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-xs hidden sm:inline-flex">{getMimeLabel(template.mimeType)}</Badge>
        <Badge variant="secondary" className="text-xs">v{template.version}</Badge>
        <span className="text-xs text-muted-foreground hidden md:inline">
          {format(new Date(template.updatedAt), "d MMM yyyy")}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadTemplate(template)}
          data-testid={`button-download-${template.id}`}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline ml-1">Download</span>
        </Button>
        {canEdit && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReplace(template)}
              data-testid={`button-replace-${template.id}`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Replace</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onHistory(template)}
              data-testid={`button-history-${template.id}`}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DroppableFolder({
  folder,
  children,
  isOver,
  canEdit,
  onDelete,
}: {
  folder: ToolkitFolder;
  children: React.ReactNode;
  isOver: boolean;
  canEdit: boolean;
  onDelete: (folder: ToolkitFolder) => void;
}) {
  const { setNodeRef } = useDroppable({ id: folder.id, data: { folderId: folder.id } });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm flex-1" data-testid={`folder-name-${folder.id}`}>{folder.name}</span>
        <Badge variant="secondary" className="text-xs">{folder.templates.length} template{folder.templates.length !== 1 ? "s" : ""}</Badge>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(folder)}
            data-testid={`button-delete-folder-${folder.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function DroppableUnassigned({
  children,
  isOver,
}: {
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: "__unassigned__", data: { folderId: null } });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-dashed transition-colors ${isOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
    >
      {children}
    </div>
  );
}

export default function Toolkit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "consultant";

  const [selectedModule, setSelectedModule] = useState<ModuleType>("health_safety");
  const [search, setSearch] = useState("");
  const [replaceTemplate, setReplaceTemplate] = useState<ToolkitTemplate | null>(null);
  const [historyTemplate, setHistoryTemplate] = useState<ToolkitTemplate | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [newFile, setNewFile] = useState<{ fileUrl: string; fileName: string; fileSize: number; mimeType: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Create folder dialog
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Delete folder confirmation
  const [deletingFolder, setDeletingFolder] = useState<ToolkitFolder | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: toolkit, isLoading } = useQuery<ToolkitData>({
    queryKey: ["/api/toolkit"],
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery<TemplateVersion[]>({
    queryKey: ["/api/document-templates", historyTemplate?.id, "versions"],
    enabled: !!historyTemplate,
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

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) =>
      apiRequest("DELETE", `/api/toolkit/folders/${folderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
      setDeletingFolder(null);
      toast({ title: "Folder deleted", description: "The folder has been removed. Any templates in it are now unassigned." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete folder.", variant: "destructive" }),
  });

  const replaceMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: any }) =>
      apiRequest("POST", `/api/toolkit/${templateId}/replace`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
      setReplaceTemplate(null);
      setNewFile(null);
      setChangeNote("");
      toast({ title: "File replaced", description: "The template file has been updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to replace file.", variant: "destructive" }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ templateId, toolkitFolderId }: { templateId: string; toolkitFolderId: string | null }) =>
      apiRequest("PATCH", `/api/document-templates/${templateId}`, { toolkitFolderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolkit"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to move template.", variant: "destructive" }),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    const templateId = active.id as string;
    const targetFolderId = over.id === "__unassigned__" ? null : over.id as string;

    const allTemplates = [
      ...(toolkit?.folders.flatMap(f => f.templates) ?? []),
      ...(toolkit?.unassigned ?? []),
    ];
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;

    const currentFolderId = toolkit?.folders.find(f =>
      f.templates.some(t => t.id === templateId)
    )?.id ?? null;

    if (currentFolderId === targetFolderId) return;

    moveMutation.mutate({ templateId, toolkitFolderId: targetFolderId });
  }, [toolkit, moveMutation]);

  const handleReplace = () => {
    if (!replaceTemplate || !newFile) return;
    replaceMutation.mutate({
      templateId: replaceTemplate.id,
      data: { ...newFile, changeNote: changeNote || undefined },
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({ name: newFolderName.trim(), module: selectedModule });
  };

  const filteredFolders = (toolkit?.folders ?? []).filter(f => f.module === selectedModule);
  const filteredUnassigned = (toolkit?.unassigned ?? []).filter(t => t.module === selectedModule);

  const applySearch = (templates: ToolkitTemplate[]) =>
    search.trim()
      ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
      : templates;

  const activeTemplate = activeId
    ? [...(toolkit?.folders.flatMap(f => f.templates) ?? []), ...(toolkit?.unassigned ?? [])].find(t => t.id === activeId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BookMarked className="h-7 w-7 text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">Toolkit</h1>
            <p className="text-muted-foreground text-sm">
              Download public document templates.
              {canEdit && " Drag templates between folders to organise them, or replace files to update the template."}
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
              onClick={() => setSelectedModule(mod)}
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
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading toolkit...</div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {/* Folders with templates */}
            {filteredFolders.map((folder) => {
              const visibleTemplates = applySearch(folder.templates);
              if (!canEdit && visibleTemplates.length === 0) return null;
              const isOver = overId === folder.id;

              return (
                <DroppableFolder
                  key={folder.id}
                  folder={folder}
                  isOver={isOver}
                  canEdit={isAdmin}
                  onDelete={setDeletingFolder}
                >
                  {visibleTemplates.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {canEdit ? "Drop templates here" : "No templates in this folder"}
                    </div>
                  ) : (
                    visibleTemplates.map((template) => (
                      <DraggableTemplateRow
                        key={template.id}
                        template={template}
                        canEdit={canEdit}
                        onReplace={setReplaceTemplate}
                        onHistory={setHistoryTemplate}
                      />
                    ))
                  )}
                </DroppableFolder>
              );
            })}

            {/* Unassigned section */}
            {(canEdit || filteredUnassigned.length > 0) && (
              <DroppableUnassigned isOver={overId === "__unassigned__"}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-muted-foreground/30">
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm text-muted-foreground">Unassigned</span>
                  <Badge variant="outline" className="text-xs ml-auto">{filteredUnassigned.length}</Badge>
                </div>
                {applySearch(filteredUnassigned).length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {canEdit ? "Templates not yet assigned to a folder will appear here. Drag to assign." : "No unassigned templates."}
                  </div>
                ) : (
                  applySearch(filteredUnassigned).map((template) => (
                    <DraggableTemplateRow
                      key={template.id}
                      template={template}
                      canEdit={canEdit}
                      onReplace={setReplaceTemplate}
                      onHistory={setHistoryTemplate}
                    />
                  ))
                )}
              </DroppableUnassigned>
            )}

            {/* Empty state */}
            {filteredFolders.length === 0 && filteredUnassigned.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <BookMarked className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No templates available for this module yet.</p>
                {canEdit && <p className="text-sm mt-1">Add public templates in the Template Library to display them here.</p>}
                {isAdmin && <p className="text-sm mt-1">Use "New Folder" to create folders for organising templates.</p>}
              </div>
            )}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTemplate && (
              <div className="flex items-center gap-3 px-4 py-3 bg-card border rounded-lg shadow-lg opacity-90">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{activeTemplate.name}</span>
                <Badge variant="secondary" className="text-xs">v{activeTemplate.version}</Badge>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

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

      {/* Delete Folder Confirmation */}
      <Dialog open={!!deletingFolder} onOpenChange={(o) => { if (!o) setDeletingFolder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingFolder?.name}</strong>?
              {(deletingFolder?.templates.length ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  The {deletingFolder?.templates.length} template{deletingFolder?.templates.length !== 1 ? "s" : ""} inside will be moved to Unassigned.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFolder(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingFolder && deleteFolderMutation.mutate(deletingFolder.id)}
              disabled={deleteFolderMutation.isPending}
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace File Dialog */}
      <Dialog open={!!replaceTemplate} onOpenChange={(o) => { if (!o) { setReplaceTemplate(null); setNewFile(null); setChangeNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Template File</DialogTitle>
            <DialogDescription>
              Upload a new file for <strong>{replaceTemplate?.name}</strong>. The current file will be saved in version history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New File</Label>
              <SimpleFileUpload
                onUploadComplete={(result) => setNewFile({
                  fileUrl: result.objectPath,
                  fileName: result.fileName,
                  fileSize: result.fileSize,
                  mimeType: result.mimeType,
                })}
                onError={(err) => toast({ title: "Upload failed", description: err, variant: "destructive" })}
              />
              {newFile && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Ready: {newFile.fileName} ({formatBytes(newFile.fileSize)})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-note">Change Note (optional)</Label>
              <Textarea
                id="change-note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={2}
                data-testid="input-change-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplaceTemplate(null); setNewFile(null); setChangeNote(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleReplace}
              disabled={!newFile || replaceMutation.isPending}
              data-testid="button-confirm-replace"
            >
              {replaceMutation.isPending ? "Replacing..." : "Replace File"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!historyTemplate} onOpenChange={(o) => { if (!o) setHistoryTemplate(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{historyTemplate?.name}</DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading history...</div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No version history available.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">
                <span>Version</span>
                <span>File</span>
                <span>Date</span>
                <span></span>
              </div>
              {versions.map((v) => (
                <div key={v.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t text-sm">
                  <Badge variant="secondary" className="text-xs w-fit">v{v.version}</Badge>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{v.fileName}</p>
                    {v.changeNote && <p className="text-xs text-muted-foreground truncate">{v.changeNote}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(v.createdAt), "d MMM yyyy")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadVersion(v)}
                    disabled={!v.fileUrl}
                    data-testid={`button-download-version-${v.id}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
