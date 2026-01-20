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
      const res = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await res.json();

      setProgress(30);

      console.log("Starting GCS upload to:", uploadURL.substring(0, 100) + "...");
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
      });

      console.log("GCS upload response status:", uploadRes.status);

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text().catch(() => "Unknown error");
        console.error("GCS upload failed:", uploadRes.status, errorText);
        throw new Error(`Upload failed: ${uploadRes.status} - ${errorText.substring(0, 100)}`);
      }

      setProgress(100);

      onUploadComplete({
        objectPath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
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
