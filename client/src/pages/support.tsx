import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, SupportStatusBadge } from "@/components/rag-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  HelpCircle,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  MapPin,
  Building2,
  User,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { SupportRequest, SupportPriority, SupportStatus } from "@shared/schema";

interface SiteWithDetails {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
}

interface Company {
  id: string;
  name: string;
}

interface SupportRequestWithNames extends SupportRequest {
  createdByName: string;
  respondedByName: string | null;
  unreadCount: number;
  latestMessage: {
    message: string;
    senderName: string;
    createdAt: string;
  } | null;
}

const supportRequestSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1, "Please select a category"),
  siteId: z.string().min(1, "Please select a site"),
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

function CreateSupportRequestDialog({ sites, onSuccess }: { sites: SiteWithDetails[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<SupportRequestForm>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "medium",
      category: "",
      siteId: sites.length === 1 ? sites[0].id : "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SupportRequestForm) => {
      return apiRequest("POST", "/api/support-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests/counts"] });
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
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-site">
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} ({site.companyName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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

function InlineStatusSelect({ request }: { request: SupportRequest }) {
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<"open" | "in_progress" | "resolved" | "closed">(request.status);
  const [pendingStatus, setPendingStatus] = useState<"open" | "in_progress" | "resolved" | "closed" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const statusLabels: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  const mutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/support-requests/${request.id}`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests/counts"] });
      toast({
        title: "Status Updated",
        description: "The ticket status has been changed.",
      });
    },
    onError: () => {
      setCurrentStatus(request.status);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: "open" | "in_progress" | "resolved" | "closed") => {
    if (newStatus !== currentStatus) {
      setPendingStatus(newStatus);
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmStatusChange = () => {
    if (pendingStatus) {
      setCurrentStatus(pendingStatus);
      mutation.mutate(pendingStatus);
    }
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  const handleCancelStatusChange = () => {
    setShowConfirmDialog(false);
    setPendingStatus(null);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={currentStatus} onValueChange={handleStatusChange} disabled={mutation.isPending}>
          <SelectTrigger className="w-[140px] h-8" data-testid={`select-status-${request.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {mutation.isPending && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change the ticket status from "{statusLabels[currentStatus]}" to "{pendingStatus ? statusLabels[pendingStatus] : ''}"?
              {pendingStatus === "closed" && (
                <span className="block mt-2 font-medium text-foreground">
                  Closing this ticket will mark it as complete.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelStatusChange} data-testid="button-cancel-status-change">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatusChange} data-testid="button-confirm-status-change">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MessageWithSender {
  id: string;
  requestId: string;
  senderId: string;
  message: string;
  createdAt: Date;
  senderName: string;
  senderRole: string;
}

function ConversationThread({ requestId, isOpen }: { requestId: string; isOpen: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");

  const { data: messages = [], isLoading, refetch } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/support-requests", requestId, "messages"],
    queryFn: async () => {
      const response = await fetch(`/api/support-requests/${requestId}/messages`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 10000 : false,
    staleTime: 0, // Always fetch fresh messages
    refetchOnMount: "always",
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/support-requests/${requestId}/messages`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support-requests/counts"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  if (isLoading) {
    return <FetchingOverlay />;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Conversation ({messages.length} {messages.length === 1 ? "message" : "messages"})
      </h4>

      {messages.length === 0 ? (
        <div className="rounded-md bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          No messages yet. Start the conversation below.
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {messages.map((msg) => {
            const isOwnMessage = msg.senderId === user?.id;
            const isStaff = msg.senderRole === "developer" || msg.senderRole === "consultant" || msg.senderRole === "administrator";
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    isOwnMessage
                      ? "bg-primary text-primary-foreground"
                      : isStaff
                      ? "bg-muted border-l-4 border-primary"
                      : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {msg.senderName}
                    </span>
                    {isStaff && !isOwnMessage && (
                      <Badge variant="secondary" className="text-xs py-0 px-1">
                        Staff
                      </Badge>
                    )}
                    <span className={`text-xs ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="min-h-20 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          data-testid="input-message"
        />
        <Button
          onClick={handleSend}
          disabled={!newMessage.trim() || sendMutation.isPending}
          className="self-end"
          data-testid="button-send-message"
        >
          {sendMutation.isPending ? "..." : "Send"}
        </Button>
      </div>
    </div>
  );
}

function RequestDetailDialog({ request, site, canRespond }: { request: SupportRequestWithNames; site?: SiteWithDetails; canRespond: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="hover-elevate cursor-pointer" data-testid={`request-card-${request.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                {request.status === "resolved" || request.status === "closed" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : request.priority === "urgent" || request.priority === "high" ? (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                )}
                {request.unreadCount > 0 && (
                  <span 
                    className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground px-1"
                    data-testid={`badge-unread-${request.id}`}
                  >
                    {request.unreadCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className={`font-medium ${request.unreadCount > 0 ? "text-primary" : ""}`}>{request.subject}</h4>
                    <p className="mt-0.5 text-sm text-muted-foreground">{request.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={request.priority} />
                    <SupportStatusBadge status={request.status} />
                  </div>
                </div>
                {request.latestMessage ? (
                  <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      <span className="font-medium">{request.latestMessage.senderName}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(request.latestMessage.createdAt), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {request.latestMessage.message}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {request.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {request.createdByName}
                  </span>
                  {site && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {site.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {request.createdAt && formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              {request.status === "resolved" || request.status === "closed" ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : request.priority === "urgent" || request.priority === "high" ? (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <DialogTitle>{request.subject}</DialogTitle>
              <DialogDescription>{request.category}</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={request.priority} />
              {canRespond ? (
                <InlineStatusSelect request={request} />
              ) : (
                <SupportStatusBadge status={request.status} />
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            {site && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Site:</span>
                <span className="font-medium">{site.name}</span>
              </div>
            )}
            {site && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Company:</span>
                <span className="font-medium">{site.companyName}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">
                {request.createdAt && format(new Date(request.createdAt), "PPp")}
              </span>
            </div>
            {request.resolvedAt && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground">Resolved:</span>
                <span className="font-medium">
                  {format(new Date(request.resolvedAt), "PPp")}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Original Request</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{request.createdByName}</span>
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-4">
              <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </div>
          </div>

          <ConversationThread requestId={request.id} isOpen={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupportRequestCard({ request, sites, canRespond }: { request: SupportRequestWithNames; sites: SiteWithDetails[]; canRespond: boolean }) {
  const site = sites.find(s => s.id === request.siteId);
  
  return (
    <RequestDetailDialog request={request} site={site} canRespond={canRespond} />
  );
}

export default function Support() {
  const { user } = useAuth();
  // Support keeps its own remembered company/site filter ("support" scope) so
  // it neither affects nor is affected by other pages' filters.
  const { selectedCompany, selectedSiteId, setSelectedSiteId, handleCompanyChange } = useSiteFilter("support");
  const companyFilter = selectedCompany || "all";
  const siteFilter = selectedSiteId || "all";
  const setCompanyFilter = (val: string) => handleCompanyChange(val === "all" ? null : val);
  const setSiteFilter = (val: string) => setSelectedSiteId(val === "all" ? null : val);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const isPrivilegedUser = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter, coverageSitesUrl, coverageQueryKey, isProConsultant, proStaffFilter, setProStaffFilter, myStaff } = useCoverageFilter();

  const { data: sites = [], isLoading: sitesLoading } = useQuery<SiteWithDetails[]>({
    queryKey: coverageQueryKey,
    queryFn: coverageSitesUrl !== "/api/sites" ? async () => {
      const res = await fetch(coverageSitesUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    } : undefined,
  });

  const { data: companiesResponse } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies?limit=1000"],
    enabled: user?.role === "developer",
  });
  const companies = companiesResponse?.companies || [];

  const queryParams = new URLSearchParams();
  if (siteFilter !== "all") {
    queryParams.set("siteId", siteFilter);
  } else if (companyFilter !== "all") {
    queryParams.set("companyId", companyFilter);
  }

  const { data: requests, isLoading: requestsLoading } = useQuery<SupportRequestWithNames[]>({
    queryKey: ["/api/support-requests", siteFilter, companyFilter],
    queryFn: async () => {
      const response = await fetch(`/api/support-requests?${queryParams.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
    staleTime: 0, // Always refetch fresh data for support requests
    refetchOnMount: "always",
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

  const isLoading = sitesLoading || requestsLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 px-8 py-6 bg-background border-b">
        <div>
          <h1 className="text-3xl font-semibold">Support</h1>
          <p className="mt-1 text-muted-foreground">
            {isPrivilegedUser ? "Manage support requests from clients" : "Get help from the Guardian Group team"}
          </p>
        </div>
        {sites.length > 0 && <CreateSupportRequestDialog sites={sites} onSuccess={() => {}} />}
      </div>

      <div id="page-content" className="flex-1 overflow-auto px-8 pb-8 pt-6 space-y-6 dash-animate">

      {isPrivilegedUser && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          {user?.role === "developer" && companies.length > 0 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48" data-testid="filter-company">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-48" data-testid="filter-site">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites
                .filter(s => companyFilter === "all" || s.companyId === companyFilter)
                .map((site) => (
                  <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          {hasCoverage && (
            <Select
              value={coverageFilter}
              onValueChange={(v) => { setCoverageFilter(v); setCompanyFilter("all"); setSiteFilter("all"); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-support">
                <span className="truncate pointer-events-none">
                  {coverageFilter === "my"
                    ? "My client sites"
                    : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my">My client sites</SelectItem>
                {coveringFor.map(c => (
                  <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-support-${c.absentConsultantId}`}>
                    {c.absentConsultantName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isProConsultant && (
            <Select
              value={proStaffFilter}
              onValueChange={(v) => { setProStaffFilter(v); setCompanyFilter("all"); setSiteFilter("all"); }}
            >
              <SelectTrigger className="w-[205px] text-sm" data-testid="select-pro-staff-filter-support">
                <span className="truncate pointer-events-none">
                  {proStaffFilter === "my"
                    ? "My client sites"
                    : proStaffFilter === "all"
                      ? "All client sites"
                      : (myStaff.find(s => s.id === proStaffFilter)?.fullName ?? "Staff") + "'s client sites"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="my">My client sites</SelectItem>
                <SelectItem value="all">All client sites</SelectItem>
                {myStaff.map(s => (
                  <SelectItem key={s.id} value={s.id} data-testid={`pro-staff-filter-support-${s.id}`}>
                    {s.fullName}'s client sites
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setCompanyFilter("all"); setSiteFilter("all"); setSearchQuery(""); setCoverageFilter("my"); setProStaffFilter("my"); }}
            disabled={!(companyFilter !== "all" || siteFilter !== "all" || !!searchQuery || (hasCoverage && coverageFilter !== "my") || (isProConsultant && proStaffFilter !== "my"))}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            title="Clear filters"
            data-testid="button-clear-filters-support"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!isPrivilegedUser && sites.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by Site:</span>
          </div>
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="w-48" data-testid="filter-site-client">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSiteFilter("all"); setSearchQuery(""); }}
            disabled={!(siteFilter !== "all" || !!searchQuery)}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
            title="Clear filters"
            data-testid="button-clear-filters-support-client"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

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
          {isLoading ? (
            <FetchingOverlay />
          ) : filteredRequests && filteredRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <SupportRequestCard 
                  key={request.id} 
                  request={request} 
                  sites={sites}
                  canRespond={isPrivilegedUser}
                />
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
    </div>
  );
}
