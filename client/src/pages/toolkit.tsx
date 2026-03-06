import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Download,
  FileText,
  File,
  FileSpreadsheet,
  Search,
  HardHat,
  Users,
  Scale,
  Globe,
  Lock,
  Folder,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { FolderTemplate } from "@shared/schema";

type ToolkitTemplate = {
  id: string;
  name: string;
  description?: string | null;
  module: string;
  fileName: string;
  fileUrl?: string | null;
  fileSize: number;
  mimeType: string;
  isPublic: boolean;
  toolkitFolderId?: string | null;
  toolkitFolderName?: string | null;
};

const moduleNames: Record<string, string> = {
  health_safety: "H&S",
  human_resources: "HR",
  employment_law: "EL",
  training: "Training",
};

const moduleBadgeClasses: Record<string, string> = {
  health_safety: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  human_resources: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  employment_law: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border-pink-200 dark:border-pink-700",
  training: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
};

const moduleIcons: Record<string, typeof HardHat> = {
  health_safety: HardHat,
  human_resources: Users,
  employment_law: Scale,
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("document") || mimeType.includes("word")) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadFile = async (fileUrl: string, fileName: string) => {
  try {
    const response = await fetch(`${fileUrl}?download=${encodeURIComponent(fileName)}`);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = decodeURIComponent(fileName);
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Download error:", error);
  }
};

export default function ToolkitPage() {
  const { user } = useAuth();
  const isClient = user?.role === "client";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  const { data: toolkitFolders = [], isLoading: foldersLoading } = useQuery<FolderTemplate[]>({
    queryKey: ["/api/toolkit/folders"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ToolkitTemplate[]>({
    queryKey: ["/api/toolkit/templates"],
  });

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (selectedModule !== "all") {
      result = result.filter((t) => t.module === selectedModule);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, selectedModule, searchQuery]);

  const groupedByFolder = useMemo(() => {
    const groups: Array<{ folder: FolderTemplate | null; folderId: string | null; folderName: string; templates: ToolkitTemplate[] }> = [];
    const folderMap = new Map(toolkitFolders.map((f) => [f.id, f]));

    const withFolder: Record<string, ToolkitTemplate[]> = {};
    const uncategorised: ToolkitTemplate[] = [];

    for (const t of filteredTemplates) {
      if (t.toolkitFolderId && folderMap.has(t.toolkitFolderId)) {
        if (!withFolder[t.toolkitFolderId]) withFolder[t.toolkitFolderId] = [];
        withFolder[t.toolkitFolderId].push(t);
      } else {
        uncategorised.push(t);
      }
    }

    for (const folder of toolkitFolders) {
      const items = withFolder[folder.id];
      if (items && items.length > 0) {
        groups.push({ folder, folderId: folder.id, folderName: folder.name, templates: items });
      }
    }

    if (uncategorised.length > 0) {
      groups.push({ folder: null, folderId: null, folderName: "Uncategorised", templates: uncategorised });
    }

    return groups;
  }, [filteredTemplates, toolkitFolders]);

  const isLoading = foldersLoading || templatesLoading;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Toolkit</h1>
          <p className="text-sm text-muted-foreground">Browse and download document templates</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-toolkit-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "health_safety", label: "H&S" },
            { value: "human_resources", label: "HR" },
            { value: "employment_law", label: "EL" },
          ].map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={selectedModule === value ? "default" : "outline"}
              onClick={() => setSelectedModule(value)}
              data-testid={`button-module-filter-${value}`}
            >
              {value !== "all" && moduleIcons[value] ? (() => {
                const Icon = moduleIcons[value];
                return <Icon className="h-3.5 w-3.5 mr-1" />;
              })() : null}
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[1, 2].map((j) => <Skeleton key={j} className="h-12 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groupedByFolder.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-14 w-14 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No templates found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? "Try a different search term." : "No templates are available yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByFolder.map(({ folder, folderId, folderName, templates: folderTemplates }) => (
            <Card key={folderId ?? "__uncategorised__"} data-testid={`card-toolkit-folder-${folderId ?? "uncategorised"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Folder className="h-5 w-5 text-amber-500" />
                  {folderName}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {folderTemplates.length} template{folderTemplates.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
                {folder?.description && (
                  <p className="text-sm text-muted-foreground">{folder.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {folderTemplates.map((template) => {
                  const FileIcon = getFileIcon(template.mimeType);
                  const moduleBadge = moduleBadgeClasses[template.module];
                  const moduleName = moduleNames[template.module] || template.module;
                  return (
                    <div
                      key={template.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      data-testid={`row-toolkit-template-${template.id}`}
                    >
                      <div className="p-2 rounded-md bg-muted shrink-0">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{template.name}</span>
                          <Badge variant="outline" className={`text-xs py-0 ${moduleBadge}`}>
                            {moduleName}
                          </Badge>
                          {!isClient && (
                            template.isPublic ? (
                              <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-500">
                                <Globe className="h-3 w-3 mr-1" />
                                Public
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs py-0 text-muted-foreground">
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                              </Badge>
                            )
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{template.fileName} · {formatFileSize(template.fileSize)}</p>
                      </div>
                      {template.fileUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => downloadFile(template.fileUrl!, template.fileName)}
                          data-testid={`button-download-toolkit-${template.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
