import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileText,
  Users,
  MapPin,
  ShieldAlert,
  Building2,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole, Company } from "@shared/schema";

interface UserReportData {
  id: string;
  referenceNumber: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  companyId: string | null;
  jobTitle?: string | null;
  siteAssignments?: { siteId: string; siteName: string }[];
}

export default function AdminReports() {
  const { user } = useAuth();
  const [showUsersReport, setShowUsersReport] = useState(false);

  const { data: companiesData } = useQuery<{ companies: Company[]; total: number }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesData?.companies || [];

  const { data: usersData = [], isLoading: usersLoading } = useQuery<UserReportData[]>({
    queryKey: ["/api/users"],
    enabled: showUsersReport,
  });

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrator",
    consultant: "Consultant",
    client: "Client",
  };

  const roleColors: Record<UserRole, string> = {
    admin: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    consultant: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    client: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  };

  const downloadUsersCSV = () => {
    const headers = ["Reference", "Full Name", "Email", "Role", "Status", "Company", "Job Title", "Assigned Sites"];
    const rows = usersData.map(user => {
      const company = companies.find(c => c.id === user.companyId);
      const sites = user.siteAssignments?.map(s => s.siteName).join("; ") || "";
      return [
        user.referenceNumber || "",
        user.fullName,
        user.email,
        roleLabels[user.role],
        user.status,
        company?.name || "",
        user.jobTitle || "",
        sites,
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `users_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Only admin and consultants can access this page
  if (!user || (user.role !== "admin" && user.role !== "consultant")) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This section is restricted to administrators and consultants only.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8 dash-animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background -mx-8 px-8 pb-4">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-8 w-8" />
            Admin Reports
          </h1>
          <p className="mt-1 text-muted-foreground">
            Confidential reports for administrators and consultants only
          </p>
        </div>
      </div>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Confidential Information</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Reports in this section contain sensitive data and are only visible to administrators and consultants. 
                Do not share this information with unauthorised personnel.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Available Admin Reports
          </CardTitle>
          <CardDescription>Generate and download confidential reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-4 hover-elevate"
              onClick={() => setShowUsersReport(true)}
              data-testid="report-users"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">Users Report</p>
                  <p className="text-sm text-muted-foreground">All users with roles and site assignments</p>
                </div>
              </div>
              <Badge variant="secondary">View</Badge>
            </div>
            {[
              { title: "Audit Trail Export", description: "Full audit log of all user actions", format: "CSV", icon: ClipboardList },
              { title: "Access Permissions", description: "User access levels across all sites", format: "Excel", icon: ShieldAlert },
              { title: "Company Summary", description: "Detailed breakdown by company", format: "PDF", icon: Building2 },
            ].map((report) => (
              <div key={report.title} className="flex items-center justify-between gap-4 rounded-md border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <report.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">{report.format}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Report Dialog */}
      <Dialog open={showUsersReport} onOpenChange={setShowUsersReport}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users Report
            </DialogTitle>
            <DialogDescription>
              Complete list of all users with their roles and site assignments. Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Roles:</span>
                <Badge variant="outline" className={roleColors.admin}>Admin</Badge>
                <Badge variant="outline" className={roleColors.consultant}>Consultant</Badge>
                <Badge variant="outline" className={roleColors.client}>Client</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={downloadUsersCSV} data-testid="button-download-users-csv">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {usersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Sites</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.map((user) => (
                      <TableRow key={user.id} data-testid={`report-row-user-${user.id}`}>
                        <TableCell>
                          <span className="font-mono text-sm">{user.referenceNumber || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{user.fullName}</div>
                          {user.jobTitle && (
                            <div className="text-xs text-muted-foreground">{user.jobTitle}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleColors[user.role]}>
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.companyId ? (
                            <span className="text-sm">
                              {companies.find(c => c.id === user.companyId)?.name || "-"}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "secondary"}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.siteAssignments && user.siteAssignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.siteAssignments.slice(0, 3).map((site) => (
                                <Badge key={site.siteId} variant="outline" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {site.siteName}
                                </Badge>
                              ))}
                              {user.siteAssignments.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{user.siteAssignments.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No assignments</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {usersData.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    No users found.
                  </div>
                )}

                <div className="mt-6 border-t pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-medium">Summary</h4>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold">{usersData.length}</p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-purple-600">
                        {usersData.filter(u => u.role === "admin").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Administrators</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-blue-600">
                        {usersData.filter(u => u.role === "consultant").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Consultants</p>
                    </div>
                    <div className="rounded-md border p-3 text-center">
                      <p className="text-2xl font-semibold text-emerald-600">
                        {usersData.filter(u => u.role === "client").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Clients</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
