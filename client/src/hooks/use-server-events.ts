import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "./use-auth";

let backoffMs = 1_000;
const MAX_BACKOFF = 30_000;

export function useServerEvents() {
  const { isAuthenticated, logout } = useAuth();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("connected", () => {
        backoffMs = 1_000;
        // Refresh online presence immediately on (re)connect
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
      });

      es.addEventListener("session-revoked", () => {
        es.close();
        logout();
      });

      es.addEventListener("module-access-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/module-access"] });
      });

      es.addEventListener("presence-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
      });

      es.addEventListener("document-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "compliance"] });
          }
        } catch { /* ignore */ }
        // Refresh all document, dashboard and compliance-related views for other users
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents/module"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      });

      es.addEventListener("document-uploaded", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "compliance"] });
          }
        } catch { /* ignore */ }
        // Refresh all document, dashboard and compliance-related views for other users
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents/module"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      });

      es.addEventListener("support-request-created", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/support-requests/counts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      });

      es.addEventListener("support-request-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/support-requests/counts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/support-requests"] });
      });

      es.addEventListener("company-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      });

      es.addEventListener("site-updated", () => {
        // Predicate covers all site query key variants including filtered URLs
        // e.g. ["/api/sites"], ["/api/sites", "pro", "my"], ["/api/sites?myAssigned=true"]
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.startsWith("/api/sites");
          },
        });
      });

      es.addEventListener("user-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      });

      es.addEventListener("case-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      });

      es.addEventListener("incident-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/incidents", data.siteId] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      });

      es.addEventListener("cloud-share-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.folderId) {
            queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", data.folderId, "files"] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!unmountedRef.current) {
          reconnectTimer.current = setTimeout(() => {
            backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
            connect();
          }, backoffMs);
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isAuthenticated, logout]);
}
