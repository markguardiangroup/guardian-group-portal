import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Settings, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Industry } from "@shared/schema";

export function IndustrySelect({
  id,
  value,
  onChange,
  testId,
  placeholder = "Select an industry",
}: {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  testId?: string;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isDeveloper = user?.role === "developer";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showManageDialog, setShowManageDialog] = useState(false);

  const { data: industries = [] } = useQuery<Industry[]>({
    queryKey: ["/api/industries", "activeOnly"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/industries?activeOnly=true");
      return res.json();
    },
  });

  const createIndustryMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/industries", { label });
      return res.json();
    },
    onSuccess: (created: Industry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/industries"] });
      toast({ title: "Industry added", description: `"${created.label}" is now available in the list.` });
      onChange(created.label);
      setNewLabel("");
      setShowAddDialog(false);
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add industry",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Ensure the currently-selected value always renders even if it isn't
  // (yet) present in the fetched list — e.g. a value set before the list loaded.
  const options = value && !industries.some((i) => i.label === value)
    ? [...industries, { id: "current", label: value, sortOrder: -1, isActive: true, createdAt: new Date() } as Industry]
    : industries;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
              data-testid={testId}
            >
              <span className={cn("truncate", !value && "text-muted-foreground")}>
                {value || placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search industries..."
                value={search}
                onValueChange={setSearch}
                data-testid="input-search-industry"
              />
              <CommandList>
                <CommandEmpty>No industry found.</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.label}
                      onSelect={() => {
                        onChange(opt.label);
                        setOpen(false);
                      }}
                      data-testid={`option-industry-${opt.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === opt.label ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {isDeveloper && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value="__add_new_industry__"
                        onSelect={() => {
                          setNewLabel(search);
                          setShowAddDialog(true);
                        }}
                        data-testid="option-add-new-industry"
                      >
                        <Plus className="mr-2 h-3.5 w-3.5 text-primary" />
                        <span className="text-primary">
                          {search.trim() ? `Add "${search.trim()}"` : "Add new industry"}
                        </span>
                      </CommandItem>
                      <CommandItem
                        value="__manage_industries__"
                        onSelect={() => {
                          setOpen(false);
                          setShowManageDialog(true);
                        }}
                        data-testid="option-manage-industries"
                      >
                        <Settings className="mr-2 h-3.5 w-3.5" />
                        Edit industry list...
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {isDeveloper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setShowManageDialog(true)}
            title="Edit industry list"
            data-testid="button-manage-industries"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent data-testid="dialog-add-industry">
          <DialogHeader>
            <DialogTitle>Add New Industry</DialogTitle>
            <DialogDescription>
              This adds a new option to the industry list for all users when adding or editing a company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="new-industry-label">Industry name</Label>
            <Input
              id="new-industry-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g., Renewable Energy"
              data-testid="input-new-industry-label"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  createIndustryMutation.mutate(newLabel.trim());
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="button-cancel-add-industry">
              Cancel
            </Button>
            <Button
              onClick={() => createIndustryMutation.mutate(newLabel.trim())}
              disabled={!newLabel.trim() || createIndustryMutation.isPending}
              data-testid="button-save-new-industry"
            >
              {createIndustryMutation.isPending ? "Adding..." : "Add Industry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isDeveloper && (
        <ManageIndustriesDialog
          open={showManageDialog}
          onOpenChange={setShowManageDialog}
          currentValue={value}
          onRenamedCurrent={(newLabel) => onChange(newLabel)}
        />
      )}
    </>
  );
}

function ManageIndustriesDialog({
  open,
  onOpenChange,
  currentValue,
  onRenamedCurrent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue?: string;
  onRenamedCurrent: (newLabel: string) => void;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const { data: allIndustries = [], isLoading } = useQuery<Industry[]>({
    queryKey: ["/api/industries", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/industries");
      return res.json();
    },
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/industries"] });
  };

  const createMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/industries", { label });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setNewLabel("");
      toast({ title: "Industry added" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add industry", description: error?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Industry, "label" | "isActive">> }) => {
      const res = await apiRequest("PATCH", `/api/industries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast({ title: "Industry updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update industry", description: error?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/industries/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Industry removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove industry", description: error?.message, variant: "destructive" });
    },
  });

  const startEdit = (industry: Industry) => {
    setEditingId(industry.id);
    setEditingLabel(industry.label);
  };

  const saveEdit = (industry: Industry) => {
    const trimmed = editingLabel.trim();
    if (!trimmed || trimmed === industry.label) {
      setEditingId(null);
      return;
    }
    const wasSelected = currentValue === industry.label;
    updateMutation.mutate(
      { id: industry.id, data: { label: trimmed } },
      {
        onSuccess: () => {
          if (wasSelected) onRenamedCurrent(trimmed);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-manage-industries">
        <DialogHeader>
          <DialogTitle>Edit Industry List</DialogTitle>
          <DialogDescription>
            Rename, add, or deactivate industries. Deactivated industries are hidden from the picker
            but existing companies keep their assigned value.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add a new industry..."
            data-testid="input-manage-new-industry"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newLabel.trim()) {
                createMutation.mutate(newLabel.trim());
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => createMutation.mutate(newLabel.trim())}
            disabled={!newLabel.trim() || createMutation.isPending}
            data-testid="button-manage-add-industry"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
          ) : allIndustries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No industries yet.</div>
          ) : (
            allIndustries.map((industry) => (
              <div
                key={industry.id}
                className="flex items-center gap-2 p-2"
                data-testid={`row-manage-industry-${industry.id}`}
              >
                {editingId === industry.id ? (
                  <>
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="h-8 flex-1"
                      autoFocus
                      data-testid={`input-edit-industry-${industry.id}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(industry);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => saveEdit(industry)}
                      disabled={updateMutation.isPending}
                      data-testid={`button-save-edit-industry-${industry.id}`}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      data-testid={`button-cancel-edit-industry-${industry.id}`}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={cn("flex-1 text-sm truncate", !industry.isActive && "text-muted-foreground line-through")}>
                      {industry.label}
                    </span>
                    <Switch
                      checked={industry.isActive}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: industry.id, data: { isActive: checked } })}
                      data-testid={`switch-active-industry-${industry.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(industry)}
                      data-testid={`button-edit-industry-${industry.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remove "${industry.label}" from the industry list?`)) {
                          deleteMutation.mutate(industry.id);
                        }
                      }}
                      data-testid={`button-delete-industry-${industry.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-manage-industries">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
