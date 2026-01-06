import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RAGBadge, ApprovalBadge } from "@/components/rag-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Search,
  Filter,
  Upload,
  MoreVertical,
  Eye,
  Download,
  Archive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  History,
  MessageSquare,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Document, DocumentType, DocumentVersion, AuditLog } from "@shared/schema";

const documentTypeLabels: Record<DocumentType, string> = {
  policy: "Policy",
  risk_assessment: "Risk Assessment",
  audit: "Audit",
  assessment: "Assessment",
  compliance: "Compliance",
  incident_log: "Incident Log",
  checklist: "Checklist",
  template: "Template",
};

function DocumentsListView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus && !doc.isArchived;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage compliance documents and approvals
          </p>
        </div>
        <Button asChild>
          <Link href="/documents/upload" data-testid="button-upload-document">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-documents"
              />
            </div>
            <div className="flex gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-document-type">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-document-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="review_required">Review Required</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDocuments && filteredDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id} className="hover-elevate" data-testid={`row-document-${doc.id}`}>
                    <TableCell>
                      <Link href={`/documents/${doc.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            v{doc.version} • {doc.fileName}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {documentTypeLabels[doc.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RAGBadge status={doc.status} />
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge status={doc.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.updatedAt && format(new Date(doc.updatedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${doc.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/documents/${doc.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first document to get started"}
              </p>
              {!searchQuery && typeFilter === "all" && statusFilter === "all" && (
                <Button className="mt-4" asChild>
                  <Link href="/documents/upload">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "changes">("approve");

  const { data: document, isLoading } = useQuery<Document>({
    queryKey: ["/api/documents", id],
  });

  const { data: versions } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", id, "versions"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/documents", id, "audit"],
  });

  const approvalMutation = useMutation({
    mutationFn: async (data: { action: string; feedback?: string }) => {
      return apiRequest("POST", `/api/documents/${id}/approval`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id, "audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowApprovalDialog(false);
      setFeedback("");
      toast({
        title: "Success",
        description: `Document has been ${approvalAction === "approve" ? "approved" : approvalAction === "reject" ? "rejected" : "returned for changes"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document approval status",
        variant: "destructive",
      });
    },
  });

  const handleApproval = () => {
    approvalMutation.mutate({ action: approvalAction, feedback });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-semibold">Document not found</h2>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">{document.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{documentTypeLabels[document.type]}</Badge>
              <RAGBadge status={document.status} />
              <ApprovalBadge status={document.approvalStatus} />
              <span className="text-sm text-muted-foreground">Version {document.version}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          {document.approvalStatus === "pending" && (
            <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-review">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Review Document</DialogTitle>
                  <DialogDescription>
                    Provide your feedback and approval decision for this document.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-3">
                    <Button
                      variant={approvalAction === "approve" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("approve")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant={approvalAction === "changes" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("changes")}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Request Changes
                    </Button>
                    <Button
                      variant={approvalAction === "reject" ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => setApprovalAction("reject")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Feedback</label>
                    <Textarea
                      placeholder="Add your comments or feedback..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="mt-2"
                      data-testid="textarea-feedback"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleApproval} 
                    disabled={approvalMutation.isPending}
                    data-testid="button-submit-review"
                  >
                    {approvalMutation.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {document.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                  <p className="mt-1">{document.description}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">File Name</h4>
                  <p className="mt-1 font-mono text-sm">{document.fileName}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">File Size</h4>
                  <p className="mt-1">{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                  <p className="mt-1">
                    {document.createdAt && format(new Date(document.createdAt), "PPP")}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Last Modified</h4>
                  <p className="mt-1">
                    {document.updatedAt && format(new Date(document.updatedAt), "PPP")}
                  </p>
                </div>
                {document.reviewDate && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Review Date</h4>
                    <p className="mt-1">{format(new Date(document.reviewDate), "PPP")}</p>
                  </div>
                )}
                {document.expiryDate && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Expiry Date</h4>
                    <p className="mt-1">{format(new Date(document.expiryDate), "PPP")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions && versions.length > 0 ? (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-4 rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          v{version.version}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{version.fileName}</p>
                          {version.changeNote && (
                            <p className="text-sm text-muted-foreground">{version.changeNote}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {version.createdAt && formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No version history available
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="relative space-y-4">
                  <div className="absolute bottom-0 left-3 top-0 w-px bg-border" />
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative pl-8">
                      <div className="absolute left-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background">
                        {log.action.includes("approved") ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : log.action.includes("rejected") ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : log.action.includes("comment") ? (
                          <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{log.userName}</span>{" "}
                          <span className="text-muted-foreground">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </p>
                        {log.details && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{log.details}</p>
                        )}
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No activity recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Documents() {
  const [matchList] = useRoute("/documents");
  const [, params] = useRoute("/documents/:id");

  if (params?.id && params.id !== "upload") {
    return <DocumentDetailView id={params.id} />;
  }

  return <DocumentsListView />;
}
