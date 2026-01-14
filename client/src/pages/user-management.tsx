import { useState } from "react";
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

interface MockUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  entityId: string | null;
  entityName: string | null;
  status: "active" | "inactive";
  lastLogin: string | null;
  consultantTier?: ConsultantTier | null;
  clientPermissionRole?: ClientPermissionRole | null;
}

const mockUsers: MockUser[] = [
  {
    id: "1",
    username: "admin",
    email: "admin@guardiangroup.com",
    fullName: "System Administrator",
    role: "admin",
    entityId: null,
    entityName: null,
    status: "active",
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    username: "consultant1",
    email: "john.doe@guardiangroup.com",
    fullName: "John Doe",
    role: "consultant",
    entityId: null,
    entityName: null,
    status: "active",
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    consultantTier: "senior",
  },
  {
    id: "3",
    username: "consultant2",
    email: "sarah.connor@guardiangroup.com",
    fullName: "Sarah Connor",
    role: "consultant",
    entityId: null,
    entityName: null,
    status: "active",
    lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    consultantTier: "senior",
  },
  {
    id: "4",
    username: "client.acme",
    email: "safety@acme-mfg.com",
    fullName: "Robert Chen",
    role: "client",
    entityId: "entity-1",
    entityName: "Acme Manufacturing Ltd",
    status: "active",
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "owner",
  },
  {
    id: "5",
    username: "client.acme2",
    email: "hr@acme-mfg.com",
    fullName: "Lisa Wong",
    role: "client",
    entityId: "entity-1",
    entityName: "Acme Manufacturing Ltd",
    status: "active",
    lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "contributor",
  },
  {
    id: "6",
    username: "client.techcorp",
    email: "compliance@techcorp.co.uk",
    fullName: "James Miller",
    role: "client",
    entityId: "entity-2",
    entityName: "TechCorp Solutions",
    status: "active",
    lastLogin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "viewer",
  },
  {
    id: "7",
    username: "inactive.user",
    email: "old@example.com",
    fullName: "Former Employee",
    role: "consultant",
    entityId: null,
    entityName: null,
    status: "inactive",
    lastLogin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    consultantTier: "standard",
  },
];

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
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

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
    if (isAdmin) return mockUsers;
    if (isConsultant) return mockUsers.filter(u => u.role === "client");
    return [];
  };

  const filteredUsers = getVisibleUsers().filter(u => {
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

  const handleEditUser = (updatedUser: MockUser) => {
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

  const handleToggleStatus = (targetUser: MockUser) => {
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    toast({
      title: newStatus === "active" ? "User Activated" : "User Deactivated",
      description: `${targetUser.fullName} has been ${newStatus === "active" ? "activated" : "deactivated"}.`,
    });
  };

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
              <TableHead>Organization</TableHead>
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
              paginatedUsers.map(u => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {u.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
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
                    {u.entityName ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {u.entityName}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Guardian Group</span>
                    )}
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={() => editingUser && handleEditUser(editingUser)} data-testid="button-save-user">
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
              Create a new user account and send an invitation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Enter full name" data-testid="input-new-fullname" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="Enter email address" type="email" data-testid="input-new-email" />
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
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} data-testid="button-create-user">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
