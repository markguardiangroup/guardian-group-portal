import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import type { ModuleType } from "@shared/schema";

interface ModuleAccessData {
  health_safety: "active" | "visible" | "hidden";
  human_resources: "active" | "visible" | "hidden";
  employment_law: "active" | "visible" | "hidden";
  training: "active" | "visible" | "hidden";
  toolkit: "active" | "visible" | "hidden";
  support: "active" | "visible" | "hidden";
  reports: "active" | "visible" | "hidden";
}

interface UseModuleAccessResult {
  isLoading: boolean;
  hasActiveAccess: (module: ModuleType) => boolean;
  hasVisibleAccess: (module: ModuleType) => boolean;
  isHidden: (module: ModuleType) => boolean;
  getAccessStatus: (module: ModuleType) => "active" | "visible" | "hidden" | undefined;
}

export function useModuleAccess(): UseModuleAccessResult {
  const { user, isLoading: authLoading } = useAuth();
  
  const { data: moduleAccess, isLoading: accessLoading } = useQuery<ModuleAccessData>({
    queryKey: ["/api/user/module-access"],
    enabled: !!user,
  });
  
  const isLoading = authLoading || accessLoading;
  const isPrivilegedUser = user?.role === "developer" || user?.role === "consultant" || user?.role === "administrator";

  const getAccessStatus = (module: ModuleType): "active" | "visible" | "hidden" | undefined => {
    // Admin/consultants always have active access to all modules
    if (isPrivilegedUser) {
      return "active";
    }
    
    // Return the fetched access status for the module
    if (moduleAccess) {
      return moduleAccess[module as keyof ModuleAccessData];
    }
    
    // Default to hidden while loading or if no data
    return undefined;
  };

  const hasActiveAccess = (module: ModuleType): boolean => {
    // Admin/consultants always have active access
    if (isPrivilegedUser) {
      return true;
    }
    return getAccessStatus(module) === "active";
  };

  const hasVisibleAccess = (module: ModuleType): boolean => {
    // Admin/consultants always have access
    if (isPrivilegedUser) {
      return true;
    }
    const status = getAccessStatus(module);
    return status === "active" || status === "visible";
  };

  const isHidden = (module: ModuleType): boolean => {
    // Admin/consultants never see hidden modules
    if (isPrivilegedUser) {
      return false;
    }
    return getAccessStatus(module) === "hidden";
  };

  return {
    isLoading,
    hasActiveAccess,
    hasVisibleAccess,
    isHidden,
    getAccessStatus,
  };
}
