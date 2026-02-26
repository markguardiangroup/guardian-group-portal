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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
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
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
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
              <object
                data={`/api/legal-documents/${previewDoc}/view#toolbar=0`}
                type="application/pdf"
                className="w-full h-full"
              >
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <p className="mb-4">Unable to display PDF directly in your browser.</p>
                  <Button 
                    onClick={() => window.open(`/api/legal-documents/${previewDoc}/view`, "_blank")}
                  >
                    Open in New Tab
                  </Button>
                </div>
              </object>
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

  const handleChangePassword = () => {
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully.",
    });
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
          {user?.role === "client" && (
            <TabsTrigger value="legal-client" className="gap-2" data-testid="tab-legal-client">
              <FileText className="h-4 w-4" />
              Legal Documents
            </TabsTrigger>
          )}
          <TabsTrigger value="permissions" className="gap-2" data-testid="tab-permissions">
            <UserCog className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger value="legal" className="gap-2" data-testid="tab-legal">
              <FileText className="h-4 w-4" />
              Legal Documents
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
                Customize the look and feel of the application
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    placeholder="Enter new password"
                    data-testid="input-new-password" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    placeholder="Confirm new password"
                    data-testid="input-confirm-password" 
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleChangePassword} data-testid="button-change-password">
                    <Key className="mr-2 h-4 w-4" />
                    Change Password
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
                  <p className="text-sm text-muted-foreground mb-4">
                    These roles determine what client users can do within their organization.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Currently, all client users are assigned the <strong>Owner</strong> role with full permissions. Additional permission levels (Approver, Contributor, Viewer) are available for future use.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Capability</th>
                          {(["owner", "approver", "contributor", "viewer"] as ClientPermissionRole[]).map(role => (
                            <th key={role} className="text-center py-3 px-2 font-medium">
                              <div className="flex flex-col items-center gap-1">
                                <span className="capitalize">{role}</span>
                                {role === "owner" ? (
                                  <Badge variant="default" className="text-xs">Active</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs opacity-60">Future</Badge>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "canApproveDocuments", label: "Approve Documents" },
                          { key: "canSubmitDocuments", label: "Submit Documents" },
                          { key: "canComment", label: "Add Comments" },
                          { key: "canView", label: "View Documents" },
                          { key: "canRequestSupport", label: "Request Support" },
                          { key: "canManageTeam", label: "Manage Team Members" },
                        ].map(({ key, label }) => (
                          <tr key={key} className="border-b">
                            <td className="py-3 px-2">{label}</td>
                            {(["owner", "approver", "contributor", "viewer"] as ClientPermissionRole[]).map(role => (
                              <td key={role} className="text-center py-3 px-2">
                                {clientPermissionCapabilities[role][key as keyof ClientCapabilities] ? (
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

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">Consultant Tiers</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    These tiers determine what consultants can do across the platform.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Currently, all consultants are assigned the <strong>Senior</strong> tier with full capabilities. Additional tiers (Standard, Junior) are available for future use.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Capability</th>
                          {(["senior", "standard", "junior"] as ConsultantTier[]).map(tier => (
                            <th key={tier} className="text-center py-3 px-2 font-medium">
                              <div className="flex flex-col items-center gap-1">
                                <span className="capitalize">{tier}</span>
                                {tier === "senior" ? (
                                  <Badge variant="default" className="text-xs">Active</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs opacity-60">Future</Badge>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "canAccessAllClients", label: "Access All Clients" },
                          { key: "canRequestEntities", label: "Request New Entities" },
                          { key: "canManageClientUsers", label: "Manage Client Users" },
                          { key: "canEditDocuments", label: "Edit Documents" },
                          { key: "canViewDocuments", label: "View Documents" },
                          { key: "canManageChecklists", label: "Manage Checklists" },
                          { key: "canManageIncidents", label: "Manage Incidents" },
                        ].map(({ key, label }) => (
                          <tr key={key} className="border-b">
                            <td className="py-3 px-2">{label}</td>
                            {(["senior", "standard", "junior"] as ConsultantTier[]).map(tier => (
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

        {user?.role === "client" && (
          <TabsContent value="legal-client">
            <LegalClientTab />
          </TabsContent>
        )}

        {user?.role === "admin" && (
          <TabsContent value="legal">
            <LegalDocumentsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function LegalDocumentsTab() {
  const { toast } = useToast();
  const [termsUploading, setTermsUploading] = useState(false);
  const [privacyUploading, setPrivacyUploading] = useState(false);

  const { data: termsInfo, refetch: refetchTerms } = useQuery<{
    exists: boolean;
    type: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    revisionDate?: string;
  }>({
    queryKey: ["/api/legal-documents/terms/info"],
  });

  const { data: privacyInfo, refetch: refetchPrivacy } = useQuery<{
    exists: boolean;
    type: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    revisionDate?: string;
  }>({
    queryKey: ["/api/legal-documents/privacy/info"],
  });

  const handleUpload = async (type: "terms" | "privacy") => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderDocCard = (
    type: "terms" | "privacy",
    title: string,
    description: string,
    info: typeof termsInfo,
    uploading: boolean
  ) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={info?.exists ? "default" : "secondary"}>
            {info?.exists ? "Uploaded" : "Not uploaded"}
          </Badge>
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
              {info.revisionDate && (
                <Badge variant="outline" className="text-xs">
                  Revision: {new Date(info.revisionDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              )}
            </div>
            {info.uploadedAt && (
              <p className="text-sm text-muted-foreground">
                Uploaded {new Date(info.uploadedAt).toLocaleDateString("en-GB", {
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
            onClick={() => handleUpload(type)}
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
              onClick={() => window.open(`/api/legal-documents/${type}/view`, "_blank")}
              data-testid={`button-view-${type}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Document
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
          <CardTitle>Legal Documents</CardTitle>
          <CardDescription>
            Manage Terms & Conditions and Privacy Policy documents. These documents are presented to new users during account setup and must be accepted before they can use the portal. When a document is replaced, all users will be required to re-accept the updated documents on their next login.
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
    </div>
  );
}
