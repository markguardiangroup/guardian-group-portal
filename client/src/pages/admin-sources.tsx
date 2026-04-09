import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Tag, ShieldAlert } from "lucide-react";

type Source = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminSources() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");

  if (user?.role !== "admin") {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  const { data: sources = [], isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources", "includeInactive"],
    queryFn: async () => {
      const res = await fetch("/api/sources?includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { code: string; label: string }) => {
      const res = await apiRequest("POST", "/api/sources", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setNewCode("");
      setNewLabel("");
      toast({ title: "Source created", description: "The new source has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create source", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/sources/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update source", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    const label = newLabel.trim();
    if (!code || !label) return;
    createMutation.mutate({ code, label });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage brand/relationship codes used to tag companies and consultants.
        </p>
      </div>

      {/* Add new source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Source
          </CardTitle>
          <CardDescription>
            Enter a short code (e.g. GS) and a descriptive label. Codes are permanent identity keys — deactivate instead of editing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 w-32">
              <Label htmlFor="source-code">Code</Label>
              <Input
                id="source-code"
                data-testid="input-source-code"
                placeholder="e.g. GS"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-1 flex-1 min-w-48">
              <Label htmlFor="source-label">Label</Label>
              <Input
                id="source-label"
                data-testid="input-source-label"
                placeholder="e.g. Guardian Support"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              data-testid="button-add-source"
              disabled={createMutation.isPending || !newCode.trim() || !newLabel.trim()}
            >
              {createMutation.isPending ? "Adding…" : "Add Source"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sources list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            All Sources
          </CardTitle>
          <CardDescription>
            {sources.length} source{sources.length !== 1 ? "s" : ""} configured.
            Inactive sources are hidden from assignment dropdowns but preserved for historical data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sources found.</p>
          ) : (
            <div className="divide-y">
              {sources.map((source) => (
                <div
                  key={source.id}
                  data-testid={`row-source-${source.id}`}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs shrink-0"
                      data-testid={`badge-source-code-${source.id}`}
                    >
                      {source.code}
                    </Badge>
                    <span
                      className="text-sm truncate"
                      data-testid={`text-source-label-${source.id}`}
                    >
                      {source.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {source.isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={source.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: source.id, isActive: checked })
                      }
                      data-testid={`switch-source-active-${source.id}`}
                      aria-label={`Toggle ${source.code} active state`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
