import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSiteFilter } from "@/hooks/use-site-filter";

export interface CoveringForEntry {
  absentConsultantId: string;
  absentConsultantName: string;
}

export interface StaffConsultant {
  id: string;
  fullName: string;
  consultantTier?: string | null;
}

export function useCoverageFilter() {
  const { user } = useAuth();
  const { coverageConsultantId, setCoverageConsultantId, proStaffFilter, setProStaffFilter } = useSiteFilter();

  const isConsultant = user?.role === "consultant";
  const isProConsultant = isConsultant && user?.consultantTier === "pro";
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

  const { data: myStaff = [], isSuccess: myStaffLoaded } = useQuery<StaffConsultant[]>({
    queryKey: ["/api/consultants/my-staff"],
    queryFn: async () => {
      const res = await fetch("/api/consultants/my-staff", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isProConsultant,
  });

  useEffect(() => {
    if (isProConsultant && myStaffLoaded && myStaff.length === 0 && proStaffFilter === "my") {
      setProStaffFilter("all");
    }
  }, [isProConsultant, myStaffLoaded, myStaff.length]);

  const coveringFor: CoveringForEntry[] = data?.coveringFor ?? [];
  const hasCoverage = showCoverageFilter && !isProConsultant && coveringFor.length > 0;

  const coverageFilter = coverageConsultantId ?? "my";
  const setCoverageFilter = (v: string) => {
    setCoverageConsultantId(v === "my" ? null : v);
  };

  // Unified sites URL — pro consultants use proStaffFilter, others use coverageFilter
  const coverageSitesUrl = isProConsultant
    ? proStaffFilter === "my"
      ? "/api/sites?myAssigned=true"
      : proStaffFilter !== "all"
        ? `/api/sites?staffId=${proStaffFilter}`
        : "/api/sites"
    : coverageFilter !== "my"
      ? `/api/sites?staffId=${coverageFilter}`
      : "/api/sites";

  const coverageQueryKey: readonly string[] = isProConsultant
    ? proStaffFilter === "my"
      ? ["/api/sites", "pro", "my"]
      : proStaffFilter !== "all"
        ? ["/api/sites", "pro", proStaffFilter]
        : ["/api/sites"]
    : coverageFilter !== "my"
      ? ["/api/sites", "coverage", coverageFilter]
      : ["/api/sites"];

  return {
    hasCoverage,
    coveringFor,
    coverageFilter,
    setCoverageFilter,
    coverageSitesUrl,
    coverageQueryKey,
    isProConsultant,
    proStaffFilter,
    setProStaffFilter,
    myStaff,
  };
}
