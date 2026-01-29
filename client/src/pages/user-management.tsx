import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
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
  siteName: string;
  companyName: string;
  isPrimary: boolean;
}

interface UserWithAssignments {
  id: string;
  referenceNumber?: string | null;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  status: "active" | "inactive";
  lastLogin: string | null;
  consultantTier?: ConsultantTier | null;
  clientPermissionRole?: ClientPermissionRole | null;
  siteAssignments?: SiteAssignment[];
  // Profile fields
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContactMethod?: "email" | "phone" | "mobile" | null;
  notes?: string | null;
}

interface SiteBasic {
  id: string;
  name: string;
  companyId: string;
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

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserWithAssignments | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    fullName: "",
    title: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    phone: "",
    mobile: "",
    preferredContactMethod: "email" as "email" | "phone" | "mobile",
    notes: "",
    role: "client" as "admin" | "consultant" | "client",
    companyId: "",
    consultantTier: "" as "" | "standard" | "senior" | "principal",
    clientPermissionRole: "viewer" as "viewer" | "contributor" | "manager",
  });

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

  const { data: sites = [] } = useQuery<SiteBasic[]>({
    queryKey: ["/api/sites"],
    enabled: isAdmin || isConsultant,
  });

  const { data: companiesResponse } = useQuery<{ companies: { id: string; name: string }[] }>({
    queryKey: ["/api/companies"],
    enabled: isAdmin || isConsultant,
  });
  const companies = companiesResponse?.companies || [];

  const usersWithSiteInfo = allUsers.map((u) => {
    if (u.role === "consultant") {
      const consultantData = consultantsWithAssignments.find((c) => c.id === u.id);
      return {
        ...u,
        siteAssignments: consultantData?.siteAssignments || [],
      };
    }
    if (u.role === "client" && u.companyId) {
      const company = companies.find((c) => c.id === u.companyId);
      return {
        ...u,
        companyName: company?.name || null,
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
    if (isAdmin) return usersWithSiteInfo;
    if (isConsultant) return usersWithSiteInfo.filter((u) => u.role === "client");
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

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      const payload = {
        ...data,
        consultantTier: data.consultantTier || null,
        companyId: data.companyId || null,
      };
      const response = await apiRequest("POST", "/api/users", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Created",
        description: "New user has been created successfully.",
      });
      setIsAddUserOpen(false);
      setNewUser({
        username: "",
        password: "",
        email: "",
        fullName: "",
        title: "",
        firstName: "",
        lastName: "",
        jobTitle: "",
        department: "",
        phone: "",
        mobile: "",
        preferredContactMethod: "email",
        notes: "",
        role: "client",
        companyId: "",
        consultantTier: "",
        clientPermissionRole: "viewer",
      });
    },
    onError: () => {
      toast({ title: "Failed to create user", variant: "destructive" });
    },
  });

  const handleAddUser = () => {
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast({ title: "Username, email and password are required", variant: "destructive" });
      return;
    }
    // Auto-generate fullName from firstName and lastName if not provided
    const fullName = newUser.fullName.trim() || 
      `${newUser.firstName} ${newUser.lastName}`.trim() || 
      newUser.username;
    createUserMutation.mutate({ ...newUser, fullName });
  };

  const handleToggleStatus = (targetUser: UserWithAssignments) => {
    const newStatus = targetUser.status === "active" ? "inactive" : "active";
    toast({
      title: newStatus === "active" ? "User Activated" : "User Deactivated",
      description: `${targetUser.fullName} has been ${newStatus === "active" ? "activated" : "deactivated"}.`,
    });
  };

  const renderSiteAssignments = (u: UserWithAssignments) => {
    // For consultants with site assignments
    if (u.role === "consultant" && u.siteAssignments && u.siteAssignments.length > 0) {
      const displayCount = 2;
      const visibleAssignments = u.siteAssignments.slice(0, displayCount);
      const remainingCount = u.siteAssignments.length - displayCount;

      return (
        <div className="flex flex-wrap items-center gap-1">
          {visibleAssignments.map((a) => (
            <Badge
              key={a.siteId}
              variant="outline"
              className="text-xs"
              data-testid={`badge-site-${a.siteId}`}
            >
              {a.isPrimary && <Shield className="h-3 w-3 mr-1" />}
              {a.siteName}
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
                  {u.siteAssignments.slice(displayCount).map((a) => (
                    <div key={a.siteId} className="text-xs">
                      {a.isPrimary && "(Primary) "}
                      {a.siteName}
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

    // For clients - show assigned sites from the sites list based on companyId
    if (u.role === "client" && u.companyId) {
      const companySites = sites.filter((s) => s.companyId === u.companyId);
      if (companySites.length > 0) {
        const displayCount = 2;
        const visibleSites = companySites.slice(0, displayCount);
        const remainingCount = companySites.length - displayCount;
        
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visibleSites.map((s) => (
              <Badge
                key={s.id}
                variant="outline"
                className="text-xs"
                data-testid={`badge-site-${s.id}`}
              >
                {s.name}
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
                    {companySites.slice(displayCount).map((s) => (
                      <div key={s.id} className="text-xs">
                        {s.name}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      }
      return <span className="text-sm text-muted-foreground">No sites</span>;
    }

    // For admins - show "All Sites"
    if (u.role === "admin") {
      return <span className="text-sm text-muted-foreground">All Sites</span>;
    }

    return <span className="text-sm text-muted-foreground">-</span>;
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
                <TableHead>Company</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sites Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
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
          <h1 className="text-3xl font-semibold">Users</h1>
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
              <TableHead>Company</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sites Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{u.fullName}</p>
                          {u.referenceNumber && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {u.referenceNumber}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.companyId ? (
                      <span className="text-sm">
                        {companies.find(c => c.id === u.companyId)?.name || "-"}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {u.jobTitle || <span className="text-muted-foreground">-</span>}
                    </span>
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
                    {renderSiteAssignments(u)}
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with full profile details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Account Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-username">Username *</Label>
                    <Input
                      id="new-username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="Enter username"
                      data-testid="input-new-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">Password *</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Enter password"
                      data-testid="input-new-password"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="email@company.com"
                    data-testid="input-new-email"
                  />
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Personal Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-title">Title</Label>
                    <Select
                      value={newUser.title}
                      onValueChange={(value) => setNewUser({ ...newUser, title: value })}
                    >
                      <SelectTrigger id="new-title" data-testid="select-new-title">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr">Mr</SelectItem>
                        <SelectItem value="Mrs">Mrs</SelectItem>
                        <SelectItem value="Ms">Ms</SelectItem>
                        <SelectItem value="Miss">Miss</SelectItem>
                        <SelectItem value="Dr">Dr</SelectItem>
                        <SelectItem value="Prof">Prof</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new-firstname">First Name</Label>
                      <Input
                        id="new-firstname"
                        value={newUser.firstName}
                        onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                        placeholder="First name"
                        data-testid="input-new-firstname"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-lastname">Surname</Label>
                      <Input
                        id="new-lastname"
                        value={newUser.lastName}
                        onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                        placeholder="Surname"
                        data-testid="input-new-lastname"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-jobtitle">Job Title</Label>
                    <Input
                      id="new-jobtitle"
                      value={newUser.jobTitle}
                      onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                      placeholder="e.g., Safety Manager"
                      data-testid="input-new-jobtitle"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-department">Department</Label>
                    <Input
                      id="new-department"
                      value={newUser.department}
                      onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                      placeholder="e.g., Operations"
                      data-testid="input-new-department"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Contact Details</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-phone">Phone</Label>
                    <Input
                      id="new-phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      placeholder="+44 123 456 7890"
                      data-testid="input-new-phone"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-mobile">Mobile</Label>
                    <Input
                      id="new-mobile"
                      value={newUser.mobile}
                      onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })}
                      placeholder="+44 7xx xxx xxxx"
                      data-testid="input-new-mobile"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-preferred-contact">Preferred Contact Method</Label>
                  <Select
                    value={newUser.preferredContactMethod}
                    onValueChange={(value: "email" | "phone" | "mobile") => setNewUser({ ...newUser, preferredContactMethod: value })}
                  >
                    <SelectTrigger id="new-preferred-contact" data-testid="select-new-preferred-contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="mobile">Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h4 className="text-sm font-medium mb-3">Role & Access</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-role">Role *</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: "admin" | "consultant" | "client") => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger id="new-role" data-testid="select-new-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.role === "client" && (
                    <div className="grid gap-2">
                      <Label htmlFor="new-company">Company</Label>
                      <Select
                        value={newUser.companyId}
                        onValueChange={(value) => setNewUser({ ...newUser, companyId: value })}
                      >
                        <SelectTrigger id="new-company" data-testid="select-new-company">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {newUser.role === "consultant" && (
                    <div className="grid gap-2">
                      <Label htmlFor="new-tier">Consultant Tier</Label>
                      <Select
                        value={newUser.consultantTier}
                        onValueChange={(value: "" | "standard" | "senior" | "principal") => setNewUser({ ...newUser, consultantTier: value })}
                      >
                        <SelectTrigger id="new-tier" data-testid="select-new-tier">
                          <SelectValue placeholder="Select tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="principal">Principal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {newUser.role === "client" && (
                  <div className="grid gap-2">
                    <Label htmlFor="new-permission">Permission Level</Label>
                    <Select
                      value={newUser.clientPermissionRole}
                      onValueChange={(value: "viewer" | "contributor" | "manager") => setNewUser({ ...newUser, clientPermissionRole: value })}
                    >
                      <SelectTrigger id="new-permission" data-testid="select-new-permission">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">Additional Notes</h4>
              <div className="grid gap-2">
                <Textarea
                  value={newUser.notes}
                  onChange={(e) => setNewUser({ ...newUser, notes: e.target.value })}
                  placeholder="Any additional notes about this user..."
                  className="min-h-[80px]"
                  data-testid="textarea-new-notes"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={createUserMutation.isPending} data-testid="button-create-user">
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
