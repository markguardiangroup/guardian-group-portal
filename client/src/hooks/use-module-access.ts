import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { EntityModuleAccess, ModuleType, ModuleAccessRequest } from "@shared/schema";

interface UseModuleAccessResult {
  moduleAccess: EntityModuleAccess[];
  accessRequests: ModuleAccessRequest[];
  isLoading: boolean;
  hasActiveAccess: (module: ModuleType) => boolean;
  hasVisibleAccess: (module: ModuleType) => boolean;
  isHidden: (module: ModuleType) => boolean;
  getAccessStatus: (module: ModuleType) => "active" | "visible" | "hidden" | undefined;
  hasPendingRequest: (module: ModuleType) => boolean;
  canRequestAccess: (module: ModuleType) => boolean;
}

export function useModuleAccess(): UseModuleAccessResult {
  const { user } = useAuth();
  
  const entityId = user?.entityId;
  const isPrivilegedUser = user?.role === "admin" || user?.role === "consultant";
  
  // Only fetch module access for clients with an entity
  // Admin/consultants have access to all modules by default
  const { data: moduleAccess = [], isLoading: accessLoading } = useQuery<EntityModuleAccess[]>({
    queryKey: [`/api/entities/${entityId}/module-access`],
    enabled: !!entityId && !isPrivilegedUser,
  });
  
  // Fetch access requests for all users
  const { data: accessRequests = [], isLoading: requestsLoading } = useQuery<ModuleAccessRequest[]>({
    queryKey: ["/api/module-access-requests"],
    enabled: !!user,
  });

  const getAccessStatus = (module: ModuleType): "active" | "visible" | "hidden" | undefined => {
    // Admin/consultants always have active access to all modules
    if (isPrivilegedUser) {
      return "active";
    }
    
    // Clients without an entity have no access
    if (!entityId) {
      return undefined;
    }
    
    const access = moduleAccess.find(a => a.module === module);
    return access?.status as "active" | "visible" | "hidden" | undefined;
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
    // Admin/consultants can see all modules
    if (isPrivilegedUser) {
      return false;
    }
    return getAccessStatus(module) === "hidden";
  };

  const hasPendingRequest = (module: ModuleType): boolean => {
    if (!entityId) return false;
    return accessRequests.some(
      r => r.module === module && 
           r.entityId === entityId && 
           r.status === "pending"
    );
  };

  const canRequestAccess = (module: ModuleType): boolean => {
    // Admin/consultants don't need to request access
    if (isPrivilegedUser) {
      return false;
    }
    const status = getAccessStatus(module);
    return status === "visible" && !hasPendingRequest(module);
  };

  // For privileged users, loading is only dependent on access requests
  // For clients, loading depends on both module access and access requests
  const isLoading = isPrivilegedUser ? requestsLoading : (accessLoading || requestsLoading);

  return {
    moduleAccess,
    accessRequests,
    isLoading,
    hasActiveAccess,
    hasVisibleAccess,
    isHidden,
    getAccessStatus,
    hasPendingRequest,
    canRequestAccess,
  };
}
