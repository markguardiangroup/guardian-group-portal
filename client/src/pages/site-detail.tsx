import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  KeyRound,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Site, User, ConsultantAssignment, ClientSiteAssignment, Company } from "@shared/schema";
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

function OverviewTab({ entity, sites, onEditSite, companyId, companyName }: { entity: Site; sites: Site[]; onEditSite: () => void; companyId?: string; companyName?: string }) {
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Sites ({sites.length})</CardTitle>
            <CardDescription>Physical locations for this entity</CardDescription>
          </div>
          <Button size="sm" data-testid="button-add-site">
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sites registered for this entity.</p>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                  data-testid={`site-${site.id}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{site.name}</p>
                    {(site.addressLine1 || site.city) && (
                      <p className="text-sm text-muted-foreground">
                        {[site.addressLine1, site.city, site.postalCode].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {site.contactName && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {site.contactName}
                        </span>
                      )}
                      {site.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {site.contactPhone}
                        </span>
                      )}
                    </div>
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
                        {c.fullName} ({c.consultantTier || "Standard"})
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
                      {assignment.canManageModules && (
                        <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                          <KeyRound className="h-3 w-3" />
                          Module Manager
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{assignment.consultantEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {assignment.consultantTier || "Standard"}
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
                      {!assignment.canManageModules && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ consultantId: assignment.consultantId, canManageModules: true })}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Grant Module Management
                        </DropdownMenuItem>
                      )}
                      {assignment.canManageModules && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ consultantId: assignment.consultantId, canManageModules: false })}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Revoke Module Management
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

function UsersTab({ siteId }: { siteId: string }) {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<UserWithoutPassword | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    fullName: "",
    password: "",
    clientPermissionRole: "viewer",
  });

  const { data: users = [], isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/sites", siteId, "users"],
  });

  // Fetch client site assignments for this site
  const { data: clientAssignments = [] } = useQuery<ClientAssignmentWithDetails[]>({
    queryKey: ["/api/sites", siteId, "client-assignments"],
  });

  // Create a set of assigned client IDs for quick lookup
  const assignedClientIds = new Set(clientAssignments.map(a => a.clientId));

  // Mutation to assign client to site
  const assignClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("POST", `/api/sites/${siteId}/client-assignments`, { clientId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "client-assignments"] });
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
      toast({ title: "Client site assignment removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove assignment", variant: "destructive" });
    },
  });

  // Helper to check if user has any site assignments
  const toggleClientSiteAccess = (userId: string) => {
    if (assignedClientIds.has(userId)) {
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const response = await apiRequest("POST", `/api/sites/${siteId}/users`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId, "users"] });
      toast({ title: "User created successfully" });
      setIsAddUserOpen(false);
      setNewUser({
        username: "",
        email: "",
        fullName: "",
        password: "",
        clientPermissionRole: "viewer",
      });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Failed to create user", variant: "destructive" });
    },
  });

  const handleAddUser = () => {
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.fullName.trim() || !newUser.password.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(newUser);
  };

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    approver: "Approver",
    editor: "Editor",
    viewer: "Viewer",
  };

  const handleEditUser = (user: UserWithoutPassword) => {
    setEditingUser(user);
    setEditRole(user.clientPermissionRole || "viewer");
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Client Users ({users.length})</CardTitle>
            <CardDescription>Users with access to this entity's portal</CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user">
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users registered for this entity.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`user-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {user.fullName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {roleLabels[user.clientPermissionRole || ""] || "Viewer"}
                    </Badge>
                    {assignedClientIds.has(user.id) ? (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                        <Shield className="mr-1 h-3 w-3" />
                        Site Access
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        All Sites
                      </Badge>
                    )}
                    <Badge
                      variant={user.status === "active" ? "secondary" : "outline"}
                      className={user.status === "active" ? "bg-emerald-500/10 text-emerald-600" : ""}
                    >
                      {user.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          data-testid={`button-user-menu-${user.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => toggleClientSiteAccess(user.id)}
                          data-testid={`toggle-site-access-${user.id}`}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          {assignedClientIds.has(user.id) ? "Remove Site Access" : "Grant Site Access"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({
                            userId: user.id,
                            status: user.status === "active" ? "inactive" : "active"
                          })}
                        >
                          {user.status === "active" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <label className="text-sm font-medium">Permission Role</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new client user for this entity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-user-fullname">Full Name *</Label>
              <Input
                id="new-user-fullname"
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-new-user-fullname"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-user-username">Username *</Label>
                <Input
                  id="new-user-username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter username"
                  data-testid="input-new-user-username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-email">Email *</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-new-user-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-user-password">Password *</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                  data-testid="input-new-user-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-role">Permission Role</Label>
                <Select
                  value={newUser.clientPermissionRole}
                  onValueChange={(value) => setNewUser({ ...newUser, clientPermissionRole: value })}
                >
                  <SelectTrigger id="new-user-role" data-testid="select-new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add-user">
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={createMutation.isPending} data-testid="button-save-new-user">
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComplianceTab({ siteId }: { siteId: string }) {
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", { siteId }],
  });

  const compliantDocs = documents.filter((d) => d.status === "compliant").length;
  const reviewDocs = documents.filter((d) => d.status === "review_required").length;
  const overdueDocs = documents.filter((d) => d.status === "overdue").length;
  const totalDocs = documents.length;
  const complianceScore = totalDocs > 0 ? Math.round((compliantDocs / totalDocs) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Compliance Score</span>
              <span className="text-2xl font-bold">{complianceScore}%</span>
            </div>
            <Progress value={complianceScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliantDocs}</p>
                <p className="text-sm text-muted-foreground">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewDocs}</p>
                <p className="text-sm text-muted-foreground">Review Required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueDocs}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SiteDetail() {
  const params = useParams<{ siteId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const siteId = params.siteId;
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
  });

  const { data: entity, isLoading: entityLoading } = useQuery<Site>({
    queryKey: ["/api/sites", siteId],
    enabled: !!siteId,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites", siteId, "sites"],
    enabled: !!siteId,
  });

  const { data: parentCompany } = useQuery<Company>({
    queryKey: ["/api/companies", entity?.companyId],
    enabled: !!entity?.companyId,
  });

  const updateSiteMutation = useMutation({
    mutationFn: async (data: typeof editSiteData) => {
      const response = await apiRequest("PATCH", `/api/sites/${siteId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Site updated successfully" });
      setIsEditSiteOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update site", variant: "destructive" });
    },
  });

  const handleEditSite = () => {
    if (entity) {
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
      });
      setIsEditSiteOpen(true);
    }
  };

  const handleSaveSite = () => {
    if (!editSiteData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/sites")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{entity.name}</h1>
            {(entity.addressLine1 || entity.city) && (
              <p className="text-sm text-muted-foreground">
                {[entity.addressLine1, entity.city, entity.postalCode].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="consultants" data-testid="tab-consultants">
            <UserCog className="mr-2 h-4 w-4" />
            Consultants
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <FileText className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab entity={entity} sites={sites} onEditSite={handleEditSite} companyId={entity.companyId} companyName={parentCompany?.name} />
        </TabsContent>

        <TabsContent value="consultants">
          <ConsultantsTab siteId={siteId!} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab siteId={siteId!} />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceTab siteId={siteId!} />
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
                placeholder="Enter site name"
                data-testid="input-site-name"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Address</h4>
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="site-address-line1">Address Line 1</Label>
                  <Input
                    id="site-address-line1"
                    value={editSiteData.addressLine1}
                    onChange={(e) => setEditSiteData({ ...editSiteData, addressLine1: e.target.value })}
                    placeholder="Street address"
                    data-testid="input-site-address-line1"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="site-address-line2">Address Line 2</Label>
                  <Input
                    id="site-address-line2"
                    value={editSiteData.addressLine2}
                    onChange={(e) => setEditSiteData({ ...editSiteData, addressLine2: e.target.value })}
                    placeholder="Suite, floor, building (optional)"
                    data-testid="input-site-address-line2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-city">City</Label>
                    <Input
                      id="site-city"
                      value={editSiteData.city}
                      onChange={(e) => setEditSiteData({ ...editSiteData, city: e.target.value })}
                      placeholder="City"
                      data-testid="input-site-city"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-county">County</Label>
                    <Input
                      id="site-county"
                      value={editSiteData.county}
                      onChange={(e) => setEditSiteData({ ...editSiteData, county: e.target.value })}
                      placeholder="County"
                      data-testid="input-site-county"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-postal-code">Postal Code</Label>
                    <Input
                      id="site-postal-code"
                      value={editSiteData.postalCode}
                      onChange={(e) => setEditSiteData({ ...editSiteData, postalCode: e.target.value })}
                      placeholder="Postal code"
                      data-testid="input-site-postal-code"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-country">Country</Label>
                    <Input
                      id="site-country"
                      value={editSiteData.country}
                      onChange={(e) => setEditSiteData({ ...editSiteData, country: e.target.value })}
                      placeholder="Country"
                      data-testid="input-site-country"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Primary Site Contact</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-contact-name">Contact Name</Label>
                    <Input
                      id="site-contact-name"
                      value={editSiteData.contactName}
                      onChange={(e) => setEditSiteData({ ...editSiteData, contactName: e.target.value })}
                      placeholder="Full name"
                      data-testid="input-site-contact-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-contact-position">Job Position</Label>
                    <Input
                      id="site-contact-position"
                      value={editSiteData.contactPosition}
                      onChange={(e) => setEditSiteData({ ...editSiteData, contactPosition: e.target.value })}
                      placeholder="e.g., Site Manager"
                      data-testid="input-site-contact-position"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="site-phone">Phone</Label>
                    <Input
                      id="site-phone"
                      value={editSiteData.contactPhone}
                      onChange={(e) => setEditSiteData({ ...editSiteData, contactPhone: e.target.value })}
                      placeholder="+44 123 456 7890"
                      data-testid="input-site-phone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="site-email">Email</Label>
                    <Input
                      id="site-email"
                      type="email"
                      value={editSiteData.contactEmail}
                      onChange={(e) => setEditSiteData({ ...editSiteData, contactEmail: e.target.value })}
                      placeholder="email@company.com"
                      data-testid="input-site-email"
                    />
                  </div>
                </div>
              </div>
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
    </div>
  );
}
