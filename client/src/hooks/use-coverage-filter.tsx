import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";

export interface CoveringForEntry {
  absentConsultantId: string;
  absentConsultantName: string;
}

export function useCoverageFilter() {
  const { user } = useAuth();
  const { coverageConsultantId, setCoverageConsultantId } = useSiteFilter();

  const isConsultant = user?.role === "consultant";
  const isProConsultant = isConsultant && (user as any)?.consultantTier === "pro";
  const showCoverageFilter = isConsultant;

  const { data } = useQuery<{
    coveringFor: CoveringForEntry[];
    beingCoveredBy: unknown[];
    allActive: unknown[];
  }>({
    queryKey: ["/api/consultant-coverage/my-active"],
    enabled: showCoverageFilter,
    staleTime: 30000,
  });

  const coveringFor: CoveringForEntry[] = data?.coveringFor ?? [];
  // Pro Consultants merge coverage into their staff picker — no separate Select needed
  const hasCoverage = showCoverageFilter && !isProConsultant && coveringFor.length > 0;

  const coverageFilter = coverageConsultantId ?? "my";

  const setCoverageFilter = (v: string) => {
    setCoverageConsultantId(v === "my" ? null : v);
  };

  const coverageSitesUrl =
    coverageFilter !== "my"
      ? `/api/sites?staffId=${coverageFilter}`
      : "/api/sites";

  const coverageQueryKey =
    coverageFilter !== "my"
      ? (["/api/sites", "coverage", coverageFilter] as const)
      : (["/api/sites"] as const);

  return {
    hasCoverage,
    coveringFor,
    coverageFilter,
    setCoverageFilter,
    coverageSitesUrl,
    coverageQueryKey,
  };
}
