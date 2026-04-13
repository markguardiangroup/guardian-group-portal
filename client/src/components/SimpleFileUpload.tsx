import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";

interface SimpleFileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  onUploadComplete: (result: {
    objectPath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function SimpleFileUpload({
  accept = ".doc,.docx,.pdf,.xls,.xlsx,.txt,.rtf",
  maxSizeMB = 50,
  onUploadComplete,
  onError,
  className,
  children,
}: SimpleFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      onError?.(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      setProgress(30);

      // Upload directly to server which handles GCS upload
      const uploadRes = await fetch("/api/uploads/file", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        credentials: "include",
        body: file,
      });

      if (!uploadRes.ok) {
        if (uploadRes.status === 401) {
          throw new Error("Your session has expired — please refresh the page and log back in.");
        }
        const errorData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(errorData.error || `Upload failed: ${uploadRes.status}`);
      }

      const result = await uploadRes.json();

      setProgress(100);

      onUploadComplete({
        objectPath: result.objectPath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (err) {
      console.error("Upload error:", err);
      onError?.(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full justify-start"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Uploading... {progress > 0 && `${progress}%`}
          </>
        ) : (
          children || (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Choose file...
            </>
          )
        )}
      </Button>
    </div>
  );
}
