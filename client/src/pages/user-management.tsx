import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Shield,
  Building2,
  Mail,
  Clock,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, ClientPermissionRole, ConsultantTier } from "@shared/schema";

interface SiteAssignment {
  siteId: string;
  companyName: string;
  isPrimary: boolean;
}

interface UserWithAssignments {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  siteId: string | null;
  status: "active" | "inactive";
  lastLogin: string | null;
  consultantTier?: ConsultantTier | null;
  clientPermissionRole?: ClientPermissionRole | null;
  entityAssignments?: SiteAssignment[];
}

interface Entity {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE = 15;

const roleColors: Record<UserRole, string> = {
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  consultant: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  client: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  consultant: "Consultant",
  client: "Client",
};

function formatLastLogin(lastLogin: string | null): string {
  if (!lastLogin) return "Never";
  const date = new Date(lastLogin);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin || isConsultant,
  });

  const { data: consultantsWithAssignments = [] } = useQuery<UserWithAssignments[]>({
    queryKey: ["/api/consultants"],
    enabled: isAdmin,
  });

  const { data: sites = [] } = useQuery<Entity[]>({
    queryKey: ["/api/sites"],
    enabled: isAdmin || isConsultant,
  });

  const usersWithEntityInfo = allUsers.map((u) => {
    if (u.role === "consultant") {
      const consultantData = consultantsWithAssignments.find((c) => c.id === u.id);
      return {
        ...u,
        entityAssignments: consultantData?.entityAssignments || [],
      };
    }
    if (u.role === "client" && u.siteId) {
      const entity = sites.find((e) => e.id === u.siteId);
      return {
        ...u,
        companyName: entity?.name || null,
      };
    }
    return u;
  });

  if (!isAdmin && !isConsultant) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators and consultants can access user management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getVisibleUsers = () => {
    if (isAdmin) return usersWithEntityInfo;
    if (isConsultant) return usersWithEntityInfo.filter((u) => u.role === "client");
    return [];
  };

  const filteredUsers = getVisibleUsers().filter((u) => {
    const matchesSearch = 
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const handleEditUser = (updatedUser: UserWithAssignments) => {
    toast({
      title: "User Updated",
      description: `${updatedUser.fullName}'s profile has been updated.`,
    });
    setEditingUser(null);
  };

  const handleAddUser = () => {
    toast({
      title: "User Created",
      description: "New user has been created and invitation sent.",
    });
    setIsAddUserOpen(false);
  };

  const handleToggleStatus = (targetUser: UserWithAssignments) => {
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    toast({
      title: newStatus === "active" ? "User Activated" : "User Deactivated",
      description: `${targetUser.fullName} has been ${newStatus === "active" ? "activated" : "deactivated"}.`,
    });
  };

  const renderSiteAssignments = (u: UserWithAssignments & { companyName?: string | null }) => {
    if (u.role === "consultant" && u.entityAssignments && u.entityAssignments.length > 0) {
      const primaryAssignment = u.entityAssignments.find((a) => a.isPrimary);
      const otherAssignments = u.entityAssignments.filter((a) => !a.isPrimary);
      const displayCount = 2;
      const visibleAssignments = u.entityAssignments.slice(0, displayCount);
      const remainingCount = u.entityAssignments.length - displayCount;

      return (
        <div className="flex flex-wrap items-center gap-1">
          {visibleAssignments.map((a) => (
            <Badge
              key={a.siteId}
              variant="outline"
              className="text-xs"
              data-testid={`badge-entity-${a.siteId}`}
            >
              {a.isPrimary && <Shield className="h-3 w-3 mr-1" />}
              {a.companyName}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-xs cursor-default">
                  +{remainingCount} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  {u.entityAssignments.slice(displayCount).map((a) => (
                    <div key={a.siteId} className="text-xs">
                      {a.isPrimary && "(Primary) "}
                      {a.companyName}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    }

    if (u.role === "consultant") {
      return <span className="text-sm text-muted-foreground">No assignments</span>;
    }

    if (u.role === "client" && u.companyName) {
      return (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {u.companyName}
        </div>
      );
    }

    if (u.role === "client" && u.siteId) {
      const entity = sites.find((e) => e.id === u.siteId);
      return (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {entity?.name || "Unknown Entity"}
        </div>
      );
    }

    return <span className="text-sm text-muted-foreground">Guardian Group</span>;
  };

  if (isLoadingUsers) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="mt-2 h-5 w-64" />
          </div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Entities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">User Management</h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin ? "Manage all users across the platform" : "View client users"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddUserOpen(true)} data-testid="button-add-user">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>

        {isAdmin && (
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v as UserRole | "all"); setPage(1); }}>
            <SelectTrigger className="w-[150px]" data-testid="select-role-filter">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Administrators</SelectItem>
              <SelectItem value="consultant">Consultants</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as "active" | "inactive" | "all"); setPage(1); }}>
          <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Entities</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search || roleFilter !== "all" || statusFilter !== "all" 
                    ? "No users match your filters." 
                    : "No users found."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {u.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleColors[u.role]}>
                      {roleLabels[u.role]}
                    </Badge>
                    {u.consultantTier && (
                      <span className="ml-2 text-xs text-muted-foreground capitalize">
                        ({u.consultantTier})
                      </span>
                    )}
                    {u.clientPermissionRole && (
                      <span className="ml-2 text-xs text-muted-foreground capitalize">
                        ({u.clientPermissionRole})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {renderSiteAssignments(u as UserWithAssignments & { companyName?: string | null })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"}>
                      {u.status === "active" ? (
                        <><UserCheck className="h-3 w-3 mr-1" />Active</>
                      ) : (
                        <><UserX className="h-3 w-3 mr-1" />Inactive</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatLastLogin(u.lastLogin)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${u.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => setEditingUser(u)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                              {u.status === "active" ? (
                                <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                              ) : (
                                <><UserCheck className="h-4 w-4 mr-2" />Activate</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and permissions
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input defaultValue={editingUser.fullName} data-testid="input-edit-fullname" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue={editingUser.email} data-testid="input-edit-email" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select defaultValue={editingUser.role}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser.role === "consultant" && (
                <div className="space-y-2">
                  <Label>Consultant Tier</Label>
                  <Select defaultValue={editingUser.consultantTier || "standard"}>
                    <SelectTrigger data-testid="select-edit-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={() => editingUser && handleEditUser(editingUser)} data-testid="button-save-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Enter full name" data-testid="input-new-fullname" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="Enter email address" data-testid="input-new-email" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input placeholder="Enter username" data-testid="input-new-username" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select defaultValue="client">
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="consultant">Consultant</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button onClick={handleAddUser} data-testid="button-create-user">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
