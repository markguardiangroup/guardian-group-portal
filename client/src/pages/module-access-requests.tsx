import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  HardHat, 
  Users, 
  Scale,
  Building2,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
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

function RequestCard({ 
  request, 
  onApprove, 
  onReject,
  isProcessing,
}: { 
  request: ModuleAccessRequest;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const Icon = moduleIcons[request.module];
  const moduleName = moduleNames[request.module];
  const iconColor = moduleColors[request.module];
  const iconBg = moduleBgColors[request.module];

  const statusBadge = {
    pending: <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>,
    approved: <Badge variant="outline" className="text-emerald-600 border-emerald-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>,
    rejected: <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>,
  };

  return (
    <Card className="hover-elevate" data-testid={`card-access-request-${request.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div>
              <CardTitle className="text-base">{moduleName}</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Entity: {request.entityId}
              </CardDescription>
            </div>
          </div>
          {statusBadge[request.status]}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Requested by: <span className="text-foreground font-medium">{request.requestedByName}</span></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
          </div>
          {request.reason && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4 mt-0.5" />
              <span className="text-foreground">{request.reason}</span>
            </div>
          )}
        </div>

        {request.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1" 
              onClick={onApprove}
              disabled={isProcessing}
              data-testid={`button-approve-${request.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onReject}
              disabled={isProcessing}
              data-testid={`button-reject-${request.id}`}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        )}

        {request.status !== "pending" && request.reviewedByName && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              {request.status === "approved" ? "Approved" : "Rejected"} by{" "}
              <span className="font-medium text-foreground">{request.reviewedByName}</span>
              {request.reviewedAt && (
                <span className="text-muted-foreground">
                  {" "}on {format(new Date(request.reviewedAt), "MMM d, yyyy")}
                </span>
              )}
            </p>
            {request.reviewNotes && (
              <p className="mt-1 text-foreground">{request.reviewNotes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ModuleAccessRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [reviewDialog, setReviewDialog] = useState<{ 
    open: boolean; 
    request: ModuleAccessRequest | null;
    action: "approve" | "reject" | null;
  }>({ open: false, request: null, action: null });
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
      toast({
        title: reviewDialog.action === "approve" ? "Access Granted" : "Request Rejected",
        description: reviewDialog.action === "approve" 
          ? "The entity now has access to the module."
          : "The access request has been rejected.",
      });
      setReviewDialog({ open: false, request: null, action: null });
      setReviewNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process the request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReview = () => {
    if (!reviewDialog.request || !reviewDialog.action) return;
    reviewMutation.mutate({
      id: reviewDialog.request.id,
      status: reviewDialog.action === "approve" ? "approved" : "rejected",
      notes: reviewNotes || undefined,
    });
  };

  const openReviewDialog = (request: ModuleAccessRequest, action: "approve" | "reject") => {
    setReviewDialog({ open: true, request, action });
    setReviewNotes("");
  };

  const isAdmin = user?.role === "admin" || user?.role === "consultant";

  if (!isAdmin) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only administrators and consultants can manage access requests.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filteredRequests = filter === "pending" 
    ? requests.filter(r => r.status === "pending")
    : requests;

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Module Access Requests</h1>
          <p className="mt-1 text-muted-foreground">
            Review and manage entity requests for module access
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button 
          variant={filter === "pending" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilter("pending")}
          data-testid="button-filter-pending"
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending ({pendingCount})
        </Button>
        <Button 
          variant={filter === "all" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilter("all")}
          data-testid="button-filter-all"
        >
          All Requests ({requests.length})
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Pending Requests</h3>
            <p className="text-muted-foreground text-center mt-1">
              {filter === "pending" 
                ? "All access requests have been processed."
                : "No module access requests have been made yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={() => openReviewDialog(request, "approve")}
              onReject={() => openReviewDialog(request, "reject")}
              isProcessing={reviewMutation.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={reviewDialog.open} onOpenChange={(open) => {
        if (!open) setReviewDialog({ open: false, request: null, action: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" ? "Approve Access Request" : "Reject Access Request"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === "approve" 
                ? "This will grant the entity access to the requested module."
                : "This will deny the entity's request for module access."}
            </DialogDescription>
          </DialogHeader>
          
          {reviewDialog.request && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = moduleIcons[reviewDialog.request.module];
                    return (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${moduleBgColors[reviewDialog.request.module]}`}>
                        <Icon className={`h-5 w-5 ${moduleColors[reviewDialog.request.module]}`} />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="font-medium">{moduleNames[reviewDialog.request.module]}</p>
                    <p className="text-sm text-muted-foreground">
                      Requested by {reviewDialog.request.requestedByName}
                    </p>
                  </div>
                </div>
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
              onClick={() => setReviewDialog({ open: false, request: null, action: null })}
            >
              Cancel
            </Button>
            <Button 
              variant={reviewDialog.action === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending ? "Processing..." : (
                reviewDialog.action === "approve" ? "Approve Access" : "Reject Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
