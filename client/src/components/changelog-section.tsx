import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  GitBranch,
  FileDown,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { exportChangelogPdf } from "@/lib/export-pdf";

export type ChangelogCategory = "bug" | "enhancement" | "feature" | "other";

export interface ChangelogEntry {
  id: string;
  patch: number;
  message: string;
  category: ChangelogCategory;
  createdAt: string;
  createdBy: string;
}

export interface ChangelogVersion {
  id: string;
  major: number;
  minor: number;
  patch: number;
  /** The patch number last pushed to production. When publishedPatch < patch, there are unreleased changes. */
  publishedPatch?: number;
  label: string;
  isActive: boolean;
  createdAt: string;
  entries: ChangelogEntry[];
}

export interface ChangelogData {
  activeVersionId: string;
  versions: ChangelogVersion[];
}

const CATEGORY_LABELS: Record<ChangelogCategory, string> = {
  bug: "Bug Fix",
  enhancement: "Enhancement",
  feature: "New Feature",
  other: "Other",
};

const CATEGORY_COLORS: Record<ChangelogCategory, string> = {
  bug: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  enhancement: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  feature: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  other: "bg-muted text-muted-foreground",
};

function versionLabel(v: ChangelogVersion) {
  return `v${v.major}.${v.minor}`;
}

function formatPatch(v: ChangelogVersion, patch: number) {
  return `v${v.major}.${v.minor}.${String(patch).padStart(2, "0")}`;
}

export default function ChangelogSection() {
  const qc = useQueryClient();
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editCategory, setEditCategory] = useState<ChangelogCategory>("bug");
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionBump, setNewVersionBump] = useState<"patch" | "minor" | "major">("minor");
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [addEntryVersionId, setAddEntryVersionId] = useState<string | null>(null);
  const [newEntryMessage, setNewEntryMessage] = useState("");
  const [newEntryCategory, setNewEntryCategory] = useState<ChangelogCategory>("feature");

  const { data: changelog, isLoading } = useQuery<ChangelogData>({
    queryKey: ["/api/changelog/versions"],
    staleTime: 0,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/changelog/versions"], refetchType: "all" });

  const createVersionMutation = useMutation({
    mutationFn: (data: { bump: "minor" | "major"; label?: string }) =>
      apiRequest("POST", "/api/changelog/versions", data),
    onSuccess: () => { invalidate(); setNewVersionOpen(false); setNewVersionLabel(""); },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/changelog/versions/${id}`),
    onSuccess: invalidate,
  });

  const createEntryMutation = useMutation({
    mutationFn: (data: { message: string; category: ChangelogCategory; versionId?: string }) =>
      apiRequest("POST", "/api/changelog/entries", data),
    onSuccess: () => {
      invalidate();
      setAddEntryVersionId(null);
      setNewEntryMessage("");
      setNewEntryCategory("feature");
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, message, category }: { id: string; message: string; category: ChangelogCategory }) =>
      apiRequest("PATCH", `/api/changelog/entries/${id}`, { message, category }),
    onSuccess: () => { invalidate(); setEditingEntryId(null); },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/changelog/entries/${id}`),
    onSuccess: invalidate,
  });

  const bumpAfterPublishMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/changelog/bump-after-publish"),
    onSuccess: () => { invalidate(); setNewVersionOpen(false); },
  });

  // Auto-detect publish: poll the production /api/changelog/published-patch
  // endpoint and, if prod's active patch has caught up to dev's current patch
  // (meaning a new publish has just shipped), bump dev so it advances to the
  // next patch number. Only runs in dev — prod skips itself.
  const isDev = typeof window !== "undefined" && import.meta.env.DEV;
  const prodUrl = (import.meta.env.VITE_PROD_URL as string | undefined)?.replace(/\/$/, "");
  useQuery<{ major: number; minor: number; patch: number }>({
    queryKey: ["prod-published-patch", prodUrl],
    enabled: isDev && !!prodUrl && !!changelog,
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(`${prodUrl}/api/changelog/published-patch`, { credentials: "omit" });
      if (!res.ok) throw new Error("prod fetch failed");
      const data = await res.json();
      const active = changelog?.versions.find((v) => v.id === changelog.activeVersionId);
      if (
        active &&
        data.major === active.major &&
        data.minor === active.minor &&
        data.patch >= active.patch &&
        !bumpAfterPublishMutation.isPending
      ) {
        bumpAfterPublishMutation.mutate();
      }
      return data;
    },
  });

  const toggleCard = (id: string) =>
    setOpenCards((prev) => ({ ...prev, [id]: !prev[id] }));

  const startEdit = (entry: ChangelogEntry) => {
    setEditingEntryId(entry.id);
    setEditMessage(entry.message);
    setEditCategory(entry.category);
  };

  const sortedVersions = changelog
    ? [...changelog.versions].sort((a, b) =>
        a.major !== b.major ? b.major - a.major : b.minor - a.minor
      )
    : [];

  const handleGenerateReport = () => {
    if (!changelog || selectedVersionIds.length === 0) return;
    const selected = sortedVersions.filter((v) => selectedVersionIds.includes(v.id));
    exportChangelogPdf(selected);
    setReportOpen(false);
  };

  const toggleReportVersion = (id: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <History className="h-4 w-4" />
          <span>
            {changelog?.versions.length ?? 0} version{(changelog?.versions.length ?? 0) !== 1 ? "s" : ""},&nbsp;
            {sortedVersions.reduce((n, v) => n + v.entries.length, 0)} entries
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setReportOpen(true); setSelectedVersionIds([]); }}
            data-testid="button-changelog-report"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button
            size="sm"
            onClick={() => setNewVersionOpen(true)}
            data-testid="button-new-version"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Version
          </Button>
        </div>
      </div>

      {/* Version cards */}
      {sortedVersions.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No versions yet. Create the first version to get started.
        </div>
      )}

      {sortedVersions.map((version) => {
        const isOpen = openCards[version.id] ?? true;

        // Group entries by patch number, newest patch first
        const patchMap = new Map<number, ChangelogEntry[]>();
        for (const entry of version.entries) {
          if (!patchMap.has(entry.patch)) patchMap.set(entry.patch, []);
          patchMap.get(entry.patch)!.push(entry);
        }
        const patchNums = [...patchMap.keys()].sort((a, b) => b - a);

        return (
          <Card key={version.id} className="overflow-hidden" data-testid={`card-version-${version.id}`}>
            <Collapsible open={isOpen} onOpenChange={() => toggleCard(version.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base font-mono">
                          {versionLabel(version)}
                        </span>
                        {patchNums.length > 0 && (
                          <span className="text-xs text-muted-foreground font-mono">
                            .00 – .{String(version.patch).padStart(2, "0")}
                          </span>
                        )}
                        {version.isActive && (
                          <Badge variant="default" className="text-xs px-1.5 py-0">
                            Active
                          </Badge>
                        )}
                        {version.isActive && version.publishedPatch !== undefined && (
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 font-mono ${
                              version.publishedPatch < version.patch
                                ? "border-amber-400 text-amber-600 dark:text-amber-400"
                                : "border-emerald-400 text-emerald-600 dark:text-emerald-400"
                            }`}
                            title={version.publishedPatch < version.patch ? "Unreleased changes exist" : "Dev and production are in sync"}
                          >
                            Live: {formatPatch(version, version.publishedPatch)}
                          </Badge>
                        )}
                        {version.label && (
                          <span className="text-sm text-muted-foreground">— {version.label}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{version.entries.length} entr{version.entries.length !== 1 ? "ies" : "y"}</span>
                      <span>{format(new Date(version.createdAt), "d MMM yyyy")}</span>
                      {!version.isActive && (
                        <button
                          className="text-destructive hover:text-destructive/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this version and all its entries?")) {
                              deleteVersionMutation.mutate(version.id);
                            }
                          }}
                          data-testid={`button-delete-version-${version.id}`}
                          title="Delete version"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="px-4 pb-4 pt-0 space-y-4">
                  {/* Patch sub-sections */}
                  {patchNums.length === 0 && (
                    <p className="text-sm text-muted-foreground italic py-2">No entries yet.</p>
                  )}
                  {patchNums.map((patchNum) => {
                    const patchEntries = patchMap.get(patchNum)!;
                    const latestDate = new Date(Math.max(...patchEntries.map((e) => new Date(e.createdAt).getTime())));
                    return (
                    <div key={patchNum}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {formatPatch(version, patchNum)}
                        </span>
                        {(!version.isActive || patchNum <= (version.publishedPatch ?? -1)) && (
                          <span className="text-xs text-muted-foreground/60">
                            {format(latestDate, "d MMM yyyy")}
                          </span>
                        )}
                        <div className="flex-1 border-t border-muted" />
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {patchMap.get(patchNum)!.map((entry) =>
                          editingEntryId === entry.id ? (
                            <div key={entry.id} className="flex items-center gap-2 py-1" data-testid={`entry-edit-${entry.id}`}>
                              <Select
                                value={editCategory}
                                onValueChange={(v) => setEditCategory(v as ChangelogCategory)}
                              >
                                <SelectTrigger className="w-36 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(CATEGORY_LABELS) as ChangelogCategory[]).map((cat) => (
                                    <SelectItem key={cat} value={cat} className="text-xs">
                                      {CATEGORY_LABELS[cat]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                className="flex-1 h-7 text-sm"
                                autoFocus
                                data-testid={`input-edit-entry-${entry.id}`}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  updateEntryMutation.mutate({ id: entry.id, message: editMessage, category: editCategory })
                                }
                                disabled={updateEntryMutation.isPending}
                                data-testid={`button-save-entry-${entry.id}`}
                              >
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingEntryId(null)}
                                data-testid={`button-cancel-entry-${entry.id}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2 group py-0.5"
                              data-testid={`entry-row-${entry.id}`}
                            >
                              <Badge
                                variant="outline"
                                className={`text-xs px-1.5 py-0 shrink-0 ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other}`}
                              >
                                {CATEGORY_LABELS[entry.category] ?? entry.category}
                              </Badge>
                              <span className="text-sm flex-1">{entry.message}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={() => startEdit(entry)}
                                  data-testid={`button-edit-entry-${entry.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() => {
                                    if (confirm("Delete this entry?")) deleteEntryMutation.mutate(entry.id);
                                  }}
                                  data-testid={`button-delete-entry-${entry.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ); })}

                  {/* Add entry form */}
                  {addEntryVersionId === version.id ? (
                    <div className="flex items-center gap-2 pt-2 border-t" data-testid={`form-add-entry-${version.id}`}>
                      <Select
                        value={newEntryCategory}
                        onValueChange={(v) => setNewEntryCategory(v as ChangelogCategory)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-entry-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(CATEGORY_LABELS) as ChangelogCategory[]).map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-xs">
                              {CATEGORY_LABELS[cat]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="1-line description of the change…"
                        value={newEntryMessage}
                        onChange={(e) => setNewEntryMessage(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newEntryMessage.trim()) {
                            createEntryMutation.mutate({
                              message: newEntryMessage.trim(),
                              category: newEntryCategory,
                              versionId: version.id,
                            });
                          }
                          if (e.key === "Escape") {
                            setAddEntryVersionId(null);
                            setNewEntryMessage("");
                          }
                        }}
                        data-testid="input-new-entry"
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          if (newEntryMessage.trim()) {
                            createEntryMutation.mutate({
                              message: newEntryMessage.trim(),
                              category: newEntryCategory,
                              versionId: version.id,
                            });
                          }
                        }}
                        disabled={!newEntryMessage.trim() || createEntryMutation.isPending}
                        data-testid="button-save-new-entry"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => { setAddEntryVersionId(null); setNewEntryMessage(""); }}
                        data-testid="button-cancel-new-entry"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground mt-1"
                      onClick={() => {
                        setAddEntryVersionId(version.id);
                        setNewEntryMessage("");
                        setNewEntryCategory("feature");
                      }}
                      data-testid={`button-add-entry-${version.id}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add entry
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* New Version Dialog */}
      <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Create New Version
            </DialogTitle>
            <DialogDescription>
              Choose a bump type to create a new version. The current version will be closed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {changelog && (() => {
              const active = changelog.versions.find((v) => v.id === changelog.activeVersionId);
              if (!active) return null;
              const patchNext = `v${active.major}.${active.minor}.${String(active.patch + 1).padStart(2, "0")}`;
              const minorNext = `v${active.major}.${active.minor + 1}`;
              const majorNext = `v${active.major + 1}.0`;
              return (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${newVersionBump === "patch" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40"}`}
                    onClick={() => setNewVersionBump("patch")}
                    data-testid="button-bump-patch"
                  >
                    <div className="font-mono font-semibold text-base">{patchNext}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Patch bump</div>
                  </button>
                  <button
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${newVersionBump === "minor" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40"}`}
                    onClick={() => setNewVersionBump("minor")}
                    data-testid="button-bump-minor"
                  >
                    <div className="font-mono font-semibold text-base">{minorNext}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Minor release</div>
                  </button>
                  <button
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${newVersionBump === "major" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40"}`}
                    onClick={() => setNewVersionBump("major")}
                    data-testid="button-bump-major"
                  >
                    <div className="font-mono font-semibold text-base">{majorNext}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Major release</div>
                  </button>
                </div>
              );
            })()}
            {newVersionBump !== "patch" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Label (optional)</Label>
                <Input
                  placeholder="e.g. Bug fixes & improvements"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  data-testid="input-version-label"
                />
              </div>
            )}
            {newVersionBump === "patch" && (
              <p className="text-xs text-muted-foreground">
                Records the current patch as live and advances the dev counter — same as what happens automatically on deployment.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewVersionOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (newVersionBump === "patch") {
                  bumpAfterPublishMutation.mutate();
                } else {
                  createVersionMutation.mutate({
                    bump: newVersionBump,
                    label: newVersionLabel.trim() || undefined,
                  });
                }
              }}
              disabled={createVersionMutation.isPending || bumpAfterPublishMutation.isPending}
              data-testid="button-confirm-new-version"
            >
              {newVersionBump === "patch" ? "Bump Patch" : "Create Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              Generate Changelog Report
            </DialogTitle>
            <DialogDescription>
              Select one or more versions to include in the PDF report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-auto">
            {sortedVersions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40"
                onClick={() => toggleReportVersion(v.id)}
                data-testid={`checkbox-version-${v.id}`}
              >
                <Checkbox
                  checked={selectedVersionIds.includes(v.id)}
                  onCheckedChange={() => toggleReportVersion(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-medium text-sm">{versionLabel(v)}</span>
                  {v.label && <span className="text-xs text-muted-foreground ml-2">— {v.label}</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{v.entries.length} entr{v.entries.length !== 1 ? "ies" : "y"}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateReport}
              disabled={selectedVersionIds.length === 0}
              data-testid="button-download-changelog-pdf"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
