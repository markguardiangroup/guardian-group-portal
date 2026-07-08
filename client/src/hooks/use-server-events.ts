import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { useAuth, clearAuthCache } from "./use-auth";

let backoffMs = 1_000;
const MAX_BACKOFF = 5_000;

export function useServerEvents() {
  const { isAuthenticated, logout } = useAuth();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const isFirstConnectRef = useRef(true);
  const [serverDown, setServerDown] = useState(false);
  const downTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const es = new EventSource("/api/events");
      esRef.current = es;

      es.addEventListener("connected", () => {
        backoffMs = 1_000;
        // Clear any pending "server down" timer and hide the overlay
        if (downTimerRef.current) {
          clearTimeout(downTimerRef.current);
          downTimerRef.current = null;
        }
        setServerDown(false);
        if (!isFirstConnectRef.current) {
          // Reconnect after a drop — flush everything to catch missed events
          queryClient.invalidateQueries();
        }
        isFirstConnectRef.current = false;
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
      });

      es.addEventListener("session-revoked", () => {
        clearAuthCache();
        es.close();
        logout();
      });

      es.addEventListener("user-updated", (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data ?? "{}") as { userId?: string };
          const currentUser = queryClient.getQueryData<{ id: string }>(["/api/auth/me"]);
          if (data.userId && currentUser?.id && data.userId === currentUser.id) {
            clearAuthCache();
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          }
        } catch { /* non-fatal */ }
      });

      es.addEventListener("module-access-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/module-access"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("presence-changed", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
        // Coming online/offline also updates the user's lastSeenAt (and may reflect a
        // status change such as invited -> active on first sign-in), so refresh the
        // user list too — otherwise the row shows stale status / "last seen".
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      });

      es.addEventListener("document-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "compliance"] });
          }
          // Invalidate ALL hierarchy queries — they use a full URL string key and may
          // show "all" sites (not a specific siteId), so match by URL fragment instead.
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === "string" && key.includes("documents-hierarchy");
            },
          });
          // Refresh the specific document detail and its audit trail
          if (data.documentId) {
            queryClient.invalidateQueries({ queryKey: ["/api/documents", data.documentId] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents", data.documentId, "audit"] });
          }
        } catch { /* ignore */ }
        // Refresh all document, dashboard, compliance and calendar views for other users
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents/module"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"] });
        queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-actions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("document-audit-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.documentId) {
            queryClient.invalidateQueries({ queryKey: ["/api/documents", data.documentId, "audit"] });
          }
        } catch { /* ignore */ }
      });

      es.addEventListener("document-uploaded", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "documents"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites", data.siteId, "compliance"] });
          }
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === "string" && key.includes("documents-hierarchy");
            },
          });
          if (data.documentId) {
            queryClient.invalidateQueries({ queryKey: ["/api/documents", data.documentId] });
            queryClient.invalidateQueries({ queryKey: ["/api/documents", data.documentId, "audit"] });
          }
        } catch { /* ignore */ }
        // Refresh all document, dashboard, compliance and calendar views for other users
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/documents/module"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates/by-company"] });
        queryClient.invalidateQueries({ queryKey: ["/api/effective-required-template-ids-by-site"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-actions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
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
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        // Deleting a company also deletes its client users, so refresh the
        // Users list (and online presence) too — otherwise deleted clients
        // keep showing until a manual refresh.
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
      });

      es.addEventListener("company-mandatory-templates-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.companyId) {
            queryClient.invalidateQueries({ queryKey: ["/api/companies", data.companyId, "required-templates"] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      });

      es.addEventListener("training-booking-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/training-bookings", data.siteId] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/training-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("training-request-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/training-requests", data.siteId] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/training-requests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("document-template-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/document-templates-archived"] });
        queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
      });

      es.addEventListener("folder-template-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/folder-templates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      });

      es.addEventListener("roadmap-updated", () => {
        queryClient.invalidateQueries({ queryKey: ["/api/roadmap"] });
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
        // Site changes affect company site-counts and compliance scores
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/modules/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/missing-required-templates"] });
      });

      es.addEventListener("user-updated", () => {
        // Prefix match on ["/api/users"] covers ["/api/users", ...] keys such as
        // /api/users/:id/site-assignments, but NOT ["/api/users/online"] which is
        // a different first element — invalidate that one explicitly.
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/online"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      });

      es.addEventListener("case-updated", () => {
        // Prefix match covers /api/cases and nested keys
        // (/api/cases/:id, .../notes, .../documents, .../bundles)
        queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-actions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("incident-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.siteId) {
            queryClient.invalidateQueries({ queryKey: ["/api/incidents", data.siteId] });
          }
        } catch { /* ignore */ }
        // Prefix match covers /api/incidents and nested keys
        // (/api/incidents/:id, .../documents, .../milestones)
        queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-actions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/home-summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("cloud-share-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.folderId) {
            queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders", data.folderId, "files"] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/client-upload-folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.addEventListener("ishare-updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.folderId) {
            queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders", data.folderId, "files"] });
          }
        } catch { /* ignore */ }
        queryClient.invalidateQueries({ queryKey: ["/api/ishare-folders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!unmountedRef.current) {
          // Show the overlay after 4 s — absorbs brief drops from heavy uploads/network blips
          // while still catching genuine server outages (which last much longer)
          if (!downTimerRef.current) {
            downTimerRef.current = setTimeout(() => {
              downTimerRef.current = null;
              setServerDown(true);
            }, 4_000);
          }
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
      if (downTimerRef.current) clearTimeout(downTimerRef.current);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isAuthenticated, logout]);

  return { serverDown };
}
