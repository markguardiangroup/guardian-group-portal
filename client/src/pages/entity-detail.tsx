import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  UserCog,
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Star,
  Crown,
  MessageSquare,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Entity, Site, User, ConsultantAssignment, EntityModuleAccess, ModuleAccessRequest } from "@shared/schema";

type ModuleStatus = "active" | "visible" | "hidden";

interface ConsultantWithDetails extends ConsultantAssignment {
  consultantName: string;
  consultantEmail: string;
  consultantTier: string | null;
}

interface UserWithoutPassword {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  entityId: string | null;
  status: string;
  consultantTier: string | null;
  clientPermissionRole: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const moduleLabels: Record<string, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
};

const statusColors: Record<ModuleStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  visible: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  hidden: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<ModuleStatus, string> = {
  active: "Active",
  visible: "Visible",
  hidden: "Hidden",
};

function OverviewTab({ entity, sites }: { entity: Entity; sites: Site[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Company Name</p>
              <p className="font-medium">{entity.name}</p>
            </div>
            {entity.companyNumber && (
              <div>
                <p className="text-sm text-muted-foreground">Company Number</p>
                <p className="font-medium">{entity.companyNumber}</p>
              </div>
            )}
            {entity.address && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{entity.address}</p>
              </div>
            )}
            {entity.contactEmail && (
              <div>
                <p className="text-sm text-muted-foreground">Contact Email</p>
                <p className="font-medium">{entity.contactEmail}</p>
              </div>
            )}
            {entity.contactPhone && (
              <div>
                <p className="text-sm text-muted-foreground">Contact Phone</p>
                <p className="font-medium">{entity.contactPhone}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Sites ({sites.length})</CardTitle>
            <CardDescription>Physical locations for this entity</CardDescription>
          </div>
          <Button size="sm" data-testid="button-add-site">
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sites registered for this entity.</p>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                  data-testid={`site-${site.id}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{site.name}</p>
                    {site.address && (
                      <p className="text-sm text-muted-foreground">{site.address}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {site.siteManager && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {site.siteManager}
                        </span>
                      )}
                      {site.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {site.contactPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConsultantsTab({ entityId }: { entityId: string }) {
  const { toast } = useToast();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<ConsultantWithDetails[]>({
    queryKey: ["/api/entities", entityId, "consultants"],
  });

  const { data: allConsultants = [], isLoading: consultantsLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/consultants"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ consultantId, isPrimary }: { consultantId: string; isPrimary: boolean }) => {
      const response = await apiRequest("POST", `/api/entities/${entityId}/consultants`, {
        consultantId,
        isPrimary,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities", entityId, "consultants"] });
      toast({ title: "Consultant assigned successfully" });
      setIsAssignDialogOpen(false);
      setSelectedConsultantId("");
    },
    onError: () => {
      toast({ title: "Failed to assign consultant", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (consultantId: string) => {
      await apiRequest("DELETE", `/api/entities/${entityId}/consultants/${consultantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities", entityId, "consultants"] });
      toast({ title: "Consultant removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove consultant", variant: "destructive" });
    },
  });

  const availableConsultants = allConsultants.filter(
    (c) => !assignments.some((a) => a.consultantId === c.id)
  );

  if (assignmentsLoading || consultantsLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Assigned Consultants ({assignments.length})</CardTitle>
          <CardDescription>Consultants managing this entity's compliance</CardDescription>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-assign-consultant">
              <Plus className="mr-2 h-4 w-4" />
              Assign Consultant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Consultant</DialogTitle>
              <DialogDescription>
                Select a consultant to assign to this entity.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
                <SelectTrigger data-testid="select-consultant">
                  <SelectValue placeholder="Select a consultant" />
                </SelectTrigger>
                <SelectContent>
                  {availableConsultants.length === 0 ? (
                    <SelectItem value="none" disabled>No available consultants</SelectItem>
                  ) : (
                    availableConsultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} ({c.consultantTier || "Standard"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAssignDialogOpen(false)}
                data-testid="button-cancel-assign"
              >
                Cancel
              </Button>
              <Button
                onClick={() => assignMutation.mutate({ consultantId: selectedConsultantId, isPrimary: false })}
                disabled={!selectedConsultantId || assignMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No consultants assigned to this entity.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`consultant-${assignment.consultantId}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {assignment.consultantName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{assignment.consultantName}</p>
                      {assignment.isPrimary && (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{assignment.consultantEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {assignment.consultantTier || "Standard"}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        data-testid={`button-remove-consultant-${assignment.consultantId}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Consultant</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {assignment.consultantName} from this entity?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMutation.mutate(assignment.consultantId)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsersTab({ entityId }: { entityId: string }) {
  const { data: users = [], isLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/entities", entityId, "users"],
  });

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    approver: "Approver",
    editor: "Editor",
    viewer: "Viewer",
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Client Users ({users.length})</CardTitle>
          <CardDescription>Users with access to this entity's portal</CardDescription>
        </div>
        <Button size="sm" data-testid="button-add-user">
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users registered for this entity.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md border p-3"
                data-testid={`user-${user.id}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {roleLabels[user.clientPermissionRole || ""] || "Viewer"}
                  </Badge>
                  <Badge
                    variant={user.status === "active" ? "secondary" : "outline"}
                    className={user.status === "active" ? "bg-emerald-500/10 text-emerald-600" : ""}
                  >
                    {user.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModuleAccessTab({ entityId }: { entityId: string }) {
  const { toast } = useToast();

  const { data: moduleAccess = [], isLoading } = useQuery<EntityModuleAccess[]>({
    queryKey: ["/api/entities", entityId, "module-access"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ module, status }: { module: string; status: string }) => {
      const response = await apiRequest("POST", `/api/entities/${entityId}/module-access`, {
        module,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entities", entityId, "module-access"] });
      toast({ title: "Module access updated" });
    },
    onError: () => {
      toast({ title: "Failed to update module access", variant: "destructive" });
    },
  });

  const modules = ["health_safety", "human_resources", "employment_law"];

  const getModuleStatus = (module: string): ModuleStatus => {
    const access = moduleAccess.find((a) => a.module === module);
    return (access?.status as ModuleStatus) || "hidden";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module Access</CardTitle>
        <CardDescription>Control which modules this entity can access</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {modules.map((module) => {
            const status = getModuleStatus(module);
            return (
              <div
                key={module}
                className="flex items-center justify-between rounded-md border p-4"
                data-testid={`module-access-${module}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{moduleLabels[module]}</p>
                    <p className="text-sm text-muted-foreground">
                      {status === "active"
                        ? "Full access to all features"
                        : status === "visible"
                        ? "Can request access"
                        : "Not available"}
                    </p>
                  </div>
                </div>
                <Select
                  value={status}
                  onValueChange={(value) => updateMutation.mutate({ module, status: value })}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className="w-[130px]" data-testid={`select-module-${module}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                        Active
                      </span>
                    </SelectItem>
                    <SelectItem value="visible">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        Visible
                      </span>
                    </SelectItem>
                    <SelectItem value="hidden">
                      <span className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                        Hidden
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceTab({ entityId }: { entityId: string }) {
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", { entityId }],
  });

  const compliantDocs = documents.filter((d) => d.status === "compliant").length;
  const reviewDocs = documents.filter((d) => d.status === "review_required").length;
  const overdueDocs = documents.filter((d) => d.status === "overdue").length;
  const totalDocs = documents.length;
  const complianceScore = totalDocs > 0 ? Math.round((compliantDocs / totalDocs) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Compliance Score</span>
              <span className="text-2xl font-bold">{complianceScore}%</span>
            </div>
            <Progress value={complianceScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compliantDocs}</p>
                <p className="text-sm text-muted-foreground">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewDocs}</p>
                <p className="text-sm text-muted-foreground">Review Required</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueDocs}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessRequestsTab({ entityId }: { entityId: string }) {
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<ModuleAccessRequest[]>({
    queryKey: ["/api/module-access-requests", { entityId }],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const response = await apiRequest("PATCH", `/api/module-access-requests/${id}`, {
        status,
        notes,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/module-access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entities", entityId, "module-access"] });
      toast({ title: `Request ${variables.status}` });
    },
    onError: () => {
      toast({ title: "Failed to review request", variant: "destructive" });
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const reviewedRequests = requests.filter((r) => r.status !== "pending");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-600 border-red-200">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Requests ({pendingRequests.length})</CardTitle>
          <CardDescription>Module access requests awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending access requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-md border p-4"
                  data-testid={`request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                        <MessageSquare className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium">{moduleLabels[request.module]}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Requested by {request.requestedByName}
                        </p>
                        {request.reason && (
                          <p className="mt-2 text-sm">{request.reason}</p>
                        )}
                        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reviewMutation.mutate({ id: request.id, status: "rejected" })}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-reject-${request.id}`}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => reviewMutation.mutate({ id: request.id, status: "approved" })}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-approve-${request.id}`}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {reviewedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request History ({reviewedRequests.length})</CardTitle>
            <CardDescription>Previously reviewed requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reviewedRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-md border p-3"
                  data-testid={`request-history-${request.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{moduleLabels[request.module]}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.requestedByName} • Reviewed by {request.reviewedByName}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function EntityDetail() {
  const params = useParams<{ entityId: string }>();
  const [, navigate] = useLocation();
  const entityId = params.entityId;

  const { data: entity, isLoading: entityLoading } = useQuery<Entity>({
    queryKey: ["/api/entities", entityId],
    enabled: !!entityId,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/entities", entityId, "sites"],
    enabled: !!entityId,
  });

  if (entityLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="mb-4 h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Entity Not Found</h2>
          <p className="mt-2 text-muted-foreground">The entity you're looking for doesn't exist.</p>
          <Button className="mt-4" onClick={() => navigate("/entities")}>
            Back to Entities
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/entities")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{entity.name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {entity.companyNumber && <span>#{entity.companyNumber}</span>}
              <Badge variant={entity.status === "active" ? "secondary" : "outline"}>
                {entity.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Building2 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="consultants" data-testid="tab-consultants">
            <UserCog className="mr-2 h-4 w-4" />
            Consultants
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="module-access" data-testid="tab-module-access">
            <Shield className="mr-2 h-4 w-4" />
            Module Access
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <FileText className="mr-2 h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="access-requests" data-testid="tab-access-requests">
            <MessageSquare className="mr-2 h-4 w-4" />
            Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab entity={entity} sites={sites} />
        </TabsContent>

        <TabsContent value="consultants">
          <ConsultantsTab entityId={entityId!} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab entityId={entityId!} />
        </TabsContent>

        <TabsContent value="module-access">
          <ModuleAccessTab entityId={entityId!} />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceTab entityId={entityId!} />
        </TabsContent>

        <TabsContent value="access-requests">
          <AccessRequestsTab entityId={entityId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
