import { useState, useRef } from "react";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  UserCog,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Star,
  Crown,
  MoreHorizontal,
  Pencil,
  Shield,
  Briefcase,
  Search,
  X,
  UserCheck,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Site, SiteWithDetails, User, ConsultantAssignment, ClientSiteAssignment, Company, DocumentTemplate, SiteTemplateOverride } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

type ClientAssignmentWithDetails = ClientSiteAssignment & {
  clientName: string;
  clientEmail: string;
};

interface ConsultantWithDetails extends ConsultantAssignment {
  consultantName: string;
  consultantEmail: string;
  consultantTier: string | null;
}

interface UserWithoutPassword {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  siteId: string | null;
  status: string;
  consultantTier: string | null;
  clientPermissionRole: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

function OverviewTab({ entity, onEditSite, companyId, companyName, siteId }: { entity: Site & { companySources?: string[] | null }; onEditSite: () => void; companyId?: string; companyName?: string; siteId: string }) {
  const { data: siteStats } = useQuery<{ documents: Record<string, number>; cases: number; incidents: number }>({
    queryKey: ["/api/sites", siteId, "stats"],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/stats`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!siteId,
  });

  return (
    <div className="space-y-6">
      {/* Parent Company Card */}
      {companyId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">{companyName || "Parent Company"}</CardTitle>
              <CardDescription>This site belongs to a company group</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/companies/${companyId}`} data-testid="link-view-parent-company">
                <Building2 className="mr-2 h-4 w-4" />
                View Company
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      {/* Site Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Site Details</CardTitle>
          <Button variant="outline" size="sm" onClick={onEditSite} data-testid="button-edit-site">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Site
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Site Name</p>
            <p className="font-medium">{entity.name}</p>
          </div>
          
          {(entity.addressLine1 || entity.city || entity.postalCode) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Address</p>
              <div className="text-sm">
                {entity.addressLine1 && <p>{entity.addressLine1}</p>}
                {entity.addressLine2 && <p>{entity.addressLine2}</p>}
                {(entity.city || entity.county) && (
                  <p>{[entity.city, entity.county].filter(Boolean).join(", ")}</p>
                )}
                {entity.postalCode && <p>{entity.postalCode}</p>}
                {entity.country && <p>{entity.country}</p>}
              </div>
            </div>
          )}
          
          {(entity.contactName || entity.contactPhone || entity.contactEmail) && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Primary Contact</p>
              <div className="space-y-1 text-sm">
                {entity.contactName && (
                  <p className="font-medium">
                    {entity.contactName}{entity.contactPosition && ` - ${entity.contactPosition}`}
                  </p>
                )}
                {entity.contactPhone && <p>{entity.contactPhone}</p>}
                {entity.contactEmail && <p>{entity.contactEmail}</p>}
              </div>
            </div>
          )}
          {entity.companySources && entity.companySources.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {entity.companySources.map((code) => (
                  <Badge key={code} variant="outline" className="text-xs px-1.5 py-0 font-mono" data-testid={`badge-overview-source-${code}`}>
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Document Summary */}
      {siteStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { key: "health_safety", label: "Health & Safety", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", extra: { label: "Incidents", count: siteStats.incidents } },
                { key: "human_resources", label: "Human Resources", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
                { key: "employment_law", label: "Employment Law", color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-200 dark:border-pink-800", extra: { label: "Cases", count: siteStats.cases } },
                { key: "training", label: "Training", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800" },
                { key: "support", label: "Support", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
              ].map(({ key, label, color, bg, border, extra }) => (
                <div key={key} className={`rounded-lg border p-3 ${bg} ${border}`} data-testid={`stat-site-module-${key}`}>
                  <p className={`text-2xl font-bold ${color}`}>{siteStats.documents[key] ?? 0}</p>
                  <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
                  <p className="text-xs text-muted-foreground">documents</p>
                  {extra && (
                    <p className={`text-xs mt-1.5 font-medium ${color}`} data-testid={`stat-site-extra-${key}`}>
                      {extra.count} {extra.label}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConsultantsTab({ siteId }: { siteId: string }) {
  const { toast } = useToast();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<ConsultantWithDetails[]>({
    queryKey: ["/api/sites", siteId, "consultants"],
  });

  const { data: allConsultants = [], isLoading: consultantsLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/consultants"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ consultantId, isPrimary }: { consultantId: string; isPrimary: boolean }) => {
      const response = await apiRequest("POST", `/api/sites/${siteId}/consultants`, {
        consultantId,
        isPrimary,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "consultants"] });
      toast({ title: "Consultant assigned successfully" });
      setIsAssignDialogOpen(false);
      setSelectedConsultantId("");
    },
    onError: () => {
      toast({ title: "Failed to assign consultant", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      await apiRequest("DELETE", `/api/sites/${siteId}/consultants/${consultantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "consultants"] });
      toast({ title: "Consultant removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove consultant", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ consultantId, isPrimary, canManageModules }: { consultantId: string; isPrimary?: boolean; canManageModules?: boolean }) => {
      const response = await apiRequest("PATCH", `/api/sites/${siteId}/consultants/${consultantId}`, {
        isPrimary,
        canManageModules,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "consultants"] });
      toast({ title: "Consultant updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update consultant", variant: "destructive" });
    },
  });

  const availableConsultants = allConsultants.filter(
    (c) => !assignments.some((a) => a.consultantId === c.id)
  );

  if (assignmentsLoading || consultantsLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Assigned Consultants ({assignments.length})</CardTitle>
          <CardDescription>Consultants managing this entity's compliance</CardDescription>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-assign-consultant">
              <Plus className="mr-2 h-4 w-4" />
              Assign Consultant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Consultant</DialogTitle>
              <DialogDescription>
                Select a consultant to assign to this entity.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
                <SelectTrigger data-testid="select-consultant">
                  <SelectValue placeholder="Select a consultant" />
                </SelectTrigger>
                <SelectContent>
                  {availableConsultants.length === 0 ? (
                    <SelectItem value="none" disabled>No available consultants</SelectItem>
                  ) : (
                    availableConsultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} ({c.consultantTier === 'pro' ? 'Pro' : c.consultantTier || "Standard"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAssignDialogOpen(false)}
                data-testid="button-cancel-assign"
              >
                Cancel
              </Button>
              <Button
                onClick={() => assignMutation.mutate({ consultantId: selectedConsultantId, isPrimary: false })}
                disabled={!selectedConsultantId || assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No consultants assigned to this entity.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`consultant-${assignment.consultantId}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {assignment.consultantName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{assignment.consultantName}</p>
                      {assignment.isPrimary && (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{assignment.consultantEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {assignment.consultantTier === 'pro' ? 'Pro' : assignment.consultantTier || "Standard"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        data-testid={`button-consultant-menu-${assignment.consultantId}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!assignment.isPrimary && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ consultantId: assignment.consultantId, isPrimary: true })}
                        >
                          <Crown className="mr-2 h-4 w-4" />
                          Set as Primary
                        </DropdownMenuItem>
                      )}
                      {assignment.isPrimary && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ consultantId: assignment.consultantId, isPrimary: false })}
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Remove Primary Status
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from Site
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Consultant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {assignment.consultantName} from this entity?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMutation.mutate(assignment.consultantId)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsersTab({ siteId, companyId }: { siteId: string; companyId?: string }) {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<UserWithoutPassword | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: users = [], isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/sites", siteId, "users"],
  });

  // Fetch client site assignments for this site
  const { data: clientAssignments = [] } = useQuery<ClientAssignmentWithDetails[]>({
    queryKey: ["/api/sites", siteId, "client-assignments"],
  });

  // Fetch all users to get company users
  const { data: allUsersData = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
    enabled: !!companyId,
  });

  // Fetch company to know who the primary contact is
  const { data: company } = useQuery<{ id: string; contactUserId?: string | null }>({
    queryKey: ["/api/companies", companyId],
    enabled: !!companyId,
  });

  // Filter to get only client users belonging to this company
  const companyUsers = allUsersData.filter(
    (u) => u.role === "client" && (u as any).companyId === companyId
  );

  // Create a set of assigned client IDs for quick lookup
  const assignedClientIds = new Set(clientAssignments.map(a => a.clientId));

  // Filter to get only unassigned company users
  const availableUsers = companyUsers.filter((u) => !assignedClientIds.has(u.id));

  // Mutation to assign client to site
  const assignClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("POST", `/api/sites/${siteId}/client-assignments`, { clientId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Client assigned to this site" });
    },
    onError: () => {
      toast({ title: "Failed to assign client", variant: "destructive" });
    },
  });

  // Mutation to remove client from site
  const removeClientAssignmentMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await apiRequest("DELETE", `/api/sites/${siteId}/client-assignments/${clientId}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Client site assignment removed" });
    },
    onError: (error: Error) => {
      const message = error.message.includes("Cannot remove the last site")
        ? "Cannot remove the last site assignment from a client user. Assign another site first."
        : "Failed to remove assignment";
      toast({ title: message, variant: "destructive" });
    },
  });

  // Helper to check if user has any site assignments
  const toggleClientSiteAccess = (userId: string) => {
    if (assignedClientIds.has(userId)) {
      if (company?.contactUserId && company.contactUserId === userId) {
        toast({ title: "Cannot remove primary contact", description: "Change the primary contact first before removing site access.", variant: "destructive" });
        return;
      }
      removeClientAssignmentMutation.mutate(userId);
    } else {
      assignClientMutation.mutate(userId);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ userId, role, status }: { userId: string; role?: string; status?: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, {
        clientPermissionRole: role,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "users"] });
      toast({ title: "User updated successfully" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  // Fetch consultants assigned to this site (reuse same query as ConsultantsTab)
  const { data: consultantAssignments = [] } = useQuery<ConsultantWithDetails[]>({
    queryKey: ["/api/sites", siteId, "consultants"],
  });

  // Filter to non-pro consultants only
  const nonProConsultants = consultantAssignments.filter(a => a.consultantTier !== "pro");

  const roleLabels: Record<string, string> = {
    full: "Full",
  };

  const handleEditUser = (user: UserWithoutPassword) => {
    setEditingUser(user);
    setEditRole(user.clientPermissionRole || "full");
    setEditStatus(user.status || "active");
  };

  const handleSaveUser = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      userId: editingUser.id,
      role: editRole,
      status: editStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const hasAnyUsers = nonProConsultants.length > 0 || users.length > 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Users ({nonProConsultants.length + users.length})</h2>
        <Button size="sm" onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user">
          <Plus className="mr-2 h-4 w-4" />
          Assign Client User
        </Button>
      </div>
      {hasAnyUsers ? (
        <Card>
          {/* Consultants section */}
          {nonProConsultants.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Consultants ({nonProConsultants.length})
                </p>
              </div>
              <div className="divide-y">
                {nonProConsultants.map((a) => (
                  <div key={a.consultantId} className="flex items-center gap-4 px-4 py-3" data-testid={`row-consultant-${a.consultantId}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {a.consultantName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{a.consultantName}</span>
                        {a.isPrimary && (
                          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shrink-0">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{a.consultantEmail}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700">
                        {a.consultantTier ? (a.consultantTier.charAt(0).toUpperCase() + a.consultantTier.slice(1)) : "Standard"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Clients section */}
          {nonProConsultants.length > 0 && users.length > 0 && <div className="border-t" />}
          {users.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Clients ({users.length})
                </p>
              </div>
              <div className="divide-y">
                {users.map((user) => {
                  const isPrimaryContact = company?.contactUserId === user.id;
                  return (
                  <div key={user.id} className="flex items-center gap-4 px-4 py-3" data-testid={`user-${user.id}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{user.fullName}</span>
                        {isPrimaryContact && (
                          <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shrink-0">
                            Primary Contact
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={user.status === "active" ? "default" : "outline"}
                        className={
                          user.status === "invited" ? "border-amber-500 text-amber-600 dark:text-amber-400" :
                          user.status === "locked" ? "border-red-500 text-red-600 dark:text-red-400" : ""
                        }
                      >
                        {user.status === "active" ? (
                          <><UserCheck className="h-3 w-3 mr-1" />Active</>
                        ) : user.status === "invited" ? (
                          <><Clock className="h-3 w-3 mr-1" />Invited</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" />{user.status}</>
                        )}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-user-menu-${user.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toggleClientSiteAccess(user.id)}
                            disabled={isPrimaryContact && assignedClientIds.has(user.id)}
                            data-testid={`toggle-site-access-${user.id}`}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {assignedClientIds.has(user.id) ? (isPrimaryContact ? "Primary contact — cannot remove" : "Remove Site Access") : "Grant Site Access"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-medium">No users</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              No consultants or clients are currently assigned to this site
            </p>
            <Button className="mt-4" size="sm" onClick={() => setIsAddUserOpen(true)} data-testid="button-add-first-user">
              <Plus className="mr-2 h-4 w-4" />
              Assign Client User
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {editingUser?.fullName}'s role and status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger data-testid="select-user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={(open) => {
        setIsAddUserOpen(open);
        if (!open) {
          setSelectedUserId("");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Assign Client User</DialogTitle>
            <DialogDescription>
              Select an existing company user to grant them access to this site.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {availableUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p className="font-medium">No available users</p>
                <p className="text-sm mt-1">All company users are already assigned to this site, or no users exist yet.</p>
                <p className="text-sm mt-4 text-primary">
                  To add a new user, go to the Users section under Admin.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="select-user">Select User</Label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger id="select-user" data-testid="select-existing-user">
                      <SelectValue placeholder="Choose a user to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.fullName}</span>
                            <span className="text-muted-foreground">({user.email})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedUserId && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    {(() => {
                      const selected = availableUsers.find(u => u.id === selectedUserId);
                      return selected ? (
                        <div className="space-y-2">
                          <p className="font-medium">{selected.fullName}</p>
                          <p className="text-sm text-muted-foreground">{selected.email}</p>
                          <Badge variant="outline" className="text-xs">
                            {roleLabels[selected.clientPermissionRole || "full"] || "Full"}
                          </Badge>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Need to add someone new? Create them first in the Users section under Admin.
                </p>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add-user">
              Cancel
            </Button>
            {availableUsers.length > 0 && (
              <Button 
                onClick={() => {
                  if (selectedUserId) {
                    assignClientMutation.mutate(selectedUserId);
                    setIsAddUserOpen(false);
                    setSelectedUserId("");
                  }
                }} 
                disabled={!selectedUserId || assignClientMutation.isPending} 
                data-testid="button-assign-user"
              >
                {assignClientMutation.isPending ? "Adding..." : "Add User"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SiteWithCompliance {
  id: string;
  complianceSummary?: {
    totalDocuments: number;
    compliantDocuments: number;
    reviewRequired: number;
    overdueDocuments: number;
    complianceScore: number;
  };
}

const MODULE_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
};

const MODULE_ICON: Record<string, typeof Shield> = {
  health_safety: Shield,
  human_resources: Users,
  employment_law: Briefcase,
};

const MODULE_COLOR: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const MODULE_BORDER: Record<string, string> = {
  health_safety: "border-emerald-200 dark:border-emerald-800",
  human_resources: "border-blue-200 dark:border-blue-800",
  employment_law: "border-pink-200 dark:border-pink-800",
};

function ComplianceTab({ siteId, companyId }: { siteId: string; companyId?: string }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [addSelectedIds, setAddSelectedIds] = useState<Set<string>>(new Set());
  const [isSavingReqs, setIsSavingReqs] = useState(false);

  const { data: allTemplates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: companyModuleAccess } = useQuery<{ healthSafety: boolean; humanResources: boolean; employmentLaw: boolean }>({
    queryKey: ["/api/companies", companyId, "module-access"],
    queryFn: async () => {
      if (!companyId) return { healthSafety: false, humanResources: false, employmentLaw: false };
      const res = await fetch(`/api/companies/${companyId}/module-access`, { credentials: "include" });
      if (!res.ok) return { healthSafety: false, humanResources: false, employmentLaw: false };
      return res.json();
    },
    enabled: !!companyId,
  });

  const enabledModules = [
    companyModuleAccess?.healthSafety && "health_safety",
    companyModuleAccess?.humanResources && "human_resources",
    companyModuleAccess?.employmentLaw && "employment_law",
  ].filter(Boolean) as string[];

  const { data: companyRequired = [] } = useQuery<Array<{ id: string; templateId: string; companyId: string; inheritedFromCompanyId?: string | null; removedAt?: string | null }>>({
    queryKey: ["/api/companies", companyId, "required-templates"],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await fetch(`/api/companies/${companyId}/required-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: siteOverrides = [] } = useQuery<SiteTemplateOverride[]>({
    queryKey: ["/api/sites", siteId, "template-overrides"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/template-overrides`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Active vs soft-removed company requirements:
  // - Active rows drive compliance and show normally.
  // - Soft-removed inherited rows (parent group dropped them) stay visible
  //   here as struck-through "previously inherited, no longer required"
  //   entries so users can see what was removed without losing context.
  const activeCompanyRequired = companyRequired.filter(r => !r.removedAt);
  const softRemovedCompanyRequired = companyRequired.filter(r => !!r.removedAt);
  const companyRequiredIds = new Set(activeCompanyRequired.map(r => r.templateId));
  const excludedIds = new Set(siteOverrides.filter(o => o.action === "exclude").map(o => o.templateId));
  const includedIds = new Set(siteOverrides.filter(o => o.action === "include").map(o => o.templateId));
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));

  const effectiveRows: Array<{ templateId: string; source: "company" | "site" | "company-removed" }> = [
    ...[...companyRequiredIds].filter(id => !excludedIds.has(id)).map(id => ({ templateId: id, source: "company" as const })),
    ...[...includedIds].filter(id => !companyRequiredIds.has(id)).map(id => ({ templateId: id, source: "site" as const })),
    // Append soft-removed inherited rows last so the active list stays at
    // the top. Skip ones already site-excluded to avoid double-display.
    ...softRemovedCompanyRequired
      .filter(r => !excludedIds.has(r.templateId))
      .map(r => ({ templateId: r.templateId, source: "company-removed" as const })),
  ];

  const invalidateSiteData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "template-overrides"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
  };

  const addOverrideMutation = useMutation({
    mutationFn: async ({ templateId, action }: { templateId: string; action: "include" | "exclude" }) =>
      apiRequest("POST", `/api/sites/${siteId}/template-overrides`, { templateId, action }),
    onSuccess: () => { invalidateSiteData(); setAddOpen(false); setSearch(""); setModuleFilter(null); },
    onError: () => toast({ title: "Failed to update requirements", variant: "destructive" }),
  });

  const removeOverrideMutation = useMutation({
    mutationFn: async (templateId: string) =>
      apiRequest("DELETE", `/api/sites/${siteId}/template-overrides/${templateId}`),
    onSuccess: () => invalidateSiteData(),
    onError: () => toast({ title: "Failed to update requirements", variant: "destructive" }),
  });

  const handleRemove = (templateId: string, source: "company" | "site") => {
    if (source === "company") {
      addOverrideMutation.mutate({ templateId, action: "exclude" });
    } else {
      removeOverrideMutation.mutate(templateId);
    }
  };

  const handleAdd = (templateId: string) => {
    if (excludedIds.has(templateId)) {
      removeOverrideMutation.mutate(templateId);
    } else {
      addOverrideMutation.mutate({ templateId, action: "include" });
    }
    setAddOpen(false);
    setSearch("");
    setModuleFilter(null);
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setSearch("");
    setModuleFilter(null);
    setAddSelectedIds(new Set());
  };

  const effectiveIds = new Set(effectiveRows.map(r => r.templateId));
  const effectiveSourceMap = new Map(effectiveRows.map(r => [r.templateId, r.source]));
  const allPrivateActiveForSite = allTemplates.filter(t =>
    t.isActive && t.visibility === "private" && enabledModules.includes(t.module)
  );

  const handleSaveSelected = async () => {
    setIsSavingReqs(true);
    try {
      const toAdd = allPrivateActiveForSite.filter(t => addSelectedIds.has(t.id) && !effectiveIds.has(t.id));
      const toRemove = effectiveRows.filter(r => !addSelectedIds.has(r.templateId));
      if (toAdd.length === 0 && toRemove.length === 0) { closeAddDialog(); return; }
      await Promise.all([
        ...toAdd.map(t => {
          if (excludedIds.has(t.id)) {
            return apiRequest("DELETE", `/api/sites/${siteId}/template-overrides/${t.id}`);
          } else {
            return apiRequest("POST", `/api/sites/${siteId}/template-overrides`, { templateId: t.id, action: "include" });
          }
        }),
        ...toRemove.map(r => {
          if (r.source === "company") {
            return apiRequest("POST", `/api/sites/${siteId}/template-overrides`, { templateId: r.templateId, action: "exclude" });
          } else {
            return apiRequest("DELETE", `/api/sites/${siteId}/template-overrides/${r.templateId}`);
          }
        }),
      ]);
      invalidateSiteData();
      const parts = [];
      if (toAdd.length > 0) parts.push(`${toAdd.length} added`);
      if (toRemove.length > 0) parts.push(`${toRemove.length} removed`);
      toast({ title: `Requirements updated: ${parts.join(", ")}` });
      closeAddDialog();
    } catch {
      toast({ title: "Failed to update requirements", variant: "destructive" });
    } finally {
      setIsSavingReqs(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Required Documents</h3>
          <p className="text-sm text-muted-foreground">
            This list overrides the company-level requirements for this site. Adding a document here requires it only at this site; removing a company requirement excludes it from this site's compliance score only.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={v => { if (!v) closeAddDialog(); else { setAddOpen(true); setAddSelectedIds(new Set(effectiveIds)); } }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-requirement">
              <Plus className="mr-2 h-4 w-4" />
              Manage Requirements
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] h-[680px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <div className="px-6 pt-6 pb-4 shrink-0 border-b">
              <DialogHeader>
                <DialogTitle>Manage Required Documents</DialogTitle>
                <DialogDescription>
                  Tick to require a document at this site. Untick to remove an existing requirement. Changes apply to this site only.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {enabledModules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No modules are enabled for this site.</p>
              ) : (
                <Tabs defaultValue={enabledModules[0]}>
                  <TabsList className="mb-4">
                    {enabledModules.map(mod => (
                      <TabsTrigger key={mod} value={mod} data-testid={`tab-req-${mod}`}>
                        {MODULE_LABELS[mod] || mod}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {enabledModules.map(mod => {
                    const moduleTemplates = allPrivateActiveForSite.filter(t => t.module === mod);
                    return (
                      <TabsContent key={mod} value={mod}>
                        {moduleTemplates.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">
                            No templates available for {MODULE_LABELS[mod] || mod}.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {moduleTemplates.map(t => {
                              const source = effectiveSourceMap.get(t.id);
                              return (
                                <div key={t.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`req-${t.id}`}
                                    checked={addSelectedIds.has(t.id)}
                                    onCheckedChange={(checked) => {
                                      const newIds = new Set(addSelectedIds);
                                      if (checked) newIds.add(t.id); else newIds.delete(t.id);
                                      setAddSelectedIds(newIds);
                                    }}
                                    data-testid={`checkbox-req-${t.id}`}
                                  />
                                  <label
                                    htmlFor={`req-${t.id}`}
                                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                                  >
                                    {t.name}
                                    {source === "company" && (
                                      <Badge variant="outline" className="text-xs">Company</Badge>
                                    )}
                                    {t.requiresApproval && (
                                      <Badge variant="outline" className="text-xs">Approval Required</Badge>
                                    )}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </div>
            <div className="px-6 py-4 shrink-0 border-t">
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeAddDialog} data-testid="button-cancel-add-req">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSelected}
                  disabled={isSavingReqs}
                  data-testid="button-save-add-req"
                >
                  {isSavingReqs ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {effectiveRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">No required documents</p>
              <p className="text-xs text-muted-foreground mt-1">Add requirements above or configure them at the company level.</p>
            </div>
          ) : (
            <div className="divide-y">
              {effectiveRows.map(({ templateId, source }) => {
                const tmpl = templateMap.get(templateId);
                if (!tmpl) return null;
                const ModIcon = MODULE_ICON[tmpl.module] || FileText;
                const isPending = addOverrideMutation.isPending || removeOverrideMutation.isPending;
                // Soft-removed inherited rows: parent group dropped this
                // template. Render struck-through with no remove button —
                // re-adding at the group level reactivates it automatically.
                const isSoftRemoved = source === "company-removed";
                return (
                  <div
                    key={templateId}
                    className={`flex items-center gap-3 px-4 py-3 ${isSoftRemoved ? "opacity-60" : ""}`}
                    data-testid={`row-required-${templateId}`}
                  >
                    <div className="p-1.5 rounded-md bg-muted shrink-0">
                      <ModIcon className={`h-4 w-4 ${MODULE_COLOR[tmpl.module] || ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSoftRemoved ? "line-through text-muted-foreground" : ""}`}>
                        {tmpl.name}
                      </p>
                      <p className={`text-xs ${isSoftRemoved ? "text-muted-foreground" : MODULE_COLOR[tmpl.module] || "text-muted-foreground"}`}>
                        {isSoftRemoved
                          ? "No longer required by parent group"
                          : MODULE_LABELS[tmpl.module] || tmpl.module}
                      </p>
                    </div>
                    {(source === "company" || source === "company-removed") ? (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 flex items-center gap-1 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
                        data-testid={`badge-inherited-${templateId}`}
                      >
                        <Building2 className="h-3 w-3" />
                        Inherited
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                        data-testid={`badge-site-only-${templateId}`}
                      >
                        Site Only
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(templateId, isSoftRemoved ? "company" : (source as "company" | "site"))}
                      disabled={isPending}
                      title={
                        isSoftRemoved
                          ? "Hide this entry from this site"
                          : source === "company"
                            ? "Remove from this site"
                            : "Remove requirement"
                      }
                      data-testid={`button-remove-requirement-${templateId}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SiteDetail() {
  const params = useParams<{ siteId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const siteId = params.siteId;
  const fromParam = new URLSearchParams(searchString).get("from");
  const [isEditSiteOpen, setIsEditSiteOpen] = useState(false);
  const [editSiteData, setEditSiteData] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postalCode: "",
    country: "",
    contactName: "",
    contactPosition: "",
    contactPhone: "",
    contactEmail: "",
    contactUserId: "",
  });

  const { data: entity, isLoading: entityLoading } = useQuery<Site & { companySources?: string[] | null }>({
    queryKey: ["/api/sites", siteId],
    enabled: !!siteId,
  });

  const { data: parentCompany } = useQuery<Company & { sites?: Array<{ id: string }> }>({
    queryKey: ["/api/companies", entity?.companyId],
    enabled: !!entity?.companyId,
  });

  const siteAddressSnapshotRef = useRef({
    addressLine1: "", addressLine2: "", city: "", county: "", postalCode: "", country: "",
  });
  const [companySyncOpen, setCompanySyncOpen] = useState(false);
  const [companySyncAddress, setCompanySyncAddress] = useState<{
    addressLine1: string; addressLine2: string; city: string; county: string; postalCode: string; country: string;
  } | null>(null);

  // Fetch all users to filter for company users
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!entity?.companyId,
  });

  // Filter to get only client users from this company
  const companyUsers = allUsers.filter(
    (u) => u.role === "client" && u.companyId === entity?.companyId && u.status !== "inactive"
  );

  // Handler to select a user as site contact in edit mode
  const handleSelectContactUser = (userId: string) => {
    if (userId === "none") {
      setEditSiteData({
        ...editSiteData,
        contactUserId: "",
        contactName: "",
        contactPosition: "",
        contactPhone: "",
        contactEmail: "",
      });
      return;
    }
    
    const selectedUser = companyUsers.find((u) => u.id === userId);
    if (selectedUser) {
      setEditSiteData({
        ...editSiteData,
        contactUserId: userId,
        contactName: selectedUser.fullName || "",
        contactPosition: selectedUser.jobTitle || "",
        contactPhone: selectedUser.phone || selectedUser.mobile || "",
        contactEmail: selectedUser.email || "",
      });
    }
  };

  const addrFields = ["addressLine1", "addressLine2", "city", "county", "postalCode", "country"] as const;
  type AddrSnapshot = Record<typeof addrFields[number], string>;

  const updateSiteMutation = useMutation({
    mutationFn: async (data: typeof editSiteData) => {
      const response = await apiRequest("PATCH", `/api/sites/${siteId}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Site updated successfully" });
      setIsEditSiteOpen(false);

      const newAddr: AddrSnapshot = {
        addressLine1: variables.addressLine1, addressLine2: variables.addressLine2,
        city: variables.city, county: variables.county,
        postalCode: variables.postalCode, country: variables.country,
      };
      const oldAddr = siteAddressSnapshotRef.current;
      const addrChanged = addrFields.some(
        (f) => (newAddr[f] || "").trim().toLowerCase() !== (oldAddr[f] || "").trim().toLowerCase()
      );
      if (!addrChanged || !parentCompany) return;

      const companyAddr: AddrSnapshot = {
        addressLine1: parentCompany.addressLine1 || "", addressLine2: parentCompany.addressLine2 || "",
        city: parentCompany.city || "", county: parentCompany.county || "",
        postalCode: parentCompany.postalCode || "", country: parentCompany.country || "",
      };
      const companyHasOneSite = (parentCompany.sites?.length ?? 0) === 1;
      const companyMatchedOldSite = addrFields.every(
        (f) => (companyAddr[f] || "").trim().toLowerCase() === (oldAddr[f] || "").trim().toLowerCase()
      );
      if (companyHasOneSite || companyMatchedOldSite) {
        setCompanySyncAddress(newAddr);
        setCompanySyncOpen(true);
      }
    },
    onError: () => {
      toast({ title: "Failed to update site", variant: "destructive" });
    },
  });

  const syncCompanyMutation = useMutation({
    mutationFn: async (address: AddrSnapshot) => {
      if (!entity?.companyId) throw new Error("Missing company");
      const response = await apiRequest("PATCH", `/api/companies/${entity.companyId}`, address);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", entity?.companyId] });
      toast({ title: "Company address updated" });
      setCompanySyncOpen(false);
      setCompanySyncAddress(null);
    },
    onError: () => {
      toast({ title: "Failed to update company address", variant: "destructive" });
    },
  });

  const COUNTRY_OPTIONS = ["England", "Ireland", "Northern Ireland", "Scotland", "Wales"];

  const validateUKPostcode = (postcode: string) => /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i.test(postcode.trim());
  const validateEircode = (postcode: string) => /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i.test(postcode.trim());
  const validatePostcode = (postcode: string, country: string) => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return validateUKPostcode(postcode);
    if (country === "Ireland") return validateEircode(postcode);
    return postcode.trim().length > 0;
  };
  const getPostcodeError = (country: string) => {
    if (["England", "Northern Ireland", "Scotland", "Wales"].includes(country)) return "Please enter a valid UK postcode (e.g., BT1 1AA, SW1A 1AA)";
    if (country === "Ireland") return "Please enter a valid Eircode (e.g., D02 AF30)";
    return "Please enter a valid postal code";
  };

  const COUNTY_MAP: Record<string, string[]> = {
    "England": [
      "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire",
      "Cheshire", "City of London", "Cornwall", "County Durham", "Cumbria",
      "Derbyshire", "Devon", "Dorset", "East Riding of Yorkshire", "East Sussex",
      "Essex", "Gloucestershire", "Greater London", "Greater Manchester",
      "Hampshire", "Herefordshire", "Hertfordshire", "Isle of Wight", "Kent",
      "Lancashire", "Leicestershire", "Lincolnshire", "Merseyside", "Norfolk",
      "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire",
      "Oxfordshire", "Rutland", "Shropshire", "Somerset", "South Yorkshire",
      "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear", "Warwickshire",
      "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
    ],
    "Ireland": [
      "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
      "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick",
      "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly",
      "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
      "Wexford", "Wicklow",
    ],
    "Northern Ireland": [
      "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
    ],
    "Scotland": [
      "Aberdeen City", "Aberdeenshire", "Angus", "Argyll and Bute",
      "Clackmannanshire", "Dumfries and Galloway", "Dundee City",
      "East Ayrshire", "East Dunbartonshire", "East Lothian", "East Renfrewshire",
      "Edinburgh", "Falkirk", "Fife", "Glasgow City", "Highland",
      "Inverclyde", "Midlothian", "Moray", "North Ayrshire",
      "North Lanarkshire", "Orkney Islands", "Perth and Kinross",
      "Renfrewshire", "Scottish Borders", "Shetland Islands",
      "South Ayrshire", "South Lanarkshire", "Stirling",
      "West Dunbartonshire", "West Lothian", "Western Isles",
    ],
    "Wales": [
      "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire",
      "Ceredigion", "Conwy", "Denbighshire", "Flintshire", "Gwynedd",
      "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot",
      "Newport", "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea",
      "Torfaen", "Vale of Glamorgan", "Wrexham",
    ],
  };

  const handleEditSite = () => {
    if (entity) {
      siteAddressSnapshotRef.current = {
        addressLine1: entity.addressLine1 || "",
        addressLine2: entity.addressLine2 || "",
        city: entity.city || "",
        county: entity.county || "",
        postalCode: entity.postalCode || "",
        country: entity.country || "",
      };
      // Try to find the user whose details match the current contact
      const matchingUser = companyUsers.find(
        (u) => u.email === entity.contactEmail || u.fullName === entity.contactName
      );
      setEditSiteData({
        name: entity.name || "",
        addressLine1: entity.addressLine1 || "",
        addressLine2: entity.addressLine2 || "",
        city: entity.city || "",
        county: entity.county || "",
        postalCode: entity.postalCode || "",
        country: entity.country || "",
        contactName: entity.contactName || "",
        contactPosition: entity.contactPosition || "",
        contactPhone: entity.contactPhone || "",
        contactEmail: entity.contactEmail || "",
        contactUserId: matchingUser?.id || "",
      });
      setIsEditSiteOpen(true);
    }
  };

  const handleSaveSite = () => {
    if (!editSiteData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }
    if (!editSiteData.addressLine1.trim()) {
      toast({ title: "Address Line 1 is required", variant: "destructive" });
      return;
    }
    if (!editSiteData.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return;
    }
    if (!editSiteData.country) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (!editSiteData.county) {
      toast({ title: "County is required", variant: "destructive" });
      return;
    }
    if (!validatePostcode(editSiteData.postalCode, editSiteData.country)) {
      toast({ title: getPostcodeError(editSiteData.country), variant: "destructive" });
      return;
    }
    updateSiteMutation.mutate(editSiteData);
  };

  if (entityLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-4 h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Site Not Found</h2>
          <p className="mt-2 text-muted-foreground">The site you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => navigate("/sites")}>
            Back to Sites
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-6 bg-background border-b flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(fromParam || "/sites")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold">{entity.name}</h1>
              {entity.referenceNumber && (
                <Badge variant="outline" className="font-mono text-xs" data-testid="badge-site-reference">
                  {entity.referenceNumber}
                </Badge>
              )}
            </div>
            {(entity.addressLine1 || entity.city) && (
              <p className="text-sm text-muted-foreground">
                {[entity.addressLine1, entity.city, entity.postalCode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>
      <div id="page-content" className="flex-1 overflow-auto px-6 pb-6 pt-6 space-y-6 dash-animate">

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <FileText className="mr-2 h-4 w-4" />
            Required Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab entity={entity} onEditSite={handleEditSite} companyId={entity.companyId} companyName={parentCompany?.name} siteId={siteId!} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab siteId={siteId!} companyId={entity.companyId} />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceTab siteId={siteId!} companyId={entity.companyId} />
        </TabsContent>
      </Tabs>

      <Dialog open={isEditSiteOpen} onOpenChange={setIsEditSiteOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Site Details</DialogTitle>
            <DialogDescription>
              Update the details for this site location.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="site-name">Site Name *</Label>
              <Input
                id="site-name"
                value={editSiteData.name}
                onChange={(e) => setEditSiteData({ ...editSiteData, name: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                  setEditSiteData({ ...editSiteData, name: v });
                }}
                placeholder="Enter site name"
                data-testid="input-site-name"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="site-address-line1">Address Line 1 <span className="text-destructive">*</span></Label>
                  <Input
                    id="site-address-line1"
                    value={editSiteData.addressLine1}
                    onChange={(e) => setEditSiteData({ ...editSiteData, addressLine1: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                      setEditSiteData({ ...editSiteData, addressLine1: v });
                    }}
                    placeholder="Street address"
                    data-testid="input-site-address-line1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-address-line2">Address Line 2</Label>
                  <Input
                    id="site-address-line2"
                    value={editSiteData.addressLine2}
                    onChange={(e) => setEditSiteData({ ...editSiteData, addressLine2: e.target.value })}
                    onBlur={(e) => {
                      const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                      setEditSiteData({ ...editSiteData, addressLine2: v });
                    }}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-site-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-city">City <span className="text-destructive">*</span></Label>
                    <Input
                      id="site-city"
                      value={editSiteData.city}
                      onChange={(e) => setEditSiteData({ ...editSiteData, city: e.target.value })}
                      onBlur={(e) => {
                        const v = e.target.value.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                        setEditSiteData({ ...editSiteData, city: v });
                      }}
                      placeholder="City"
                      data-testid="input-site-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-country">Country <span className="text-destructive">*</span></Label>
                    <Select
                      value={editSiteData.country || ""}
                      onValueChange={(value) => setEditSiteData({ ...editSiteData, country: value, county: "" })}
                    >
                      <SelectTrigger id="site-country" data-testid="select-site-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-county">County <span className="text-destructive">*</span></Label>
                    <Select
                      value={editSiteData.county || ""}
                      onValueChange={(value) => setEditSiteData({ ...editSiteData, county: value })}
                      disabled={!editSiteData.country}
                    >
                      <SelectTrigger id="site-county" data-testid="select-site-county">
                        <SelectValue placeholder={editSiteData.country ? "Select county" : "Select country first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(COUNTY_MAP[editSiteData.country] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-postal-code">Postal Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="site-postal-code"
                      value={editSiteData.postalCode}
                      onChange={(e) => setEditSiteData({ ...editSiteData, postalCode: e.target.value.toUpperCase() })}
                      placeholder={editSiteData.country === "Ireland" ? "e.g., D02 AF30" : "e.g., BT1 1AA"}
                      data-testid="input-site-postal-code"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Primary Site Contact (Optional)</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Select a registered user from this company to be the primary contact for this site.
              </p>
              
              {companyUsers.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-contact-user">Select Contact</Label>
                    <Select
                      value={editSiteData.contactUserId || "none"}
                      onValueChange={handleSelectContactUser}
                    >
                      <SelectTrigger id="site-contact-user" data-testid="select-site-contact-user">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No contact selected</SelectItem>
                        {companyUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName} {u.jobTitle ? `- ${u.jobTitle}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editSiteData.contactUserId && (
                    <div className="rounded-md border p-3 bg-muted/50">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2">Contact Details (from user profile)</h5>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>{" "}
                          <span className="font-medium">{editSiteData.contactName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Position:</span>{" "}
                          <span className="font-medium">{editSiteData.contactPosition || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>{" "}
                          <span className="font-medium">{editSiteData.contactPhone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          <span className="font-medium">{editSiteData.contactEmail || "—"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No users available in this company yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can add users in the <strong>Users</strong> section and then assign them as site contacts.
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSiteOpen(false)} data-testid="button-cancel-edit-site">
              Cancel
            </Button>
            <Button onClick={handleSaveSite} disabled={updateSiteMutation.isPending} data-testid="button-save-site">
              {updateSiteMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={companySyncOpen} onOpenChange={(open) => { if (!open) { setCompanySyncOpen(false); setCompanySyncAddress(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update company address?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to copy the new address to <strong>{parentCompany?.name}</strong> as well?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setCompanySyncOpen(false); setCompanySyncAddress(null); }}
              data-testid="button-skip-company-sync"
            >
              No, keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => companySyncAddress && syncCompanyMutation.mutate(companySyncAddress)}
              disabled={syncCompanyMutation.isPending}
              data-testid="button-confirm-company-sync"
            >
              {syncCompanyMutation.isPending ? "Updating..." : "Yes, update company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
