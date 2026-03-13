import { useState, useEffect } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfViewerProps {
  url: string;
  className?: string;
}

export function PdfViewer({ url, className = "w-full h-full" }: PdfViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let currentBlobUrl: string | null = null;

    setLoading(true);
    setError(false);
    setBlobUrl(null);

    fetch(url, { credentials: "include", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/pdf")) {
          throw new Error("Response is not a PDF");
        }
        return res.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="pdf-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center" data-testid="pdf-error">
        <p className="mb-4 text-muted-foreground">Unable to load PDF preview.</p>
        <Button
          variant="outline"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          data-testid="button-open-pdf-new-tab"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      className={`${className} border-0`}
      title="PDF preview"
      data-testid="pdf-iframe"
    />
  );
}
