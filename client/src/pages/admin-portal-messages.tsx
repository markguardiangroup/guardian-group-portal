import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Pin,
  Eye,
  EyeOff,
  Megaphone,
  Loader2,
} from "lucide-react";
import type { PortalMessage } from "@shared/schema";

const MESSAGE_TYPES = [
  { value: "update", label: "Update" },
  { value: "feature", label: "New Feature" },
  { value: "training", label: "Training" },
  { value: "guidance", label: "Guidance" },
  { value: "news", label: "News" },
];

const TARGET_ROLES = [
  { value: "admin", label: "Admins" },
  { value: "consultant", label: "Consultants" },
  { value: "client", label: "Clients" },
];

interface MessageFormData {
  title: string;
  body: string;
  type: string;
  targetRoles: string[];
  status: "draft" | "published";
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
}

const emptyForm = (): MessageFormData => ({
  title: "",
  body: "",
  type: "update",
  targetRoles: [],
  status: "draft",
  pinned: false,
  publishedAt: null,
  expiresAt: null,
});

export default function AdminPortalMessages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<MessageFormData>(emptyForm());

  if (user?.role !== "admin") {
    setLocation("/home");
    return null;
  }

  const { data: messages = [], isLoading } = useQuery<PortalMessage[]>({
    queryKey: ["/api/portal-messages"],
  });

  const createMutation = useMutation({
    mutationFn: (data: MessageFormData) => apiRequest("POST", "/api/portal-messages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
      toast({ title: "Message created" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Failed to create message", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MessageFormData }) =>
      apiRequest("PATCH", `/api/portal-messages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
      toast({ title: "Message updated" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Failed to update message", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/portal-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
      toast({ title: "Message deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
  });

  const quickToggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MessageFormData> }) =>
      apiRequest("PATCH", `/api/portal-messages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(msg: PortalMessage) {
    setEditingId(msg.id);
    setForm({
      title: msg.title,
      body: msg.body,
      type: msg.type,
      targetRoles: msg.targetRoles ?? [],
      status: msg.status as "draft" | "published",
      pinned: msg.pinned,
      publishedAt: msg.publishedAt ? format(new Date(msg.publishedAt), "yyyy-MM-dd'T'HH:mm") : null,
      expiresAt: msg.expiresAt ? format(new Date(msg.expiresAt), "yyyy-MM-dd'T'HH:mm") : null,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : (form.status === "published" ? new Date().toISOString() : null),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      targetRoles: f.targetRoles.includes(role)
        ? f.targetRoles.filter((r) => r !== role)
        : [...f.targetRoles, role],
    }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Portal Messages
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Broadcast updates, guidance and news to portal users.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-message">
          <Plus className="mr-2 h-4 w-4" />
          New Message
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No messages yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create your first portal message to broadcast to users on the home page.
            </p>
            <Button onClick={openCreate} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className={msg.pinned ? "border-primary/40 ring-1 ring-primary/20" : ""}
              data-testid={`card-message-${msg.id}`}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {msg.pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="font-semibold text-sm">{msg.title}</span>
                      <Badge
                        variant={msg.status === "published" ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                        data-testid={`badge-status-${msg.id}`}
                      >
                        {msg.status === "published" ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5">{msg.type}</Badge>
                      {msg.targetRoles && msg.targetRoles.length > 0 && msg.targetRoles.map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px] px-1.5">{r}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {msg.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          Published {format(new Date(msg.publishedAt), "d MMM yyyy")}
                        </span>
                      )}
                      {msg.expiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expires {format(new Date(msg.expiresAt), "d MMM yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={msg.status === "published" ? "Unpublish" : "Publish"}
                      onClick={() =>
                        quickToggleMutation.mutate({
                          id: msg.id,
                          data: {
                            status: msg.status === "published" ? "draft" : "published",
                            publishedAt: msg.status !== "published" ? new Date().toISOString() : null,
                          } as any,
                        })
                      }
                      data-testid={`button-toggle-publish-${msg.id}`}
                    >
                      {msg.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={msg.pinned ? "Unpin" : "Pin"}
                      onClick={() => quickToggleMutation.mutate({ id: msg.id, data: { pinned: !msg.pinned } as any })}
                      data-testid={`button-toggle-pin-${msg.id}`}
                    >
                      <Pin className={`h-4 w-4 ${msg.pinned ? "text-primary" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(msg)}
                      data-testid={`button-edit-${msg.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(msg.id)}
                      data-testid={`button-delete-${msg.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Message" : "New Portal Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="msg-title">Title</Label>
              <Input
                id="msg-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Message title"
                data-testid="input-message-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg-body">Body</Label>
              <Textarea
                id="msg-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Message content…"
                rows={4}
                data-testid="input-message-body"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-message-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: "draft" | "published") => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger data-testid="select-message-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Roles (empty = all roles)</Label>
              <div className="flex gap-2">
                {TARGET_ROLES.map((r) => (
                  <Button
                    key={r.value}
                    variant={form.targetRoles.includes(r.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleRole(r.value)}
                    type="button"
                    data-testid={`button-role-${r.value}`}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="msg-published-at">Publish Date/Time</Label>
                <Input
                  id="msg-published-at"
                  type="datetime-local"
                  value={form.publishedAt ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value || null }))}
                  data-testid="input-published-at"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msg-expires-at">Expiry Date/Time</Label>
                <Input
                  id="msg-expires-at"
                  type="datetime-local"
                  value={form.expiresAt ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value || null }))}
                  data-testid="input-expires-at"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="msg-pinned"
                checked={form.pinned}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
                data-testid="switch-pinned"
              />
              <Label htmlFor="msg-pinned">Pin to top of home page</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-message">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Create Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the portal message. Users will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
