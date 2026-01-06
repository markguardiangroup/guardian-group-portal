import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, SupportStatusBadge } from "@/components/rag-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  HelpCircle,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { SupportRequest, SupportPriority, SupportStatus } from "@shared/schema";

const supportRequestSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1, "Please select a category"),
});

type SupportRequestForm = z.infer<typeof supportRequestSchema>;

const categories = [
  "General Inquiry",
  "Document Issue",
  "Compliance Question",
  "Technical Support",
  "Account Management",
  "Feature Request",
  "Other",
];

function CreateSupportRequestDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<SupportRequestForm>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "medium",
      category: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SupportRequestForm) => {
      return apiRequest("POST", "/api/support-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Request Submitted",
        description: "Your support request has been submitted successfully.",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit support request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SupportRequestForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-request">
          <Plus className="mr-2 h-4 w-4" />
          New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Support Request</DialogTitle>
          <DialogDescription>
            Submit a request and our team will respond as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief summary of your request" {...field} data-testid="input-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide details about your request..."
                      className="min-h-32"
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-request">
                {mutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SupportRequestCard({ request }: { request: SupportRequest }) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
            {request.status === "resolved" || request.status === "closed" ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : request.priority === "urgent" || request.priority === "high" ? (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium">{request.subject}</h4>
                <p className="mt-0.5 text-sm text-muted-foreground">{request.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={request.priority} />
                <SupportStatusBadge status={request.status} />
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {request.description}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created {request.createdAt && formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
              </span>
              {request.resolvedAt && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  Resolved {formatDistanceToNow(new Date(request.resolvedAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Support() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: requests, isLoading } = useQuery<SupportRequest[]>({
    queryKey: ["/api/support-requests"],
  });

  const filteredRequests = requests?.filter((req) => {
    const matchesSearch =
      req.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "open") return matchesSearch && (req.status === "open" || req.status === "in_progress");
    if (activeTab === "resolved") return matchesSearch && (req.status === "resolved" || req.status === "closed");
    return matchesSearch;
  });

  const openCount = requests?.filter((r) => r.status === "open" || r.status === "in_progress").length || 0;
  const resolvedCount = requests?.filter((r) => r.status === "resolved" || r.status === "closed").length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Support</h1>
          <p className="mt-1 text-muted-foreground">
            Get help from the Guardian Group team
          </p>
        </div>
        <CreateSupportRequestDialog onSuccess={() => {}} />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{requests?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{openCount}</p>
              <p className="text-sm text-muted-foreground">Open Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="open" data-testid="tab-open">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="resolved" data-testid="tab-resolved">Resolved ({resolvedCount})</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-requests"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {filteredRequests && filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <SupportRequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <HelpCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">No requests found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Create your first support request to get help"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
