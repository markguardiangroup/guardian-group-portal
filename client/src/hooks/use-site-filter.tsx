import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SiteFilterContextType {
  selectedCompany: string | null;
  selectedSiteId: string | null;
  selectedGroup: string;
  setSelectedCompany: (company: string | null) => void;
  setSelectedSiteId: (siteId: string | null) => void;
  setSelectedGroup: (group: string) => void;
  handleCompanyChange: (company: string | null) => void;
  resetFilters: () => void;
}

const SiteFilterContext = createContext<SiteFilterContextType | null>(null);

export function SiteFilterProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

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
        setSelectedCompany,
        setSelectedSiteId,
        setSelectedGroup,
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
