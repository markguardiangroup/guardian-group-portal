import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle, MapPin, Plus, Search, Shield, Star, X } from "lucide-react";

function toTitleCase(str: string): string {
  return str.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function extractEmailDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase().trim() : "";
}

function extractWebsiteDomain(website: string): string {
  try {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return website.toLowerCase().replace(/^www\./i, "").split("/")[0].trim();
  }
}

const FORM_INITIAL = {
  title: "", firstName: "", lastName: "", jobTitle: "", department: "",
  phone: "", mobile: "", email: "", notes: "", clientPermissionRole: "full",
};

export interface CreateClientUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
  companyWebsite?: string | null;
  companySites?: Array<{ id: string; name: string }>;
  onCreated?: () => void;
}

export function CreateClientUserDialog({
  open, onOpenChange, companyId, companyName, companyWebsite, companySites = [], onCreated,
}: CreateClientUserDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_INITIAL);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [domainMismatch, setDomainMismatch] = useState<{ emailDomain: string; websiteDomain: string } | null>(null);
  const [showDomainConfirm, setShowDomainConfirm] = useState(false);

  const [createdUser, setCreatedUser] = useState<{ id: string; fullName: string } | null>(null);
  const [showSiteAssign, setShowSiteAssign] = useState(false);
  const [pendingSiteAdds, setPendingSiteAdds] = useState<string[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [setPrimary, setSetPrimary] = useState(false);
  const [setKeyContact, setSetKeyContact] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setForm(FORM_INITIAL);
    setEmailError(null);
    setDomainMismatch(null);
  };

  const resetSiteAssign = () => {
    setCreatedUser(null);
    setPendingSiteAdds([]);
    setSiteSearch("");
    setSetPrimary(false);
    setSetKeyContact(false);
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await apiRequest("POST", "/api/users", data);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onOpenChange(false);
      resetForm();
      setCreatedUser({ id: data.id, fullName: data.fullName || `${form.firstName} ${form.lastName}`.trim() });
      setShowSiteAssign(true);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const doSubmit = () => {
    if (!form.email.trim()) { toast({ title: "Email is required", variant: "destructive" }); return; }
    if (emailError) { toast({ title: "Please fix email errors before saving", variant: "destructive" }); return; }
    if (domainMismatch) { setShowDomainConfirm(true); return; }
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim() || form.email.split("@")[0];
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, "").replace(/[^a-z0-9.]/g, "") || form.email.split("@")[0];
    createUserMutation.mutate({
      username, email: form.email.trim(), fullName,
      title: form.title === "_none" ? "" : form.title, firstName, lastName,
      jobTitle: form.jobTitle, department: form.department,
      phone: form.phone, mobile: form.mobile, notes: form.notes,
      role: "client", companyId, clientPermissionRole: form.clientPermissionRole, sources: [],
    });
  };

  const handleDone = async () => {
    if (!createdUser) { setShowSiteAssign(false); return; }
    setIsSaving(true);
    try {
      for (const siteId of pendingSiteAdds) {
        await apiRequest("POST", `/api/users/${createdUser.id}/site-assignments/${siteId}`, {});
      }
      if (setPrimary) {
        await apiRequest("PATCH", `/api/companies/${companyId}/primary-contact`, { userId: createdUser.id });
        queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      }
      if (setKeyContact) {
        await apiRequest("POST", "/api/key-contacts", { userId: createdUser.id, entityType: "company", entityId: companyId });
        queryClient.invalidateQueries({ queryKey: ["/api/key-contacts/user-ids"] });
        queryClient.invalidateQueries({ queryKey: ["/api/key-contacts", "company", companyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      const parts: string[] = [];
      if (pendingSiteAdds.length > 0) parts.push(`${pendingSiteAdds.length} site${pendingSiteAdds.length !== 1 ? "s" : ""} assigned`);
      if (setPrimary) parts.push("set as primary contact");
      if (setKeyContact) parts.push("set as key contact");
      toast({
        title: "User created",
        description: parts.length > 0 ? parts.join(", ") + "." : `${createdUser.fullName} created successfully.`,
      });
      onCreated?.();
    } catch {
      toast({ title: "Failed to save some settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setShowSiteAssign(false);
      resetSiteAssign();
    }
  };

  const unassignedSites = companySites.filter(s => !pendingSiteAdds.includes(s.id));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Client User</DialogTitle>
            <DialogDescription>
              Add a new client user{companyName ? <> to <span className="font-medium">{companyName}</span></> : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-[100px_1fr_1fr] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ccu-title">Title</Label>
                <Select value={form.title} onValueChange={(v) => setForm(f => ({ ...f, title: v }))}>
                  <SelectTrigger id="ccu-title" data-testid="select-ccu-title"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Miss">Miss</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ccu-firstname">First Name</Label>
                <Input id="ccu-firstname" value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" data-testid="input-ccu-firstname" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ccu-lastname">Last Name</Label>
                <Input id="ccu-lastname" value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" data-testid="input-ccu-lastname" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccu-email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="ccu-email"
                type="email"
                value={form.email}
                onChange={(e) => { setForm(f => ({ ...f, email: e.target.value })); setEmailError(null); setDomainMismatch(null); }}
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  if (!val) return;
                  try {
                    const res = await fetch(`/api/users/check-email?email=${encodeURIComponent(val)}`, { credentials: "include" });
                    if (!res.ok) {
                      const d = await res.json();
                      setEmailError(d.error || "This email address is already in use.");
                      return;
                    }
                    setEmailError(null);
                    if (companyWebsite) {
                      const emailDomain = extractEmailDomain(val);
                      const websiteDomain = extractWebsiteDomain(companyWebsite);
                      if (emailDomain && websiteDomain && emailDomain !== websiteDomain) {
                        setDomainMismatch({ emailDomain, websiteDomain });
                      } else {
                        setDomainMismatch(null);
                      }
                    }
                  } catch { setEmailError(null); }
                }}
                placeholder="email@company.com"
                data-testid="input-ccu-email"
              />
              {emailError && <p className="text-xs font-medium text-destructive">{emailError}</p>}
              {!emailError && domainMismatch && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Email domain <strong>@{domainMismatch.emailDomain}</strong> doesn't match <strong>{domainMismatch.websiteDomain}</strong>. You can still save.</span>
                </div>
              )}
              {!emailError && !domainMismatch && !companyWebsite && (
                <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>No website on file — email domain check unavailable.</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ccu-jobtitle">Job Title</Label>
                <Input id="ccu-jobtitle" value={form.jobTitle} onChange={(e) => setForm(f => ({ ...f, jobTitle: e.target.value }))} onBlur={(e) => { const v = e.target.value.trim(); if (v) setForm(f => ({ ...f, jobTitle: toTitleCase(v) })); }} placeholder="e.g., Safety Manager" data-testid="input-ccu-jobtitle" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ccu-department">Department</Label>
                <Input id="ccu-department" value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} onBlur={(e) => { const v = e.target.value.trim(); if (v) setForm(f => ({ ...f, department: toTitleCase(v) })); }} placeholder="e.g., Operations" data-testid="input-ccu-department" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ccu-phone">Phone</Label>
                <Input id="ccu-phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+44 1234 567890" data-testid="input-ccu-phone" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ccu-mobile">Mobile</Label>
                <Input id="ccu-mobile" value={form.mobile} onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="+44 7700 900000" data-testid="input-ccu-mobile" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccu-permission">Permission Role</Label>
              <Select value={form.clientPermissionRole} onValueChange={(v) => setForm(f => ({ ...f, clientPermissionRole: v }))}>
                <SelectTrigger id="ccu-permission" data-testid="select-ccu-permission"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access</SelectItem>
                  <SelectItem value="limited">Limited Access</SelectItem>
                  <SelectItem value="compliance_only">Compliance Only</SelectItem>
                  <SelectItem value="none">No Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ccu-notes">Notes</Label>
              <Textarea id="ccu-notes" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} data-testid="textarea-ccu-notes" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} data-testid="button-ccu-cancel">Cancel</Button>
            <Button onClick={doSubmit} disabled={createUserMutation.isPending || !!emailError} data-testid="button-ccu-save">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDomainConfirm} onOpenChange={setShowDomainConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email domain mismatch</AlertDialogTitle>
            <AlertDialogDescription>
              The email domain <strong>@{domainMismatch?.emailDomain}</strong> doesn't match the company website domain <strong>{domainMismatch?.websiteDomain}</strong>. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDomainConfirm(false); setDomainMismatch(null); doSubmit(); }}>Continue anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showSiteAssign}
        onOpenChange={(o) => {
          if (!o) {
            setShowSiteAssign(false);
            resetSiteAssign();
            if (createdUser) {
              toast({ title: "User created", description: `${createdUser.fullName} has been created.` });
              onCreated?.();
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Assign Sites to {createdUser?.fullName}
            </DialogTitle>
            <DialogDescription>
              {createdUser?.fullName} has been created. Assign them to sites and optionally set contact roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 space-y-3 transition-colors ${setPrimary ? "border-primary/50 bg-primary/5" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="ccu-primary-check"
                  checked={setPrimary}
                  onChange={e => { setSetPrimary(e.target.checked); if (e.target.checked) setSetKeyContact(false); }}
                  className="h-4 w-4 mt-0.5 rounded border-input accent-primary cursor-pointer shrink-0"
                  data-testid="checkbox-ccu-primary"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="ccu-primary-check" className="cursor-pointer font-medium leading-snug">Set as primary contact</Label>
                  <p className="text-xs text-muted-foreground">Replaces the current primary contact for {companyName ?? "this company"}.</p>
                </div>
              </div>
              {setPrimary && (
                <div className="flex items-start gap-2 text-sm bg-muted/60 rounded-md p-3">
                  <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{createdUser?.fullName}</strong> will become the primary contact for <strong className="text-foreground">{companyName ?? "this company"}</strong> and be granted access to all current and future sites.
                  </span>
                </div>
              )}
            </div>
            <div className={`rounded-lg border p-4 space-y-3 transition-colors ${setKeyContact ? "border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/20" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="ccu-keycontact-check"
                  checked={setKeyContact}
                  onChange={e => { setSetKeyContact(e.target.checked); if (e.target.checked) setSetPrimary(false); }}
                  className="h-4 w-4 mt-0.5 rounded border-input accent-teal-600 cursor-pointer shrink-0"
                  data-testid="checkbox-ccu-keycontact"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="ccu-keycontact-check" className="cursor-pointer font-medium leading-snug">Set as key contact</Label>
                  <p className="text-xs text-muted-foreground">Designates this user as a key contact for {companyName ?? "their company"}.</p>
                </div>
              </div>
              {setKeyContact && (
                <div className="flex items-start gap-2 text-sm bg-muted/60 rounded-md p-3">
                  <Star className="h-4 w-4 mt-0.5 text-teal-600 shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{createdUser?.fullName}</strong> will be marked as a key contact for <strong className="text-foreground">{companyName ?? "this company"}</strong>.
                  </span>
                </div>
              )}
            </div>
            {!setPrimary && companySites.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Assigned Sites</Label>
                  {unassignedSites.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setPendingSiteAdds(companySites.map(s => s.id))} data-testid="button-ccu-add-all">
                      <Plus className="h-3 w-3 mr-1" />Add All
                    </Button>
                  )}
                </div>
                {pendingSiteAdds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                    {pendingSiteAdds.map(siteId => {
                      const site = companySites.find(s => s.id === siteId);
                      return (
                        <Badge key={siteId} variant="default" className="flex items-center gap-1 pr-1" data-testid={`badge-pending-site-${siteId}`}>
                          <span>{site?.name ?? siteId}</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-destructive/20" onClick={() => setPendingSiteAdds(prev => prev.filter(id => id !== siteId))} data-testid={`button-unstage-site-${siteId}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sites assigned yet.</p>
                )}
                {unassignedSites.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <Label className="text-sm font-medium">Available Sites</Label>
                    {companySites.length > 3 && (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)} placeholder="Search sites…" className="pl-8 h-8 text-sm" data-testid="input-ccu-site-search" />
                      </div>
                    )}
                    <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {unassignedSites
                        .filter(s => !siteSearch || s.name.toLowerCase().includes(siteSearch.toLowerCase()))
                        .map(site => (
                          <div key={site.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/50">
                            <span className="text-sm">{site.name}</span>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setPendingSiteAdds(prev => [...prev, site.id])} data-testid={`button-ccu-add-site-${site.id}`}>
                              <Plus className="h-3 w-3 mr-1" />Add
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowSiteAssign(false); resetSiteAssign(); toast({ title: "User created", description: `${createdUser?.fullName} has been created.` }); onCreated?.(); }}
              disabled={isSaving}
              data-testid="button-ccu-skip"
            >
              Skip
            </Button>
            <Button onClick={handleDone} disabled={isSaving} data-testid="button-ccu-done">
              {isSaving ? "Saving..." : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
