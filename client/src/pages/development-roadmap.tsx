import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import type { RoadmapItem, RoadmapStatus, RoadmapPriority } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Lightbulb,
  Clock,
  Loader2,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Trash2,
  Rocket,
  Sparkles,
  Target,
  Bug,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

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

const categoryConfig: Record<string, { label: string; icon: typeof Rocket }> = {
  feature: { label: "Feature", icon: Rocket },
  improvement: { label: "Improvement", icon: Sparkles },
  bug: { label: "Bug Fix", icon: Bug },
  enhancement: { label: "Enhancement", icon: Target },
};

export default function DevelopmentRoadmap() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: roadmapItems = [], isLoading } = useQuery<RoadmapItem[]>({
    queryKey: ["/api/roadmap"],
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
      setEditingItem(null);
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

  const filteredItems = filterStatus === "all" 
    ? roadmapItems 
    : roadmapItems.filter(item => item.status === filterStatus);

  const groupedItems = {
    idea: filteredItems.filter(i => i.status === "idea"),
    planned: filteredItems.filter(i => i.status === "planned"),
    in_progress: filteredItems.filter(i => i.status === "in_progress"),
    completed: filteredItems.filter(i => i.status === "completed"),
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Development Roadmap</h1>
            <p className="text-muted-foreground">
              Track and manage future development ideas and features
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
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
                        onEdit={() => setEditingItem(item)}
                        onDelete={() => deleteMutation.mutate(item.id)}
                        onStatusChange={(status) => updateMutation.mutate({ id: item.id, status })}
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
            {filteredItems.map(item => (
              <RoadmapCard
                key={item.id}
                item={item}
                onEdit={() => setEditingItem(item)}
                onDelete={() => deleteMutation.mutate(item.id)}
                onStatusChange={(status) => updateMutation.mutate({ id: item.id, status })}
              />
            ))}
          </div>
        )}

        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Roadmap Item</DialogTitle>
            </DialogHeader>
            {editingItem && (
              <RoadmapItemForm
                item={editingItem}
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
  onEdit,
  onDelete,
  onStatusChange,
}: {
  item: RoadmapItem;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: RoadmapStatus) => void;
}) {
  const status = statusConfig[item.status as RoadmapStatus];
  const priority = priorityConfig[item.priority as RoadmapPriority];
  const category = categoryConfig[item.category] || categoryConfig.feature;
  const CategoryIcon = category.icon;
  const PriorityIcon = priority.icon;

  return (
    <Card className="hover-elevate" data-testid={`card-roadmap-${item.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CategoryIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <h4 className="font-medium truncate">{item.title}</h4>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`button-menu-${item.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-${item.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {item.status !== "planned" && (
                <DropdownMenuItem onClick={() => onStatusChange("planned")}>
                  <Target className="h-4 w-4 mr-2" />
                  Mark as Planned
                </DropdownMenuItem>
              )}
              {item.status !== "in_progress" && (
                <DropdownMenuItem onClick={() => onStatusChange("in_progress")}>
                  <Loader2 className="h-4 w-4 mr-2" />
                  Mark In Progress
                </DropdownMenuItem>
              )}
              {item.status !== "completed" && (
                <DropdownMenuItem onClick={() => onStatusChange("completed")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`button-delete-${item.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={status.color}>{status.label}</Badge>
          <div className={`flex items-center gap-1 text-xs ${priority.color}`}>
            <PriorityIcon className="h-3 w-3" />
            {priority.label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RoadmapItemForm({
  item,
  onSubmit,
  isLoading,
}: {
  item?: RoadmapItem;
  onSubmit: (data: Partial<RoadmapItem>) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [category, setCategory] = useState(item?.category || "feature");
  const [status, setStatus] = useState<RoadmapStatus>(item?.status as RoadmapStatus || "idea");
  const [priority, setPriority] = useState<RoadmapPriority>(item?.priority as RoadmapPriority || "medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title, description, category, status, priority });
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