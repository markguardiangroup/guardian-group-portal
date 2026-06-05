import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { FetchingOverlay } from "@/components/ui/fetching-overlay";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronDown,
  AlertTriangle,
  File,
  Loader2,
  UserPlus,
  X,
  Shield,
  Clock,
  Plus,
  CloudUpload,
  HelpCircle,
} from "lucide-react";
import { CompanyCombobox } from "@/components/company-combobox";
import { SiteCombobox } from "@/components/site-combobox";
import { useCoverageFilter } from "@/hooks/use-coverage-filter";
import { useSiteFilter } from "@/hooks/use-site-filter";

type ClientUploadModule = "health_safety" | "human_resources" | "employment_law";

interface ClientUploadFolderWithMeta {
  id: string;
  name: string;
  description: string | null;
  module: ClientUploadModule;
  siteId: string;
  createdByUserId: string;
  allocatedClientId: string | null;
  expiresAt: string;
  createdAt: string;
  fileCount: number;
  totalSize: number;
  creatorName: string;
  allocatedClientName: string | null;
  siteName: string;
  companyName: string;
}

interface ClientUploadWithUploader {
  id: string;
  folderId: string;
  module: ClientUploadModule;
  siteId: string;
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

interface Company {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  companyId: string;
  companyName?: string;
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

const MODULE_LABELS: Record<ClientUploadModule, string> = {
  health_safety: "Health & Safety",
  human_resources: "Human Resources",
  employment_law: "Employment Law",
} as const;

const MODULE_COLOR: Record<ClientUploadModule, string> = {
  health_safety: "emerald",
  human_resources: "blue",
  employment_law: "pink",
};

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
        <Clock className="h-3 w-3 mr-1" />
        Expires {format(new Date(expiresAt), "d MMM yyyy")}
      </Badge>
    );
  }
  if (days < 7) {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" data-testid="expiry-badge-warning">
        <Clock className="h-3 w-3 mr-1" />
        Expires {format(new Date(expiresAt), "d MMM yyyy")}
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" data-testid="expiry-badge-ok">
      <Clock className="h-3 w-3 mr-1" />
      Expires {format(new Date(expiresAt), "d MMM yyyy")}
    </Badge>
  );
}

export default function ClientUploads({ module }: { module: ClientUploadModule }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { selectedSiteId, setSelectedSiteId, selectedCompany, setSelectedCompany } = useSiteFilter();
  const [selectedFolder, setSelectedFolder] = useState<ClientUploadFolderWithMeta | null>(null);
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set());

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [dialogCompanyId, setDialogCompanyId] = useState<string>("");
  const [dialogSiteId, setDialogSiteId] = useState<string>("");
  const [folderAllocatedClientId, setFolderAllocatedClientId] = useState<string>("__none__");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploadMoreOpen, setUploadMoreOpen] = useState(false);
  const [uploadMoreWarningShown, setUploadMoreWarningShown] = useState(false);
  const [moreFiles, setMoreFiles] = useState<PendingFile[]>([]);
  const [uploadingMore, setUploadingMore] = useState(false);

  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [accessFolder, setAccessFolder] = useState<ClientUploadFolderWithMeta | null>(null);
  const [grantUserId, setGrantUserId] = useState<string>("");
  const [grantingAccess, setGrantingAccess] = useState(false);

  const [deleteFolder, setDeleteFolder] = useState<ClientUploadFolderWithMeta | null>(null);
  const [deleteFile, setDeleteFile] = useState<ClientUploadWithUploader | null>(null);

  const [downloadingZip, setDownloadingZip] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreFileInputRef = useRef<HTMLInputElement>(null);

  const [folderListDragActive, setFolderListDragActive] = useState(false);
  const [folderViewDragActive, setFolderViewDragActive] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const folderListDragCount = useRef(0);
  const folderViewDragCount = useRef(0);
  const folderRowDragCounts = useRef<Record<string, number>>({});

  const isAdmin = user?.role === "admin";
  const isConsultant = user?.role === "consultant";
  const isClient = user?.role === "client";
  const canManageFolders = isAdmin || isConsultant;
  const { hasCoverage, coveringFor, coverageFilter, setCoverageFilter } = useCoverageFilter();

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: coverageFilter !== "my" ? ["/api/sites", "coverage", coverageFilter] : ["/api/sites"],
    enabled: !isClient,
    queryFn: coverageFilter !== "my" ? async () => {
      const res = await fetch(`/api/sites?staffId=${coverageFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    } : undefined,
  });

  const { data: clientSiteAssignments = [] } = useQuery<{ siteId: string; siteName: string }[]>({
    queryKey: ["/api/users", user?.id, "site-assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user!.id}/site-assignments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch site assignments");
      return res.json();
    },
    enabled: isClient && !!user?.id,
  });

  useEffect(() => {
    if (isClient && clientSiteAssignments.length === 1) {
      setSelectedSiteId(clientSiteAssignments[0].siteId);
    }
  }, [isClient, clientSiteAssignments]);

  const filteredSites = useMemo(() => {
    if (!sites || !selectedCompany) return sites;
    return sites.filter(s => s.companyName === selectedCompany);
  }, [sites, selectedCompany]);

  const handleCompanyChange = useCallback((company: string | null) => {
    setSelectedCompany(company && company !== "all" ? company : null);
    setSelectedSiteId(null);
  }, []);

  const handleSiteChange = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId && sites) {
      const site = sites.find(s => s.id === siteId);
      if (site?.companyName) setSelectedCompany(site.companyName);
    }
  }, [sites]);

  const resetFilters = useCallback(() => {
    setSelectedCompany(null);
    setSelectedSiteId(null);
  }, []);

  const contextCompany = useMemo(() => {
    if (selectedSiteId) return sites.find(s => s.id === selectedSiteId)?.companyName || null;
    return selectedCompany || null;
  }, [selectedSiteId, selectedCompany, sites]);

  const contextSite = useMemo(() => {
    if (selectedSiteId) return sites.find(s => s.id === selectedSiteId)?.name || null;
    if (selectedCompany) return "All sites";
    return null;
  }, [selectedSiteId, selectedCompany, sites]);

  const { data: folders = [], isLoading: foldersLoading } = useQuery<ClientUploadFolderWithMeta[]>({
    queryKey: ["/api/client-upload-folders", module, selectedSiteId, selectedCompany],
    queryFn: async () => {
      const params = new URLSearchParams({ module });
      if (selectedSiteId) params.set("siteId", selectedSiteId);
      const res = await fetch(`/api/client-upload-folders?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    },
  });

  // When a company is selected without a specific site, filter folders to only show
  // those belonging to sites of the selected company
  const filteredFolders = useMemo(() => {
    if (!selectedCompany || selectedSiteId) return folders;
    const companySiteIds = new Set(
      sites.filter(s => s.companyName === selectedCompany).map(s => s.id)
    );
    return folders.filter(f => companySiteIds.has(f.siteId));
  }, [folders, selectedCompany, selectedSiteId, sites]);

  const { data: files = [], isLoading: filesLoading } = useQuery<ClientUploadWithUploader[]>({
    queryKey: ["/api/client-upload-folders", selectedFolder?.id, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/client-upload-folders/${selectedFolder!.id}/files`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    enabled: !!selectedFolder,
  });

  const { data: accessGrants = [] } = useQuery<FolderAccessWithUser[]>({
    queryKey: ["/api/client-upload-folders", accessFolder?.id, "access"],
    queryFn: async () => {
      const res = await fetch(`/api/client-upload-folders/${accessFolder!.id}/access`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch access");
      return res.json();
    },
    enabled: !!accessFolder,
  });

  const { data: grantableUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/client-upload-folders", accessFolder?.id, "grantable-users"],
    queryFn: async () => {
      const res = await fetch(`/api/client-upload-folders/${accessFolder!.id}/grantable-users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: !!accessFolder,
  });

  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies?limit=1000"],
    queryFn: async () => {
      const res = await fetch("/api/companies?limit=1000", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
    enabled: canManageFolders && createDialogOpen,
  });
  const companies = companiesData?.companies ?? [];

  const { data: siteClientAssignments = [] } = useQuery<{ clientId: string; clientName: string; clientEmail: string }[]>({
    queryKey: ["/api/sites", dialogSiteId, "client-assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${dialogSiteId}/client-assignments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch site clients");
      return res.json();
    },
    enabled: canManageFolders && !!dialogSiteId,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/client-upload-folders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
      toast({ title: "Folder deleted successfully" });
      setDeleteFolder(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete folder", description: err.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/client-uploads/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", selectedFolder?.id, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
      toast({ title: "File deleted" });
      setDeleteFile(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete file", description: err.message, variant: "destructive" });
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async ({ folderId, userId }: { folderId: string; userId: string }) => {
      const res = await apiRequest("POST", `/api/client-upload-folders/${folderId}/access`, { userId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", accessFolder?.id, "access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", accessFolder?.id, "grantable-users"] });
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
      const res = await apiRequest("DELETE", `/api/client-upload-folders/${folderId}/access/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", accessFolder?.id, "access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", accessFolder?.id, "grantable-users"] });
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
    const effectiveSiteId = canManageFolders ? dialogSiteId : selectedSiteId;
    if (!effectiveSiteId) {
      toast({ title: "Please select a site", variant: "destructive" });
      return;
    }

    setCreatingFolder(true);
    try {
      const folderRes = await apiRequest("POST", "/api/client-upload-folders", {
        name: folderName.trim(),
        description: folderDescription.trim() || null,
        module,
        siteId: effectiveSiteId,
        allocatedClientId: canManageFolders ? (folderAllocatedClientId === "__none__" ? null : folderAllocatedClientId || null) : undefined,
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
          await apiRequest("POST", "/api/client-uploads", {
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

      queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
      toast({ title: "Upload folder created successfully" });
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
    setDialogCompanyId("");
    setDialogSiteId("");
    setFolderAllocatedClientId("__none__");
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
        await apiRequest("POST", "/api/client-uploads", {
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
    queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", selectedFolder.id, "files"] });
    queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
    toast({ title: "Files uploaded successfully" });
    setUploadMoreOpen(false);
    setMoreFiles([]);
    setUploadMoreWarningShown(false);
    setUploadingMore(false);
  }

  async function downloadSingleFile(file: ClientUploadWithUploader) {
    const res = await fetch(`/api/client-uploads/${file.id}/download`, { credentials: "include" });
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
      const res = await fetch(`/api/client-upload-folders/${selectedFolder.id}/download`, {
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

  function makeFolderRowHandlers(folder: ClientUploadFolderWithMeta) {
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
        e.stopPropagation(); // prevent parent "create folder" handler
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

  const accentColor = MODULE_COLOR[module];
  const themeClass = module === "health_safety" ? "theme-hs" : module === "human_resources" ? "theme-hr" : "theme-el";

  if (selectedFolder) {
    return (
      <div className={`${themeClass} flex flex-col h-full`} data-testid="folder-contents-view">
        <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-module-accent hover:text-module-accent hover:bg-module-accent-subtle font-medium"
              onClick={() => {
                setSelectedFolder(null);
                setCheckedFileIds(new Set());
              }}
              data-testid="button-back-to-folders"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Cloud Share
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
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-module-accent rounded-lg pointer-events-none">
              <Upload className="h-12 w-12 text-module-accent mb-3" />
              <p className="text-lg font-semibold text-module-accent">Drop files to upload</p>
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
            {selectedFolder.allocatedClientName && (
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                {selectedFolder.allocatedClientName}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">Site: {selectedFolder.siteName}</span>
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
                        {(isAdmin || isConsultant || file.uploadedByUserId === user?.id) && (
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
    <div className={`${themeClass} flex flex-col h-full`} data-testid="folder-list-view">
      <div className="dash-header bg-module-accent-subtle border-b border-t-4 border-t-module-accent px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-module-accent shrink-0">
              <CloudUpload className="h-7 w-7 text-module-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">
                {MODULE_LABELS[module]}
                <span className="font-normal text-muted-foreground text-2xl"> - Cloud Share</span>
              </h1>
              <p className="text-base mt-1 text-muted-foreground min-h-[1.5rem]">
                {canManageFolders && (
                  <span className="font-semibold text-foreground">{contextCompany || "All Companies"}</span>
                )}
                {!canManageFolders && contextCompany && (
                  <span className="font-semibold text-foreground">{contextCompany}</span>
                )}
                {(canManageFolders || contextCompany) && contextSite && <span> - </span>}
                {contextSite && <span>{contextSite}</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canManageFolders && sites.length > 0 && (
              <div className="flex items-center gap-2">
                {(selectedCompany || selectedSiteId) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFilters}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                    data-testid="button-clear-filters-cloudshare"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex flex-row items-center gap-2">
                  <CompanyCombobox
                    sites={sites}
                    value={selectedCompany}
                    onValueChange={handleCompanyChange}
                    className="w-[200px]"
                    testId="select-company-cloudshare"
                  />
                  <SiteCombobox
                    sites={filteredSites}
                    value={selectedSiteId}
                    onValueChange={handleSiteChange}
                    className="w-[200px]"
                    testId="select-site-cloudshare"
                    disabled={!selectedCompany || selectedCompany === "all"}
                  />
                </div>
              </div>
            )}
            {hasCoverage && (
              <Select
                value={coverageFilter}
                onValueChange={(v) => { setCoverageFilter(v); handleCompanyChange(null); }}
              >
                <SelectTrigger className="w-[205px] text-sm" data-testid="select-coverage-filter-uploads">
                  <span className="truncate pointer-events-none">
                    {coverageFilter === "my"
                      ? "My client sites"
                      : (coveringFor.find(c => c.absentConsultantId === coverageFilter)?.absentConsultantName ?? "") + "'s client sites"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My client sites</SelectItem>
                  {coveringFor.map(c => (
                    <SelectItem key={c.absentConsultantId} value={c.absentConsultantId} data-testid={`coverage-filter-uploads-${c.absentConsultantId}`}>
                      {c.absentConsultantName}'s client sites
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="bg-module-accent hover:bg-module-accent/90 text-module-accent-foreground shrink-0"
              onClick={() => {
                setCreateStep(1);
                setCreateDialogOpen(true);
              }}
              data-testid="button-upload-documents"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
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
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-module-accent rounded-lg pointer-events-none">
            <FolderPlus className="h-12 w-12 text-module-accent mb-3" />
            <p className="text-lg font-semibold text-module-accent">Drop to create a new folder</p>
            <p className="text-sm text-muted-foreground mt-1">Or drag onto an existing folder to upload into it</p>
          </div>
        )}

      {isClient ? (
        <div className="rounded-lg border bg-card overflow-hidden" data-testid="client-help-card">
          <button
            onClick={() => setHelpExpanded(!helpExpanded)}
            className="flex items-center gap-2.5 w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
            data-testid="button-toggle-help"
            aria-expanded={helpExpanded}
          >
            <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">How to share documents with your advisor</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${helpExpanded ? "rotate-180" : ""}`} />
          </button>
          <div
            className="grid transition-all duration-300 ease-in-out"
            style={{ gridTemplateRows: helpExpanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="px-5 pb-5 pt-4 space-y-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Share files with your advisor quickly and securely — such as policies, certificates, or any other documents. There are two ways to upload:
                </p>

                {/* Two-route side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Route A — Drag & Drop */}
                  <div className="rounded-lg border-2 border-module-accent/40 bg-module-accent/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-module-accent/20">
                        <CloudUpload className="h-4 w-4 text-module-accent" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Drag &amp; Drop</span>
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-module-accent text-module-accent-foreground">Quickest</span>
                    </div>
                    <ol className="space-y-2">
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-module-accent text-module-accent-foreground text-[10px] font-semibold mt-0.5">1</span>
                        <span>Drag your files from your computer and <strong className="text-foreground">drop them anywhere on this page</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-module-accent text-module-accent-foreground text-[10px] font-semibold mt-0.5">2</span>
                        <span>Give the upload a clear name — e.g. <em>"March Risk Assessments"</em>.</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-module-accent text-module-accent-foreground text-[10px] font-semibold mt-0.5">3</span>
                        <span>Click <strong className="text-foreground">Upload</strong> — done. Multiple files are supported.</span>
                      </li>
                    </ol>
                  </div>

                  {/* Route B — Button */}
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Upload Button</span>
                    </div>
                    <ol className="space-y-2">
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground text-[10px] font-semibold mt-0.5">1</span>
                        <span>Click <strong className="text-foreground">Upload Documents</strong> in the top right corner.</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground text-[10px] font-semibold mt-0.5">2</span>
                        <span>Give the upload a clear name — e.g. <em>"Updated Policies"</em>.</span>
                      </li>
                      <li className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-foreground text-[10px] font-semibold mt-0.5">3</span>
                        <span>Browse and select your files, then click <strong className="text-foreground">Upload</strong>.</span>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Uploaded files are automatically and permanently deleted <strong>30 days</strong> after upload. If you need them available longer, upload them again closer to when they are needed.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" data-testid="expiry-info-banner">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Press <strong>Upload Documents</strong> to create a new folder, or open an existing folder to add more files.<br />
            Files are <strong>automatically deleted 30 days</strong> after upload.
          </p>
        </div>
      )}

      {foldersLoading ? (
        <FetchingOverlay />
      ) : filteredFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state-folders">
          <CloudUpload className="h-14 w-14 text-muted-foreground mb-4" />
          {isClient ? (
            <>
              <p className="text-lg font-medium">Nothing shared yet</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                When you're ready to share a document with your advisor, click <strong>Upload Documents</strong> above — it only takes a minute.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-muted-foreground">No uploads yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Upload Documents" to create the first folder.</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-lg border divide-y" data-testid="folders-grid">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                dragOverFolderId === folder.id
                  ? "bg-module-accent/10 ring-2 ring-inset ring-module-accent"
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
                  <span>{folder.companyName}</span>
                  <span>·</span>
                  <span>{folder.siteName}</span>
                  <span>·</span>
                  <span>{folder.fileCount} file{folder.fileCount !== 1 ? "s" : ""}{folder.totalSize > 0 ? ` · ${formatBytes(folder.totalSize)}` : ""}</span>
                  {folder.allocatedClientName && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {folder.allocatedClientName}
                      </span>
                    </>
                  )}
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
                {!isClient && (
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
                    <TooltipContent>Delete Folder</TooltipContent>
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
              {createStep === 1 ? "Name Your Upload" : "Add Files"}
            </DialogTitle>
            <DialogDescription>
              {createStep === 1
                ? "Give this upload folder a name and choose who it's for."
                : "Add the files you want to upload. You can add a description to each file."}
            </DialogDescription>
          </DialogHeader>

          {createStep === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="folder-name">Folder Name <span className="text-destructive">*</span></Label>
                <Input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder={
                    module === "health_safety"
                      ? "e.g. Risk Assessment Documents"
                      : module === "human_resources"
                      ? "e.g. Employee Handbook Updates"
                      : "e.g. Settlement Agreement Documents"
                  }
                  data-testid="input-folder-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folder-description">Description (optional)</Label>
                <Textarea
                  id="folder-description"
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  placeholder="Brief description of the upload contents..."
                  className="resize-none"
                  rows={3}
                  data-testid="input-folder-description"
                />
              </div>
              {canManageFolders && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="company-select">Company <span className="text-destructive">*</span></Label>
                    <Select
                      value={dialogCompanyId}
                      onValueChange={(val) => {
                        setDialogCompanyId(val);
                        setDialogSiteId("");
                        setFolderAllocatedClientId("__none__");
                      }}
                    >
                      <SelectTrigger id="company-select" data-testid="select-folder-company">
                        <SelectValue placeholder="Select a company..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-select">Site <span className="text-destructive">*</span></Label>
                    <Select
                      value={dialogSiteId}
                      onValueChange={(val) => {
                        setDialogSiteId(val);
                        setFolderAllocatedClientId("__none__");
                      }}
                      disabled={!dialogCompanyId}
                    >
                      <SelectTrigger id="site-select" data-testid="select-folder-site">
                        <SelectValue placeholder={dialogCompanyId ? "Select a site..." : "Select a company first..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {sites
                          .filter((s) => s.companyId === dialogCompanyId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allocate-client">Allocate to Client (optional)</Label>
                    <Select
                      value={folderAllocatedClientId}
                      onValueChange={setFolderAllocatedClientId}
                      disabled={!dialogSiteId}
                    >
                      <SelectTrigger id="allocate-client" data-testid="select-allocate-client">
                        <SelectValue placeholder={dialogSiteId ? "No specific client..." : "Select a site first..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No specific client</SelectItem>
                        {siteClientAssignments.map((a) => (
                          <SelectItem key={a.clientId} value={a.clientId}>{a.clientName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If no client is selected, all clients on the site will be notified by email when files are uploaded.
                    </p>
                  </div>
                </>
              )}
              {isClient && clientSiteAssignments.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="site-select">Site <span className="text-destructive">*</span></Label>
                  <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger id="site-select" data-testid="select-folder-site">
                      <SelectValue placeholder="Select a site..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientSiteAssignments.map((a) => (
                        <SelectItem key={a.siteId} value={a.siteId}>{a.siteName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                    toast({ title: "Please enter a folder name", variant: "destructive" });
                    return;
                  }
                  const siteToCheck = canManageFolders ? dialogSiteId : selectedSiteId;
                  if (!siteToCheck) {
                    toast({ title: "Please select a site", variant: "destructive" });
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
                  : "Create Folder"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder <strong>{deleteFolder?.name}</strong> and all{" "}
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
              Delete Folder & Files
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
  folder: ClientUploadFolderWithMeta | null;
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
              {folder.allocatedClientName && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-muted/30" data-testid="access-allocated-client">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{folder.allocatedClientName}</p>
                      <p className="text-xs text-muted-foreground">Primary — cannot be removed</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">Client</Badge>
                </div>
              )}
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
              {!folder.allocatedClientName && accessGrants.length === 0 && (
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
                    <SelectValue placeholder="Select a client user..." />
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
