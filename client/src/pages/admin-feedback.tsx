import { useQuery, useMutation } from "@tanstack/react-query";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { Feedback, FeedbackComment } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, MessageSquare, Trash2, ThumbsUp, MessageCircle, Circle, CheckCircle2, Search, Pencil, X, Check } from "lucide-react";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

type FeedbackWithMetadata = Feedback & { commentCount: number; hasUnreadComments: boolean };

export default function AdminFeedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit feedback state
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editingFeedbackMessage, setEditingFeedbackMessage] = useState("");

  // Edit comment state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");

  const { data: feedbackList, isLoading } = useQuery<FeedbackWithMetadata[]>({
    queryKey: ["/api/feedback"],
    enabled: !!user && (user.role === "developer" || user.role === "consultant" || user.role === "administrator"),
  });

  const { data: comments } = useQuery<FeedbackComment[]>({
    queryKey: ["/api/feedback", activeFeedbackId, "comments"],
    enabled: !!activeFeedbackId,
  });

  const createMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/feedback", { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setMessage("");
      toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
    },
  });

  const editFeedbackMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${id}`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setEditingFeedbackId(null);
      setEditingFeedbackMessage("");
      toast({ title: "Feedback updated" });
    },
    onError: () => {
      toast({ title: "Could not update feedback", variant: "destructive" });
    },
  });

  const editCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/feedback/comments/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback", activeFeedbackId, "comments"] });
      setEditingCommentId(null);
      setEditingCommentContent("");
      toast({ title: "Comment updated" });
    },
    onError: () => {
      toast({ title: "Could not update comment", variant: "destructive" });
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/feedback/${id}/upvote`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/feedback/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("POST", `/api/feedback/${id}/comments`, { content });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback", variables.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setCommentContent("");
    },
  });

  const likeCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await apiRequest("POST", `/api/feedback/comments/${commentId}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback", activeFeedbackId, "comments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/feedback/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({ title: "Feedback deleted" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "resolved" }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${id}`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      toast({ 
        title: data.status === "resolved" ? "Feedback resolved" : "Feedback reopened",
        description: data.status === "resolved" ? "The feedback has been marked as resolved." : "The feedback has been reopened."
      });
    },
  });

  const isDeveloper = user?.role === "developer";
  const isConsultant = user?.role === "consultant";

  const isAdmin = user?.role === "administrator";
  if (!isDeveloper && !isConsultant && !isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only developers and consultants can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleOpenComments = (id: string) => {
    setActiveFeedbackId(id);
    markReadMutation.mutate(id);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-6 bg-background border-b">
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          Internal feedback and collaboration for the Guardian Group team.
        </p>
      </div>
      <div id="page-content" className="flex-1 overflow-auto px-6 pb-6 pt-6 space-y-6 dash-animate">

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Submit New Feedback
          </CardTitle>
          <CardDescription>
            Share your thoughts, suggestions, or report issues during the testing period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="Type your feedback here..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-feedback-message"
          />
          <Button 
            onClick={() => createMutation.mutate(message)}
            disabled={!message.trim() || createMutation.isPending}
            data-testid="button-submit-feedback"
          >
            {createMutation.isPending && <img src={logoIcon} alt="" className="mr-2 h-4 w-4 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Recent Feedback</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[220px] h-9"
                data-testid="input-search-feedback"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "open" | "resolved")}>
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <FetchingOverlay />
          ) : (
            <div className="space-y-6">
              {feedbackList
                ?.filter(item => (item.status || "open") === statusFilter)
                .filter(item => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    item.message.toLowerCase().includes(q) ||
                    (item.userName || "").toLowerCase().includes(q)
                  );
                })
                .map((item) => {
                  const canEditFeedback =
                    item.userId === user?.id &&
                    (item.upvotes?.length ?? 0) === 0 &&
                    (item.commentCount ?? 0) === 0;
                  const isEditingThis = editingFeedbackId === item.id;

                  return (
                  <Card key={item.id} className={cn("border-l-4", item.hasUnreadComments ? "border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10" : "border-l-primary")}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2">
                          {item.hasUnreadComments && (
                            <Circle className="h-2 w-2 fill-blue-500 text-blue-500 mt-2 shrink-0" />
                          )}
                          <div>
                            <p className="font-semibold">{item.userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "flex items-center gap-1.5 h-8",
                              item.upvotes?.includes(user?.id || "") && "bg-primary/10 border-primary"
                            )}
                            onClick={() => upvoteMutation.mutate(item.id)}
                            data-testid={`button-upvote-${item.id}`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                            <span>({item.upvotes?.length || 0})</span>
                          </Button>
                          
                          <Dialog onOpenChange={(open) => {
                            if (!open) {
                              setActiveFeedbackId(null);
                              setEditingCommentId(null);
                              setEditingCommentContent("");
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={cn("flex items-center gap-1.5 h-8", item.hasUnreadComments && "border-blue-500 text-blue-600")}
                                onClick={() => handleOpenComments(item.id)}
                                data-testid={`button-comments-${item.id}`}
                              >
                                <MessageCircle className="h-4 w-4" />
                                <span>Comments ({item.commentCount || 0})</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                              <DialogHeader>
                                <DialogTitle>Comments ({item.commentCount || 0})</DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
                              <div className="rounded-md border-l-4 border-l-primary bg-muted/50 px-4 py-3 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground pb-1">
                                  {item.userName} &middot; {format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                              </div>
                                {comments?.map((comment) => {
                                  const isEditingComment = editingCommentId === comment.id;
                                  const canEditComment = comment.userId === user?.id;
                                  return (
                                    <div key={comment.id} className="bg-muted p-3 rounded-lg space-y-1">
                                      <div className="flex justify-between items-start">
                                        <span className="font-semibold text-sm">{comment.userName}</span>
                                        <div className="flex items-center gap-1">
                                          {canEditComment && !isEditingComment && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                              onClick={() => {
                                                setEditingCommentId(comment.id);
                                                setEditingCommentContent(comment.content);
                                              }}
                                              data-testid={`button-edit-comment-${comment.id}`}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                              "h-7 px-2 text-xs flex items-center gap-1",
                                              comment.likes?.includes(user?.id || "") && "text-primary"
                                            )}
                                            onClick={() => likeCommentMutation.mutate(comment.id)}
                                          >
                                            <ThumbsUp className="h-3 w-3" />
                                            {comment.likes?.length || 0}
                                          </Button>
                                        </div>
                                      </div>
                                      {isEditingComment ? (
                                        <div className="space-y-2 pt-1">
                                          <Textarea
                                            value={editingCommentContent}
                                            onChange={(e) => setEditingCommentContent(e.target.value)}
                                            className="min-h-[80px] text-sm"
                                            autoFocus
                                            data-testid={`textarea-edit-comment-${comment.id}`}
                                          />
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs"
                                              onClick={() => editCommentMutation.mutate({ id: comment.id, content: editingCommentContent })}
                                              disabled={!editingCommentContent.trim() || editCommentMutation.isPending}
                                              data-testid={`button-save-comment-${comment.id}`}
                                            >
                                              {editCommentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                              Save
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 text-xs"
                                              onClick={() => { setEditingCommentId(null); setEditingCommentContent(""); }}
                                              data-testid={`button-cancel-edit-comment-${comment.id}`}
                                            >
                                              <X className="h-3 w-3" />
                                              Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                                      )}
                                      <p className="text-[10px] text-muted-foreground">
                                        {format(new Date(comment.createdAt), "HH:mm, dd MMM")}
                                        {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                                          <span className="ml-1">(edited)</span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                })}
                                {comments?.length === 0 && (
                                  <p className="text-center text-muted-foreground py-4 text-sm">No comments yet.</p>
                                )}
                              </div>
                              <div className="pt-4 border-t flex gap-2">
                                <Textarea 
                                  placeholder="Add a comment..."
                                  value={commentContent}
                                  onChange={(e) => setCommentContent(e.target.value)}
                                  className="min-h-[80px]"
                                />
                              </div>
                              <DialogFooter>
                                <Button 
                                  onClick={() => addCommentMutation.mutate({ id: item.id, content: commentContent })}
                                  disabled={!commentContent.trim() || addCommentMutation.isPending}
                                >
                                  {addCommentMutation.isPending && <img src={logoIcon} alt="" className="mr-2 h-4 w-4 rounded-full object-cover animate-spin" style={{ animationDuration: "1.5s" }} />}
                                  Post Comment
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          {canEditFeedback && !isEditingThis && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingFeedbackId(item.id);
                                setEditingFeedbackMessage(item.message);
                              }}
                              title="Edit feedback"
                              data-testid={`button-edit-feedback-${item.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          {isDeveloper && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn((item.status || "open") === "resolved" ? "text-green-600" : "text-muted-foreground")}
                                onClick={() => resolveMutation.mutate({ 
                                  id: item.id, 
                                  status: (item.status || "open") === "resolved" ? "open" : "resolved" 
                                })}
                                title={(item.status || "open") === "resolved" ? "Reopen feedback" : "Mark as resolved"}
                                data-testid={`button-resolve-feedback-${item.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Are you sure?")) deleteMutation.mutate(item.id);
                                }}
                                data-testid={`button-delete-feedback-${item.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingFeedbackMessage}
                            onChange={(e) => setEditingFeedbackMessage(e.target.value)}
                            className="min-h-[100px] text-sm"
                            autoFocus
                            data-testid={`textarea-edit-feedback-${item.id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => editFeedbackMutation.mutate({ id: item.id, message: editingFeedbackMessage })}
                              disabled={!editingFeedbackMessage.trim() || editFeedbackMutation.isPending}
                              data-testid={`button-save-feedback-${item.id}`}
                            >
                              {editFeedbackMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setEditingFeedbackId(null); setEditingFeedbackMessage(""); }}
                              data-testid={`button-cancel-edit-feedback-${item.id}`}
                            >
                              <X className="mr-2 h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              {(() => {
                const filtered = feedbackList
                  ?.filter(item => (item.status || "open") === statusFilter)
                  .filter(item => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return item.message.toLowerCase().includes(q) || (item.userName || "").toLowerCase().includes(q);
                  });
                if (!filtered || filtered.length === 0) {
                  return (
                    <p className="text-center py-8 text-muted-foreground">
                      {searchQuery.trim() ? `No feedback matches "${searchQuery}".` : "No feedback found."}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
