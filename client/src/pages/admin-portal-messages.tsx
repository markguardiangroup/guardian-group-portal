import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  { value: "banner", label: "Homepage Banner" },
];

type AudienceOption = "all" | "clients_only" | "consultants_only";

const AUDIENCE_OPTIONS: { value: AudienceOption; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "clients_only", label: "Clients only" },
  { value: "consultants_only", label: "Consultants only" },
];

function audienceFromRoles(roles: string[] | null | undefined): AudienceOption {
  if (!roles || roles.length === 0) return "all";
  if (roles.includes("client") && !roles.includes("consultant")) return "clients_only";
  if (roles.includes("consultant") && !roles.includes("client")) return "consultants_only";
  return "all";
}

function rolesToAudience(audience: AudienceOption): string[] {
  if (audience === "clients_only") return ["client"];
  if (audience === "consultants_only") return ["consultant"];
  return [];
}

type CtaType = "none" | "make_enquiry" | "navigate_to_link" | "book_now" | "contact_consultant" | "download";

const CTA_TYPES: { value: CtaType; label: string; needsUrl: boolean }[] = [
  { value: "none", label: "No call to action", needsUrl: false },
  { value: "make_enquiry", label: "Make an Enquiry", needsUrl: false },
  { value: "navigate_to_link", label: "Navigate to Link", needsUrl: true },
  { value: "book_now", label: "Book Now", needsUrl: true },
  { value: "contact_consultant", label: "Contact Your Consultant", needsUrl: false },
  { value: "download", label: "Download", needsUrl: true },
];

interface MessageFormData {
  title: string;
  body: string;
  type: string;
  audience: AudienceOption;
  status: "draft" | "published";
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  ctaType: CtaType;
  ctaUrl: string | null;
  ctaLabel: string | null;
}

const emptyForm = (): MessageFormData => ({
  title: "",
  body: "",
  type: "update",
  audience: "all",
  status: "draft",
  pinned: false,
  publishedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  expiresAt: null,
  ctaType: "none",
  ctaUrl: null,
  ctaLabel: null,
});

type QuickTogglePayload = {
  status?: "draft" | "published";
  publishedAt?: string | null;
  pinned?: boolean;
};

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/portal-messages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Omit<MessageFormData, "audience"> & { targetRoles: string[] }) =>
      apiRequest("POST", "/api/portal-messages", data),
    onSuccess: () => { invalidate(); toast({ title: "Message created" }); setDialogOpen(false); },
    onError: () => toast({ title: "Failed to create message", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<MessageFormData, "audience"> & { targetRoles: string[] } }) =>
      apiRequest("PATCH", `/api/portal-messages/${id}`, data),
    onSuccess: () => { invalidate(); toast({ title: "Message updated" }); setDialogOpen(false); },
    onError: () => toast({ title: "Failed to update message", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/portal-messages/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Message deleted" }); setDeleteId(null); },
    onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
  });

  const quickToggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: QuickTogglePayload }) =>
      apiRequest("PATCH", `/api/portal-messages/${id}`, data),
    onSuccess: invalidate,
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
      audience: audienceFromRoles(msg.targetRoles),
      status: msg.status as "draft" | "published",
      pinned: msg.pinned,
      publishedAt: msg.publishedAt ? format(new Date(msg.publishedAt), "yyyy-MM-dd'T'HH:mm") : null,
      expiresAt: msg.expiresAt ? format(new Date(msg.expiresAt), "yyyy-MM-dd'T'HH:mm") : null,
      ctaType: (msg.ctaType as CtaType) ?? "none",
      ctaUrl: msg.ctaUrl ?? null,
      ctaLabel: msg.ctaLabel ?? null,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }
    const { audience, ...rest } = form;
    const payload = {
      ...rest,
      targetRoles: rolesToAudience(audience),
      publishedAt: form.publishedAt
        ? new Date(form.publishedAt).toISOString()
        : form.status === "published" ? new Date().toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div id="page-content" className="p-6 space-y-6 max-w-5xl mx-auto dash-animate">
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
        <FetchingOverlay />
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create your first portal message to broadcast to users on the home page.
          </p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Create Message
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Pinned</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((msg) => {
                const audience = audienceFromRoles(msg.targetRoles);
                const audienceLabel = AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label ?? "All users";
                return (
                  <TableRow key={msg.id} data-testid={`row-message-${msg.id}`}>
                    <TableCell className="font-medium max-w-[280px]">
                      <span className="line-clamp-1">{msg.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{msg.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={msg.status === "published" ? "default" : "secondary"}
                        className="text-[10px]"
                        data-testid={`badge-status-${msg.id}`}
                      >
                        {msg.status === "published" ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{audienceLabel}</TableCell>
                    <TableCell>
                      {msg.pinned ? (
                        <Pin className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {msg.publishedAt ? format(new Date(msg.publishedAt), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {msg.expiresAt ? format(new Date(msg.expiresAt), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={msg.status === "published" ? "Unpublish" : "Publish"}
                          onClick={() => {
                            const payload: QuickTogglePayload =
                              msg.status === "published"
                                ? { status: "draft", publishedAt: null }
                                : { status: "published", publishedAt: new Date().toISOString() };
                            quickToggleMutation.mutate({ id: msg.id, data: payload });
                          }}
                          data-testid={`button-toggle-publish-${msg.id}`}
                        >
                          {msg.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={msg.pinned ? "Unpin" : "Pin"}
                          onClick={() => quickToggleMutation.mutate({ id: msg.id, data: { pinned: !msg.pinned } })}
                          data-testid={`button-toggle-pin-${msg.id}`}
                        >
                          <Pin className={`h-3.5 w-3.5 ${msg.pinned ? "text-primary" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(msg)}
                          data-testid={`button-edit-${msg.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(msg.id)}
                          data-testid={`button-delete-${msg.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Message" : "New Portal Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
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
              <Label>Target Audience</Label>
              <Select
                value={form.audience}
                onValueChange={(v: AudienceOption) => setForm((f) => ({ ...f, audience: v }))}
              >
                <SelectTrigger data-testid="select-message-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* CTA Section */}
            <div className="space-y-3 rounded-md border p-3 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call to Action</p>
              <div className="space-y-1.5">
                <Label>Button action</Label>
                <Select
                  value={form.ctaType}
                  onValueChange={(v: CtaType) =>
                    setForm((f) => ({ ...f, ctaType: v, ctaUrl: CTA_TYPES.find(c => c.value === v)?.needsUrl ? f.ctaUrl : null }))
                  }
                >
                  <SelectTrigger data-testid="select-cta-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.ctaType !== "none" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="msg-cta-label">Button label <span className="text-muted-foreground font-normal">(optional — uses default if blank)</span></Label>
                    <Input
                      id="msg-cta-label"
                      value={form.ctaLabel ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value || null }))}
                      placeholder={CTA_TYPES.find(c => c.value === form.ctaType)?.label ?? "Button label"}
                      data-testid="input-cta-label"
                    />
                  </div>
                  {CTA_TYPES.find(c => c.value === form.ctaType)?.needsUrl && (
                    <div className="space-y-1.5">
                      <Label htmlFor="msg-cta-url">Destination URL</Label>
                      <Input
                        id="msg-cta-url"
                        value={form.ctaUrl ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value || null }))}
                        placeholder="https://..."
                        data-testid="input-cta-url"
                      />
                    </div>
                  )}
                </>
              )}
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
