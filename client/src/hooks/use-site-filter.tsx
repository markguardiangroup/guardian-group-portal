import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SiteFilterContextType {
  selectedCompany: string | null;
  selectedSiteId: string | null;
  selectedGroup: string;
  coverageConsultantId: string | null;
  proStaffFilter: string;
  sitesCompanyId: string | null;
  setSelectedCompany: (company: string | null) => void;
  setSelectedSiteId: (siteId: string | null) => void;
  setSelectedGroup: (group: string) => void;
  setCoverageConsultantId: (id: string | null) => void;
  setProStaffFilter: (v: string) => void;
  setSitesCompanyId: (id: string | null) => void;
  handleCompanyChange: (company: string | null) => void;
  resetFilters: () => void;
}

const SiteFilterContext = createContext<SiteFilterContextType | null>(null);

export function SiteFilterProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [coverageConsultantId, setCoverageConsultantId] = useState<string | null>(null);
  const [proStaffFilter, setProStaffFilter] = useState<string>("my");
  const [sitesCompanyId, setSitesCompanyId] = useState<string | null>(null);

  const handleCompanyChange = useCallback((company: string | null) => {
    setSelectedCompany(company);
    setSelectedSiteId(null);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCompany(null);
    setSelectedSiteId(null);
    setSelectedGroup("all");
  }, []);

  return (
    <SiteFilterContext.Provider
      value={{
        selectedCompany,
        selectedSiteId,
        selectedGroup,
        coverageConsultantId,
        proStaffFilter,
        sitesCompanyId,
        setSelectedCompany,
        setSelectedSiteId,
        setSelectedGroup,
        setCoverageConsultantId,
        setProStaffFilter,
        setSitesCompanyId,
        handleCompanyChange,
        resetFilters,
      }}
    >
      {children}
    </SiteFilterContext.Provider>
  );
}

export function useSiteFilter() {
  const context = useContext(SiteFilterContext);
  if (!context) {
    throw new Error("useSiteFilter must be used within a SiteFilterProvider");
  }
  return context;
}
