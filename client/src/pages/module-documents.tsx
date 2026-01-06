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
  ArrowLeft,
  History,
  HardHat,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import type { Document, DocumentWithDetails, DocumentVersion, AuditLog, ModuleType } from "@shared/schema";
import { moduleConfig } from "@shared/schema";

interface ModuleDocumentsProps {
  module: ModuleType;
}

function ModuleDocumentsListView({ module }: { module: ModuleType }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";
  const ModuleIcon = module === "health_safety" ? HardHat : Users;
  const themeClass = module === "health_safety" ? "theme-hs" : "theme-hr";

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents/module", module],
  });

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus && !doc.isArchived;
  });

  const getDocTypeLabel = (type: string) => {
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

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
    <div className={`space-y-6 p-8 ${themeClass}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-module-accent-muted">
            <ModuleIcon className="h-5 w-5 text-module-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">{config.name} Documents</h1>
            <p className="text-muted-foreground">
              Manage {config.shortName} compliance documents
            </p>
          </div>
        </div>
        <Button className="bg-module-accent text-module-accent-foreground" asChild>
          <Link href={`${basePath}/documents/upload`} data-testid="button-upload-document">
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
                <SelectTrigger className="w-48" data-testid="select-document-type">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {config.documentTypes.map(({ value, label }) => (
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
                      <Link href={`${basePath}/documents/${doc.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            v{doc.version} - {doc.fileName}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {getDocTypeLabel(doc.type)}
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
                            <Link href={`${basePath}/documents/${doc.id}`}>
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
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No documents found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : `Upload your first ${config.shortName} document to get started`}
              </p>
              <Button className="mt-4" asChild>
                <Link href={`${basePath}/documents/upload`}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleDocumentDetailView({ id, module }: { id: string; module: ModuleType }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "changes">("approve");
  const [feedback, setFeedback] = useState("");

  const config = moduleConfig[module];
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";

  const { data: document, isLoading } = useQuery<DocumentWithDetails>({
    queryKey: ["/api/documents", id],
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
      queryClient.invalidateQueries({ queryKey: ["/api/documents/module", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", module] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
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

  const getDocTypeLabel = (type: string) => {
    const docType = config.documentTypes.find(dt => dt.value === type);
    return docType?.label || type.replace(/_/g, " ");
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold">Document not found</h2>
        <Button className="mt-4" asChild>
          <Link href={`${basePath}/documents`}>Back to Documents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`${basePath}/documents`} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{document.title}</h1>
          <p className="text-muted-foreground">
            Version {document.version} - {getDocTypeLabel(document.type)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RAGBadge status={document.status} />
          <ApprovalBadge status={document.approvalStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity</p>
                  <p>{document.entityName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Site</p>
                  <p>{document.siteName || "All Sites"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File</p>
                  <p>{document.fileName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">File Size</p>
                  <p>{(document.fileSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Review Date</p>
                  <p>{document.reviewDate ? format(new Date(document.reviewDate), "MMM d, yyyy") : "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Uploaded By</p>
                  <p>{document.uploadedByName || "Unknown"}</p>
                </div>
              </div>
              {document.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="mt-1">{document.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {document.approvalStatus === "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Actions</CardTitle>
                <CardDescription>Review and approve or reject this document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => { setApprovalAction("approve"); setShowApprovalDialog(true); }}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setApprovalAction("changes"); setShowApprovalDialog(true); }}
                    data-testid="button-request-changes"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Request Changes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => { setApprovalAction("reject"); setShowApprovalDialog(true); }}
                    data-testid="button-reject"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {auditLogs && auditLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Activity History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm">{log.details}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.userName} - {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" data-testid="button-download">
                <Download className="mr-2 h-4 w-4" />
                Download Document
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-upload-version">
                <Upload className="mr-2 h-4 w-4" />
                Upload New Version
              </Button>
            </CardContent>
          </Card>

          {document.versions && document.versions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {document.versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(version.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" ? "Approve Document" : 
               approvalAction === "reject" ? "Reject Document" : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve" 
                ? "This will mark the document as approved and compliant."
                : approvalAction === "reject"
                ? "This will reject the document. Please provide a reason."
                : "Please describe the changes required."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={approvalAction === "approve" ? "Optional comments..." : "Please provide details..."}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-24"
              data-testid="input-feedback"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApproval}
              disabled={approvalMutation.isPending}
              variant={approvalAction === "reject" ? "destructive" : "default"}
              data-testid="button-confirm-approval"
            >
              {approvalMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ModuleDocuments({ module }: ModuleDocumentsProps) {
  const basePath = module === "health_safety" ? "/health-safety" : "/human-resources";
  const [matchDetail, params] = useRoute(`${basePath}/documents/:id`);

  if (matchDetail && params?.id) {
    return <ModuleDocumentDetailView id={params.id} module={module} />;
  }

  return <ModuleDocumentsListView module={module} />;
}
