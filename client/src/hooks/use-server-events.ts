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
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        } catch {
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        }
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
