import { useMemo, useState } from "react";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import {
  GraduationCap,
  LayoutDashboard,
  Calendar,
  CheckCircle,
  Clock,
  BookOpen,
  Link as LinkIcon,
  KeyRound,
  Building2,
  MapPin,
  Eye,
  Award,
  ExternalLink,
  Copy,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { SiteCombobox } from "@/components/site-combobox";
import { CompanyCombobox } from "@/components/company-combobox";

import type { TrainingCourse, SiteWithDetails, TrainingBooking } from "@shared/schema";

type TrainingBookingWithDetails = TrainingBooking & {
  course?: TrainingCourse;
  site?: SiteWithDetails;
};

export default function MyTraining() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"booked" | "completed">("booked");
  const [viewDialog, setViewDialog] = useState<TrainingBookingWithDetails | null>(null);
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: sites = [] } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });

  const { data: trainingBookings = [], isLoading } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  const { data: trainingCourses = [] } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const companies = useMemo(() => {
    const uniqueCompanies = Array.from(new Set(sites.map(s => s.companyName).filter(Boolean)));
    return uniqueCompanies.sort();
  }, [sites]);

  const filteredSites = useMemo(() => {
    if (selectedCompany && selectedCompany !== "all") {
      return sites.filter(s => s.companyName === selectedCompany);
    }
    return sites;
  }, [sites, selectedCompany]);

  const bookingsWithDetails: TrainingBookingWithDetails[] = useMemo(() => {
    return trainingBookings.map(booking => ({
      ...booking,
      course: trainingCourses.find(c => c.id === booking.trainingCourseId),
      site: sites.find(s => s.id === booking.siteId),
    }));
  }, [trainingBookings, trainingCourses, sites]);

  const filteredBookings = useMemo(() => {
    return bookingsWithDetails.filter(booking => {
      if (activeTab === "booked" && booking.status !== "booked") return false;
      if (activeTab === "completed" && booking.status !== "completed") return false;
      
      if (selectedSiteId && selectedSiteId !== "all") {
        if (booking.siteId !== selectedSiteId) return false;
      }
      
      if (selectedCompany && selectedCompany !== "all") {
        if (booking.site?.companyName !== selectedCompany) return false;
      }
      
      return true;
    });
  }, [bookingsWithDetails, activeTab, selectedSiteId, selectedCompany]);

  const metrics = useMemo(() => {
    let relevantBookings = bookingsWithDetails;
    
    if (selectedSiteId && selectedSiteId !== "all") {
      relevantBookings = relevantBookings.filter(b => b.siteId === selectedSiteId);
    }
    if (selectedCompany && selectedCompany !== "all") {
      relevantBookings = relevantBookings.filter(b => b.site?.companyName === selectedCompany);
    }
    
    const booked = relevantBookings.filter(b => b.status === "booked").length;
    const completed = relevantBookings.filter(b => b.status === "completed").length;
    return { booked, completed };
  }, [bookingsWithDetails, selectedSiteId, selectedCompany]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  if (isPrivilegedUser) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Training Dashboard</h2>
            <p className="text-muted-foreground mb-4">
              As a consultant/admin, please use the Training Dashboard to manage bookings.
            </p>
            <Link href="/training/dashboard">
              <Button data-testid="link-dashboard">
                Go to Training Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="theme-training flex flex-col h-full">
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent">
              <LayoutDashboard className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                Training
                <span className="font-normal text-muted-foreground text-2xl"> — Dashboard</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                View your booked training courses, certificates and access information
              </p>
            </div>
          </div>
        </div>
      </div>
      <div id="page-content" className="flex-1 overflow-auto space-y-6 px-8 py-6 dash-animate">

      {/* Filters & Metrics Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Filters */}
          {sites.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filter by:</span>
              </div>
              {companies.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Company</Label>
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-44"
                    testId="select-company-training"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Site</Label>
                <SiteCombobox
                  sites={filteredSites}
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  className="w-44"
                  testId="select-site-training"
                />
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              className={`p-4 rounded-lg border cursor-pointer transition-all ${activeTab === "booked" ? "ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20" : "hover:bg-muted/50"}`}
              onClick={() => setActiveTab("booked")}
              data-testid="card-booked"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Active Bookings</span>
                <BookOpen className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-3xl font-bold">{metrics.booked}</div>
              <p className="text-xs text-muted-foreground mt-1">Training courses booked for you</p>
            </div>

            <div 
              className={`p-4 rounded-lg border cursor-pointer transition-all ${activeTab === "completed" ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-muted/50"}`}
              onClick={() => setActiveTab("completed")}
              data-testid="card-completed"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Completed</span>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-bold">{metrics.completed}</div>
              <p className="text-xs text-muted-foreground mt-1">Training courses completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training List */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "booked" | "completed")}>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab("booked")}
                data-testid="tab-booked"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  activeTab === "booked"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Booked
                <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-semibold ${
                  activeTab === "booked" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {metrics.booked}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                data-testid="tab-completed"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  activeTab === "completed"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                Completed
                <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-semibold ${
                  activeTab === "completed" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {metrics.completed}
                </span>
              </button>
            </div>

            <TabsContent value="booked" className="mt-0">
              {isLoading ? (
                <div className="py-8 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No Active Training</h3>
                  <p className="text-muted-foreground">
                    You don't have any training courses booked at the moment.
                  </p>
                </div>
              ) : (
            <div className="grid gap-4">
              {filteredBookings.map((booking) => (
                <Card key={booking.id} className="hover-elevate" data-testid={`card-booking-${booking.id}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-purple-600" />
                          {booking.course?.title || "Unknown Course"}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {booking.course?.productCode && (
                            <span className="mr-3">Code: {booking.course.productCode}</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {booking.site?.name || "Unknown Site"}
                          </span>
                        </CardDescription>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Booked
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {booking.scheduledDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Scheduled:</span>
                        <span>{format(new Date(booking.scheduledDate), "EEEE, dd MMMM yyyy")}</span>
                      </div>
                    )}

                    {booking.accessUrl && (
                      <div className="bg-muted p-4 rounded-lg space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <KeyRound className="h-4 w-4" />
                          Course Access
                        </h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={booking.accessUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              Access Course
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          
                          {booking.accessUsername && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-20">Username:</span>
                              <code className="bg-background px-2 py-1 rounded text-sm">{booking.accessUsername}</code>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(booking.accessUsername!, "Username")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          {booking.accessPassword && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground w-20">Password:</span>
                              <code className="bg-background px-2 py-1 rounded text-sm">{booking.accessPassword}</code>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(booking.accessPassword!, "Password")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(booking.providerName || booking.providerContact) && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>
                          {booking.providerName}
                          {booking.providerContact && ` - ${booking.providerContact}`}
                        </span>
                      </div>
                    )}

                    {booking.notes && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span> {booking.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0">
          {isLoading ? (
            <div className="py-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Completed Training</h3>
              <p className="text-muted-foreground">
                You haven't completed any training courses yet.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Certificate</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id} data-testid={`row-completed-${booking.id}`}>
                        <TableCell>
                          <div className="font-medium">{booking.course?.title || "Unknown Course"}</div>
                          {booking.course?.productCode && (
                            <div className="text-sm text-muted-foreground">{booking.course.productCode}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {booking.site?.name || "Unknown Site"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {booking.completedAt ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-emerald-600" />
                              {format(new Date(booking.completedAt), "dd MMM yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking.certificateId ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <Award className="h-3 w-3 mr-1" />
                              Available
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewDialog(booking)}
                            data-testid={`button-view-completed-${booking.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </div>
          )}
        </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* View Dialog - Enhanced for completed training details */}
      {viewDialog && (
        <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-600" />
                {viewDialog.course?.title || "Training Details"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {viewDialog.course?.productCode && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Course Code:</Label>
                  <code className="bg-muted px-2 py-1 rounded text-sm">{viewDialog.course.productCode}</code>
                </div>
              )}
              
              {viewDialog.site && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Site:</Label>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{viewDialog.site.name}</span>
                  </div>
                </div>
              )}
              
              {viewDialog.scheduledDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Scheduled:</Label>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(viewDialog.scheduledDate), "EEEE, dd MMMM yyyy")}</span>
                  </div>
                </div>
              )}
              
              {viewDialog.completedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Completed:</Label>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{format(new Date(viewDialog.completedAt), "dd MMM yyyy")}</span>
                  </div>
                </div>
              )}

              {(viewDialog.providerName || viewDialog.providerContact) && (
                <div className="flex items-start gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Provider:</Label>
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {viewDialog.providerName}
                      {viewDialog.providerContact && ` - ${viewDialog.providerContact}`}
                    </span>
                  </div>
                </div>
              )}

              {viewDialog.notes && (
                <div className="flex items-start gap-2 text-sm">
                  <Label className="text-muted-foreground w-24">Notes:</Label>
                  <p className="text-muted-foreground">{viewDialog.notes}</p>
                </div>
              )}

              {viewDialog.certificateId && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <Award className="h-5 w-5" />
                    <span className="font-medium">Certificate Available</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Your training certificate is ready for viewing and download.
                  </p>
                  <Link href="/training/certificates">
                    <Button size="sm" className="bg-purple-600 text-white" data-testid="button-view-certificates">
                      <Award className="h-4 w-4 mr-2" />
                      View Certificates
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialog(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
