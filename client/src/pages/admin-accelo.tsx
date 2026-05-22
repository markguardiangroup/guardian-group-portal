import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Link2, Link2Off, RefreshCw, Info, Copy, Check, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

interface AcceloStatus {
  connected: boolean;
  expiresAt?: string;
}

interface WebhookSecretResponse {
  secret: string | null;
}

export default function AdminAcceloPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<AcceloStatus>({
    queryKey: ["/api/integrations/accelo/status"],
  });

  const { data: secretData } = useQuery<WebhookSecretResponse>({
    queryKey: ["/api/integrations/accelo/webhook-secret"],
  });

  const webhookSecret = secretData?.secret ?? null;
  const webhookUrl = webhookSecret
    ? `https://guardiangroup.ai/api/integrations/accelo/push?secret=${webhookSecret}`
    : "https://guardiangroup.ai/api/integrations/accelo/push";

  const maskedUrl = webhookSecret
    ? `https://guardiangroup.ai/api/integrations/accelo/push?secret=${"•".repeat(16)}`
    : webhookUrl;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/accelo/connect");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: () => {
      toast({ title: "Failed to start connection", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/integrations/accelo/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      toast({ title: "Accelo disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/accelo/status"] });
      toast({ title: "Accelo connected successfully" });
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

  const expiresAt = status?.expiresAt ? new Date(status.expiresAt) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accelo Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Accelo CRM to push clients directly into the portal.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh-accelo-status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Checking connection…
            </div>
          ) : status?.connected && !isExpired ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-400">Connected to Accelo</span>
                <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge>
              </div>
              {expiresAt && (
                <p className="text-sm text-muted-foreground">
                  Access token expires {format(expiresAt, "d MMM yyyy 'at' HH:mm")}
                </p>
              )}
              <Separator />
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-accelo"
              >
                <Link2Off className="h-4 w-4 mr-2" />
                {disconnectMutation.isPending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isExpired ? "Token expired — reconnect to continue" : "Not connected"}
                </span>
              </div>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                data-testid="button-connect-accelo"
              >
                <Link2 className="h-4 w-4 mr-2" />
                {connectMutation.isPending ? "Redirecting to Accelo…" : "Connect Accelo"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Push Endpoint</CardTitle>
          <CardDescription>
            Paste this URL into the <strong>Payload URL</strong> field in Accelo. Leave the Secret field blank — the secret is already embedded in the URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-stretch gap-2">
            <div
              className="flex-1 rounded-md bg-muted px-4 py-3 font-mono text-sm break-all select-all"
              data-testid="text-push-endpoint"
            >
              {secretVisible ? webhookUrl : maskedUrl}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setSecretVisible((v) => !v)}
                title={secretVisible ? "Hide secret" : "Reveal secret"}
                data-testid="button-toggle-secret-visibility"
              >
                {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={copyUrl}
                title="Copy URL"
                data-testid="button-copy-push-endpoint"
              >
                {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-background p-4 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="space-y-1 text-muted-foreground">
                <p>The request body must include:</p>
                <pre className="rounded bg-muted px-3 py-2 text-xs mt-1">{`{ "acceloCompanyId": "12345" }`}</pre>
                <p className="mt-1">
                  The portal will look up the company in Accelo, then create or update it here.
                  New companies are created with <strong>pending</strong> status — an admin must
                  activate them and configure module access.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Connect your Accelo account above using OAuth.</li>
            <li>In Accelo, configure a webhook pointing to the push endpoint URL above (Secret field can be left blank).</li>
            <li>When triggered, Accelo sends the company ID to the portal.</li>
            <li>The portal looks up the company in Accelo and creates it (or updates it if it already exists).</li>
            <li>New companies are created with <strong className="text-foreground">pending</strong> status — assign module access and activate from the Companies page.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
