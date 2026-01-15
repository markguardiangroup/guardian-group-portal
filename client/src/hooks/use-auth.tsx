import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserRole } from "@shared/schema";

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getDevUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem("dev_user");
    return stored ? JSON.parse(stored) as AuthUser : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devUser, setDevUser] = useState<AuthUser | null>(getDevUser);
  
  // Check localStorage on mount and when storage changes
  useEffect(() => {
    const handleStorage = () => setDevUser(getDevUser());
    window.addEventListener("storage", handleStorage);
    // Also check periodically for same-window changes
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  const { data: user, isLoading, isError } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Use server session if available, otherwise fall back to dev user
  const effectiveUser = user ?? (isError || !isLoading ? devUser : null);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      localStorage.removeItem("dev_user");
      setDevUser(null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries();
      window.location.href = "/login";
    },
  });

  const value: AuthContextType = {
    user: effectiveUser ?? null,
    isLoading: isLoading && !devUser,
    isAuthenticated: !!effectiveUser,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
