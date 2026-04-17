import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  GraduationCap,
  LayoutDashboard,
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
  HardHat,
  Users,
  Scale,
  Filter,
  Download,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import type { TrainingCourse, SiteWithDetails, TrainingBooking, Document as TrainingDocument } from "@shared/schema";

type TrainingBookingWithDetails = TrainingBooking & {
  course?: TrainingCourse;
  site?: SiteWithDetails;
};

type Company = {
  id: string;
  name: string;
};

type ModuleFilter = "all" | "health_safety" | "human_resources" | "employment_law";

const moduleFilterConfig = [
  { value: "all" as const, label: "All Modules", Icon: Filter, color: "text-purple-600 dark:text-purple-400", activeStyle: "bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700" },
  { value: "health_safety" as const, label: "Health & Safety", Icon: HardHat, color: "text-emerald-600 dark:text-emerald-400", activeStyle: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700" },
  { value: "human_resources" as const, label: "Human Resources", Icon: Users, color: "text-blue-600 dark:text-blue-400", activeStyle: "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700" },
  { value: "employment_law" as const, label: "Employment Law", Icon: Scale, color: "text-pink-600 dark:text-pink-400", activeStyle: "bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700" },
];

export default function TrainingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter();
  const companyFilter = selectedCompany || "all";
  const siteFilter = selectedSiteId || "all";
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const setSiteFilter = (val: string) => setSelectedSiteId(val === "all" ? null : val);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"booked" | "completed" | "certificates">("booked");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  
  const [bookingDialog, setBookingDialog] = useState(false);
  const [completeDialog, setCompleteDialog] = useState<TrainingBookingWithDetails | null>(null);
  const [viewDialog, setViewDialog] = useState<TrainingBookingWithDetails | null>(null);
  const [viewCertDialog, setViewCertDialog] = useState<TrainingDocument | null>(null);
  
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

  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies?limit=1000"],
  });
  const companies = companiesData?.companies || [];

  const { data: trainingBookings = [], isLoading } = useQuery<TrainingBooking[]>({
    queryKey: ["/api/training-bookings"],
  });

  const { data: trainingCourses = [] } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const { data: certDocuments = [] } = useQuery<TrainingDocument[]>({
    queryKey: ["/api/documents/module/training"],
  });

  // Filter sites based on selected company
  const filteredSitesForDropdown = useMemo(() => {
    if (companyFilter === "all") return sites;
    return sites.filter(s => s.companyId === companyFilter);
  }, [sites, companyFilter]);

  const handleCompanyFilterChange = (value: string) => {
    setCompanyFilter(value);
  };

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
      
      // Module filter
      if (moduleFilter !== "all" && booking.course?.module !== moduleFilter) return false;
      
      // Company filter
      if (companyFilter !== "all" && booking.site?.companyId !== companyFilter) return false;
      
      // Site filter
      if (siteFilter !== "all" && booking.siteId !== siteFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCourse = booking.course?.title?.toLowerCase().includes(query);
        const matchesSite = booking.site?.name?.toLowerCase().includes(query);
        if (!matchesCourse && !matchesSite) return false;
      }
      return true;
    });
  }, [bookingsWithDetails, activeTab, searchQuery, companyFilter, siteFilter, moduleFilter]);

  const filteredCertificates = useMemo(() => {
    return certDocuments
      .filter(d => d.type === "training_certificate")
      .filter(cert => {
        const site = sites.find(s => s.id === cert.siteId);
        if (companyFilter !== "all" && site?.companyId !== companyFilter) return false;
        if (siteFilter !== "all" && cert.siteId !== siteFilter) return false;
        if (moduleFilter !== "all") {
          const booking = trainingBookings.find(b => b.certificateId === cert.id);
          const course = booking ? trainingCourses.find(c => c.id === booking.trainingCourseId) : null;
          if (course?.module !== moduleFilter) return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !cert.trainingCourseTitle?.toLowerCase().includes(q) &&
            !cert.trainingCourseCode?.toLowerCase().includes(q) &&
            !cert.title.toLowerCase().includes(q)
          ) return false;
        }
        return true;
      });
  }, [certDocuments, sites, companyFilter, siteFilter, moduleFilter, searchQuery, trainingBookings, trainingCourses]);

  const metrics = useMemo(() => {
    const booked = bookingsWithDetails.filter(b => b.status === "booked").length;
    const completed = bookingsWithDetails.filter(b => b.status === "completed").length;
    const certificates = certDocuments.filter(d => d.type === "training_certificate").length;
    return { booked, completed, total: bookingsWithDetails.length, certificates };
  }, [bookingsWithDetails, certDocuments]);

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
            <Link href="/training/my-training">
              <Button className="mt-4" data-testid="link-my-training">
                View Training Dashboard
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
              <p className="text-base mt-1 text-muted-foreground">
                Manage training bookings and track completion
              </p>
            </div>
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
      </div>
      <div id="page-content" className="flex-1 overflow-auto container px-6 py-6 dash-animate">

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

        <Card
          className={`cursor-pointer transition-all ${activeTab === "certificates" ? "border-amber-500 border-2 bg-amber-50/50 dark:bg-amber-950/20" : "hover-elevate"}`}
          onClick={() => setActiveTab("certificates")}
          data-testid="card-certificates"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <Award className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.certificates}</div>
            <p className="text-xs text-muted-foreground">Training certificates uploaded</p>
          </CardContent>
        </Card>
      </div>

      {/* Module Tabs - Enhanced Prominence */}
      <div className="grid w-full grid-cols-4 gap-2 p-1 rounded-xl bg-muted/50 border mb-6">
        {moduleFilterConfig.map(({ value, label, Icon, color, activeStyle }) => {
          const isActive = moduleFilter === value;
          return (
            <button
              key={value}
              onClick={() => setModuleFilter(value)}
              data-testid={`module-tab-${value}`}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 py-4 px-3 rounded-lg font-medium transition-all ${
                isActive 
                  ? `${activeStyle} border shadow-sm ${color}` 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-transparent"
              }`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses or sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={companyFilter} onValueChange={handleCompanyFilterChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-company-filter">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-site-filter">
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {filteredSitesForDropdown.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(companyFilter !== "all" || siteFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCompanyFilter("all");
            }}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("booked")}
          data-testid="tab-booked"
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "booked"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Booked</span>
          <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-semibold ${
            activeTab === "booked" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {metrics.booked}
          </span>
        </button>
        
        <button
          onClick={() => setActiveTab("completed")}
          data-testid="tab-completed"
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "completed"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border"
          }`}
        >
          <CheckCircle className="h-4 w-4" />
          <span>Completed</span>
          <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-semibold ${
            activeTab === "completed" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {metrics.completed}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("certificates")}
          data-testid="tab-certificates"
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
            activeTab === "certificates"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border"
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Certificates</span>
          <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded text-xs font-semibold ${
            activeTab === "certificates" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {metrics.certificates}
          </span>
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === "booked" && (
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
      )}

      {activeTab === "completed" && (
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
                            <button
                              onClick={() => {
                                const cert = certDocuments.find(d => d.id === booking.certificateId);
                                if (cert) setViewCertDialog(cert);
                              }}
                              data-testid={`button-cert-badge-${booking.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                            >
                              <Award className="h-3 w-3" />
                              View Certificate
                            </button>
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
      )}

      {/* Certificates Tab */}
      {activeTab === "certificates" && (
        <Card>
          <CardContent className="p-0">
            {filteredCertificates.length === 0 ? (
              <div className="py-12 text-center">
                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Certificates Found</h3>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || companyFilter !== "all" || siteFilter !== "all" || moduleFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Certificates will appear here once training is completed and uploaded."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Certificate Date</TableHead>
                    <TableHead>Renewal Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificates.map((cert) => {
                    const site = sites.find(s => s.id === cert.siteId);
                    const renewalStatus = (() => {
                      if (!cert.renewalDate) return <Badge variant="secondary">No Renewal</Badge>;
                      const days = Math.ceil((new Date(cert.renewalDate).getTime() - Date.now()) / 86400000);
                      if (days < 0) return <Badge variant="destructive">Overdue</Badge>;
                      if (days <= 30) return <Badge className="bg-amber-500 hover:bg-amber-600">Due Soon</Badge>;
                      return <Badge className="bg-green-600 hover:bg-green-700">Valid</Badge>;
                    })();
                    return (
                      <TableRow key={cert.id} data-testid={`row-cert-${cert.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                            <div>
                              <div className="font-medium">{cert.trainingCourseTitle || cert.title}</div>
                              {cert.trainingCourseCode && (
                                <code className="text-xs bg-muted px-1 py-0.5 rounded">{cert.trainingCourseCode}</code>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {site?.name || "-"}
                            </div>
                            {site?.companyName && (
                              <div className="text-xs text-muted-foreground mt-0.5">{site.companyName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cert.trainingDate ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {format(new Date(cert.trainingDate), "dd MMM yyyy")}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {cert.renewalDate ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                              {format(new Date(cert.renewalDate), "dd MMM yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{renewalStatus}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {cert.fileUrl && (
                              <Button variant="ghost" size="icon" asChild data-testid={`button-cert-download-${cert.id}`}>
                                <a href={`${cert.fileUrl}?download=${encodeURIComponent(cert.fileName)}`} download={cert.fileName}>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setViewCertDialog(cert)} data-testid={`button-cert-view-${cert.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Certificate View Dialog */}
      {viewCertDialog && (
        <Dialog open={!!viewCertDialog} onOpenChange={() => setViewCertDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                {viewCertDialog.trainingCourseTitle || viewCertDialog.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {viewCertDialog.trainingCourseCode && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-32">Course Code:</span>
                  <code className="bg-muted px-2 py-1 rounded">{viewCertDialog.trainingCourseCode}</code>
                </div>
              )}
              {viewCertDialog.trainingDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-32">Certificate Date:</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(viewCertDialog.trainingDate), "dd MMMM yyyy")}
                  </div>
                </div>
              )}
              {viewCertDialog.renewalDate && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-32">Renewal Date:</span>
                  <div className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(viewCertDialog.renewalDate), "dd MMMM yyyy")}
                  </div>
                </div>
              )}
              {(() => {
                const site = sites.find(s => s.id === viewCertDialog.siteId);
                return site ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-32">Site:</span>
                    <div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {site.name}
                      </div>
                      {site.companyName && <div className="text-xs text-muted-foreground ml-5">{site.companyName}</div>}
                    </div>
                  </div>
                ) : null;
              })()}
              {viewCertDialog.fileUrl && (
                <div className="pt-2">
                  <Button asChild className="w-full bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-cert-download-dialog">
                    <a href={`${viewCertDialog.fileUrl}?download=${encodeURIComponent(viewCertDialog.fileName)}`} download={viewCertDialog.fileName}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewCertDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
    </div>
  );
}
