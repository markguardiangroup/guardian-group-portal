import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardCheck,
  Search,
  Plus,
  Calendar,
  User,
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Assessment {
  id: string;
  title: string;
  type: string;
  siteId: string;
  companyName: string;
  siteId?: string;
  siteName?: string;
  assignedTo: string;
  assignedToName: string;
  status: "pending" | "in_progress" | "completed";
  progress: number;
  dueDate: string;
  completedAt?: string;
  createdAt: string;
}

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const statusConfig = {
    pending: {
      label: "Pending",
      icon: Clock,
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
    in_progress: {
      label: "In Progress",
      icon: AlertTriangle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    completed: {
      label: "Completed",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
  };

  const { label, icon: Icon, className } = statusConfig[assessment.status];
  const isOverdue = new Date(assessment.dueDate) < new Date() && assessment.status !== "completed";

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">{assessment.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{assessment.type}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {assessment.companyName}
                  {assessment.siteName && ` - ${assessment.siteName}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {assessment.assignedToName}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className={className}>
            <Icon className="mr-1.5 h-3 w-3" />
            {label}
          </Badge>
        </div>

        {assessment.status === "in_progress" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{assessment.progress}%</span>
            </div>
            <Progress value={assessment.progress} className="h-2" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {assessment.status === "completed" ? (
              <span className="text-muted-foreground">
                Completed {assessment.completedAt && formatDistanceToNow(new Date(assessment.completedAt), { addSuffix: true })}
              </span>
            ) : (
              <span className={isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                Due {format(new Date(assessment.dueDate), "MMM d, yyyy")}
                {isOverdue && " (Overdue)"}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm">
            View Details
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Assessments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: assessments, isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  const filteredAssessments = assessments?.filter((assessment) => {
    const matchesSearch = assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assessment.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || assessment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: assessments?.length || 0,
    pending: assessments?.filter((a) => a.status === "pending").length || 0,
    inProgress: assessments?.filter((a) => a.status === "in_progress").length || 0,
    completed: assessments?.filter((a) => a.status === "completed").length || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-6 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8 dash-animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background -mx-8 px-8 pb-4">
        <div>
          <h1 className="text-3xl font-semibold">Assessments</h1>
          <p className="mt-1 text-muted-foreground">
            Manage risk assessments and audits
          </p>
        </div>
        <Button data-testid="button-new-assessment">
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500/10">
              <Clock className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-assessments"
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "in_progress", "completed"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              data-testid={`filter-${status}`}
            >
              {status === "all" ? "All" : status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {filteredAssessments && filteredAssessments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssessments.map((assessment) => (
            <AssessmentCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No assessments found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first assessment to get started"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                New Assessment
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
