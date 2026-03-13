import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface PdfViewerProps {
  url: string;
  className?: string;
}

export function PdfViewer({ url, className = "w-full h-full" }: PdfViewerProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null);

  const renderPdf = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(false);

    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy();
      loadingTaskRef.current = null;
    }
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    try {
      const response = await fetch(url, { credentials: "include", signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      if (signal.aborted) return;

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      loadingTaskRef.current = loadingTask;
      if (signal.aborted) {
        loadingTask.destroy();
        loadingTaskRef.current = null;
        return;
      }
      const pdfDoc = await loadingTask.promise;
      loadingTaskRef.current = null;
      if (signal.aborted) {
        pdfDoc.destroy();
        return;
      }

      pdfDocRef.current = pdfDoc;

      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      const parentWidth = container.parentElement?.clientWidth ?? container.clientWidth;
      const containerWidth = Math.max(parentWidth - 16, 200);
      const dpr = window.devicePixelRatio || 1;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (signal.aborted) {
          pdfDoc.destroy();
          pdfDocRef.current = null;
          return;
        }
        const page = await pdfDoc.getPage(i);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(
          Math.max(containerWidth / unscaledViewport.width, 0.5),
          1.1
        );
        const viewport = page.getViewport({ scale: fitScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 8px auto";

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.scale(dpr, dpr);

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (signal.aborted) {
          pdfDoc.destroy();
          pdfDocRef.current = null;
          return;
        }
        container.appendChild(canvas);
      }

      setLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (signal.aborted) return;
      console.error("PdfViewer render error:", err);
      setError(true);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    renderPdf(controller.signal);
    return () => {
      controller.abort();
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
        loadingTaskRef.current = null;
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [renderPdf]);

  return (
    <div className={className} style={{ position: "relative" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" data-testid="pdf-loading">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center" data-testid="pdf-error">
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
      )}
      <div
        ref={containerRef}
        className="overflow-y-auto h-full p-2"
        style={{ display: loading || error ? "none" : "block" }}
        data-testid="pdf-canvas-container"
      />
    </div>
  );
}
