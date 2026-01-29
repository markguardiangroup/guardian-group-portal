import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  GraduationCap,
  Calendar,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Search,
  Plus,
  BookOpen,
  Link as LinkIcon,
  User,
  KeyRound,
  Building2,
  MapPin,
  Eye,
  Trash2,
  Award,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import type { TrainingCourse, SiteWithDetails, TrainingBooking } from "@shared/schema";

type TrainingBookingWithDetails = TrainingBooking & {
  course?: TrainingCourse;
  site?: SiteWithDetails;
};

export default function TrainingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"booked" | "completed">("booked");
  
  const [bookingDialog, setBookingDialog] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<TrainingBookingWithDetails | null>(null);
  const [viewDialog, setViewDialog] = useState<TrainingBookingWithDetails | null>(null);
  
  // Form state for new booking
  const [newBooking, setNewBooking] = useState({
    trainingCourseId: "",
    siteId: "",
    scheduledDate: "",
    accessUrl: "",
    accessUsername: "",
    accessPassword: "",
    providerName: "",
    providerContact: "",
    notes: "",
  });

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
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCourse = booking.course?.title?.toLowerCase().includes(query);
        const matchesSite = booking.site?.name?.toLowerCase().includes(query);
        if (!matchesCourse && !matchesSite) return false;
      }
      return true;
    });
  }, [bookingsWithDetails, activeTab, searchQuery]);

  const metrics = useMemo(() => {
    const booked = bookingsWithDetails.filter(b => b.status === "booked").length;
    const completed = bookingsWithDetails.filter(b => b.status === "completed").length;
    return { booked, completed, total: bookingsWithDetails.length };
  }, [bookingsWithDetails]);

  const createBookingMutation = useMutation({
    mutationFn: async (data: typeof newBooking) => {
      return apiRequest("POST", "/api/training-bookings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-bookings"] });
      toast({
        title: "Training Booked",
        description: "The training has been booked successfully.",
      });
      setBookingDialog(false);
      setNewBooking({
        trainingCourseId: "",
        siteId: "",
        scheduledDate: "",
        accessUrl: "",
        accessUsername: "",
        accessPassword: "",
        providerName: "",
        providerContact: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/training-bookings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-bookings"] });
      toast({
        title: "Booking Updated",
        description: "The training booking has been updated.",
      });
      setCompleteDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update booking",
        variant: "destructive",
      });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/training-bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-bookings"] });
      toast({
        title: "Booking Deleted",
        description: "The training booking has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
  });

  const handleCreateBooking = () => {
    if (!newBooking.trainingCourseId || !newBooking.siteId) {
      toast({
        title: "Missing Information",
        description: "Please select a course and site.",
        variant: "destructive",
      });
      return;
    }
    createBookingMutation.mutate(newBooking);
  };

  const handleUploadCertificate = (booking: TrainingBookingWithDetails) => {
    navigate(`/training/certificates/upload?bookingId=${booking.id}&courseId=${booking.trainingCourseId}&siteId=${booking.siteId}`);
  };

  if (!isPrivilegedUser) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Training Dashboard</h2>
            <p className="text-muted-foreground">
              This dashboard is only available to consultants and administrators.
            </p>
            <Link href="/training">
              <Button className="mt-4" data-testid="link-my-training">
                View My Training
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container px-6 py-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-purple-600" />
            Training Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage training bookings and track completion
          </p>
        </div>
        <Button 
          onClick={() => setBookingDialog(true)}
          className="bg-purple-600 hover:bg-purple-700"
          data-testid="button-book-training"
        >
          <Plus className="h-4 w-4 mr-2" />
          Book Training
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card 
          className={`cursor-pointer transition-all ${activeTab === "booked" ? "border-purple-500 border-2 bg-purple-50/50 dark:bg-purple-950/20" : "hover-elevate"}`}
          onClick={() => setActiveTab("booked")}
          data-testid="card-booked"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Booked</CardTitle>
            <BookOpen className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{metrics.booked}</div>
            <p className="text-xs text-muted-foreground">Active training bookings</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeTab === "completed" ? "border-emerald-500 border-2 bg-emerald-50/50 dark:bg-emerald-950/20" : "hover-elevate"}`}
          onClick={() => setActiveTab("completed")}
          data-testid="card-completed"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.completed}</div>
            <p className="text-xs text-muted-foreground">Completed training courses</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">All training bookings</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses or sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Tabs & Table */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "booked" | "completed")}>
        <TabsList>
          <TabsTrigger value="booked" data-testid="tab-booked">
            <BookOpen className="h-4 w-4 mr-2" />
            Booked ({metrics.booked})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed ({metrics.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booked" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Access Info</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">No booked training found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
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
                          {booking.site?.companyName && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {booking.site.companyName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking.scheduledDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(booking.scheduledDate), "dd MMM yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking.accessUrl ? (
                            <Badge variant="outline" className="gap-1">
                              <LinkIcon className="h-3 w-3" />
                              Has Access Info
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No access info</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${booking.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewDialog(booking)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUploadCertificate(booking)}>
                                <Award className="h-4 w-4 mr-2" />
                                Complete & Upload Certificate
                              </DropdownMenuItem>
                              {user?.role === "admin" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => deleteBookingMutation.mutate(booking.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-muted-foreground">No completed training found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
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
                              Uploaded
                            </Badge>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleUploadCertificate(booking)}
                              data-testid={`button-upload-cert-${booking.id}`}
                            >
                              <Award className="h-3 w-3 mr-1" />
                              Upload
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewDialog(booking)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {!booking.certificateId && (
                                <DropdownMenuItem onClick={() => handleUploadCertificate(booking)}>
                                  <Award className="h-4 w-4 mr-2" />
                                  Upload Certificate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Book Training Dialog */}
      <Dialog open={bookingDialog} onOpenChange={setBookingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              Book Training
            </DialogTitle>
            <DialogDescription>
              Create a new training booking for a site
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course">Training Course *</Label>
              <Select
                value={newBooking.trainingCourseId}
                onValueChange={(v) => setNewBooking({ ...newBooking, trainingCourseId: v })}
              >
                <SelectTrigger data-testid="select-booking-course">
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {trainingCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                      {course.productCode && ` (${course.productCode})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site">Site *</Label>
              <Select
                value={newBooking.siteId}
                onValueChange={(v) => setNewBooking({ ...newBooking, siteId: v })}
              >
                <SelectTrigger data-testid="select-booking-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                      {site.companyName && ` - ${site.companyName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={newBooking.scheduledDate}
                onChange={(e) => setNewBooking({ ...newBooking, scheduledDate: e.target.value })}
                data-testid="input-booking-date"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Access Information
              </h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="accessUrl">Login URL / Course Link</Label>
                  <Input
                    id="accessUrl"
                    placeholder="https://..."
                    value={newBooking.accessUrl}
                    onChange={(e) => setNewBooking({ ...newBooking, accessUrl: e.target.value })}
                    data-testid="input-access-url"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="accessUsername">Username</Label>
                    <Input
                      id="accessUsername"
                      placeholder="username"
                      value={newBooking.accessUsername}
                      onChange={(e) => setNewBooking({ ...newBooking, accessUsername: e.target.value })}
                      data-testid="input-access-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessPassword">Password</Label>
                    <Input
                      id="accessPassword"
                      type="text"
                      placeholder="password"
                      value={newBooking.accessPassword}
                      onChange={(e) => setNewBooking({ ...newBooking, accessPassword: e.target.value })}
                      data-testid="input-access-password"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Provider Details
              </h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="providerName">Provider Name</Label>
                  <Input
                    id="providerName"
                    placeholder="Training Provider"
                    value={newBooking.providerName}
                    onChange={(e) => setNewBooking({ ...newBooking, providerName: e.target.value })}
                    data-testid="input-provider-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="providerContact">Contact (Email/Phone)</Label>
                  <Input
                    id="providerContact"
                    placeholder="contact@provider.com"
                    value={newBooking.providerContact}
                    onChange={(e) => setNewBooking({ ...newBooking, providerContact: e.target.value })}
                    data-testid="input-provider-contact"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={newBooking.notes}
                onChange={(e) => setNewBooking({ ...newBooking, notes: e.target.value })}
                className="resize-none"
                data-testid="textarea-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBooking}
              disabled={createBookingMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-booking"
            >
              {createBookingMutation.isPending ? "Booking..." : "Book Training"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              Booking Details
            </DialogTitle>
          </DialogHeader>
          
          {viewDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Course</Label>
                  <p className="font-medium">{viewDialog.course?.title || "Unknown"}</p>
                  {viewDialog.course?.productCode && (
                    <p className="text-sm text-muted-foreground">{viewDialog.course.productCode}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Site</Label>
                  <p className="font-medium">{viewDialog.site?.name || "Unknown"}</p>
                  {viewDialog.site?.companyName && (
                    <p className="text-sm text-muted-foreground">{viewDialog.site.companyName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={viewDialog.status === "completed" 
                    ? "bg-emerald-100 text-emerald-800" 
                    : "bg-purple-100 text-purple-800"
                  }>
                    {viewDialog.status === "completed" ? "Completed" : "Booked"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Scheduled Date</Label>
                  <p className="font-medium">
                    {viewDialog.scheduledDate 
                      ? format(new Date(viewDialog.scheduledDate), "dd MMM yyyy")
                      : "Not scheduled"}
                  </p>
                </div>
              </div>

              {viewDialog.accessUrl && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Access Information
                  </h4>
                  <div className="space-y-2 bg-muted p-3 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground">Login URL</Label>
                      <a 
                        href={viewDialog.accessUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline block"
                      >
                        {viewDialog.accessUrl}
                      </a>
                    </div>
                    {viewDialog.accessUsername && (
                      <div>
                        <Label className="text-muted-foreground">Username</Label>
                        <p className="font-mono">{viewDialog.accessUsername}</p>
                      </div>
                    )}
                    {viewDialog.accessPassword && (
                      <div>
                        <Label className="text-muted-foreground">Password</Label>
                        <p className="font-mono">{viewDialog.accessPassword}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(viewDialog.providerName || viewDialog.providerContact) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Provider
                  </h4>
                  <div className="space-y-1">
                    {viewDialog.providerName && <p className="font-medium">{viewDialog.providerName}</p>}
                    {viewDialog.providerContact && (
                      <p className="text-muted-foreground">{viewDialog.providerContact}</p>
                    )}
                  </div>
                </div>
              )}

              {viewDialog.notes && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="whitespace-pre-wrap">{viewDialog.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
