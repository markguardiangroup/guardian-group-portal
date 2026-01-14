import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ClipboardList,
  Search,
  FileCheck,
  Calendar,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Shield,
  Download,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Checklist {
  id: string;
  title: string;
  category: string;
  siteId: string;
  companyName: string;
  siteName?: string;
  assignedTo: string;
  assignedToName: string;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  totalItems: number;
  completedItems: number;
  dueDate: string;
  completedAt?: string;
}

const mockChecklists: Checklist[] = [
  {
    id: "1",
    title: "Monthly Fire Safety Inspection",
    category: "Fire Safety",
    siteId: "1",
    companyName: "Acme Corporation",
    siteName: "Head Office",
    assignedTo: "user1",
    assignedToName: "John Smith",
    status: "in_progress",
    progress: 65,
    totalItems: 20,
    completedItems: 13,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    title: "Weekly Workplace Hazard Check",
    category: "General Safety",
    siteId: "2",
    companyName: "Acme Corporation",
    siteName: "Warehouse",
    assignedTo: "user2",
    assignedToName: "Sarah Jones",
    status: "completed",
    progress: 100,
    totalItems: 15,
    completedItems: 15,
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    title: "Annual COSHH Assessment Checklist",
    category: "COSHH",
    siteId: "3",
    companyName: "TechStart Ltd",
    assignedTo: "user3",
    assignedToName: "Mike Wilson",
    status: "not_started",
    progress: 0,
    totalItems: 30,
    completedItems: 0,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    title: "First Aid Equipment Check",
    category: "First Aid",
    siteId: "1",
    companyName: "Acme Corporation",
    siteName: "Head Office",
    assignedTo: "user1",
    assignedToName: "John Smith",
    status: "not_started",
    progress: 0,
    totalItems: 12,
    completedItems: 0,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function ChecklistCard({ checklist }: { checklist: Checklist }) {
  const statusConfig = {
    not_started: {
      label: "Not Started",
      icon: Clock,
      className: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
    },
    in_progress: {
      label: "In Progress",
      icon: AlertCircle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    },
    completed: {
      label: "Completed",
      icon: CheckCircle,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    },
  };

  const { label, icon: Icon, className } = statusConfig[checklist.status];
  const isOverdue = new Date(checklist.dueDate) < new Date() && checklist.status !== "completed";

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-module-accent/10">
              <ClipboardList className="h-6 w-6 text-module-accent" />
            </div>
            <div>
              <h3 className="font-semibold">{checklist.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{checklist.category}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {checklist.companyName}
                  {checklist.siteName && ` - ${checklist.siteName}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5" />
                  {checklist.completedItems}/{checklist.totalItems} items
                </span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className={className}>
            <Icon className="mr-1.5 h-3 w-3" />
            {label}
          </Badge>
        </div>

        {checklist.status !== "completed" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{checklist.progress}%</span>
            </div>
            <Progress value={checklist.progress} className="h-2 [&>div]:bg-module-accent" />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {checklist.status === "completed" ? (
              <span className="text-muted-foreground">
                Completed {checklist.completedAt && formatDistanceToNow(new Date(checklist.completedAt), { addSuffix: true })}
              </span>
            ) : (
              <span className={isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                Due {format(new Date(checklist.dueDate), "MMM d, yyyy")}
                {isOverdue && " (Overdue)"}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-module-accent hover:text-module-accent">
            {checklist.status === "completed" ? "View Results" : "Continue"}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HSChecklists() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const checklists = mockChecklists;

  const filteredChecklists = checklists?.filter((checklist) => {
    const matchesSearch = checklist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      checklist.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || checklist.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: checklists?.length || 0,
    notStarted: checklists?.filter((c) => c.status === "not_started").length || 0,
    inProgress: checklists?.filter((c) => c.status === "in_progress").length || 0,
    completed: checklists?.filter((c) => c.status === "completed").length || 0,
  };

  return (
    <div className="theme-hs">
      <div className="border-t-4 border-t-module-accent bg-module-accent-subtle">
        <div className="p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-module-accent/20">
                <ClipboardList className="h-6 w-6 text-module-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Checklists & Templates</h1>
                <p className="text-muted-foreground">
                  Complete pre-defined safety checklists and inspection templates
                </p>
              </div>
            </div>
            <Button className="bg-module-accent hover:bg-module-accent/90" data-testid="button-browse-templates">
              <Download className="mr-2 h-4 w-4" />
              Browse Templates
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-module-accent/10">
                <ClipboardList className="h-5 w-5 text-module-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-total-checklists">{stats.total}</p>
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
                <p className="text-2xl font-semibold" data-testid="text-not-started">{stats.notStarted}</p>
                <p className="text-sm text-muted-foreground">Not Started</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold" data-testid="text-in-progress">{stats.inProgress}</p>
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
                <p className="text-2xl font-semibold" data-testid="text-completed">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search checklists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-checklists"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {["all", "not_started", "in_progress", "completed"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={statusFilter === status ? "bg-module-accent hover:bg-module-accent/90" : ""}
                data-testid={`filter-${status}`}
              >
                {status === "all" ? "All" : status === "not_started" ? "Not Started" : status === "in_progress" ? "In Progress" : "Completed"}
              </Button>
            ))}
          </div>
        </div>

        {filteredChecklists && filteredChecklists.length > 0 ? (
          <div className="space-y-4">
            {filteredChecklists.map((checklist) => (
              <ChecklistCard key={checklist.id} checklist={checklist} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No checklists found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Browse templates to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button className="mt-4 bg-module-accent hover:bg-module-accent/90">
                  <Download className="mr-2 h-4 w-4" />
                  Browse Templates
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
