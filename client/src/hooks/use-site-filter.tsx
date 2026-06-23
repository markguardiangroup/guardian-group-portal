import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface ScopeState {
  selectedCompany: string | null;
  selectedSiteId: string | null;
  selectedGroup: string;
}

const DEFAULT_SCOPE: ScopeState = {
  selectedCompany: null,
  selectedSiteId: null,
  selectedGroup: "all",
};

interface SiteFilterContextType {
  scopes: Record<string, ScopeState>;
  updateScope: (scope: string, patch: Partial<ScopeState>) => void;
  // Global (non-scoped) filters shared across the app.
  coverageConsultantId: string | null;
  proStaffFilter: string;
  sitesCompanyId: string | null;
  setCoverageConsultantId: (id: string | null) => void;
  setProStaffFilter: (v: string) => void;
  setSitesCompanyId: (id: string | null) => void;
}

const SiteFilterContext = createContext<SiteFilterContextType | null>(null);

export function SiteFilterProvider({ children }: { children: ReactNode }) {
  const [scopes, setScopes] = useState<Record<string, ScopeState>>({});
  const [coverageConsultantId, setCoverageConsultantId] = useState<string | null>(null);
  const [proStaffFilter, setProStaffFilter] = useState<string>("my");
  const [sitesCompanyId, setSitesCompanyId] = useState<string | null>(null);

  const updateScope = useCallback((scope: string, patch: Partial<ScopeState>) => {
    setScopes((prev) => {
      const current = prev[scope] ?? DEFAULT_SCOPE;
      return { ...prev, [scope]: { ...current, ...patch } };
    });
  }, []);

  return (
    <SiteFilterContext.Provider
      value={{
        scopes,
        updateScope,
        coverageConsultantId,
        proStaffFilter,
        sitesCompanyId,
        setCoverageConsultantId,
        setProStaffFilter,
        setSitesCompanyId,
      }}
    >
      {children}
    </SiteFilterContext.Provider>
  );
}

/**
 * Access the company/site/group filter for a given scope. Each scope keeps its
 * own remembered selection, so pages that pass a unique scope (e.g. "calendar",
 * "support", "incidents", "cases") do not affect one another. Pages that omit a
 * scope share the default "global" bucket, preserving the previous behaviour
 * where the selection flows between the dashboard, companies, sites and the
 * module document pages.
 */
export function useSiteFilter(scope: string = "global") {
  const context = useContext(SiteFilterContext);
  if (!context) {
    throw new Error("useSiteFilter must be used within a SiteFilterProvider");
  }
  const { scopes, updateScope } = context;
  const state = scopes[scope] ?? DEFAULT_SCOPE;

  const setSelectedCompany = useCallback(
    (company: string | null) => updateScope(scope, { selectedCompany: company }),
    [updateScope, scope],
  );
  const setSelectedSiteId = useCallback(
    (siteId: string | null) => updateScope(scope, { selectedSiteId: siteId }),
    [updateScope, scope],
  );
  const setSelectedGroup = useCallback(
    (group: string) => updateScope(scope, { selectedGroup: group }),
    [updateScope, scope],
  );
  const handleCompanyChange = useCallback(
    (company: string | null) => updateScope(scope, { selectedCompany: company, selectedSiteId: null }),
    [updateScope, scope],
  );
  const resetFilters = useCallback(
    () => updateScope(scope, { ...DEFAULT_SCOPE }),
    [updateScope, scope],
  );

  return useMemo(
    () => ({
      selectedCompany: state.selectedCompany,
      selectedSiteId: state.selectedSiteId,
      selectedGroup: state.selectedGroup,
      setSelectedCompany,
      setSelectedSiteId,
      setSelectedGroup,
      handleCompanyChange,
      resetFilters,
      coverageConsultantId: context.coverageConsultantId,
      proStaffFilter: context.proStaffFilter,
      sitesCompanyId: context.sitesCompanyId,
      setCoverageConsultantId: context.setCoverageConsultantId,
      setProStaffFilter: context.setProStaffFilter,
      setSitesCompanyId: context.setSitesCompanyId,
    }),
    [
      state.selectedCompany,
      state.selectedSiteId,
      state.selectedGroup,
      setSelectedCompany,
      setSelectedSiteId,
      setSelectedGroup,
      handleCompanyChange,
      resetFilters,
      context.coverageConsultantId,
      context.proStaffFilter,
      context.sitesCompanyId,
      context.setCoverageConsultantId,
      context.setProStaffFilter,
      context.setSitesCompanyId,
    ],
  );
}
