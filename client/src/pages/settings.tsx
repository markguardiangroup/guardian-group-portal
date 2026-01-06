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
} from "lucide-react";

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
  },
];

const mockEntities = [
  { id: "1", name: "Acme Corporation" },
  { id: "2", name: "TechStart Ltd" },
  { id: "3", name: "Global Industries" },
];

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

  const isAdmin = user?.role === "admin";

  const filteredUsers = mockUsers.filter((u) => {
    const matchesSearch = u.fullName.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              User Management
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

        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage admins, consultants, and client users</CardDescription>
                  </div>
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
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            No users found matching your criteria
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

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
              </CardContent>
            </Card>

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
                    {editingUser.role === "client" && (
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
