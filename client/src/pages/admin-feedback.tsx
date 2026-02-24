import { useQuery, useMutation } from "@tanstack/react-query";
import { Feedback, InsertFeedback } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, MessageSquare, Trash2, StickyNote, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function AdminFeedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
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

  const likeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/feedback/${id}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
    },
  });

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Manage user feedback and notes." : "Submit feedback to the administrators."}
        </p>
      </div>

      {(isConsultant || isAdmin) && (
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
      )}

      {(isConsultant || isAdmin) && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : feedbackList?.map((item) => {
            const hasLiked = item.likes?.includes(user?.id || "");
            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">{item.userName}</CardTitle>
                    <CardDescription className="text-xs">
                      {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Dialog open={editingNotes?.id === item.id} onOpenChange={(open) => !open && setEditingNotes(null)}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setEditingNotes({ id: item.id, notes: item.adminNotes || "" })}
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
                              placeholder="Add notes here..."
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
                        className="h-8 w-8 text-destructive"
                        onClick={() => confirm("Delete this feedback?") && deleteMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                  {item.adminNotes && (
                    <div className="mt-4 p-2 bg-muted rounded text-xs italic">
                      <span className="font-semibold block not-italic">Admin Note:</span>
                      {item.adminNotes}
                    </div>
                  )}
                </CardContent>
                <div className="px-6 py-4 pt-0 border-t flex items-center justify-between mt-auto">
                  <Button
                    variant={hasLiked ? "default" : "outline"}
                    size="sm"
                    className="h-8 gap-2"
                    onClick={() => likeMutation.mutate(item.id)}
                    disabled={likeMutation.isPending}
                  >
                    <ThumbsUp className={cn("h-4 w-4", hasLiked && "fill-current")} />
                    <span>{item.likes?.length || 0}</span>
                  </Button>
                </div>
              </Card>
            );
          })}
          {!isLoading && feedbackList?.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No feedback found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
