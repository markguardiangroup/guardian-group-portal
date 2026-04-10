import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { useTheme } from "@/components/theme-provider";
import { PdfViewer } from "@/components/pdf-viewer";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  User,
  Bell,
  Shield,
  Palette,
  Moon,
  Sun,
  Monitor,
  Save,
  Lock,
  Key,
  Smartphone,
  History,
  UserCog,
  Check,
  X,
  Loader2,
  FileText,
  Upload,
  Eye,
  Trash2,
  Download,
  ClipboardList,
  Plus,
  Pencil,
  GripVertical,
  ChevronDown,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import {
  clientPermissionCapabilities,
  consultantTierCapabilities,
  type ClientCapabilities,
  type ConsultantCapabilities,
  type ClientPermissionRole,
  type ConsultantTier,
} from "@shared/schema";

function LegalClientTab() {
  const { user } = useAuth();
  const [previewDoc, setPreviewDoc] = useState<"terms" | "privacy" | null>(null);

  const { data: termsInfo } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/legal-documents/terms/info"],
  });

  const { data: privacyInfo } = useQuery<{ exists: boolean }>({
    queryKey: ["/api/legal-documents/privacy/info"],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Legal Documents</CardTitle>
          <CardDescription>
            Review the legal documents you have agreed to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border">
            <div className="p-4 border-b bg-muted/50">
              <h3 className="text-sm font-medium">Your Acceptance Status</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Documents Accepted</p>
                  <p className="text-xs text-muted-foreground">
                    Status of your latest legal agreement
                  </p>
                </div>
                {user?.legalAcceptedAt ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1 px-3">
                    <Check className="h-3.5 w-3.5" />
                    Accepted on {format(new Date(user.legalAcceptedAt), "dd MMM yyyy 'at' HH:mm")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 py-1 px-3">
                    Not yet accepted
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {termsInfo?.exists && (
              <Card className="hover-elevate cursor-pointer overflow-hidden border-muted" onClick={() => setPreviewDoc("terms")}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">Terms & Conditions</p>
                      <p className="text-xs text-muted-foreground truncate">Click to preview document</p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
            {privacyInfo?.exists && (
              <Card className="hover-elevate cursor-pointer overflow-hidden border-muted" onClick={() => setPreviewDoc("privacy")}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">Privacy Policy</p>
                      <p className="text-xs text-muted-foreground truncate">Click to preview document</p>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="h-[80vh] flex flex-col p-0 overflow-hidden" style={{ maxWidth: "860px" }}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>
              {previewDoc === "terms" ? "Terms & Conditions" : "Privacy Policy"}
            </DialogTitle>
            <DialogDescription>
              Preview of the legal document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full bg-white min-h-0 relative">
            {previewDoc && (
              <PdfViewer url={`/api/legal-documents/${previewDoc}/view`} />
            )}
          </div>
          <DialogFooter className="p-4 border-t">
            <Button onClick={() => setPreviewDoc(null)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [documentAlerts, setDocumentAlerts] = useState(true);
  const [reviewReminders, setReviewReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [complianceAlerts, setComplianceAlerts] = useState(true);
  const [supportUpdates, setSupportUpdates] = useState(true);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    title: "",
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    department: "",
    phone: "",
    mobile: "",
    preferredContactMethod: "email" as "email" | "phone" | "mobile",
    notes: "",
  });

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        title: user.title || "",
        firstName: user.firstName || user.fullName?.split(" ")[0] || "",
        lastName: user.lastName || user.fullName?.split(" ").slice(1).join(" ") || "",
        email: user.email || "",
        jobTitle: user.jobTitle || "",
        department: user.department || "",
        phone: user.phone || "",
        mobile: user.mobile || "",
        preferredContactMethod: user.preferredContactMethod || "email",
        notes: user.notes || "",
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      if (!user) throw new Error("Not authenticated");
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, {
        ...data,
        fullName,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notifications Updated",
      description: "Your notification preferences have been saved.",
    });
  };

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("New passwords do not match");
      }
      if (passwordForm.newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }
      const response = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change password");
      }
      return response.json();
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    changePasswordMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-8 py-6 bg-background border-b">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
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
          <TabsTrigger value="legal-client" className="gap-2" data-testid="tab-legal-client">
            <FileText className="h-4 w-4" />
            Legal Documents
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2" data-testid="tab-permissions">
            <UserCog className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          {(user?.role === "admin" || user?.role === "consultant") && (
            <TabsTrigger value="testing" className="gap-2" data-testid="tab-testing">
              <ClipboardList className="h-4 w-4" />
              Testing
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
                  {user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U"}
                </div>
                <div>
                  <p className="font-medium">{user?.fullName || "User"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize">
                      {user?.role || "client"}
                    </Badge>
                    {user?.referenceNumber && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {user.referenceNumber}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Personal Details</h3>
                
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Select 
                      value={profileForm.title} 
                      onValueChange={(v) => setProfileForm({ ...profileForm, title: v })}
                    >
                      <SelectTrigger id="title" data-testid="select-title">
                        <SelectValue placeholder="Select title" />
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
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      data-testid="input-first-name" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      data-testid="input-last-name" 
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input 
                      id="jobTitle" 
                      value={profileForm.jobTitle}
                      onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                      placeholder="Enter your job title"
                      data-testid="input-job-title" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input 
                      id="department" 
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                      placeholder="Enter your department"
                      data-testid="input-department" 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Contact Information</h3>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      data-testid="input-email" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredContact">Preferred Contact Method</Label>
                    <Select 
                      value={profileForm.preferredContactMethod} 
                      onValueChange={(v: "email" | "phone" | "mobile") => setProfileForm({ ...profileForm, preferredContactMethod: v })}
                    >
                      <SelectTrigger id="preferredContact" data-testid="select-preferred-contact">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+44 1onal 123456"
                      data-testid="input-phone" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input 
                      id="mobile" 
                      type="tel" 
                      value={profileForm.mobile}
                      onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })}
                      placeholder="+44 7700 900123"
                      data-testid="input-mobile" 
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={profileForm.notes}
                  onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                  placeholder="Any additional notes or information..."
                  rows={3}
                  data-testid="input-notes"
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Email Notifications</h3>
                
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email updates about your account
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                    data-testid="switch-email-notifications"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Document Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when documents need review or approval
                    </p>
                  </div>
                  <Switch
                    checked={documentAlerts}
                    onCheckedChange={setDocumentAlerts}
                    data-testid="switch-document-alerts"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Review Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders for upcoming document reviews
                    </p>
                  </div>
                  <Switch
                    checked={reviewReminders}
                    onCheckedChange={setReviewReminders}
                    data-testid="switch-review-reminders"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Compliance Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about compliance status changes
                    </p>
                  </div>
                  <Switch
                    checked={complianceAlerts}
                    onCheckedChange={setComplianceAlerts}
                    data-testid="switch-compliance-alerts"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Support Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates on your support requests
                    </p>
                  </div>
                  <Switch
                    checked={supportUpdates}
                    onCheckedChange={setSupportUpdates}
                    data-testid="switch-support-updates"
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label>Weekly Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive a weekly summary of activity
                    </p>
                  </div>
                  <Switch
                    checked={weeklyDigest}
                    onCheckedChange={setWeeklyDigest}
                    data-testid="switch-weekly-digest"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} data-testid="button-save-notifications">
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customise the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Theme</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 hover-elevate ${
                      theme === "light" ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid="button-theme-light"
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 hover-elevate ${
                      theme === "dark" ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid="button-theme-dark"
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 hover-elevate ${
                      theme === "system" ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid="button-theme-system"
                  >
                    <Monitor className="h-6 w-6" />
                    <span className="text-sm font-medium">System</span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword" 
                    type="password" 
                    placeholder="Enter current password"
                    data-testid="input-current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    placeholder="Enter new password (min. 8 characters)"
                    data-testid="input-new-password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="Confirm new password"
                    data-testid="input-confirm-password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleChangePassword} 
                    data-testid="button-change-password"
                    disabled={changePasswordMutation.isPending}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Authenticator App</p>
                      <p className="text-sm text-muted-foreground">
                        Use an authenticator app to generate codes
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" data-testid="button-setup-2fa">
                    Set Up
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Login History</CardTitle>
                <CardDescription>
                  Recent sign-in activity on your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { device: "Windows PC - Chrome", location: "Manchester, UK", time: "Just now", current: true },
                    { device: "iPhone - Safari", location: "London, UK", time: "2 hours ago", current: false },
                    { device: "MacBook - Chrome", location: "Manchester, UK", time: "Yesterday", current: false },
                  ].map((session, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between rounded-md border p-3"
                      data-testid={`session-${i}`}
                    >
                      <div className="flex items-center gap-3">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{session.device}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.location} • {session.time}
                          </p>
                        </div>
                      </div>
                      {session.current && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions Reference</CardTitle>
                <CardDescription>
                  Overview of what each role can do in the system
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Client Permission Roles</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Each client user is assigned one of these roles, which controls what they can do within their organisation's account.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Capability</th>
                          <th className="text-center py-3 px-2 font-medium">Client</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "canView", label: "View Documents" },
                          { key: "canApproveDocuments", label: "Sign Off Documents" },
                          { key: "canSubmitDocuments", label: "Submit Documents" },
                          { key: "canComment", label: "Add Comments" },
                          { key: "canRequestSupport", label: "Request Support" },
                          { key: "canManageTeam", label: "Manage Team Members" },
                        ].map(({ key, label }) => (
                          <tr key={key} className="border-b">
                            <td className="py-3 px-2">{label}</td>
                            <td className="text-center py-3 px-2">
                              {clientPermissionCapabilities.full[key as keyof ClientCapabilities] ? (
                                <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Consultant Tiers</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    These tiers determine what consultants can do across the platform.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Capability</th>
                          {(["pro", "standard"] as ConsultantTier[]).map(tier => (
                            <th key={tier} className="text-center py-3 px-2 font-medium capitalize">{tier}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "canAccessAllClients", label: "See All Clients & Sites" },
                          { key: "canViewDocuments", label: "View Documents" },
                          { key: "canEditDocuments", label: "Upload & Edit Documents" },
                          { key: "canApproveDocuments", label: "Approve Documents" },
                          { key: "canCreateClientUsers", label: "Create Client Users" },
                          { key: "canCreateCompanies", label: "Create Companies" },
                          { key: "canCreateSites", label: "Create Sites" },
                          { key: "canAssignConsultants", label: "Assign Consultants to Sites" },
                          { key: "canDeleteDocuments", label: "Delete Documents" },
                          { key: "canDeleteCompanies", label: "Delete Companies" },
                          { key: "canDeleteUsers", label: "Delete Users" },
                        ].map(({ key, label }) => (
                          <tr key={key} className="border-b">
                            <td className="py-3 px-2">{label}</td>
                            {(["pro", "standard"] as ConsultantTier[]).map(tier => (
                              <td key={tier} className="text-center py-3 px-2">
                                {consultantTierCapabilities[tier][key as keyof ConsultantCapabilities] ? (
                                  <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Permissions</CardTitle>
                <CardDescription>
                  Based on your current role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="text-base px-3 py-1 capitalize">
                    {user?.role || "client"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {user?.role === "admin" && "Full system access"}
                    {user?.role === "consultant" && "Can manage clients and documents"}
                    {user?.role === "client" && "Access to your organization's content"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Contact your administrator if you need different permissions.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="legal-client">
          <div className="space-y-6">
            <LegalClientTab />
            {user?.role === "admin" && <LegalDocumentsTab />}
          </div>
        </TabsContent>

        <TabsContent value="testing">
          <TestingTab />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

// ─── Testing Tab ─────────────────────────────────────────────────────────────

type TaskItem = { id: string; label: string; description?: string };
type TestingTaskList = {
  id: string; title: string; description?: string | null; module: string;
  tasks: TaskItem[]; createdBy: string; createdAt: string; updatedAt: string;
};
type TestingAssignment = {
  id: string; taskListId: string; assignedTo: string; assignedBy: string;
  completedTaskIds: string[]; createdAt: string; updatedAt: string;
  taskList?: TestingTaskList;
  assignedToUser?: { id: string; fullName: string; email: string };
};

const MODULE_ORDER = ["health_safety", "human_resources", "employment_law", "training", "toolkit", "support", "reports", "general"] as const;

const MODULE_LABELS: Record<string, string> = {
  health_safety: "H&S",
  human_resources: "HR",
  employment_law: "Employment Law",
  training: "Training",
  toolkit: "Toolkit",
  support: "Support",
  reports: "Reports",
  general: "General",
};

const MODULE_FULL_LABELS: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
  training: "Training",
  toolkit: "Toolkit",
  support: "Support",
  reports: "Reports",
  general: "General",
};

const MODULE_COLORS: Record<string, string> = {
  health_safety: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  human_resources: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  employment_law: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  training: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  toolkit: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  support: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  reports: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
};

function TaskListForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<TestingTaskList>;
  onSave: (data: { title: string; description: string; module: string; tasks: TaskItem[] }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [module, setModule] = useState(initial?.module ?? "general");
  const [tasks, setTasks] = useState<TaskItem[]>(initial?.tasks ?? []);
  const [newLabel, setNewLabel] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskLabel, setEditingTaskLabel] = useState("");
  const [editingTaskDesc, setEditingTaskDesc] = useState("");
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);

  const addTask = () => {
    if (!newLabel.trim()) return;
    setTasks([...tasks, { id: crypto.randomUUID(), label: newLabel.trim(), description: newDesc.trim() || undefined }]);
    setNewLabel("");
    setNewDesc("");
  };

  const removeTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));

  const moveTask = (idx: number, dir: -1 | 1) => {
    const copy = [...tasks];
    const swap = idx + dir;
    if (swap < 0 || swap >= copy.length) return;
    [copy[idx], copy[swap]] = [copy[swap], copy[idx]];
    setTasks(copy);
  };

  const startEditTask = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setEditingTaskLabel(task.label);
    setEditingTaskDesc(task.description ?? "");
  };

  const saveEditTask = (id: string) => {
    if (!editingTaskLabel.trim()) return;
    setTasks(tasks.map(t => t.id === id ? { ...t, label: editingTaskLabel.trim(), description: editingTaskDesc.trim() || undefined } : t));
    setEditingTaskId(null);
  };

  const cancelEditTask = () => setEditingTaskId(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tl-title">Title *</Label>
          <Input id="tl-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. H&S Portal Walkthrough" data-testid="input-tasklist-title" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tl-module">Module</Label>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger id="tl-module" data-testid="select-tasklist-module">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="health_safety">Health & Safety</SelectItem>
              <SelectItem value="human_resources">Human Resources</SelectItem>
              <SelectItem value="employment_law">Employment Law</SelectItem>
              <SelectItem value="training">Training</SelectItem>
              <SelectItem value="toolkit">Toolkit</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="reports">Reports</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tl-desc">Description</Label>
        <Textarea id="tl-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional context for testers" rows={2} data-testid="textarea-tasklist-description" />
      </div>

      <Separator />
      <div className="space-y-2">
        <Label>Task Items</Label>
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Add some below.</p>}
        {tasks.map((task, idx) => (
          <div key={task.id} className="rounded-md border bg-muted/30" data-testid={`task-item-${task.id}`}>
            {editingTaskId === task.id ? (
              <div className="p-3 space-y-2">
                <Input
                  value={editingTaskLabel}
                  onChange={e => setEditingTaskLabel(e.target.value)}
                  placeholder="Task label *"
                  autoFocus
                  data-testid={`input-edit-task-label-${task.id}`}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEditTask(task.id); } if (e.key === "Escape") cancelEditTask(); }}
                />
                <Input
                  value={editingTaskDesc}
                  onChange={e => setEditingTaskDesc(e.target.value)}
                  placeholder="Optional description"
                  data-testid={`input-edit-task-desc-${task.id}`}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEditTask(task.id); } if (e.key === "Escape") cancelEditTask(); }}
                />
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={cancelEditTask} data-testid={`button-task-edit-cancel-${task.id}`}>Cancel</Button>
                  <Button size="sm" onClick={() => saveEditTask(task.id)} disabled={!editingTaskLabel.trim()} data-testid={`button-task-edit-save-${task.id}`}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2">
                <GripVertical className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.label}</p>
                  {task.description && <p className="text-xs text-muted-foreground truncate">{task.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveTask(idx, -1)} disabled={idx === 0} data-testid={`button-task-up-${idx}`}><ChevronRight className="h-3 w-3 -rotate-90" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveTask(idx, 1)} disabled={idx === tasks.length - 1} data-testid={`button-task-down-${idx}`}><ChevronDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditTask(task)} data-testid={`button-task-edit-${task.id}`}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteTaskId(task.id)} data-testid={`button-task-remove-${idx}`}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="rounded-md border p-3 space-y-2 bg-muted/10">
          <div className="flex gap-2">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Task label *" className="flex-1" data-testid="input-new-task-label"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }} />
          </div>
          <div className="flex gap-2">
            <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" className="flex-1" data-testid="input-new-task-desc"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }} />
            <Button size="sm" variant="outline" onClick={addTask} disabled={!newLabel.trim()} data-testid="button-add-task">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} data-testid="button-tasklist-cancel">Cancel</Button>
        <Button onClick={() => onSave({ title, description, module, tasks })} disabled={!title.trim() || saving} data-testid="button-tasklist-save">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Task List
        </Button>
      </div>

      <AlertDialog open={!!confirmDeleteTaskId} onOpenChange={(open) => !open && setConfirmDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{tasks.find(t => t.id === confirmDeleteTaskId)?.label}"? This cannot be undone once you save the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-task-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-task-delete-ok"
              onClick={() => { if (confirmDeleteTaskId) { removeTask(confirmDeleteTaskId); setConfirmDeleteTaskId(null); } }}
            >
              Remove Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function printTaskList(list: TestingTaskList) {
  const moduleLabel = MODULE_FULL_LABELS[list.module] ?? list.module;
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const taskRows = list.tasks.map((task, i) => `
    <div class="task">
      <div class="checkbox"></div>
      <div class="task-body">
        <div class="task-label">${i + 1}. ${task.label}</div>
        ${task.description ? `<div class="task-desc">${task.description}</div>` : ""}
      </div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${list.title} — Task List</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; background: #fff; padding: 32px 40px; font-size: 13px; }
    .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
    .platform { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 6px; }
    .title { font-size: 22px; font-weight: 700; line-height: 1.2; }
    .meta { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
    .badge { display: inline-block; border: 1px solid #ccc; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .count { font-size: 12px; color: #555; }
    .description { margin-bottom: 20px; color: #444; line-height: 1.5; border-left: 3px solid #ddd; padding-left: 10px; }
    .tasks { display: flex; flex-direction: column; gap: 10px; }
    .task { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; page-break-inside: avoid; }
    .checkbox { width: 18px; height: 18px; border: 2px solid #555; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }
    .task-body { flex: 1; }
    .task-label { font-weight: 600; line-height: 1.4; }
    .task-desc { margin-top: 3px; color: #555; font-size: 12px; line-height: 1.4; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #888; display: flex; justify-content: space-between; }
    @media print { body { padding: 16px 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="platform">Testing Checklist</div>
    <div class="title">${list.title}</div>
    <div class="meta">
      <span class="badge">${moduleLabel}</span>
      <span class="count">${list.tasks.length} task${list.tasks.length !== 1 ? "s" : ""}</span>
    </div>
  </div>
  ${list.description ? `<div class="description">${list.description}</div>` : ""}
  <div class="tasks">${taskRows}</div>
  <div class="footer">
    <span>Printed: ${dateStr}</span>
    <span>Page 1</span>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function TestingTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

  const [showListForm, setShowListForm] = useState(false);
  const [editingList, setEditingList] = useState<TestingTaskList | null>(null);
  const [viewingList, setViewingList] = useState<TestingTaskList | null>(null);
  const [savingList, setSavingList] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignConsultantId, setAssignConsultantId] = useState("");
  const [assigningList, setAssigningList] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
  const [confirmRemoveAssignmentId, setConfirmRemoveAssignmentId] = useState<string | null>(null);
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  const { data: taskLists = [], refetch: refetchLists } = useQuery<TestingTaskList[]>({
    queryKey: ["/api/testing-task-lists"],
  });

  const { data: myAssignments = [], refetch: refetchMyAssignments } = useQuery<TestingAssignment[]>({
    queryKey: ["/api/testing-task-assignments/my"],
  });

  const { data: listAssignments = [], refetch: refetchListAssignments } = useQuery<TestingAssignment[]>({
    queryKey: ["/api/testing-task-assignments", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const res = await fetch(`/api/testing-task-assignments?taskListId=${selectedListId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load assignments");
      return res.json();
    },
    enabled: isAdmin && !!selectedListId,
  });

  const { data: rawConsultants = [] } = useQuery<{ id: string; fullName: string; email: string }[]>({
    queryKey: ["/api/consultants"],
    enabled: isAdmin,
  });

  const { data: rawAllUsers = [] } = useQuery<{ id: string; fullName: string; email: string; role: string }[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });
  const adminUsers = rawAllUsers.filter(u => u.role === "admin");

  const allConsultants = [
    ...rawConsultants,
    ...adminUsers.filter(a => !rawConsultants.some(c => c.id === a.id)),
  ];

  const handleSaveList = async (data: { title: string; description: string; module: string; tasks: TaskItem[] }) => {
    setSavingList(true);
    try {
      if (editingList) {
        await apiRequest("PATCH", `/api/testing-task-lists/${editingList.id}`, data);
        toast({ title: "Task list updated" });
      } else {
        await apiRequest("POST", "/api/testing-task-lists", data);
        toast({ title: "Task list created" });
      }
      await refetchLists();
      setShowListForm(false);
      setEditingList(null);
    } catch {
      toast({ title: "Error", description: "Failed to save task list", variant: "destructive" });
    } finally {
      setSavingList(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    setDeletingListId(id);
    try {
      await apiRequest("DELETE", `/api/testing-task-lists/${id}`);
      toast({ title: "Task list deleted" });
      if (selectedListId === id) setSelectedListId(null);
      await refetchLists();
    } catch {
      toast({ title: "Error", description: "Failed to delete task list", variant: "destructive" });
    } finally {
      setDeletingListId(null);
    }
  };

  const handleAssign = async () => {
    if (!selectedListId || !assignConsultantId) return;
    setAssigningList(true);
    try {
      await apiRequest("POST", "/api/testing-task-assignments", { taskListId: selectedListId, assignedTo: assignConsultantId });
      toast({ title: "User assigned" });
      setShowAssignDialog(false);
      setAssignConsultantId("");
      await refetchListAssignments();
    } catch {
      toast({ title: "Error", description: "Failed to assign user", variant: "destructive" });
    } finally {
      setAssigningList(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    setDeletingAssignmentId(id);
    try {
      await apiRequest("DELETE", `/api/testing-task-assignments/${id}`);
      toast({ title: "Assignment removed" });
      await refetchListAssignments();
    } catch {
      toast({ title: "Error", description: "Failed to remove assignment", variant: "destructive" });
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  const handleToggleTask = async (assignment: TestingAssignment, taskId: string) => {
    setTogglingTaskId(taskId);
    const completed = assignment.completedTaskIds ?? [];
    const next = completed.includes(taskId)
      ? completed.filter((id: string) => id !== taskId)
      : [...completed, taskId];
    try {
      await apiRequest("PATCH", `/api/testing-task-assignments/${assignment.id}`, { completedTaskIds: next });
      await refetchMyAssignments();
    } catch {
      toast({ title: "Error", description: "Failed to save progress", variant: "destructive" });
    } finally {
      setTogglingTaskId(null);
    }
  };

  const selectedList = taskLists.find(l => l.id === selectedListId);
  const assignedConsultantIds = new Set(listAssignments.map((a: TestingAssignment) => a.assignedTo));
  const availableToAssign = allConsultants.filter(c => !assignedConsultantIds.has(c.id));

  if (!isAdmin && !isConsultant) {
    return <p className="text-muted-foreground text-sm">You do not have access to this section.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Admin: Task List Management */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Task Lists</CardTitle>
                <CardDescription>Create and manage testing checklists for consultants and admins</CardDescription>
              </div>
              {!showListForm && (
                <Button size="sm" onClick={() => { setEditingList(null); setShowListForm(true); }} data-testid="button-new-tasklist">
                  <Plus className="h-4 w-4 mr-2" /> New Task List
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(showListForm || editingList) && (
              <div className="rounded-lg border p-4 bg-muted/20">
                <h3 className="text-sm font-semibold mb-4">{editingList ? "Edit Task List" : "New Task List"}</h3>
                <TaskListForm
                  initial={editingList ?? undefined}
                  onSave={handleSaveList}
                  onCancel={() => { setShowListForm(false); setEditingList(null); }}
                  saving={savingList}
                />
              </div>
            )}

            {taskLists.length === 0 && !showListForm && (
              <p className="text-sm text-muted-foreground py-4 text-center">No task lists yet. Create one above.</p>
            )}
            {(() => {
              const grouped = MODULE_ORDER.reduce<Record<string, TestingTaskList[]>>((acc, mod) => {
                acc[mod] = taskLists.filter(l => l.module === mod);
                return acc;
              }, {} as Record<string, TestingTaskList[]>);
              return MODULE_ORDER.filter(mod => grouped[mod].length > 0).map(mod => (
                <div key={mod} className="space-y-2">
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${MODULE_COLORS[mod] ?? MODULE_COLORS.general}`}>
                      {MODULE_LABELS[mod]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{MODULE_FULL_LABELS[mod] ?? mod}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {grouped[mod].map(list => (
                    <div
                      key={list.id}
                      className={`rounded-lg border p-4 cursor-pointer transition-colors ${selectedListId === list.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}
                      onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                      data-testid={`tasklist-card-${list.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <ClipboardList className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{list.title}</span>
                            <span className="text-xs text-muted-foreground">{list.tasks.length} task{list.tasks.length !== 1 ? "s" : ""}</span>
                          </div>
                          {list.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{list.description}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printTaskList(list)} data-testid={`button-print-tasklist-${list.id}`} title="Print task list">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewingList(list)} data-testid={`button-view-tasklist-${list.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingList(list); setShowListForm(false); }} data-testid={`button-edit-tasklist-${list.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deletingListId === list.id}
                            onClick={() => setConfirmDeleteListId(list.id)} data-testid={`button-delete-tasklist-${list.id}`}>
                            {deletingListId === list.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      )}

      {/* Admin: Assignment Management (shown when a list is selected) */}
      {isAdmin && selectedList && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Assignments — {selectedList.title}</CardTitle>
                <CardDescription>Assign this checklist to one or more users</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAssignDialog(true)} disabled={availableToAssign.length === 0} data-testid="button-assign-consultant">
                <UserPlus className="h-4 w-4 mr-2" /> Assign User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {listAssignments.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No users assigned yet.</p>
            )}
            <div className="space-y-2">
              {listAssignments.map((a: TestingAssignment) => {
                const total = selectedList.tasks.length;
                const done = (a.completedTaskIds ?? []).length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-md border p-3" data-testid={`assignment-row-${a.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.assignedToUser?.fullName ?? a.assignedTo}</p>
                      <p className="text-xs text-muted-foreground">{a.assignedToUser?.email}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span>{done} / {total}</span>
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span>{pct}%</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" disabled={deletingAssignmentId === a.id}
                      onClick={() => setConfirmRemoveAssignmentId(a.id)} data-testid={`button-remove-assignment-${a.id}`}>
                      {deletingAssignmentId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consultant: My Assigned Task Lists */}
      {(isConsultant || isAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle>My Testing Assignments</CardTitle>
            <CardDescription>Task lists assigned to you — tick off tasks as you complete them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {myAssignments.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No task lists assigned to you yet.</p>
            )}
            {(() => {
              const validAssignments = myAssignments.filter((a: TestingAssignment) => !!a.taskList);
              const grouped = MODULE_ORDER.reduce<Record<string, TestingAssignment[]>>((acc, mod) => {
                acc[mod] = validAssignments.filter((a: TestingAssignment) => a.taskList?.module === mod);
                return acc;
              }, {} as Record<string, TestingAssignment[]>);
              return MODULE_ORDER.filter(mod => grouped[mod].length > 0).map(mod => (
                <div key={mod} className="space-y-2">
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${MODULE_COLORS[mod] ?? MODULE_COLORS.general}`}>
                      {MODULE_LABELS[mod]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{MODULE_FULL_LABELS[mod] ?? mod}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {grouped[mod].map((a: TestingAssignment) => {
                    const list = a.taskList!;
                    const total = list.tasks.length;
                    const done = (a.completedTaskIds ?? []).length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const isComplete = total > 0 && done === total;
                    const isExpanded = expandedAssignmentId === a.id;
                    return (
                      <div key={a.id} className="rounded-lg border" data-testid={`my-assignment-${a.id}`}>
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedAssignmentId(isExpanded ? null : a.id)}
                        >
                          <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{list.title}</span>
                              {isComplete && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" data-testid={`badge-complete-${a.id}`}>
                                  <CheckCircle2 className="h-3 w-3" /> Complete
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{done} / {total} tasks</span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </div>

                        {isExpanded && (
                          <div className="border-t px-4 pb-4 pt-3 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                              {list.description
                                ? <p className="text-sm text-muted-foreground">{list.description}</p>
                                : <span />}
                              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs shrink-0" onClick={() => printTaskList(list)} data-testid={`button-print-assignment-${a.id}`}>
                                <Printer className="h-3.5 w-3.5" /> Print
                              </Button>
                            </div>
                            {list.tasks.map((task: TaskItem) => {
                              const checked = (a.completedTaskIds ?? []).includes(task.id);
                              return (
                                <div
                                  key={task.id}
                                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors cursor-pointer select-none ${checked ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/30" : "hover:bg-muted/40"}`}
                                  onClick={() => !togglingTaskId && handleToggleTask(a, task.id)}
                                  data-testid={`task-checkbox-${task.id}`}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={togglingTaskId === task.id}
                                    onCheckedChange={() => handleToggleTask(a, task.id)}
                                    className={`mt-0.5 shrink-0 h-5 w-5 ${checked ? "border-emerald-600 bg-emerald-600 text-white" : ""}`}
                                    data-testid={`checkbox-task-${task.id}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${checked ? "line-through text-muted-foreground" : ""}`}>{task.label}</p>
                                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      )}

      {/* View Task List Sheet */}
      <Sheet open={!!viewingList} onOpenChange={(open) => !open && setViewingList(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-view-tasklist">
          {viewingList && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-xl">{viewingList.title}</SheetTitle>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${MODULE_COLORS[viewingList.module] ?? MODULE_COLORS.general}`}>
                    {MODULE_LABELS[viewingList.module] ?? viewingList.module}
                  </span>
                </div>
                {viewingList.description && (
                  <SheetDescription className="text-sm mt-1">{viewingList.description}</SheetDescription>
                )}
              </SheetHeader>

              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mb-5"
                  data-testid="button-sheet-edit-tasklist"
                  onClick={() => {
                    const list = viewingList;
                    setViewingList(null);
                    setEditingList(list);
                    setShowListForm(false);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Task List
                </Button>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Tasks <span className="ml-1 text-muted-foreground font-normal">({viewingList.tasks.length})</span>
                  </h3>
                </div>

                {viewingList.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No tasks in this list yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {viewingList.tasks.map((task, idx) => (
                      <li key={task.id} className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20" data-testid={`sheet-task-item-${task.id}`}>
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">{task.label}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Assignment progress summary — shown when there are assignments for this list */}
                {selectedListId === viewingList.id && listAssignments.length > 0 && (
                  <div className="pt-4 border-t space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">User Progress</h3>
                    {listAssignments.map((a: TestingAssignment) => {
                      const total = viewingList.tasks.length;
                      const done = (a.completedTaskIds ?? []).length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={a.id} className="space-y-1" data-testid={`sheet-assignment-progress-${a.id}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{a.assignedToUser?.fullName ?? a.assignedTo}</span>
                            <span className="text-muted-foreground text-xs">{done} / {total}</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm Delete Task List Dialog */}
      <AlertDialog open={!!confirmDeleteListId} onOpenChange={(open) => !open && setConfirmDeleteListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{taskLists.find(l => l.id === confirmDeleteListId)?.title}" and all its assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-list-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-list-delete-ok"
              onClick={() => { if (confirmDeleteListId) { handleDeleteList(confirmDeleteListId); setConfirmDeleteListId(null); } }}
            >
              Delete Task List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Remove Assignment Dialog */}
      <AlertDialog open={!!confirmRemoveAssignmentId} onOpenChange={(open) => !open && setConfirmRemoveAssignmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user's access to this task list and delete their progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-remove-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmRemoveAssignmentId) { handleDeleteAssignment(confirmRemoveAssignmentId); setConfirmRemoveAssignmentId(null); } }}
              data-testid="button-confirm-remove-ok"
            >
              Remove Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Consultant Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User</DialogTitle>
            <DialogDescription>Choose a consultant or admin to assign to "{selectedList?.title}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {availableToAssign.length === 0 ? (
              <p className="text-sm text-muted-foreground">All consultants and admins are already assigned to this list.</p>
            ) : (
              <Select value={assignConsultantId} onValueChange={setAssignConsultantId}>
                <SelectTrigger data-testid="select-assign-consultant">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableToAssign.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName} — {c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignDialog(false); setAssignConsultantId(""); }}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignConsultantId || assigningList} data-testid="button-confirm-assign">
              {assigningList && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type LegalDocInfo = {
  exists: boolean;
  type: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  revisionDate?: string;
  revisionNumber?: number;
};

function LegalDocumentsTab() {
  const { toast } = useToast();
  const [termsUploading, setTermsUploading] = useState(false);
  const [privacyUploading, setPrivacyUploading] = useState(false);
  const [replaceConfirmType, setReplaceConfirmType] = useState<"terms" | "privacy" | null>(null);

  const { data: termsInfo, refetch: refetchTerms } = useQuery<LegalDocInfo>({
    queryKey: ["/api/legal-documents/terms/info"],
  });

  const { data: privacyInfo, refetch: refetchPrivacy } = useQuery<LegalDocInfo>({
    queryKey: ["/api/legal-documents/privacy/info"],
  });

  const triggerFilePicker = async (type: "terms" | "privacy") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const setUploading = type === "terms" ? setTermsUploading : setPrivacyUploading;
      setUploading(true);

      try {
        const response = await fetch(`/api/legal-documents/${type}`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name),
          },
          body: file,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Upload failed");
        }

        toast({
          title: "Document uploaded",
          description: `${type === "terms" ? "Terms & Conditions" : "Privacy Policy"} has been updated successfully.`,
        });

        if (type === "terms") {
          refetchTerms();
        } else {
          refetchPrivacy();
        }
      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload document",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const downloadDoc = (type: "terms" | "privacy") => {
    const a = document.createElement("a");
    a.href = `/api/legal-documents/${type}/download`;
    a.click();
  };

  const handleReplaceClick = (type: "terms" | "privacy", exists: boolean) => {
    if (exists) {
      setReplaceConfirmType(type);
    } else {
      triggerFilePicker(type);
    }
  };

  const handleDownloadBothAndContinue = () => {
    if (!replaceConfirmType) return;
    if (termsInfo?.exists) downloadDoc("terms");
    if (privacyInfo?.exists) downloadDoc("privacy");
    const type = replaceConfirmType;
    setReplaceConfirmType(null);
    setTimeout(() => triggerFilePicker(type), 300);
  };

  const handleContinueWithoutDownloading = () => {
    const type = replaceConfirmType;
    setReplaceConfirmType(null);
    if (type) setTimeout(() => triggerFilePicker(type), 100);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderDocCard = (
    type: "terms" | "privacy",
    title: string,
    description: string,
    info: LegalDocInfo | undefined,
    uploading: boolean
  ) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {info?.exists && info.revisionNumber != null && (
              <Badge variant="outline" className="text-xs font-mono">
                v{info.revisionNumber}
              </Badge>
            )}
            <Badge variant={info?.exists ? "default" : "secondary"}>
              {info?.exists ? "Uploaded" : "Not uploaded"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {info?.exists && (
          <div className="rounded-md border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{info.fileName}</span>
              <span className="text-muted-foreground">
                ({formatFileSize(info.fileSize || 0)})
              </span>
            </div>
            {info.revisionDate && (
              <p className="text-sm text-muted-foreground">
                Revised {new Date(info.revisionDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {info.uploadedBy ? ` by ${info.uploadedBy}` : ""}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => handleReplaceClick(type, !!info?.exists)}
            disabled={uploading}
            data-testid={`button-upload-${type}`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {info?.exists ? "Replace Document" : "Upload Document"}
          </Button>
          {info?.exists && (
            <Button
              variant="outline"
              onClick={() => downloadDoc(type)}
              data-testid={`button-download-${type}`}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Document
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Replace Document</CardTitle>
          <CardDescription>
            Replace the files below to update your legal documents. Replacing a file will require all users to accept the new terms on their next login.
          </CardDescription>
        </CardHeader>
      </Card>

      {renderDocCard(
        "terms",
        "Terms & Conditions",
        "The terms users must agree to when setting up their account.",
        termsInfo,
        termsUploading
      )}

      {renderDocCard(
        "privacy",
        "Privacy Policy",
        "The privacy policy users must acknowledge during account setup.",
        privacyInfo,
        privacyUploading
      )}

      <AlertDialog open={!!replaceConfirmType} onOpenChange={(open) => !open && setReplaceConfirmType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download documents before replacing?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Replacing a document overwrites the current version. To preserve a full version history, we recommend downloading both the Terms & Conditions and Privacy Policy before continuing.
              </span>
              <span className="block text-sm font-medium text-foreground">
                Would you like to download both files first?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="button-replace-cancel">Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleContinueWithoutDownloading}
              data-testid="button-replace-without-download"
            >
              Continue Without Downloading
            </Button>
            <AlertDialogAction
              onClick={handleDownloadBothAndContinue}
              data-testid="button-download-both-and-replace"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Both & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
