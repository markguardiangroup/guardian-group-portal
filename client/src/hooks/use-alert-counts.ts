import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface AlertCounts {
  home: number;
  cloudshare: {
    health_safety: number;
    human_resources: number;
    employment_law: number;
  };
  ishare?: number;
}

export function useAlertCounts(enabled = true) {
  return useQuery<AlertCounts>({
    queryKey: ["/api/alert-counts"],
    staleTime: 30000,
    enabled,
  });
}

// Mark a sidebar alert surface as seen, then refresh the counts so badges clear.
export async function markAlertSurfaceSeen(surface: string) {
  try {
    await apiRequest("POST", "/api/alert-counts/seen", { surface });
  } catch {
    /* non-fatal — badge will clear on next refresh */
  }
  queryClient.invalidateQueries({ queryKey: ["/api/alert-counts"] });
}
