import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  User,
  Users,
  Bell,
  Shield,
  Palette,
  Moon,
  Sun,
  Monitor,
  Mail,
  FileText,
  Clock,
  Lock,
  Save,
  Plus,
  Pencil,
  Building2,
  Search,
  UserCog,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  ClockIcon,
  Eye,
} from "lucide-react";
import type { 
  EntityRequestStatus, 
  ClientPermissionRole, 
  ConsultantTier 
} from "@shared/schema";

interface MockUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "consultant" | "client";
  entityId: string | null;
  entityName: string | null;
  status: "active" | "inactive";
  lastLogin: string | null;
  consultantTier?: ConsultantTier | null;
  clientPermissionRole?: ClientPermissionRole | null;
}

interface MockEntity {
  id: string;
  name: string;
  companyNumber?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: "active" | "inactive" | "pending";
  createdAt: string;
}

interface MockEntityRequest {
  id: string;
  proposedName: string;
  companyNumber?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  notes?: string;
  status: EntityRequestStatus;
  requestedBy: string;
  requesterName: string;
  createdAt: string;
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
    username: "john.doe",
    email: "john.doe@guardiangroup.com",
    fullName: "John Doe",
    role: "consultant",
    entityId: null,
    entityName: null,
    status: "active",
    lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    consultantTier: "senior",
  },
  {
    id: "3",
    username: "sarah.acme",
    email: "sarah@acmecorp.com",
    fullName: "Sarah Johnson",
    role: "client",
    entityId: "1",
    entityName: "Acme Corporation",
    status: "active",
    lastLogin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "owner",
  },
  {
    id: "4",
    username: "mike.tech",
    email: "mike@techstart.com",
    fullName: "Mike Wilson",
    role: "client",
    entityId: "2",
    entityName: "TechStart Ltd",
    status: "active",
    lastLogin: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "approver",
  },
  {
    id: "5",
    username: "jane.smith",
    email: "jane.smith@guardiangroup.com",
    fullName: "Jane Smith",
    role: "consultant",
    entityId: null,
    entityName: null,
    status: "inactive",
    lastLogin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    consultantTier: "standard",
  },
  {
    id: "6",
    username: "tom.acme",
    email: "tom@acmecorp.com",
    fullName: "Tom Brown",
    role: "client",
    entityId: "1",
    entityName: "Acme Corporation",
    status: "active",
    lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    clientPermissionRole: "contributor",
  },
];

const mockEntitiesFull: MockEntity[] = [
  { 
    id: "1", 
    name: "Acme Corporation", 
    companyNumber: "12345678",
    address: "123 Business Park, London, UK",
    contactEmail: "info@acmecorp.com",
    contactPhone: "+44 20 1234 5678",
    status: "active",
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  { 
    id: "2", 
    name: "TechStart Ltd", 
    companyNumber: "87654321",
    address: "45 Innovation Way, Manchester, UK",
    contactEmail: "hello@techstart.com",
    contactPhone: "+44 161 987 6543",
    status: "active",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  { 
    id: "3", 
    name: "Global Industries", 
    companyNumber: "55667788",
    address: "789 Enterprise Road, Birmingham, UK",
    contactEmail: "contact@globalind.com",
    contactPhone: "+44 121 555 6677",
    status: "active",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockEntityRequests: MockEntityRequest[] = [
  {
    id: "req-1",
    proposedName: "Northern Manufacturing Co",
    companyNumber: "11223344",
    address: "100 Industrial Estate, Leeds, UK",
    contactEmail: "ops@northernmfg.com",
    contactPhone: "+44 113 222 3344",
    contactName: "David Miller",
    notes: "New client referred by existing customer. Initial H&S audit scheduled.",
    status: "pending",
    requestedBy: "2",
    requesterName: "John Doe",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "req-2",
    proposedName: "Retail Solutions UK",
    companyNumber: "99887766",
    address: "200 High Street, Bristol, UK",
    contactEmail: "admin@retailsolutions.co.uk",
    contactPhone: "+44 117 999 8877",
    contactName: "Emma White",
    notes: "Multi-site retail chain, 12 locations. Needs both H&S and HR modules.",
    status: "draft",
    requestedBy: "5",
    requesterName: "Jane Smith",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockEntities = mockEntitiesFull.map(e => ({ id: e.id, name: e.name }));

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [documentAlerts, setDocumentAlerts] = useState(true);
  const [reviewReminders, setReviewReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState("");
  const [isRequestEntityOpen, setIsRequestEntityOpen] = useState(false);
  const [viewingEntity, setViewingEntity] = useState<MockEntity | null>(null);
  const [viewingRequest, setViewingRequest] = useState<MockEntityRequest | null>(null);

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";
  const isClient = user?.role === "client";
  const canViewUsers = isAdmin || isConsultant || isClient;
  const canEditUsers = isAdmin;
  const canAddUsers = isAdmin;
  const canViewEntities = isAdmin || isConsultant;
  const canManageEntities = isAdmin;
  const canRequestEntities = isAdmin || isConsultant;

  const getVisibleUsers = () => {
    if (isAdmin) {
      return mockUsers;
    } else if (isConsultant) {
      return mockUsers.filter((u) => u.role === "client");
    } else if (isClient && user?.entityId) {
      return mockUsers.filter((u) => u.entityId === user.entityId);
    }
    return [];
  };

  const visibleUsers = getVisibleUsers();

  const filteredUsers = visibleUsers.filter((u) => {
    const matchesSearch = u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getUserTabLabel = () => {
    if (isAdmin) return "User Management";
    if (isConsultant) return "Client Users";
    if (isClient) return "Team Members";
    return "Users";
  };

  const getUserTabDescription = () => {
    if (isAdmin) return "Manage admins, consultants, and client users";
    if (isConsultant) return "View client users you work with";
    if (isClient) return "View team members from your organization";
    return "";
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20";
      case "consultant":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "client":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "";
    }
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return "Never";
    const date = new Date(lastLogin);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          {canViewUsers && (
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              {getUserTabLabel()}
            </TabsTrigger>
          )}
          {canViewEntities && (
            <TabsTrigger value="entities" className="gap-2" data-testid="tab-entities">
              <Building2 className="h-4 w-4" />
              Client Organizations
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2" data-testid="tab-appearance">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue="John" data-testid="input-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue="Doe" data-testid="input-last-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john.doe@guardiangroup.com" data-testid="input-email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" defaultValue="+44 7700 900123" data-testid="input-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input id="jobTitle" defaultValue="H&S Consultant" data-testid="input-job-title" />
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button data-testid="button-save-profile">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canViewUsers && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>{getUserTabLabel()}</CardTitle>
                    <CardDescription>{getUserTabDescription()}</CardDescription>
                  </div>
                  {canAddUsers && (
                    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-add-user">
                          <Plus className="mr-2 h-4 w-4" />
                          Add User
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                          Create a new user account for the portal
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="newFullName">Full Name</Label>
                            <Input id="newFullName" placeholder="John Smith" data-testid="input-new-fullname" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="newUsername">Username</Label>
                            <Input id="newUsername" placeholder="john.smith" data-testid="input-new-username" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newEmail">Email</Label>
                          <Input id="newEmail" type="email" placeholder="john.smith@example.com" data-testid="input-new-email" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="newRole">Role</Label>
                            <Select>
                              <SelectTrigger data-testid="select-new-role">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="consultant">Consultant</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="newEntity">Entity (for clients)</Label>
                            <Select>
                              <SelectTrigger data-testid="select-new-entity">
                                <SelectValue placeholder="Select entity" />
                              </SelectTrigger>
                              <SelectContent>
                                {mockEntities.map((entity) => (
                                  <SelectItem key={entity.id} value={entity.id}>
                                    {entity.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={() => setIsAddUserOpen(false)} data-testid="button-create-user">
                          Create User
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-users"
                    />
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {["all", "admin", "consultant", "client"].map((role) => (
                        <Button
                          key={role}
                          variant={roleFilter === role ? "default" : "outline"}
                          size="sm"
                          onClick={() => setRoleFilter(role)}
                          data-testid={`filter-role-${role}`}
                        >
                          {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1) + "s"}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        {canEditUsers && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{u.fullName}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getRoleBadgeClass(u.role)}>
                              {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.role === "consultant" && u.consultantTier && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                {u.consultantTier.charAt(0).toUpperCase() + u.consultantTier.slice(1)}
                              </Badge>
                            )}
                            {u.role === "client" && u.clientPermissionRole && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                                {u.clientPermissionRole.charAt(0).toUpperCase() + u.clientPermissionRole.slice(1)}
                              </Badge>
                            )}
                            {u.role === "admin" && (
                              <span className="text-sm text-muted-foreground">Full Access</span>
                            )}
                            {!u.consultantTier && !u.clientPermissionRole && u.role !== "admin" && (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.entityName ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {u.entityName}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={u.status === "active" 
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
                              }
                            >
                              {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatLastLogin(u.lastLogin)}
                          </TableCell>
                          {canEditUsers && (
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setEditingUser(u)}
                                data-testid={`button-edit-user-${u.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={canEditUsers ? 7 : 6} className="py-8 text-center text-muted-foreground">
                            No users found matching your criteria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {isAdmin ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                          <UserCog className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-semibold">{mockUsers.filter(u => u.role === "admin").length}</p>
                          <p className="text-sm text-muted-foreground">Admins</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                          <Users className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-semibold">{mockUsers.filter(u => u.role === "consultant").length}</p>
                          <p className="text-sm text-muted-foreground">Consultants</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                          <Building2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-semibold">{mockUsers.filter(u => u.role === "client").length}</p>
                          <p className="text-sm text-muted-foreground">Clients</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                    Showing {visibleUsers.length} {isConsultant ? "client" : "team"} user{visibleUsers.length !== 1 ? "s" : ""}
                  </div>
                )}
              </CardContent>
            </Card>

            {canEditUsers && (
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>
                    Update user details and permissions
                  </DialogDescription>
                </DialogHeader>
                {editingUser && (
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="editFullName">Full Name</Label>
                        <Input id="editFullName" defaultValue={editingUser.fullName} data-testid="input-edit-fullname" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editUsername">Username</Label>
                        <Input id="editUsername" defaultValue={editingUser.username} data-testid="input-edit-username" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editEmail">Email</Label>
                      <Input id="editEmail" type="email" defaultValue={editingUser.email} data-testid="input-edit-email" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="editRole">Role</Label>
                        <Select defaultValue={editingUser.role}>
                          <SelectTrigger data-testid="select-edit-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="consultant">Consultant</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editStatus">Status</Label>
                        <Select defaultValue={editingUser.status}>
                          <SelectTrigger data-testid="select-edit-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {editingUser.role === "consultant" && (
                      <div className="space-y-2">
                        <Label htmlFor="editConsultantTier">Consultant Tier</Label>
                        <Select defaultValue={editingUser.consultantTier || "standard"}>
                          <SelectTrigger data-testid="select-edit-consultant-tier">
                            <SelectValue placeholder="Select tier" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="senior">Senior Consultant</SelectItem>
                            <SelectItem value="standard">Standard Consultant</SelectItem>
                            <SelectItem value="junior">Junior Consultant</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Senior: Full access to all clients. Standard: Assigned clients only. Junior: View-only access.
                        </p>
                      </div>
                    )}
                    {editingUser.role === "client" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="editEntity">Entity</Label>
                          <Select defaultValue={editingUser.entityId || undefined}>
                            <SelectTrigger data-testid="select-edit-entity">
                              <SelectValue placeholder="Select entity" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockEntities.map((entity) => (
                                <SelectItem key={entity.id} value={entity.id}>
                                  {entity.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="editClientRole">Permission Level</Label>
                          <Select defaultValue={editingUser.clientPermissionRole || "viewer"}>
                            <SelectTrigger data-testid="select-edit-client-role">
                              <SelectValue placeholder="Select permission" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="approver">Approver</SelectItem>
                              <SelectItem value="contributor">Contributor</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {editingUser.role === "client" && (
                      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        <strong>Permission Levels:</strong><br/>
                        Owner: Full access including team management<br/>
                        Approver: Can approve documents<br/>
                        Contributor: Can submit documents and comment<br/>
                        Viewer: Read-only access
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingUser(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setEditingUser(null)} data-testid="button-save-user">
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          </TabsContent>
        )}

        {canViewEntities && (
          <TabsContent value="entities">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Client Organizations</CardTitle>
                      <CardDescription>
                        {isAdmin 
                          ? "Manage client entities and review new requests" 
                          : "View client organizations and request new entities"
                        }
                      </CardDescription>
                    </div>
                    {canRequestEntities && (
                      <Dialog open={isRequestEntityOpen} onOpenChange={setIsRequestEntityOpen}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-request-entity">
                            <Plus className="mr-2 h-4 w-4" />
                            {isAdmin ? "Add Entity" : "Request New Entity"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>{isAdmin ? "Add New Entity" : "Request New Client Entity"}</DialogTitle>
                            <DialogDescription>
                              {isAdmin 
                                ? "Create a new client organization directly" 
                                : "Submit a request for a new client organization. An administrator will review and approve."
                              }
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="entityName">Organization Name</Label>
                              <Input id="entityName" placeholder="e.g., Acme Corporation" data-testid="input-entity-name" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="companyNumber">Company Number</Label>
                                <Input id="companyNumber" placeholder="e.g., 12345678" data-testid="input-company-number" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contactName">Primary Contact</Label>
                                <Input id="contactName" placeholder="Contact name" data-testid="input-contact-name" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="entityAddress">Address</Label>
                              <Input id="entityAddress" placeholder="Business address" data-testid="input-entity-address" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="contactEmail">Contact Email</Label>
                                <Input id="contactEmail" type="email" placeholder="email@company.com" data-testid="input-contact-email" />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                <Input id="contactPhone" type="tel" placeholder="+44 123 456 7890" data-testid="input-contact-phone" />
                              </div>
                            </div>
                            {!isAdmin && (
                              <div className="space-y-2">
                                <Label htmlFor="requestNotes">Notes</Label>
                                <Input id="requestNotes" placeholder="Additional context for your request..." data-testid="input-request-notes" />
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRequestEntityOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={() => setIsRequestEntityOpen(false)} data-testid="button-submit-entity">
                              {isAdmin ? "Create Entity" : "Submit Request"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search organizations..."
                      value={entitySearchQuery}
                      onChange={(e) => setEntitySearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-entities"
                    />
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead>Company Number</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockEntitiesFull
                          .filter(e => e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()))
                          .map((entity) => (
                            <TableRow key={entity.id} data-testid={`row-entity-${entity.id}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10">
                                    <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{entity.name}</p>
                                    <p className="text-sm text-muted-foreground">{entity.address}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{entity.companyNumber || "-"}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p>{entity.contactEmail}</p>
                                  <p className="text-muted-foreground">{entity.contactPhone}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={entity.status === "active" 
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                    : "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
                                  }
                                >
                                  {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setViewingEntity(entity)}
                                  data-testid={`button-view-entity-${entity.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canManageEntities && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    data-testid={`button-edit-entity-${entity.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {isAdmin && mockEntityRequests.filter(r => r.status === "pending").length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <CardTitle>Pending Entity Requests</CardTitle>
                    </div>
                    <CardDescription>Review and approve new client organization requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Proposed Organization</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockEntityRequests
                            .filter(r => r.status === "pending")
                            .map((request) => (
                              <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{request.proposedName}</p>
                                    <p className="text-sm text-muted-foreground">{request.contactEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell>{request.requesterName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(request.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                    Pending Review
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => setViewingRequest(request)}
                                      data-testid={`button-view-request-${request.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="text-emerald-600 hover:text-emerald-700"
                                      data-testid={`button-approve-request-${request.id}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="text-red-600 hover:text-red-700"
                                      data-testid={`button-reject-request-${request.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isConsultant && (
                <Card>
                  <CardHeader>
                    <CardTitle>My Entity Requests</CardTitle>
                    <CardDescription>Track the status of your submitted entity requests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Proposed Organization</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockEntityRequests.length > 0 ? (
                            mockEntityRequests.map((request) => (
                              <TableRow key={request.id} data-testid={`row-my-request-${request.id}`}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{request.proposedName}</p>
                                    <p className="text-sm text-muted-foreground">{request.contactName}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(request.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      request.status === "approved" 
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                        : request.status === "pending"
                                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                          : request.status === "rejected"
                                            ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20"
                                            : "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
                                    }
                                  >
                                    {request.status === "draft" && <ClockIcon className="mr-1 h-3 w-3" />}
                                    {request.status === "pending" && <ClockIcon className="mr-1 h-3 w-3" />}
                                    {request.status === "approved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                    {request.status === "rejected" && <X className="mr-1 h-3 w-3" />}
                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setViewingRequest(request)}
                                    data-testid={`button-view-my-request-${request.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {request.status === "draft" && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      data-testid={`button-edit-my-request-${request.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                No entity requests yet
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                      <Building2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{mockEntitiesFull.filter(e => e.status === "active").length}</p>
                      <p className="text-sm text-muted-foreground">Active Entities</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                      <ClockIcon className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{mockEntityRequests.filter(r => r.status === "pending").length}</p>
                      <p className="text-sm text-muted-foreground">Pending Requests</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{mockUsers.filter(u => u.role === "client").length}</p>
                      <p className="text-sm text-muted-foreground">Client Users</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Dialog open={!!viewingEntity} onOpenChange={(open) => !open && setViewingEntity(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entity Details</DialogTitle>
                </DialogHeader>
                {viewingEntity && (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-500/10">
                        <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{viewingEntity.name}</h3>
                        <p className="text-sm text-muted-foreground">Company #{viewingEntity.companyNumber}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span>{viewingEntity.address}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{viewingEntity.contactEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{viewingEntity.contactPhone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge 
                          variant="outline" 
                          className={viewingEntity.status === "active" 
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
                          }
                        >
                          {viewingEntity.status.charAt(0).toUpperCase() + viewingEntity.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created</span>
                        <span>{new Date(viewingEntity.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewingEntity(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={!!viewingRequest} onOpenChange={(open) => !open && setViewingRequest(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Entity Request Details</DialogTitle>
                </DialogHeader>
                {viewingRequest && (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-amber-500/10">
                        <Building2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{viewingRequest.proposedName}</h3>
                        <Badge 
                          variant="outline" 
                          className={
                            viewingRequest.status === "pending"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
                              : viewingRequest.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20"
                          }
                        >
                          {viewingRequest.status.charAt(0).toUpperCase() + viewingRequest.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company Number</span>
                        <span>{viewingRequest.companyNumber || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span>{viewingRequest.address || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact Name</span>
                        <span>{viewingRequest.contactName || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{viewingRequest.contactEmail || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{viewingRequest.contactPhone || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requested By</span>
                        <span>{viewingRequest.requesterName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted</span>
                        <span>{new Date(viewingRequest.createdAt).toLocaleDateString()}</span>
                      </div>
                      {viewingRequest.notes && (
                        <div className="pt-2">
                          <span className="text-muted-foreground">Notes</span>
                          <p className="mt-1 rounded-md bg-muted p-3">{viewingRequest.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  {isAdmin && viewingRequest?.status === "pending" && (
                    <>
                      <Button variant="outline" className="text-red-600" onClick={() => setViewingRequest(null)}>
                        Reject
                      </Button>
                      <Button onClick={() => setViewingRequest(null)} data-testid="button-approve-from-dialog">
                        Approve
                      </Button>
                    </>
                  )}
                  {(!isAdmin || viewingRequest?.status !== "pending") && (
                    <Button variant="outline" onClick={() => setViewingRequest(null)}>
                      Close
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                    </div>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications}
                    data-testid="switch-email-notifications"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Document Alerts</p>
                      <p className="text-sm text-muted-foreground">Get notified about document status changes</p>
                    </div>
                  </div>
                  <Switch 
                    checked={documentAlerts} 
                    onCheckedChange={setDocumentAlerts}
                    data-testid="switch-document-alerts"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Review Reminders</p>
                      <p className="text-sm text-muted-foreground">Receive reminders for upcoming document reviews</p>
                    </div>
                  </div>
                  <Switch 
                    checked={reviewReminders} 
                    onCheckedChange={setReviewReminders}
                    data-testid="switch-review-reminders"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Weekly Digest</p>
                      <p className="text-sm text-muted-foreground">Receive a weekly summary of compliance status</p>
                    </div>
                  </div>
                  <Switch 
                    checked={weeklyDigest} 
                    onCheckedChange={setWeeklyDigest}
                    data-testid="switch-weekly-digest"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the portal looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">Select your preferred theme</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-3 rounded-md border p-4 transition-colors ${
                      theme === "light" ? "border-primary bg-primary/5" : "hover-elevate"
                    }`}
                    data-testid="button-theme-light"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                      <Sun className="h-6 w-6 text-amber-600" />
                    </div>
                    <span className="font-medium">Light</span>
                    {theme === "light" && <Badge>Active</Badge>}
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-3 rounded-md border p-4 transition-colors ${
                      theme === "dark" ? "border-primary bg-primary/5" : "hover-elevate"
                    }`}
                    data-testid="button-theme-dark"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                      <Moon className="h-6 w-6 text-slate-200" />
                    </div>
                    <span className="font-medium">Dark</span>
                    {theme === "dark" && <Badge>Active</Badge>}
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center gap-3 rounded-md border p-4 transition-colors ${
                      theme === "system" ? "border-primary bg-primary/5" : "hover-elevate"
                    }`}
                    data-testid="button-theme-system"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Monitor className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="font-medium">System</span>
                    {theme === "system" && <Badge>Active</Badge>}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-sm text-muted-foreground">Last changed 30 days ago</p>
                    </div>
                  </div>
                  <Button variant="outline" data-testid="button-change-password">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Not Enabled</Badge>
                </div>

                <div className="rounded-md border p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Active Sessions</p>
                      <p className="text-sm text-muted-foreground">Manage your active login sessions</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between rounded-md bg-muted/50 p-3 text-sm">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-muted-foreground">Chrome on macOS • London, UK</p>
                      </div>
                      <Badge variant="secondary">Active Now</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
