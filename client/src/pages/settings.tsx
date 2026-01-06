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
import {
  Settings as SettingsIcon,
  User,
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
} from "lucide-react";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [documentAlerts, setDocumentAlerts] = useState(true);
  const [reviewReminders, setReviewReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
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
