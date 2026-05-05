import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import type { RoadmapItem, RoadmapStatus, RoadmapPriority, RoadmapModule } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Lightbulb,
  Clock,
  Loader2,
  CheckCircle2,
  Pencil,
  Trash2,
  Rocket,
  Sparkles,
  Target,
  Bug,
  Search,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Bot,
  Calendar,
  LayoutDashboard,
  ShieldCheck,
  Users,
  HardHat,
  Scale,
  GraduationCap,
  Wrench,
  BarChart2,
  UserCircle,
} from "lucide-react";
import { format } from "date-fns";

type UserType = { id: string; firstName: string; lastName: string; email: string; role: string };
function userDisplayName(u: UserType) { return `${u.firstName} ${u.lastName}`.trim(); }

const statusConfig: Record<RoadmapStatus, { label: string; color: string; icon: typeof Lightbulb }> = {
  idea: { label: "Idea", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: Lightbulb },
  planned: { label: "Planned", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: Target },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", icon: Loader2 },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", icon: CheckCircle2 },
};

const priorityConfig: Record<RoadmapPriority, { label: string; color: string; icon: typeof ArrowUp }> = {
  high: { label: "High", color: "text-red-600 dark:text-red-400", icon: ArrowUp },
  medium: { label: "Medium", color: "text-amber-600 dark:text-amber-400", icon: ArrowRight },
  low: { label: "Low", color: "text-slate-500 dark:text-slate-400", icon: ArrowDown },
};

const categoryConfig: Record<string, { label: string; icon: typeof Rocket; badgeColor?: string }> = {
  feature: { label: "Feature", icon: Rocket },
  improvement: { label: "Improvement", icon: Sparkles },
  bug: { label: "Bug Fix", icon: Bug },
  enhancement: { label: "Enhancement", icon: Target },
  ai: { label: "AI", icon: Bot, badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300" },
};

const moduleConfig: Record<RoadmapModule, { label: string; icon: typeof LayoutDashboard; badgeColor: string }> = {
  OVERVIEW:  { label: "Overview",  icon: LayoutDashboard, badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ADMIN:     { label: "Admin",     icon: ShieldCheck,     badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" },
  HR:        { label: "HR",        icon: Users,           badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
  "H&S":     { label: "H&S",       icon: HardHat,         badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  EL:        { label: "EL",        icon: Scale,           badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300" },
  TRAINING:  { label: "Training",  icon: GraduationCap,   badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" },
  TOOLKIT:   { label: "Toolkit",   icon: Wrench,          badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" },
  REPORTS:   { label: "Reports",   icon: BarChart2,       badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300" },
};

const MODULES: RoadmapModule[] = ["OVERVIEW", "ADMIN", "HR", "H&S", "EL", "TRAINING", "TOOLKIT", "REPORTS"];

const priorityOrder: Record<RoadmapPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function ModuleBadge({ module, testId }: { module: string | null | undefined; testId?: string }) {
  if (!module) return null;
  const cfg = moduleConfig[module as RoadmapModule];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.badgeColor} data-testid={testId}>
      <Icon className="h-3 w-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

function sortByPriority(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    const aPriority = priorityOrder[a.priority as RoadmapPriority] ?? 1;
    const bPriority = priorityOrder[b.priority as RoadmapPriority] ?? 1;
    return aPriority - bPriority;
  });
}

function sortByCompletedDate(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bDate - aDate;
  });
}

function UserChip({ userId, adminUsers }: { userId: string | null | undefined; adminUsers: UserType[] }) {
  if (!userId) return null;
  const u = adminUsers.find(a => a.id === userId);
  if (!u) return null;
  const displayName = userDisplayName(u);
  const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join("").toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-[10px]">
        {initials}
      </span>
      {displayName}
    </span>
  );
}

export default function DevelopmentRoadmap() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [viewingItem, setViewingItem] = useState<RoadmapItem | null>(null);
  const [completingItem, setCompletingItem] = useState<RoadmapItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterAssignedUser, setFilterAssignedUser] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: roadmapItems = [], isLoading } = useQuery<RoadmapItem[]>({
    queryKey: ["/api/roadmap"],
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const adminUsers = useMemo(() => allUsers.filter(u => u.role === "admin"), [allUsers]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<RoadmapItem>) => {
      return apiRequest("POST", "/api/roadmap", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      setIsAddDialogOpen(false);
      toast({ title: "Item added", description: "Roadmap item has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create item.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RoadmapItem> & { id: string }) => {
      return apiRequest("PATCH", `/api/roadmap/${id}`, data);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      setEditingItem(null);
      try {
        const updated = await response.json();
        if (updated.status === "completed") {
          setViewingItem(null);
        } else {
          setViewingItem(updated);
        }
      } catch {
        setViewingItem(null);
      }
      toast({ title: "Item updated", description: "Roadmap item has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update item.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/roadmap/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      setViewingItem(null);
      toast({ title: "Item deleted", description: "Roadmap item has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
    },
  });

  if (user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const filteredItems = roadmapItems.filter(item => {
    const matchesStatus = filterStatus === "all" || item.status === filterStatus;
    const matchesType = filterType === "all" || item.category === filterType;
    const matchesModule = filterModule === "all" || (filterModule === "none" ? !item.module : item.module === filterModule);
    const matchesAssignedUser =
      filterAssignedUser === "all" ||
      (filterAssignedUser === "unassigned" ? !(item as any).assignedUserId : (item as any).assignedUserId === filterAssignedUser);
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      item.title.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query));
    return matchesStatus && matchesType && matchesModule && matchesAssignedUser && matchesSearch;
  });

  const groupedItems = {
    idea: sortByPriority(filteredItems.filter(i => i.status === "idea")),
    planned: sortByPriority(filteredItems.filter(i => i.status === "planned")),
    in_progress: sortByPriority(filteredItems.filter(i => i.status === "in_progress")),
    completed: sortByCompletedDate(filteredItems.filter(i => i.status === "completed")),
  };

  const viewingAssignedUser = viewingItem ? adminUsers.find(a => a.id === (viewingItem as any).assignedUserId) : null;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6 dash-animate">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sticky top-0 z-10 bg-background pb-4">
          <div>
            <h1 className="text-2xl font-bold">Development Roadmap</h1>
            <p className="text-muted-foreground">
              Track and manage future development ideas and features
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roadmap..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[180px]"
                data-testid="input-search-roadmap"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="idea">Ideas</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(categoryConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-module">
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="none">No Module</SelectItem>
                {MODULES.map(mod => (
                  <SelectItem key={mod} value={mod}>{moduleConfig[mod].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAssignedUser} onValueChange={setFilterAssignedUser}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-assigned-user">
                <UserCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Assigned to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {adminUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{userDisplayName(u)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-roadmap-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Roadmap Item</DialogTitle>
                </DialogHeader>
                <RoadmapItemForm
                  adminUsers={adminUsers}
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : roadmapItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No roadmap items yet</h3>
              <p className="text-muted-foreground mb-4">
                Start adding ideas and features you want to develop
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-item">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            </CardContent>
          </Card>
        ) : filterStatus === "all" ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(groupedItems) as [RoadmapStatus, RoadmapItem[]][]).map(([status, items]) => {
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              return (
                <div key={status} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <StatusIcon className={`h-4 w-4 ${status === "in_progress" ? "animate-spin" : ""}`} />
                    <h3 className="font-medium">{config.label}</h3>
                    <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map(item => (
                      <RoadmapCard
                        key={item.id}
                        item={item}
                        adminUsers={adminUsers}
                        onClick={() => setViewingItem(item)}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
                        No items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(filterStatus === "completed" ? sortByCompletedDate(filteredItems) : sortByPriority(filteredItems)).map(item => (
              <RoadmapCard
                key={item.id}
                item={item}
                adminUsers={adminUsers}
                onClick={() => setViewingItem(item)}
              />
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewingItem && (() => {
                  const cat = categoryConfig[viewingItem.category] || categoryConfig.feature;
                  const CatIcon = cat.icon;
                  return <CatIcon className="h-5 w-5 text-muted-foreground" />;
                })()}
                {viewingItem?.title}
              </DialogTitle>
              <DialogDescription>
                {viewingItem && (() => {
                  const p = priorityConfig[viewingItem.priority as RoadmapPriority];
                  const PIcon = p.icon;
                  return (
                    <span className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={statusConfig[viewingItem.status as RoadmapStatus].color}>
                        {statusConfig[viewingItem.status as RoadmapStatus].label}
                      </Badge>
                      <Badge className={(categoryConfig[viewingItem.category] || categoryConfig.feature).badgeColor || "bg-muted text-muted-foreground"}>
                        {(categoryConfig[viewingItem.category] || categoryConfig.feature).label}
                      </Badge>
                      <ModuleBadge module={viewingItem.module} />
                      <span className={`flex items-center gap-1 text-xs ${p.color}`}>
                        <PIcon className="h-3 w-3" />
                        {p.label} Priority
                      </span>
                    </span>
                  );
                })()}
              </DialogDescription>
            </DialogHeader>
            {viewingItem && (
              <div className="space-y-4">
                {viewingItem.description ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm whitespace-pre-wrap">{viewingItem.description}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description provided.</p>
                )}

                {viewingItem.developerNotes && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Developer Notes</Label>
                    <p className="text-sm whitespace-pre-wrap">{viewingItem.developerNotes}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {viewingItem.createdAt ? format(new Date(viewingItem.createdAt), "MMM d, yyyy") : "Unknown"}
                  </span>
                  {viewingItem.completedAt && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Completed {format(new Date(viewingItem.completedAt), "MMM d, yyyy")}
                    </span>
                  )}
                  {viewingAssignedUser && (
                    <span className="flex items-center gap-1.5">
                      <UserCircle className="h-3 w-3" />
                      Assigned to <strong>{userDisplayName(viewingAssignedUser)}</strong>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {viewingItem.status !== "planned" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: viewingItem.id, status: "planned" })}
                      disabled={updateMutation.isPending}
                      data-testid="button-mark-planned"
                    >
                      <Target className="h-4 w-4 mr-1" />
                      Planned
                    </Button>
                  )}
                  {viewingItem.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: viewingItem.id, status: "in_progress" })}
                      disabled={updateMutation.isPending}
                      data-testid="button-mark-in-progress"
                    >
                      <Loader2 className="h-4 w-4 mr-1" />
                      In Progress
                    </Button>
                  )}
                  {viewingItem.status !== "completed" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setCompletingItem(viewingItem);
                        setCompletionNotes("");
                      }}
                      disabled={updateMutation.isPending}
                      data-testid="button-mark-complete"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingItem(viewingItem);
                      setViewingItem(null);
                    }}
                    data-testid="button-edit-from-detail"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this item?")) {
                        deleteMutation.mutate(viewingItem.id);
                      }
                    }}
                    data-testid="button-delete-from-detail"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Complete Dialog */}
        <Dialog open={!!completingItem} onOpenChange={(open) => { if (!open) setCompletingItem(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Roadmap Item</DialogTitle>
              <DialogDescription>
                Add any developer notes about what was completed for "{completingItem?.title}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="completion-notes">Developer Notes</Label>
                <Textarea
                  id="completion-notes"
                  placeholder="Details of what was completed, changes made, etc."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="input-developer-notes"
                />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCompletingItem(null)}
                  data-testid="button-cancel-complete"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (completingItem) {
                      updateMutation.mutate({
                        id: completingItem.id,
                        status: "completed",
                        developerNotes: completionNotes || null,
                      });
                      setCompletingItem(null);
                      setViewingItem(null);
                    }
                  }}
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-complete"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Mark as Complete
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Roadmap Item</DialogTitle>
            </DialogHeader>
            {editingItem && (
              <RoadmapItemForm
                item={editingItem}
                adminUsers={adminUsers}
                onSubmit={(data) => updateMutation.mutate({ id: editingItem.id, ...data })}
                isLoading={updateMutation.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function RoadmapCard({
  item,
  adminUsers,
  onClick,
}: {
  item: RoadmapItem;
  adminUsers: UserType[];
  onClick: () => void;
}) {
  const status = statusConfig[item.status as RoadmapStatus];
  const priority = priorityConfig[item.priority as RoadmapPriority];
  const category = categoryConfig[item.category] || categoryConfig.feature;
  const CategoryIcon = category.icon;
  const PriorityIcon = priority.icon;

  return (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={onClick}
      data-testid={`card-roadmap-${item.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CategoryIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <h4 className="font-medium truncate">{item.title}</h4>
          </div>
        </div>

        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={status.color}>{status.label}</Badge>
          <Badge className={category.badgeColor || "bg-muted text-muted-foreground"}>
            <CategoryIcon className="h-3 w-3 mr-1" />
            {category.label}
          </Badge>
          <ModuleBadge module={item.module} testId={`badge-module-${item.id}`} />
          <div className={`flex items-center gap-1 text-xs ${priority.color}`}>
            <PriorityIcon className="h-3 w-3" />
            {priority.label}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <UserChip userId={(item as any).assignedUserId} adminUsers={adminUsers} />
          {item.status === "completed" && item.completedAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {format(new Date(item.completedAt), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RoadmapItemForm({
  item,
  adminUsers,
  onSubmit,
  isLoading,
}: {
  item?: RoadmapItem;
  adminUsers: UserType[];
  onSubmit: (data: Partial<RoadmapItem>) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [category, setCategory] = useState(item?.category || "feature");
  const [status, setStatus] = useState<RoadmapStatus>(item?.status as RoadmapStatus || "idea");
  const [priority, setPriority] = useState<RoadmapPriority>(item?.priority as RoadmapPriority || "medium");
  const [module, setModule] = useState<string>(item?.module || "none");
  const [assignedUserId, setAssignedUserId] = useState<string>((item as any)?.assignedUserId || "unassigned");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title,
      description,
      category,
      status,
      priority,
      module: module === "none" ? null : module as RoadmapModule,
      assignedUserId: assignedUserId === "unassigned" ? null : assignedUserId,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title for this item"
          required
          data-testid="input-title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this feature or improvement"
          rows={3}
          data-testid="input-description"
        />
      </div>

      <div className="space-y-2">
        <Label>Module</Label>
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger data-testid="select-module">
            <SelectValue placeholder="Select a module (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No module</SelectItem>
            {MODULES.map(mod => {
              const ModIcon = moduleConfig[mod].icon;
              return (
                <SelectItem key={mod} value={mod}>
                  <span className="flex items-center gap-2">
                    <ModIcon className="h-3.5 w-3.5" />
                    {moduleConfig[mod].label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Assign to</Label>
        <Select value={assignedUserId} onValueChange={setAssignedUserId}>
          <SelectTrigger data-testid="select-assigned-user">
            <UserCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {adminUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{userDisplayName(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="improvement">Improvement</SelectItem>
              <SelectItem value="bug">Bug Fix</SelectItem>
              <SelectItem value="enhancement">Enhancement</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as RoadmapStatus)}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as RoadmapPriority)}>
            <SelectTrigger data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !title.trim()} data-testid="button-submit">
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {item ? "Update" : "Add"} Item
        </Button>
      </DialogFooter>
    </form>
  );
}
