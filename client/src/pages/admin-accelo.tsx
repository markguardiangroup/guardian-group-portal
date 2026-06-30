import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { CheckCircle2, XCircle, Link2, Link2Off, RefreshCw, Copy, Check, Eye, EyeOff, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { format } from "date-fns";

interface AcceloIntegrationRow {
  id: string;
  sourceCode: string;
  sourceLabel: string;
  deployment: string;
  clientId: string;
  connected: boolean;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  lastCheckOk?: boolean | null;
  lastCheckedAt?: string | null;
  lastCheckError?: string | null;
}

interface Source {
  id: string;
  code: string;
  label: string;
}

interface WebhookSecretResponse {
  secret: string | null;
}

const HOST = "https://guardiangroup.ai";

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onVerify,
  onToggleActive,
  connectPending,
  disconnectPending,
  verifyPending,
}: {
  integration: AcceloIntegrationRow;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: () => void;
  onToggleActive: () => void;
  connectPending: boolean;
  disconnectPending: boolean;
  verifyPending: boolean;
}) {
  const { toast } = useToast();
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: secretData } = useQuery<WebhookSecretResponse>({
    queryKey: ["/api/integrations/accelo/webhook-secret", integration.sourceCode],
    queryFn: async () => {
      const res = await fetch(
        `/api/integrations/accelo/webhook-secret?source=${encodeURIComponent(integration.sourceCode)}`,
        { credentials: "include" }
      );
      if (!res.ok) return { secret: null };
      return res.json();
    },
  });

  const webhookSecret = secretData?.secret ?? null;
  const pushPath = `/api/integrations/accelo/push/${integration.sourceCode.toLowerCase()}`;
  const webhookUrl = webhookSecret ? `${HOST}${pushPath}?secret=${webhookSecret}` : `${HOST}${pushPath}`;
  const maskedUrl = webhookSecret ? `${HOST}${pushPath}?secret=${"•".repeat(16)}` : webhookUrl;

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  // lastCheckOk reflects a real call made to Accelo (not just our cached expiry), so it takes
  // priority — Accelo can revoke a token at any time and that won't show up as "expired" locally
  // until we actually try to use it.
  const isLive = integration.connected && !isExpired && integration.lastCheckOk !== false;
  const lastCheckedAt = integration.lastCheckedAt ? new Date(integration.lastCheckedAt) : null;

  const displayTitle = integration.sourceLabel && integration.sourceLabel !== integration.sourceCode
    ? integration.sourceLabel
    : integration.sourceCode;

  return (
    <Card className={!integration.isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-base truncate" title={displayTitle}>{displayTitle}</CardTitle>
              <Badge variant="outline" className="text-xs font-mono shrink-0">{integration.sourceCode}</Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-integration-${integration.sourceCode}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`button-delete-integration-${integration.sourceCode}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {!integration.isActive ? (
              <Badge variant="secondary" className="text-xs shrink-0">Inactive</Badge>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-muted-foreground">{integration.isActive ? "Active" : "Disabled"}</span>
              <Switch
                checked={integration.isActive}
                onCheckedChange={onToggleActive}
                data-testid={`switch-active-${integration.sourceCode}`}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isLive ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                {expiresAt && <span className="text-xs text-muted-foreground">· expires {format(expiresAt, "d MMM yyyy HH:mm")}</span>}
              </div>
              {lastCheckedAt && (
                <p className="text-xs text-muted-foreground">
                  Last verified with Accelo {format(lastCheckedAt, "d MMM yyyy HH:mm")}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={disconnectPending}
                  data-testid={`button-disconnect-${integration.sourceCode}`}
                >
                  <Link2Off className="h-3.5 w-3.5 mr-1.5" />
                  {disconnectPending ? "Disconnecting…" : "Disconnect"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onVerify}
                  disabled={verifyPending}
                  data-testid={`button-verify-${integration.sourceCode}`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${verifyPending ? "animate-spin" : ""}`} />
                  {verifyPending ? "Checking…" : "Verify now"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {integration.connected && integration.lastCheckOk === false
                    ? "Token invalid — reconnect required"
                    : isExpired
                    ? "Token expired"
                    : "Not connected"}
                </span>
              </div>
              {integration.connected && integration.lastCheckOk === false && integration.lastCheckError && (
                <p className="text-xs text-destructive break-words" data-testid={`text-check-error-${integration.sourceCode}`}>
                  {integration.lastCheckError}
                </p>
              )}
              {lastCheckedAt && (
                <p className="text-xs text-muted-foreground">
                  Last checked {format(lastCheckedAt, "d MMM yyyy HH:mm")}
                </p>
              )}
              <Button
                size="sm"
                onClick={onConnect}
                disabled={connectPending || !integration.isActive}
                data-testid={`button-connect-${integration.sourceCode}`}
              >
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                {connectPending ? "Redirecting…" : "Connect"}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Push Endpoint</p>
          <div className="flex items-stretch gap-1.5">
            <div
              className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all"
              data-testid={`text-push-endpoint-${integration.sourceCode}`}
            >
              {secretVisible ? webhookUrl : maskedUrl}
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSecretVisible(v => !v)} title={secretVisible ? "Hide" : "Reveal"} data-testid={`button-toggle-secret-${integration.sourceCode}`}>
                {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyUrl} title="Copy" data-testid={`button-copy-endpoint-${integration.sourceCode}`}>
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface IntegrationFormData {
  sourceCode: string;
  deployment: string;
  clientId: string;
  clientSecret: string;
}

function IntegrationFormDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultValues,
  onSubmit,
  isPending,
  isEdit,
  sources,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  defaultValues: IntegrationFormData;
  onSubmit: (data: IntegrationFormData) => void;
  isPending: boolean;
  isEdit: boolean;
  sources: Source[];
}) {
  const [form, setForm] = useState<IntegrationFormData>(defaultValues);

  useEffect(() => {
    if (open) setForm(defaultValues);
  }, [open, defaultValues.sourceCode]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  const existingCodes = new Set<string>();
  const availableSources = sources.filter(s => !existingCodes.has(s.code));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceCode">Source</Label>
            {isEdit ? (
              <Input
                id="sourceCode"
                value={form.sourceCode}
                disabled
                data-testid="input-accelo-source-code"
              />
            ) : sources.length > 0 ? (
              <Select
                value={form.sourceCode}
                onValueChange={val => setForm(f => ({ ...f, sourceCode: val }))}
                required
              >
                <SelectTrigger id="sourceCode" data-testid="select-accelo-source-code">
                  <SelectValue placeholder="Select a source…" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.label} <span className="text-muted-foreground font-mono text-xs ml-1">({s.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="sourceCode"
                value={form.sourceCode}
                onChange={e => setForm(f => ({ ...f, sourceCode: e.target.value.toUpperCase() }))}
                placeholder="GS"
                maxLength={8}
                required
                data-testid="input-accelo-source-code"
              />
            )}
            <p className="text-xs text-muted-foreground">The source this integration belongs to.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deployment">Deployment</Label>
            <Input
              id="deployment"
              value={form.deployment}
              onChange={e => setForm(f => ({ ...f, deployment: e.target.value }))}
              placeholder="guardiansupport"
              required
              data-testid="input-accelo-deployment"
            />
            <p className="text-xs text-muted-foreground">The subdomain part of your Accelo URL (e.g. <span className="font-mono">guardiansupport</span>.api.accelo.com).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              required
              data-testid="input-accelo-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={form.clientSecret}
              onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
              placeholder={isEdit ? "Leave blank to keep existing" : ""}
              required={!isEdit}
              data-testid="input-accelo-client-secret"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || (!isEdit && !form.sourceCode)} data-testid="button-save-integration">
              {isPending ? <img src={logoIcon} alt="" className="h-4 w-4 mr-2 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} /> : null}
              {isEdit ? "Save Changes" : "Add Integration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAcceloPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcceloIntegrationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcceloIntegrationRow | null>(null);
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [disconnectingSource, setDisconnectingSource] = useState<string | null>(null);
  const [verifyingSource, setVerifyingSource] = useState<string | null>(null);

  const { data: integrations = [], isLoading, refetch } = useQuery<AcceloIntegrationRow[]>({
    queryKey: ["/api/developer/accelo-integrations"],
  });

  const { data: sourcesData = [] } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedSource = params.get("source");
    if (params.get("connected") === "1") {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      toast({ title: `Accelo connected${connectedSource ? ` (${connectedSource})` : ""}` });
      window.history.replaceState({}, "", "/admin/integrations/accelo");
    } else if (params.get("error")) {
      const errMap: Record<string, string> = {
        invalid_state: "OAuth state mismatch — please try again.",
        token_exchange_failed: "Failed to exchange token with Accelo.",
        access_denied: "Access was denied in Accelo.",
      };
      const msg = errMap[params.get("error")!] ?? `OAuth error: ${params.get("error")}`;
      toast({ title: "Connection failed", description: msg, variant: "destructive" });
      window.history.replaceState({}, "", "/admin/integrations/accelo");
    }
  }, []);

  const existingCodes = new Set(integrations.map(i => i.sourceCode));
  const availableSources = sourcesData.filter(s => !existingCodes.has(s.code));

  const createMutation = useMutation({
    mutationFn: (data: IntegrationFormData) => apiRequest("POST", "/api/developer/accelo-integrations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      setAddOpen(false);
      toast({ title: "Integration added" });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("409") ? "A source with that code already exists." : "Failed to add integration.";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ sourceCode, data }: { sourceCode: string; data: Partial<IntegrationFormData & { isActive: boolean }> }) =>
      apiRequest("PATCH", `/api/developer/accelo-integrations/${sourceCode}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      setEditTarget(null);
      toast({ title: "Integration updated" });
    },
    onError: () => toast({ title: "Failed to update integration", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceCode: string) => apiRequest("DELETE", `/api/developer/accelo-integrations/${sourceCode}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      setDeleteTarget(null);
      toast({ title: "Integration deleted" });
    },
    onError: (err: any) => {
      const is409 = err?.message?.includes("409");
      toast({
        title: is409 ? "Cannot delete a connected integration" : "Failed to delete integration",
        description: is409 ? "Disconnect first, then delete." : undefined,
        variant: "destructive",
      });
    },
  });

  async function handleConnect(sourceCode: string) {
    setConnectingSource(sourceCode);
    try {
      const res = await apiRequest("GET", `/api/integrations/accelo/connect?source=${encodeURIComponent(sourceCode)}`);
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast({ title: "Failed to start OAuth flow", variant: "destructive" });
      setConnectingSource(null);
    }
  }

  async function handleDisconnect(sourceCode: string) {
    setDisconnectingSource(sourceCode);
    try {
      await apiRequest("DELETE", `/api/integrations/accelo/disconnect?source=${encodeURIComponent(sourceCode)}`);
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      toast({ title: `${sourceCode} disconnected` });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    } finally {
      setDisconnectingSource(null);
    }
  }

  function handleToggleActive(integration: AcceloIntegrationRow) {
    updateMutation.mutate({ sourceCode: integration.sourceCode, data: { isActive: !integration.isActive } });
  }

  async function handleVerify(sourceCode: string) {
    setVerifyingSource(sourceCode);
    try {
      const res = await apiRequest("POST", `/api/developer/accelo-integrations/${sourceCode}/verify`);
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/developer/accelo-integrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      toast({
        title: result.ok ? `${sourceCode} is connected` : `${sourceCode} connection failed`,
        description: result.ok ? undefined : result.error,
        variant: result.ok ? undefined : "destructive",
      });
    } catch {
      toast({ title: "Failed to verify connection", variant: "destructive" });
    } finally {
      setVerifyingSource(null);
    }
  }

  const emptyForm: IntegrationFormData = { sourceCode: "", deployment: "", clientId: "", clientSecret: "" };

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accelo Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage Accelo CRM integrations. Each source has its own OAuth credentials and push endpoint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading} data-testid="button-refresh-integrations">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-integration">
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <img src={logoIcon} alt="" className="h-5 w-5 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />
          Loading integrations…
        </div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No Accelo integrations configured yet.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddOpen(true)} data-testid="button-add-first-integration">
              <Plus className="h-4 w-4 mr-2" />
              Add your first integration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map(integration => (
            <IntegrationCard
              key={integration.sourceCode}
              integration={integration}
              onConnect={() => handleConnect(integration.sourceCode)}
              onDisconnect={() => handleDisconnect(integration.sourceCode)}
              onEdit={() => setEditTarget(integration)}
              onDelete={() => setDeleteTarget(integration)}
              onVerify={() => handleVerify(integration.sourceCode)}
              onToggleActive={() => handleToggleActive(integration)}
              connectPending={connectingSource === integration.sourceCode}
              disconnectPending={disconnectingSource === integration.sourceCode}
              verifyPending={verifyingSource === integration.sourceCode}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Add an integration above — pick the source, enter the Accelo deployment, client ID, and client secret.</li>
            <li>Connect via OAuth to authorise the portal to query that Accelo account.</li>
            <li>In Accelo, paste the push endpoint URL into a webhook pointing at the portal.</li>
            <li>When triggered, Accelo sends a company ID — the portal looks it up and creates or updates the company.</li>
            <li>New companies arrive with <strong className="text-foreground">pending</strong> status and need module access assigned.</li>
          </ol>
        </CardContent>
      </Card>

      <IntegrationFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Accelo Integration"
        description="Configure a new Accelo source with its OAuth credentials."
        defaultValues={emptyForm}
        onSubmit={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        isEdit={false}
        sources={availableSources}
      />

      {editTarget && (
        <IntegrationFormDialog
          open={!!editTarget}
          onOpenChange={v => { if (!v) setEditTarget(null); }}
          title={`Edit ${editTarget.sourceLabel !== editTarget.sourceCode ? editTarget.sourceLabel : editTarget.sourceCode}`}
          description="Update the credentials for this Accelo integration."
          defaultValues={{
            sourceCode: editTarget.sourceCode,
            deployment: editTarget.deployment,
            clientId: editTarget.clientId,
            clientSecret: "",
          }}
          onSubmit={data => {
            const payload: any = { deployment: data.deployment, clientId: data.clientId };
            if (data.clientSecret) payload.clientSecret = data.clientSecret;
            updateMutation.mutate({ sourceCode: editTarget.sourceCode, data: payload });
          }}
          isPending={updateMutation.isPending}
          isEdit={true}
          sources={[]}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.sourceLabel ?? deleteTarget?.sourceCode}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteTarget?.connected && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>This integration is still connected. Disconnect it first before deleting.</span>
                  </div>
                )}
                <span>
                  {deleteTarget?.connected
                    ? "Disconnecting clears the stored tokens and allows deletion."
                    : "This will permanently remove the integration. Any existing Accelo webhooks pointing at this source will stop working."}
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleteTarget?.connected && (
              <AlertDialogAction
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.sourceCode)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-integration"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
