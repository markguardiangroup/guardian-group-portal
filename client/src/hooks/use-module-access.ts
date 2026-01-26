import { useAuth } from "./use-auth";
import type { ModuleType } from "@shared/schema";

interface UseModuleAccessResult {
  isLoading: boolean;
  hasActiveAccess: (module: ModuleType) => boolean;
  hasVisibleAccess: (module: ModuleType) => boolean;
  isHidden: (module: ModuleType) => boolean;
  getAccessStatus: (module: ModuleType) => "active" | "visible" | "hidden" | undefined;
}

export function useModuleAccess(): UseModuleAccessResult {
  const { user, isLoading } = useAuth();
  
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";

  const getAccessStatus = (module: ModuleType): "active" | "visible" | "hidden" | undefined => {
    // Admin/consultants always have active access to all modules
    if (isPrivilegedUser) {
      return "active";
    }
    
    // For clients, we default to active for all modules on the dashboard
    // The actual site-level access control is handled by the API routes
    if (user?.role === "client") {
      return "active";
    }
    
    return undefined;
  };

  const hasActiveAccess = (module: ModuleType): boolean => {
    // Admin/consultants always have active access
    if (isPrivilegedUser) {
      return true;
    }
    // Clients get access based on their company's module access
    // This is controlled at the API level per site
    if (user?.role === "client") {
      return true;
    }
    return getAccessStatus(module) === "active";
  };

  const hasVisibleAccess = (module: ModuleType): boolean => {
    // Admin/consultants always have access
    if (isPrivilegedUser) {
      return true;
    }
    if (user?.role === "client") {
      return true;
    }
    const status = getAccessStatus(module);
    return status === "active" || status === "visible";
  };

  const isHidden = (_module: ModuleType): boolean => {
    // For now, no modules are hidden on the dashboard
    // Site-level access control is handled by API routes
    return false;
  };

  return {
    isLoading,
    hasActiveAccess,
    hasVisibleAccess,
    isHidden,
    getAccessStatus,
  };
}
