import { useState, useRef, useEffect } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { markAlertSurfaceSeen } from "@/hooks/use-alert-counts";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import logoIcon from "@assets/IFRA_and_Guardian_Group_A4_1767695098725.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  FolderOpen,
  FolderPlus,
  Trash2,
  Download,
  Users,
  ChevronLeft,
  AlertTriangle,
  File,
  Loader2,
  UserPlus,
  X,
  Send,
  Plus,
} from "lucide-react";

interface IshareFolderWithMeta {
  id: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  recipientUserId: string;
  expiresAt: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
  creatorName: string;
  recipientName: string;
  recipientRole: string;
}

interface IshareWithUploader {
  id: string;
  folderId: string;
  uploadedByUserId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  description: string | null;
  expiresAt: string;
  createdAt: string;
  uploaderName: string;
}

interface FolderAccessWithUser {
  id: string;
  folderId: string;
  userId: string;
  grantedByUserId: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface PendingFile {
  file: File;
  description: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  objectPath?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const days = differenceInDays(new Date(expiresAt), new Date());
  if (days < 3) {
    return (
      <Badge variant="destructive" className="text-xs" data-testid="expiry-badge-critical">
        Expires {format(new Date(expiresAt), "d MMM yyyy")}
      </Badge>
    );
  }
  if (days < 7) {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" data-testid="expiry-badge-warning">
        Expires {format(new Date(expiresAt), "d MMM yyyy")}
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" data-testid="expiry-badge-ok">
      Expires {format(new Date(expiresAt), "d MMM yyyy")}
    </Badge>
  );
}

export default function IShare() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Opening iShare clears its unseen-alert badge.
  useEffect(() => {
    markAlertSurfaceSeen("ishare");
  }, []);

  const [selectedFolder, setSelectedFolder] = useState<IshareFolderWithMeta | null>(null);
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set());

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [recipientUserId, setRecipientUserId] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploadMoreOpen, setUploadMoreOpen] = useState(false);
  const [uploadMoreWarningShown, setUploadMoreWarningShown] = useState(false);
  const [moreFiles, setMoreFiles] = useState<PendingFile[]>([]);
  const [uploadingMore, setUploadingMore] = useState(false);

  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [accessFolder, setAccessFolder] = useState<IshareFolderWithMeta | null>(null);
  const [grantUserId, setGrantUserId] = useState<string>("");
  const [grantingAccess, setGrantingAccess] = useState(false);

  const [deleteFolder, setDeleteFolder] = useState<IshareFolderWithMeta | null>(null);
  const [deleteFile, setDeleteFile] = useState<IshareWithUploader | null>(null);

  const [downloadingZip, setDownloadingZip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreFileInputRef = useRef<HTMLInputElement>(null);

  const [folderListDragActive, setFolderListDragActive] = useState(false);
  const [folderViewDragActive, setFolderViewDragActive] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const folderListDragCount = useRef(0);
  const folderViewDragCount = useRef(0);
  const folderRowDragCounts = useRef<Record<string, number>>({});

  const isDeveloper = user?.role === "developer";
  const isAdministrator = user?.role === "administrator";
  const isConsultant = user?.role === "consultant";
  const canManageAny = isDeveloper || isAdministrator;

  const { data: folders = [], isLoading: foldersLoading } = useQuery<IshareFolderWithMeta[]>({
    queryKey: ["/api/ishare-folders"],
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<IshareWithUploader[]>({
    queryKey: ["/api/ishare-folders", selectedFolder?.id, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/ishare-folders/${selectedFolder!.id}/files`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: !!selectedFolder,
  });

  const { data: accessGrants = [] } = useQuery<FolderAccessWithUser[]>({
    queryKey: ["/api/ishare-folders", accessFolder?.id, "access"],
    queryFn: async () => {
      const res = await fetch(`/api/ishare-folders/${accessFolder!.id}/access`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch access");
      return res.json();
    },
    enabled: !!accessFolder,
  });

  const { data: grantableUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/ishare-folders", accessFolder?.id, "grantable-users"],
    queryFn: async () => {
      const res = await fetch(`/api/ishare-folders/${accessFolder!.id}/grantable-users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!accessFolder,
  });

  const { data: consultants = [] } = useQuery<User[]>({
    queryKey: ["/api/ishare/consultants"],
    enabled: createDialogOpen,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/ishare-folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders"] });
      toast({ title: "Folder deleted successfully" });
      setDeleteFolder(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete folder", description: err.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/ishares/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", selectedFolder?.id, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders"] });
      toast({ title: "File deleted" });
      setDeleteFile(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete file", description: err.message, variant: "destructive" });
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async ({ folderId, userId }: { folderId: string; userId: string }) => {
      const res = await apiRequest("POST", `/api/ishare-folders/${folderId}/access`, { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", accessFolder?.id, "access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", accessFolder?.id, "grantable-users"] });
      toast({ title: "Access granted" });
      setGrantUserId("");
      setGrantingAccess(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to grant access", description: err.message, variant: "destructive" });
      setGrantingAccess(false);
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async ({ folderId, userId }: { folderId: string; userId: string }) => {
      const res = await apiRequest("DELETE", `/api/ishare-folders/${folderId}/access/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", accessFolder?.id, "access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", accessFolder?.id, "grantable-users"] });
      toast({ title: "Access revoked" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to revoke access", description: err.message, variant: "destructive" });
    },
  });

  async function uploadFileToStorage(file: File): Promise<{ objectPath: string }> {
    const res = await fetch("/api/uploads/file", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      credentials: "include",
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Upload failed");
    }
    return res.json();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || []);
    const newItems: PendingFile[] = chosen.map((f) => ({
      file: f,
      description: "",
      progress: 0,
      status: "pending",
    }));
    setPendingFiles((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  function handleMoreFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || []);
    const newItems: PendingFile[] = chosen.map((f) => ({
      file: f,
      description: "",
      progress: 0,
      status: "pending",
    }));
    setMoreFiles((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  async function handleCreateFolder() {
    if (!folderName.trim()) {
      toast({ title: "Please enter a folder name", variant: "destructive" });
      return;
    }
    if (!recipientUserId) {
      toast({ title: "Please select a recipient", variant: "destructive" });
      return;
    }

    setCreatingFolder(true);
    try {
      const folderRes = await apiRequest("POST", "/api/ishare-folders", {
        name: folderName.trim(),
        description: folderDescription.trim() || null,
        recipientUserId,
      });
      if (!folderRes.ok) {
        const err = await folderRes.json();
        throw new Error(err.error || "Failed to create folder");
      }
      const folder = await folderRes.json();

      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i];
        setPendingFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 30 } : f))
        );
        try {
          const { objectPath } = await uploadFileToStorage(pf.file);
          await apiRequest("POST", "/api/ishares", {
            folderId: folder.id,
            fileName: pf.file.name,
            fileSize: pf.file.size,
            fileUrl: objectPath,
            description: pf.description || null,
          });
          setPendingFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f))
          );
        } catch {
          setPendingFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "error" } : f))
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders"] });
      toast({ title: "iShare folder created successfully" });
      resetCreateDialog();
    } catch (err: any) {
      toast({ title: "Failed to create folder", description: err.message, variant: "destructive" });
    } finally {
      setCreatingFolder(false);
    }
  }

  function resetCreateDialog() {
    setCreateDialogOpen(false);
    setCreateStep(1);
    setFolderName("");
    setFolderDescription("");
    setRecipientUserId("");
    setPendingFiles([]);
  }

  async function handleUploadMoreFiles() {
    if (!selectedFolder || moreFiles.length === 0) return;
    setUploadingMore(true);
    for (let i = 0; i < moreFiles.length; i++) {
      const pf = moreFiles[i];
      setMoreFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 30 } : f))
      );
      try {
        const { objectPath } = await uploadFileToStorage(pf.file);
        await apiRequest("POST", "/api/ishares", {
          folderId: selectedFolder.id,
          fileName: pf.file.name,
          fileSize: pf.file.size,
          fileUrl: objectPath,
          description: pf.description || null,
        });
        setMoreFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f))
        );
      } catch {
        setMoreFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "error" } : f))
        );
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", selectedFolder.id, "files"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders"] });
    toast({ title: "Files uploaded successfully" });
    setUploadMoreOpen(false);
    setMoreFiles([]);
    setUploadMoreWarningShown(false);
    setUploadingMore(false);
  }

  async function downloadSingleFile(file: IshareWithUploader) {
    const res = await fetch(`/api/ishares/${file.id}/download`, { credentials: "include" });
    if (!res.ok) {
      toast({ title: "Download failed", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadZip(fileIds?: string[]) {
    if (!selectedFolder) return;
    setDownloadingZip(true);
    try {
      const body: Record<string, any> = {};
      if (fileIds) body.fileIds = fileIds;
      const res = await fetch(`/api/ishare-folders/${selectedFolder.id}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast({ title: "Download failed", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedFolder.name}_files.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloadingZip(false);
    }
  }

  // ── Drag and drop ────────────────────────────────────────────────────────

  function handleFolderListDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    folderListDragCount.current++;
    setFolderListDragActive(true);
  }
  function handleFolderListDragLeave() {
    folderListDragCount.current--;
    if (folderListDragCount.current <= 0) {
      folderListDragCount.current = 0;
      setFolderListDragActive(false);
    }
  }
  function handleFolderListDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }
  function handleFolderListDrop(e: React.DragEvent) {
    e.preventDefault();
    folderListDragCount.current = 0;
    setFolderListDragActive(false);
    setDragOverFolderId(null);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    setPendingFiles(dropped.map((f) => ({ file: f, description: "", progress: 0, status: "pending" as const })));
    setCreateStep(1);
    setCreateDialogOpen(true);
  }

  function makeFolderRowHandlers(folder: IshareFolderWithMeta) {
    return {
      onDragEnter(e: React.DragEvent) {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        folderRowDragCounts.current[folder.id] = (folderRowDragCounts.current[folder.id] ?? 0) + 1;
        setDragOverFolderId(folder.id);
      },
      onDragLeave() {
        folderRowDragCounts.current[folder.id] = (folderRowDragCounts.current[folder.id] ?? 1) - 1;
        if ((folderRowDragCounts.current[folder.id] ?? 0) <= 0) {
          folderRowDragCounts.current[folder.id] = 0;
          setDragOverFolderId((prev) => (prev === folder.id ? null : prev));
        }
      },
      onDragOver(e: React.DragEvent) {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      },
      onDrop(e: React.DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        folderRowDragCounts.current[folder.id] = 0;
        folderListDragCount.current = 0;
        setDragOverFolderId(null);
        setFolderListDragActive(false);
        const dropped = Array.from(e.dataTransfer.files);
        if (!dropped.length) return;
        setSelectedFolder(folder);
        setCheckedFileIds(new Set());
        setMoreFiles(dropped.map((f) => ({ file: f, description: "", progress: 0, status: "pending" as const })));
        setUploadMoreWarningShown(false);
        setUploadMoreOpen(true);
      },
    };
  }

  function handleFolderViewDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    folderViewDragCount.current++;
    setFolderViewDragActive(true);
  }
  function handleFolderViewDragLeave() {
    folderViewDragCount.current--;
    if (folderViewDragCount.current <= 0) {
      folderViewDragCount.current = 0;
      setFolderViewDragActive(false);
    }
  }
  function handleFolderViewDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  }
  function handleFolderViewDrop(e: React.DragEvent) {
    e.preventDefault();
    folderViewDragCount.current = 0;
    setFolderViewDragActive(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    setMoreFiles(dropped.map((f) => ({ file: f, description: "", progress: 0, status: "pending" as const })));
    setUploadMoreWarningShown(false);
    setUploadMoreOpen(true);
  }

  // ─────────────────────────────────────────────────────────────────────────

  function toggleFileCheck(id: string) {
    setCheckedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiles() {
    if (checkedFileIds.size === files.length) {
      setCheckedFileIds(new Set());
    } else {
      setCheckedFileIds(new Set(files.map((f) => f.id)));
    }
  }

  const canDeleteFile = (file: IshareWithUploader) =>
    canManageAny || file.uploadedByUserId === user?.id;
  const canDeleteFolder = (folder: IshareFolderWithMeta) =>
    canManageAny || folder.createdByUserId === user?.id;

  if (selectedFolder) {
    return (
      <div className="flex flex-col h-full" data-testid="folder-contents-view">
        <div className="dash-header bg-muted/40 border-b border-t-4 border-t-primary px-8 py-5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="font-medium"
              onClick={() => {
                setSelectedFolder(null);
                setCheckedFileIds(new Set());
              }}
              data-testid="button-back-to-folders"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              iShare
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-sm">{selectedFolder.name}</span>
          </div>
        </div>

        <div
          id="page-content"
          className="flex-1 overflow-auto p-6 space-y-4 dash-animate relative"
          onDragEnter={handleFolderViewDragEnter}
          onDragLeave={handleFolderViewDragLeave}
          onDragOver={handleFolderViewDragOver}
          onDrop={handleFolderViewDrop}
        >
          {folderViewDragActive && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none">
              <Upload className="h-12 w-12 text-primary mb-3" />
              <p className="text-lg font-semibold text-primary">Drop files to upload</p>
              <p className="text-sm text-muted-foreground mt-1">Files will be added to <strong>{selectedFolder?.name}</strong></p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate" data-testid="text-folder-name">{selectedFolder.name}</h2>
              {selectedFolder.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{selectedFolder.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">
                {selectedFolder.fileCount} file{selectedFolder.fileCount !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Send className="h-3 w-3 mr-1" />
                {selectedFolder.recipientName}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setUploadMoreWarningShown(false);
                setMoreFiles([]);
                setUploadMoreOpen(true);
              }}
              data-testid="button-upload-more"
            >
              <Plus className="h-4 w-4 mr-1" />
              Upload More Files
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={checkedFileIds.size === 0 || downloadingZip}
              onClick={() => downloadZip(Array.from(checkedFileIds))}
              data-testid="button-download-selected"
            >
              {downloadingZip ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Download Selected ({checkedFileIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={files.length === 0 || downloadingZip}
              onClick={() => downloadZip()}
              data-testid="button-download-all"
            >
              {downloadingZip ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Download All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAccessFolder(selectedFolder);
                setAccessSheetOpen(true);
              }}
              data-testid="button-manage-access"
            >
              <Users className="h-4 w-4 mr-1" />
              Manage Access
            </Button>
          </div>

          {filesLoading ? (
            <FetchingOverlay />
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state-files">
              <File className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No files in this folder yet.</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  setUploadMoreWarningShown(false);
                  setMoreFiles([]);
                  setUploadMoreOpen(true);
                }}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload Files
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden" data-testid="files-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={checkedFileIds.size === files.length && files.length > 0}
                        onCheckedChange={toggleAllFiles}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id} data-testid={`row-file-${file.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={checkedFileIds.has(file.id)}
                          onCheckedChange={() => toggleFileCheck(file.id)}
                          data-testid={`checkbox-file-${file.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{file.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{file.description || "—"}</TableCell>
                      <TableCell className="text-sm">{file.uploaderName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(file.createdAt), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatBytes(file.fileSize)}</TableCell>
                      <TableCell>
                        <ExpiryBadge expiresAt={file.expiresAt} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => downloadSingleFile(file)}
                                data-testid={`button-download-file-${file.id}`}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                          {canDeleteFile(file) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteFile(file)}
                                  data-testid={`button-delete-file-${file.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={uploadMoreOpen} onOpenChange={(open) => {
            if (!open) {
              setUploadMoreOpen(false);
              setUploadMoreWarningShown(false);
              setMoreFiles([]);
            }
          }}>
            <DialogContent className="max-w-lg">
              {!uploadMoreWarningShown ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Before you upload
                    </DialogTitle>
                    <DialogDescription>
                      Each file you upload will be <strong>automatically deleted 30 days</strong> after it is uploaded. If you need files available for longer, create a new upload closer to when they are needed.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadMoreOpen(false);
                        setUploadMoreWarningShown(false);
                        setTimeout(() => {
                          setCreateDialogOpen(true);
                          setCreateStep(1);
                        }, 100);
                      }}
                      data-testid="button-create-new-upload"
                    >
                      Create New Upload
                    </Button>
                    <Button
                      onClick={() => setUploadMoreWarningShown(true)}
                      data-testid="button-continue-uploading"
                    >
                      Continue Uploading
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Upload More Files</DialogTitle>
                    <DialogDescription>
                      Add files to <strong>{selectedFolder.name}</strong>. Each file will be automatically deleted 30 days after upload.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <input
                      ref={moreFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleMoreFileInputChange}
                      data-testid="input-more-files"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => moreFileInputRef.current?.click()}
                      data-testid="button-choose-more-files"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </Button>
                    {moreFiles.length > 0 && (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {moreFiles.map((pf, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30" data-testid={`more-file-item-${i}`}>
                            <File className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{pf.file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatBytes(pf.file.size)}</p>
                              <Input
                                placeholder="Optional description"
                                value={pf.description}
                                onChange={(e) =>
                                  setMoreFiles((prev) =>
                                    prev.map((f, idx) => (idx === i ? { ...f, description: e.target.value } : f))
                                  )
                                }
                                className="h-7 text-xs mt-1"
                              />
                            </div>
                            {pf.status === "uploading" && <img src={logoIcon} alt="" className="h-4 w-4 rounded-full object-cover animate-spin shrink-0" style={{ animationDuration: "1.5s" }} />}
                            {pf.status === "done" && <span className="text-xs text-emerald-600 shrink-0">Done</span>}
                            {pf.status === "error" && <span className="text-xs text-destructive shrink-0">Error</span>}
                            {pf.status === "pending" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                onClick={() => setMoreFiles((prev) => prev.filter((_, idx) => idx !== i))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadMoreOpen(false);
                        setMoreFiles([]);
                        setUploadMoreWarningShown(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadMoreFiles}
                      disabled={moreFiles.length === 0 || uploadingMore}
                      data-testid="button-confirm-upload-more"
                    >
                      {uploadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload {moreFiles.length > 0 ? `${moreFiles.length} File${moreFiles.length !== 1 ? "s" : ""}` : ""}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteFile} onOpenChange={(o) => !o && setDeleteFile(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete File</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete <strong>{deleteFile?.fileName}</strong>? This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteFile && deleteFileMutation.mutate(deleteFile.id)}
                  data-testid="button-confirm-delete-file"
                >
                  Delete File
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AccessSheet
            open={accessSheetOpen}
            onOpenChange={setAccessSheetOpen}
            folder={accessFolder}
            accessGrants={accessGrants}
            grantableUsers={grantableUsers}
            grantUserId={grantUserId}
            setGrantUserId={setGrantUserId}
            grantingAccess={grantingAccess}
            setGrantingAccess={setGrantingAccess}
            onGrant={() => {
              if (!accessFolder || !grantUserId) return;
              setGrantingAccess(true);
              grantAccessMutation.mutate({ folderId: accessFolder.id, userId: grantUserId });
            }}
            onRevoke={(userId) => {
              if (!accessFolder) return;
              revokeAccessMutation.mutate({ folderId: accessFolder.id, userId });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="folder-list-view">
      <div className="dash-header bg-muted/40 border-b border-t-4 border-t-primary px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary shrink-0">
              <Send className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                iShare
                <span className="font-normal text-muted-foreground text-2xl"> - Consultant File Transfer</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                Share files securely with other consultants.
              </p>
            </div>
          </div>
          <Button onClick={() => { setCreateStep(1); setCreateDialogOpen(true); }} data-testid="button-new-ishare">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Share
          </Button>
        </div>
      </div>

      <div
        id="page-content"
        className="flex-1 overflow-auto p-6 space-y-5 dash-animate relative"
        onDragEnter={handleFolderListDragEnter}
        onDragLeave={handleFolderListDragLeave}
        onDragOver={handleFolderListDragOver}
        onDrop={handleFolderListDrop}
      >
        {folderListDragActive && !dragOverFolderId && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <FolderPlus className="h-12 w-12 text-primary mb-3" />
            <p className="text-lg font-semibold text-primary">Drop to create a new share</p>
            <p className="text-sm text-muted-foreground mt-1">Or drag onto an existing share to upload into it</p>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" data-testid="expiry-info-banner">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Press <strong>New Share</strong> to send files to another consultant, or open an existing share to add more files.<br />
            Files are <strong>automatically deleted 30 days</strong> after upload.
          </p>
        </div>

        {foldersLoading ? (
          <FetchingOverlay />
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state-folders">
            <Send className="h-14 w-14 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No shares yet</p>
            <p className="text-sm text-muted-foreground mt-1">Click "New Share" to send files to another consultant.</p>
          </div>
        ) : (
          <div className="rounded-lg border divide-y" data-testid="folders-grid">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                  dragOverFolderId === folder.id
                    ? "bg-primary/10 ring-2 ring-inset ring-primary"
                    : "hover:bg-muted/40"
                }`}
                data-testid={`card-folder-${folder.id}`}
                {...makeFolderRowHandlers(folder)}
              >
                <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{folder.name}</span>
                  </div>
                  {folder.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{folder.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      To {folder.recipientName}
                    </span>
                    <span>·</span>
                    <span>{folder.fileCount} file{folder.fileCount !== 1 ? "s" : ""}{folder.totalSize > 0 ? ` · ${formatBytes(folder.totalSize)}` : ""}</span>
                    <span>·</span>
                    <span>Created by {folder.creatorName} {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setSelectedFolder(folder);
                      setCheckedFileIds(new Set());
                    }}
                    data-testid={`button-open-folder-${folder.id}`}
                  >
                    Open
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => {
                          setAccessFolder(folder);
                          setAccessSheetOpen(true);
                        }}
                        data-testid={`button-folder-access-${folder.id}`}
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Manage Access</TooltipContent>
                  </Tooltip>
                  {canDeleteFolder(folder) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteFolder(folder)}
                          data-testid={`button-delete-folder-${folder.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete Share</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={createDialogOpen} onOpenChange={(o) => !o && resetCreateDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {createStep === 1 ? "New Share" : "Add Files"}
              </DialogTitle>
              <DialogDescription>
                {createStep === 1
                  ? "Name this share and choose which consultant to send it to."
                  : "Add the files you want to share. You can add a description to each file."}
              </DialogDescription>
            </DialogHeader>

            {createStep === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="folder-name">Share Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="folder-name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Client Handover Documents"
                    data-testid="input-folder-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folder-description">Description (optional)</Label>
                  <Textarea
                    id="folder-description"
                    value={folderDescription}
                    onChange={(e) => setFolderDescription(e.target.value)}
                    placeholder="Brief description of the share contents..."
                    className="resize-none"
                    rows={3}
                    data-testid="input-folder-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient-select">Send to <span className="text-destructive">*</span></Label>
                  <Select value={recipientUserId} onValueChange={setRecipientUserId}>
                    <SelectTrigger id="recipient-select" data-testid="select-recipient">
                      <SelectValue placeholder="Select a recipient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants
                        .filter((c) => c.id !== user?.id)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id} data-testid={`recipient-option-${c.id}`}>
                            {c.fullName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The selected consultant will be notified by email and can view this share.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  data-testid="input-files"
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-files"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                {pendingFiles.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {pendingFiles.map((pf, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30" data-testid={`pending-file-${i}`}>
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{pf.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(pf.file.size)}</p>
                          <Input
                            placeholder="Optional description"
                            value={pf.description}
                            onChange={(e) =>
                              setPendingFiles((prev) =>
                                prev.map((f, idx) => (idx === i ? { ...f, description: e.target.value } : f))
                              )
                            }
                            className="h-7 text-xs mt-1"
                            data-testid={`input-file-description-${i}`}
                          />
                        </div>
                        {pf.status === "uploading" && <img src={logoIcon} alt="" className="h-4 w-4 rounded-full object-cover animate-spin shrink-0" style={{ animationDuration: "1.5s" }} />}
                        {pf.status === "done" && <span className="text-xs text-emerald-600 shrink-0">Done</span>}
                        {pf.status === "error" && <span className="text-xs text-destructive shrink-0">Error</span>}
                        {pf.status === "pending" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                            data-testid={`button-remove-file-${i}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-md text-muted-foreground">
                    <Upload className="h-8 w-8 mb-2" />
                    <p className="text-sm">No files selected yet</p>
                    <p className="text-xs mt-1">Click "Choose Files" above to add files</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {createStep === 2 && (
                <Button variant="ghost" onClick={() => setCreateStep(1)} data-testid="button-back-to-step1">
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={resetCreateDialog} data-testid="button-cancel-create">
                Cancel
              </Button>
              {createStep === 1 ? (
                <Button
                  onClick={() => {
                    if (!folderName.trim()) {
                      toast({ title: "Please enter a share name", variant: "destructive" });
                      return;
                    }
                    if (!recipientUserId) {
                      toast({ title: "Please select a recipient", variant: "destructive" });
                      return;
                    }
                    setCreateStep(2);
                  }}
                  data-testid="button-next-step"
                >
                  Next: Add Files
                </Button>
              ) : (
                <Button
                  onClick={handleCreateFolder}
                  disabled={creatingFolder}
                  data-testid="button-confirm-create"
                >
                  {creatingFolder ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4 mr-2" />
                  )}
                  {pendingFiles.length > 0
                    ? `Create & Upload ${pendingFiles.length} File${pendingFiles.length !== 1 ? "s" : ""}`
                    : "Create Share"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Share</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the share <strong>{deleteFolder?.name}</strong> and all{" "}
                <strong>{deleteFolder?.fileCount} file{deleteFolder?.fileCount !== 1 ? "s" : ""}</strong> inside
                it. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
                data-testid="button-confirm-delete-folder"
              >
                Delete Share & Files
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AccessSheet
          open={accessSheetOpen}
          onOpenChange={setAccessSheetOpen}
          folder={accessFolder}
          accessGrants={accessGrants}
          grantableUsers={grantableUsers}
          grantUserId={grantUserId}
          setGrantUserId={setGrantUserId}
          grantingAccess={grantingAccess}
          setGrantingAccess={setGrantingAccess}
          onGrant={() => {
            if (!accessFolder || !grantUserId) return;
            setGrantingAccess(true);
            grantAccessMutation.mutate({ folderId: accessFolder.id, userId: grantUserId });
          }}
          onRevoke={(userId) => {
            if (!accessFolder) return;
            revokeAccessMutation.mutate({ folderId: accessFolder.id, userId });
          }}
        />
      </div>
    </div>
  );
}

function AccessSheet({
  open,
  onOpenChange,
  folder,
  accessGrants,
  grantableUsers,
  grantUserId,
  setGrantUserId,
  grantingAccess,
  setGrantingAccess,
  onGrant,
  onRevoke,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folder: IshareFolderWithMeta | null;
  accessGrants: FolderAccessWithUser[];
  grantableUsers: User[];
  grantUserId: string;
  setGrantUserId: (v: string) => void;
  grantingAccess: boolean;
  setGrantingAccess: (v: boolean) => void;
  onGrant: () => void;
  onRevoke: (userId: string) => void;
}) {
  if (!folder) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Access</SheetTitle>
          <SheetDescription>
            Control who can view the files in <strong>{folder.name}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">Who has access</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-muted/30" data-testid="access-recipient">
                <div className="flex items-center gap-2 min-w-0">
                  <Send className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{folder.recipientName}</p>
                    <p className="text-xs text-muted-foreground">Recipient — cannot be removed</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0 capitalize">{folder.recipientRole}</Badge>
              </div>
              {accessGrants.map((grant) => (
                <div key={grant.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border" data-testid={`access-grant-${grant.userId}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{grant.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{grant.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs capitalize">{grant.userRole}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onRevoke(grant.userId)}
                      data-testid={`button-revoke-${grant.userId}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {accessGrants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No additional access granted yet.</p>
              )}
            </div>
          </div>

          {grantableUsers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Add Access</h4>
              <div className="flex gap-2">
                <Select value={grantUserId} onValueChange={setGrantUserId}>
                  <SelectTrigger className="flex-1" data-testid="select-grant-user">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {grantableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id} data-testid={`grant-user-option-${u.id}`}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={onGrant}
                  disabled={!grantUserId || grantingAccess}
                  data-testid="button-grant-access"
                >
                  {grantingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
