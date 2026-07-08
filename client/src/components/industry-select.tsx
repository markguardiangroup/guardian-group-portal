import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { Industry } from "@shared/schema";

const ADD_NEW_VALUE = "__add_new_industry__";

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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLabel, setNewLabel] = useState("");

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
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v === ADD_NEW_VALUE) {
            setShowAddDialog(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger id={id} data-testid={testId}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.label}>{opt.label}</SelectItem>
          ))}
          {isDeveloper && (
            <>
              <SelectSeparator />
              <SelectItem value={ADD_NEW_VALUE} data-testid="option-add-new-industry">
                <span className="flex items-center gap-1.5 text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Add new industry
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

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
    </>
  );
}
