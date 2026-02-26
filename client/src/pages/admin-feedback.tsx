import { useQuery, useMutation } from "@tanstack/react-query";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, MessageSquare, Trash2, StickyNote, ThumbsUp, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function AdminFeedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
    enabled: !!user && (user.role === "admin" || user.role === "consultant"),
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

  const upvoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/feedback/${id}/upvote`);
      return res.json();
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, adminNotes }: { id: string; adminNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/feedback/${id}`, { adminNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      setEditingNotes(null);
      toast({ title: "Notes updated" });
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

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

  if (!isAdmin && !isConsultant) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators and consultants can access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          Internal feedback and collaboration for the Guardian Group team.
        </p>
      </div>

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
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {feedbackList?.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{item.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex items-center gap-1.5",
                            item.upvotes?.includes(user?.id || "") && "bg-primary/10 border-primary"
                          )}
                          onClick={() => upvoteMutation.mutate(item.id)}
                          data-testid={`button-upvote-${item.id}`}
                        >
                          <ThumbsUp className="h-4 w-4" />
                          <span>{item.upvotes?.length || 0}</span>
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex items-center gap-1.5"
                              onClick={() => setActiveFeedbackId(item.id)}
                              data-testid={`button-comments-${item.id}`}
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>Comments</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Comments</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                              {comments?.map((comment) => (
                                <div key={comment.id} className="bg-muted p-3 rounded-lg space-y-1">
                                  <div className="flex justify-between items-start">
                                    <span className="font-semibold text-sm">{comment.userName}</span>
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
                                  <p className="text-sm">{comment.content}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(new Date(comment.createdAt), "HH:mm, dd MMM")}
                                  </p>
                                </div>
                              ))}
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
                                {addCommentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Post Comment
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {isAdmin && (
                          <>
                            <Dialog open={editingNotes?.id === item.id} onOpenChange={(open) => !open && setEditingNotes(null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setEditingNotes({ id: item.id, notes: item.adminNotes || "" })}
                                  data-testid={`button-edit-feedback-${item.id}`}
                                >
                                  <StickyNote className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Admin Notes</DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                  <Textarea 
                                    value={editingNotes?.notes}
                                    onChange={(e) => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
                                    placeholder="Add internal notes..."
                                    className="min-h-[100px]"
                                  />
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setEditingNotes(null)}>Cancel</Button>
                                  <Button 
                                    onClick={() => updateMutation.mutate({ id: item.id, adminNotes: editingNotes?.notes || "" })}
                                    disabled={updateMutation.isPending}
                                  >
                                    Save Notes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
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
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                    {item.adminNotes && (
                      <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-xs font-semibold text-primary mb-1">Admin Response:</p>
                        <p className="text-sm italic">{item.adminNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {feedbackList?.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No feedback found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
