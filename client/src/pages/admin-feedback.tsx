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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Loader2, MessageSquare, Trash2, StickyNote } from "lucide-react";
import { useState } from "react";

export default function AdminFeedback() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);

  const { data: feedbackList, isLoading } = useQuery<Feedback[]>({
    queryKey: ["/api/feedback"],
    enabled: user?.role === "admin",
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

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>All Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Admin Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackList?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{item.userName}</TableCell>
                      <TableCell className="max-w-md truncate" title={item.message}>
                        {item.message}
                      </TableCell>
                      <TableCell className="max-w-xs truncate italic text-muted-foreground">
                        {item.adminNotes || "No notes"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
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
                              <DialogDescription>
                                Add internal notes for this feedback item.
                              </DialogDescription>
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
                                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                            if (confirm("Are you sure you want to delete this feedback?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          data-testid={`button-delete-feedback-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {feedbackList?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No feedback found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
