import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  HardHat, 
  Users, 
  Scale,
  Building2,
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import type { ModuleAccessRequest, ModuleType } from "@shared/schema";

const moduleIcons: Record<ModuleType, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
};

const moduleNames: Record<ModuleType, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const moduleColors: Record<ModuleType, string> = {
  health_safety: "text-emerald-600 dark:text-emerald-400",
  human_resources: "text-blue-600 dark:text-blue-400",
  employment_law: "text-pink-600 dark:text-pink-400",
};

const moduleBgColors: Record<ModuleType, string> = {
  health_safety: "bg-emerald-100 dark:bg-emerald-900/30",
  human_resources: "bg-blue-100 dark:bg-blue-900/30",
  employment_law: "bg-pink-100 dark:bg-pink-900/30",
};

type FilterStatus = "all" | "pending" | "overdue" | "urgent" | "approved" | "rejected";

const OVERDUE_DAYS = 5;
const URGENT_DAYS = 3;
const ITEMS_PER_PAGE = 10;

function getRequestUrgency(request: ModuleAccessRequest): "overdue" | "urgent" | "normal" {
  if (request.status !== "pending") return "normal";
  const daysPending = differenceInDays(new Date(), new Date(request.createdAt));
  if (daysPending >= OVERDUE_DAYS) return "overdue";
  if (daysPending >= URGENT_DAYS) return "urgent";
  return "normal";
}

function StatusBadge({ request }: { request: ModuleAccessRequest }) {
  const urgency = getRequestUrgency(request);
  
  if (request.status === "approved") {
    return (
      <Badge variant="outline" className="text-emerald-600 border-emerald-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Approved
      </Badge>
    );
  }
  
  if (request.status === "rejected") {
    return (
      <Badge variant="outline" className="text-red-600 border-red-600">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  }
  
  if (urgency === "overdue") {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Overdue
      </Badge>
    );
  }
  
  if (urgency === "urgent") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-600">
        <Clock className="h-3 w-3 mr-1" />
        Urgent
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-600">
      <Clock className="h-3 w-3 mr-1" />
      Pending
    </Badge>
  );
}

function ModuleBadge({ module }: { module: ModuleType }) {
  const Icon = moduleIcons[module];
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded ${moduleBgColors[module]}`}>
        <Icon className={`h-4 w-4 ${moduleColors[module]}`} />
      </div>
      <span className="text-sm font-medium">{moduleNames[module]}</span>
    </div>
  );
}

export default function ModuleAccessRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"date" | "entity" | "module">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [reviewDialog, setReviewDialog] = useState<{ 
    open: boolean; 
    requests: ModuleAccessRequest[];
    action: "approve" | "reject" | null;
  }>({ open: false, requests: [], action: null });
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: requests = [], isLoading } = useQuery<ModuleAccessRequest[]>({
    queryKey: ["/api/module-access-requests"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/module-access-requests/${id}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/module-access-requests"] });
    },
  });

  const handleBulkReview = async () => {
    if (reviewDialog.requests.length === 0 || !reviewDialog.action) return;
    
    const status = reviewDialog.action === "approve" ? "approved" : "rejected";
    let successCount = 0;
    let failCount = 0;
    
    for (const request of reviewDialog.requests) {
      try {
        await reviewMutation.mutateAsync({ 
          id: request.id, 
          status, 
          notes: reviewNotes || undefined 
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/module-access-requests"] });
    }
    
    if (failCount === 0) {
      toast({
        title: reviewDialog.action === "approve" ? "Access Granted" : "Requests Rejected",
        description: `${successCount} request(s) have been ${status}.`,
      });
    } else if (successCount > 0) {
      toast({
        title: "Partial Success",
        description: `${successCount} request(s) processed, ${failCount} failed.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to process requests. Please try again.",
        variant: "destructive",
      });
    }
    
    setSelectedRequests(new Set());
    setReviewDialog({ open: false, requests: [], action: null });
    setReviewNotes("");
  };

  const openReviewDialog = (requests: ModuleAccessRequest[], action: "approve" | "reject") => {
    setReviewDialog({ open: true, requests, action });
    setReviewNotes("");
  };

  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === "pending");
    const overdue = pending.filter(r => getRequestUrgency(r) === "overdue");
    const urgent = pending.filter(r => getRequestUrgency(r) === "urgent");
    const approved = requests.filter(r => r.status === "approved");
    const rejected = requests.filter(r => r.status === "rejected");
    
    const byModule = {
      health_safety: pending.filter(r => r.module === "health_safety").length,
      human_resources: pending.filter(r => r.module === "human_resources").length,
      employment_law: pending.filter(r => r.module === "employment_law").length,
    };
    
    return { 
      total: requests.length,
      pending: pending.length, 
      overdue: overdue.length, 
      urgent: urgent.length,
      approved: approved.length,
      rejected: rejected.length,
      byModule 
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let filtered = [...requests];
    
    if (statusFilter === "pending") {
      filtered = filtered.filter(r => r.status === "pending");
    } else if (statusFilter === "overdue") {
      filtered = filtered.filter(r => r.status === "pending" && getRequestUrgency(r) === "overdue");
    } else if (statusFilter === "urgent") {
      filtered = filtered.filter(r => r.status === "pending" && getRequestUrgency(r) === "urgent");
    } else if (statusFilter === "approved") {
      filtered = filtered.filter(r => r.status === "approved");
    } else if (statusFilter === "rejected") {
      filtered = filtered.filter(r => r.status === "rejected");
    }
    
    if (moduleFilter !== "all") {
      filtered = filtered.filter(r => r.module === moduleFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.entityName?.toLowerCase().includes(query) ||
        r.requestedByName.toLowerCase().includes(query)
      );
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "entity") {
        comparison = (a.entityName || "").localeCompare(b.entityName || "");
      } else if (sortBy === "module") {
        comparison = a.module.localeCompare(b.module);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [requests, statusFilter, moduleFilter, searchQuery, sortBy, sortOrder]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);

  const handleSelectAll = () => {
    const pendingOnPage = paginatedRequests.filter(r => r.status === "pending");
    if (selectedRequests.size === pendingOnPage.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(pendingOnPage.map(r => r.id)));
    }
  };

  const handleSelectRequest = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRequests);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRequests(newSelected);
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const selectedPendingRequests = useMemo(() => {
    return requests.filter(r => selectedRequests.has(r.id) && r.status === "pending");
  }, [requests, selectedRequests]);

  const isAdmin = user?.role === "admin" || user?.role === "consultant";

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-muted-foreground mt-1">
              Only administrators and consultants can manage access requests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Module Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Manage and review entity requests for module access
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-primary" : "hover-elevate"}`}
          onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
          data-testid="stat-card-all"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <Filter className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === "overdue" ? "ring-2 ring-destructive" : "hover-elevate"}`}
          onClick={() => { setStatusFilter("overdue"); setCurrentPage(1); }}
          data-testid="stat-card-overdue"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-destructive">{stats.overdue}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === "urgent" ? "ring-2 ring-amber-500" : "hover-elevate"}`}
          onClick={() => { setStatusFilter("urgent"); setCurrentPage(1); }}
          data-testid="stat-card-urgent"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-3xl font-bold text-amber-500">{stats.urgent}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === "pending" ? "ring-2 ring-primary" : "hover-elevate"}`}
          onClick={() => { setStatusFilter("pending"); setCurrentPage(1); }}
          data-testid="stat-card-pending"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by entity or requester..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
            data-testid="input-search-requests"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v: FilterStatus) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses ({stats.total})</SelectItem>
            <SelectItem value="pending">Pending ({stats.pending})</SelectItem>
            <SelectItem value="overdue">Overdue ({stats.overdue})</SelectItem>
            <SelectItem value="urgent">Urgent ({stats.urgent})</SelectItem>
            <SelectItem value="approved">Approved ({stats.approved})</SelectItem>
            <SelectItem value="rejected">Rejected ({stats.rejected})</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-module-filter">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="health_safety">Health & Safety ({stats.byModule.health_safety})</SelectItem>
            <SelectItem value="human_resources">Human Resources ({stats.byModule.human_resources})</SelectItem>
            <SelectItem value="employment_law">Employment Law ({stats.byModule.employment_law})</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sortBy} onValueChange={(v: "date" | "entity" | "module") => setSortBy(v)}>
          <SelectTrigger className="w-[140px]" data-testid="select-sort-by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="entity">Entity</SelectItem>
            <SelectItem value="module">Module</SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          data-testid="button-toggle-sort"
        >
          {sortOrder === "asc" ? "Oldest First" : "Newest First"}
        </Button>
      </div>

      {selectedPendingRequests.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <CheckSquare className="h-5 w-5 text-primary" />
          <span className="font-medium">{selectedPendingRequests.length} request(s) selected</span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              onClick={() => openReviewDialog(selectedPendingRequests, "approve")}
              data-testid="button-bulk-approve"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openReviewDialog(selectedPendingRequests, "reject")}
              data-testid="button-bulk-reject"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Requests Found</h3>
            <p className="text-muted-foreground text-center mt-1">
              {searchQuery 
                ? "No requests match your search criteria."
                : "No module access requests to display."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        paginatedRequests.filter(r => r.status === "pending").length > 0 &&
                        paginatedRequests.filter(r => r.status === "pending").every(r => selectedRequests.has(r.id))
                      }
                      onCheckedChange={handleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRequests.map((request) => {
                  const isExpanded = expandedRows.has(request.id);
                  return (
                    <Fragment key={request.id}>
                      <TableRow data-testid={`row-request-${request.id}`} className="group">
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            {request.status === "pending" && (
                              <Checkbox
                                checked={selectedRequests.has(request.id)}
                                onCheckedChange={(checked) => handleSelectRequest(request.id, !!checked)}
                                data-testid={`checkbox-request-${request.id}`}
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => toggleRowExpansion(request.id)}
                              data-testid={`button-expand-${request.id}`}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="font-medium text-sm">{request.entityName || request.entityId}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <ModuleBadge module={request.module} />
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm">{request.requestedByName}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm text-muted-foreground">{format(new Date(request.createdAt), "MMM d")}</span>
                        </TableCell>
                        <TableCell className="py-2">
                          <StatusBadge request={request} />
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Link href={`/entities/${request.entityId}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-view-entity-${request.id}`}
                              >
                                View
                              </Button>
                            </Link>
                            {request.status === "pending" && (
                              <>
                                <Button
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openReviewDialog([request], "approve")}
                                  data-testid={`button-approve-${request.id}`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openReviewDialog([request], "reject")}
                                  data-testid={`button-reject-${request.id}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${request.id}-expanded`} className="bg-muted/30">
                          <TableCell colSpan={7} className="py-3 px-6">
                            <div className="grid gap-x-8 gap-y-2 md:grid-cols-3 lg:grid-cols-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Reason: </span>
                                <span>{request.reason || "Not provided"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Submitted: </span>
                                <span>{format(new Date(request.createdAt), "PPP")}</span>
                              </div>
                              {request.status === "pending" && (
                                <div>
                                  <span className="text-muted-foreground">Pending: </span>
                                  <span>{differenceInDays(new Date(), new Date(request.createdAt))} days</span>
                                </div>
                              )}
                              {request.status !== "pending" && (
                                <>
                                  <div>
                                    <span className="text-muted-foreground">Reviewed by: </span>
                                    <span>{request.reviewedByName || "Unknown"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Notes: </span>
                                    <span>{request.reviewNotes || "None"}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} requests
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={reviewDialog.open} onOpenChange={(open) => {
        if (!open) setReviewDialog({ open: false, requests: [], action: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" ? "Approve" : "Reject"} {reviewDialog.requests.length > 1 ? `${reviewDialog.requests.length} Requests` : "Request"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "approve" 
                ? "This will grant the selected entities access to the requested modules."
                : "This will deny the selected access requests."}
            </DialogDescription>
          </DialogHeader>
          
          {reviewDialog.requests.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-48 overflow-y-auto space-y-2">
                {reviewDialog.requests.map(request => (
                  <div key={request.id} className="rounded-md bg-muted p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded ${moduleBgColors[request.module]}`}>
                          {(() => {
                            const Icon = moduleIcons[request.module];
                            return <Icon className={`h-4 w-4 ${moduleColors[request.module]}`} />;
                          })()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{request.entityName || request.entityId}</p>
                          <p className="text-xs text-muted-foreground">{moduleNames[request.module]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Add any notes about this decision..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  data-testid="input-review-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setReviewDialog({ open: false, requests: [], action: null })}
            >
              Cancel
            </Button>
            <Button 
              variant={reviewDialog.action === "approve" ? "default" : "destructive"}
              onClick={handleBulkReview}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? "Processing..." : (
                reviewDialog.action === "approve" 
                  ? `Approve ${reviewDialog.requests.length > 1 ? `(${reviewDialog.requests.length})` : ""}` 
                  : `Reject ${reviewDialog.requests.length > 1 ? `(${reviewDialog.requests.length})` : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
