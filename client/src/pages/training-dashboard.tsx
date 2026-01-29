import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, isFuture, addDays } from "date-fns";
import {
  GraduationCap,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Search,
  Filter,
  BookOpen,
  CalendarCheck,
  RefreshCw,
  XCircle,
  MessageSquare,
  HardHat,
  Users,
  Scale,
  Building2,
  MapPin,
} from "lucide-react";

import type { TrainingRequest, TrainingCourse, SiteWithDetails, User } from "@shared/schema";

type TrainingRequestWithDetails = TrainingRequest & {
  course?: TrainingCourse;
  site?: SiteWithDetails;
  requester?: User;
};

const moduleNames: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const moduleColors: Record<string, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<string, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: MessageSquare },
  booked: { label: "Booked", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: CalendarCheck },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle },
};

export default function TrainingDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "renewals">("overview");
  
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    request: TrainingRequestWithDetails | null;
    action: "book" | "complete" | "cancel" | null;
  }>({ open: false, request: null, action: null });
  const [scheduledDate, setScheduledDate] = useState("");
  const [responseNotes, setResponseNotes] = useState("");

  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const { data: sites = [] } = useQuery<SiteWithDetails[]>({
    queryKey: ["/api/sites"],
  });

  const { data: trainingRequests = [], isLoading: requestsLoading } = useQuery<TrainingRequest[]>({
    queryKey: ["/api/training-requests"],
  });

  const { data: trainingCourses = [] } = useQuery<TrainingCourse[]>({
    queryKey: ["/api/training-courses"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isPrivilegedUser,
  });

  const filteredSites = useMemo(() => {
    if (!selectedCompanyName || selectedCompanyName === "all") return sites;
    return sites.filter(site => site.companyName === selectedCompanyName);
  }, [sites, selectedCompanyName]);

  const requestsWithDetails: TrainingRequestWithDetails[] = useMemo(() => {
    return trainingRequests.map(request => ({
      ...request,
      course: trainingCourses.find(c => c.id === request.trainingCourseId),
      site: sites.find(s => s.id === request.siteId),
      requester: users.find(u => u.id === request.requestedBy),
    }));
  }, [trainingRequests, trainingCourses, sites, users]);

  const filteredRequests = useMemo(() => {
    return requestsWithDetails.filter(request => {
      if (selectedCompanyName && selectedCompanyName !== "all" && request.site?.companyName !== selectedCompanyName) return false;
      if (selectedSiteId && request.siteId !== selectedSiteId) return false;
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCourse = request.course?.title?.toLowerCase().includes(query);
        const matchesSite = request.site?.name?.toLowerCase().includes(query);
        const matchesRequester = request.requester?.fullName?.toLowerCase().includes(query);
        if (!matchesCourse && !matchesSite && !matchesRequester) return false;
      }
      return true;
    });
  }, [requestsWithDetails, selectedCompanyName, selectedSiteId, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    const filtered = selectedCompanyName || selectedSiteId 
      ? requestsWithDetails.filter(r => {
          if (selectedCompanyName && selectedCompanyName !== "all" && r.site?.companyName !== selectedCompanyName) return false;
          if (selectedSiteId && r.siteId !== selectedSiteId) return false;
          return true;
        })
      : requestsWithDetails;

    const pending = filtered.filter(r => r.status === "pending").length;
    const contacted = filtered.filter(r => r.status === "contacted").length;
    const booked = filtered.filter(r => r.status === "booked").length;
    const completed = filtered.filter(r => r.status === "completed").length;
    
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const renewalsDue = filtered.filter(r => 
      r.renewalDate && 
      new Date(r.renewalDate) <= thirtyDaysFromNow &&
      new Date(r.renewalDate) >= today
    ).length;
    const renewalsOverdue = filtered.filter(r => 
      r.renewalDate && isPast(new Date(r.renewalDate))
    ).length;

    return { pending, contacted, booked, completed, renewalsDue, renewalsOverdue, total: filtered.length };
  }, [requestsWithDetails, selectedCompanyName, selectedSiteId]);

  const renewalRequests = useMemo(() => {
    const today = new Date();
    return filteredRequests
      .filter(r => r.renewalDate && r.status === "completed")
      .sort((a, b) => new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime());
  }, [filteredRequests]);

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/training-requests/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-requests"] });
      toast({
        title: "Training request updated",
        description: "The training request has been updated successfully.",
      });
      setActionDialog({ open: false, request: null, action: null });
      setScheduledDate("");
      setResponseNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update training request",
        variant: "destructive",
      });
    },
  });

  const handleAction = (request: TrainingRequestWithDetails, action: "book" | "complete" | "cancel") => {
    setActionDialog({ open: true, request, action });
  };

  const confirmAction = () => {
    if (!actionDialog.request || !actionDialog.action) return;

    const data: any = { responseNotes };
    
    if (actionDialog.action === "book") {
      data.status = "booked";
      if (scheduledDate) {
        data.scheduledDate = new Date(scheduledDate).toISOString();
      }
    } else if (actionDialog.action === "complete") {
      data.status = "completed";
    } else if (actionDialog.action === "cancel") {
      data.status = "cancelled";
    }

    updateRequestMutation.mutate({ id: actionDialog.request.id, data });
  };

  const quickStatusUpdate = (request: TrainingRequestWithDetails, status: string) => {
    updateRequestMutation.mutate({ id: request.id, data: { status } });
  };

  const getModuleIcon = (module?: string) => {
    if (module === "health_safety") return HardHat;
    if (module === "human_resources") return Users;
    if (module === "employment_law") return Scale;
    return GraduationCap;
  };

  if (requestsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b bg-purple-100 dark:bg-purple-900/30">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600 dark:bg-purple-500">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Training Dashboard</h1>
              <p className="text-sm text-muted-foreground">Track and manage training requests</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 px-6 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3 flex-wrap">
          {isPrivilegedUser && (
            <>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <CompanyCombobox
                  sites={sites.map(s => ({ id: s.id, name: s.name, companyName: s.companyName }))}
                  value={selectedCompanyName}
                  onValueChange={(name) => {
                    setSelectedCompanyName(name);
                    setSelectedSiteId(null);
                  }}
                  placeholder="All Companies"
                  className="w-[200px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <SiteCombobox
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                  sites={filteredSites}
                  placeholder="All Sites"
                  className="w-[200px]"
                />
              </div>
            </>
          )}
          
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background"
              data-testid="input-search-requests"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">All Requests</TabsTrigger>
            <TabsTrigger value="renewals" data-testid="tab-renewals">
              Renewals
              {metrics.renewalsDue + metrics.renewalsOverdue > 0 && (
                <Badge variant="destructive" className="ml-2">{metrics.renewalsDue + metrics.renewalsOverdue}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover-elevate cursor-pointer" data-testid="card-pending-requests" onClick={() => { setStatusFilter("pending"); setActiveTab("requests"); }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-count">{metrics.pending}</div>
                  <p className="text-xs text-muted-foreground">Awaiting response</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-booked" onClick={() => { setStatusFilter("booked"); setActiveTab("requests"); }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Booked</CardTitle>
                  <CalendarCheck className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-booked-count">{metrics.booked}</div>
                  <p className="text-xs text-muted-foreground">Training scheduled</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-completed" onClick={() => { setStatusFilter("completed"); setActiveTab("requests"); }}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-completed-count">{metrics.completed}</div>
                  <p className="text-xs text-muted-foreground">Training finished</p>
                </CardContent>
              </Card>

              <Card className="hover-elevate cursor-pointer" data-testid="card-renewals" onClick={() => setActiveTab("renewals")}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Renewals Due</CardTitle>
                  <RefreshCw className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics.renewalsDue}
                    {metrics.renewalsOverdue > 0 && (
                      <span className="text-destructive ml-2 text-lg">+{metrics.renewalsOverdue} overdue</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Due in next 30 days</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No training requests found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRequests.slice(0, 5).map((request) => {
                      const StatusIcon = statusConfig[request.status]?.icon || Clock;
                      const ModuleIcon = getModuleIcon(request.course?.module);
                      return (
                        <div key={request.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                          <div className={`p-2 rounded-lg ${request.course?.module ? moduleBgColors[request.course.module] : "bg-muted"}`}>
                            <ModuleIcon className={`h-4 w-4 ${request.course?.module ? moduleColors[request.course.module] : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{request.course?.title || "Unknown Course"}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {request.site?.name} • {request.requester?.fullName || "Unknown"}
                            </p>
                          </div>
                          <Badge className={statusConfig[request.status]?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[request.status]?.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Training Requests</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No training requests match your filters</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        {isPrivilegedUser && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const StatusIcon = statusConfig[request.status]?.icon || Clock;
                        const ModuleIcon = getModuleIcon(request.course?.module);
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded ${request.course?.module ? moduleBgColors[request.course.module] : "bg-muted"}`}>
                                  <ModuleIcon className={`h-3 w-3 ${request.course?.module ? moduleColors[request.course.module] : "text-muted-foreground"}`} />
                                </div>
                                <span className="font-medium">{request.course?.title || "Unknown"}</span>
                              </div>
                            </TableCell>
                            <TableCell>{request.site?.name || "Unknown"}</TableCell>
                            <TableCell>{request.requester?.fullName || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {request.requestType === "booking" ? "Booking" : "Info"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig[request.status]?.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig[request.status]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {format(new Date(request.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            {isPrivilegedUser && (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" data-testid={`button-actions-${request.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {request.status === "pending" && (
                                      <DropdownMenuItem onClick={() => quickStatusUpdate(request, "contacted")}>
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Mark as Contacted
                                      </DropdownMenuItem>
                                    )}
                                    {(request.status === "pending" || request.status === "contacted") && (
                                      <DropdownMenuItem onClick={() => handleAction(request, "book")}>
                                        <CalendarCheck className="h-4 w-4 mr-2" />
                                        Book Training
                                      </DropdownMenuItem>
                                    )}
                                    {request.status === "booked" && (
                                      <DropdownMenuItem onClick={() => handleAction(request, "complete")}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Mark as Completed
                                      </DropdownMenuItem>
                                    )}
                                    {request.status !== "completed" && request.status !== "cancelled" && (
                                      <DropdownMenuItem 
                                        onClick={() => handleAction(request, "cancel")}
                                        className="text-destructive"
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Cancel Request
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="renewals">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-orange-500" />
                  Training Renewals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renewalRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No training renewals due</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Completed</TableHead>
                        <TableHead>Renewal Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {renewalRequests.map((request) => {
                        const ModuleIcon = getModuleIcon(request.course?.module);
                        const renewalDate = request.renewalDate ? new Date(request.renewalDate) : null;
                        const isOverdue = renewalDate && isPast(renewalDate);
                        const isDueSoon = renewalDate && !isOverdue && isFuture(renewalDate) && 
                          renewalDate <= addDays(new Date(), 30);
                        
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded ${request.course?.module ? moduleBgColors[request.course.module] : "bg-muted"}`}>
                                  <ModuleIcon className={`h-3 w-3 ${request.course?.module ? moduleColors[request.course.module] : "text-muted-foreground"}`} />
                                </div>
                                <span className="font-medium">{request.course?.title || "Unknown"}</span>
                              </div>
                            </TableCell>
                            <TableCell>{request.site?.name || "Unknown"}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {request.completedAt ? format(new Date(request.completedAt), "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {renewalDate ? format(renewalDate, "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              {isOverdue ? (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Overdue
                                </Badge>
                              ) : isDueSoon ? (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Due Soon
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Scheduled
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, request: null, action: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "book" && "Book Training"}
              {actionDialog.action === "complete" && "Complete Training"}
              {actionDialog.action === "cancel" && "Cancel Request"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.request?.course?.title} for {actionDialog.request?.site?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {actionDialog.action === "book" && (
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">Scheduled Date (Optional)</Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  data-testid="input-scheduled-date"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="responseNotes">Notes (Optional)</Label>
              <Textarea
                id="responseNotes"
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="Add any notes about this action..."
                data-testid="input-response-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, request: null, action: null })}>
              Cancel
            </Button>
            <Button 
              onClick={confirmAction}
              disabled={updateRequestMutation.isPending}
              variant={actionDialog.action === "cancel" ? "destructive" : "default"}
              data-testid="button-confirm-action"
            >
              {updateRequestMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
