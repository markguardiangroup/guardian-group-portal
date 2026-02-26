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
  companyName?: string | null;
  clientPermissionRole?: string | null;
  referenceNumber?: string | null;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  preferredContactMethod?: "email" | "phone" | "mobile" | null;
  notes?: string | null;
  legalAcceptanceRequired?: boolean;
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
      // Step 1: Immediately clear the cache and local storage as soon as logout is pressed
      localStorage.removeItem("dev_user");
      setDevUser(null);
      queryClient.clear();

      // Step 2: Wait for 4 seconds to show the preloader while the app is "empty" behind it
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Step 3: Perform the server-side logout
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Step 4: Redirect to login
      window.location.replace("/login");
    },
    onError: () => {
      // Step 5: Redirect to login even on error
      window.location.replace("/login");
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
