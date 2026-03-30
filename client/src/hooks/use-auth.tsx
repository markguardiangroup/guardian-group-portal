import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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

function SigningOutOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "linear-gradient(160deg, #1d3057 0%, #1a2a4a 50%, #172240 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        animation: "fadeInOverlay 0.18s ease-out forwards",
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes overlayBarScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>

      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "linear-gradient(135deg, #0ea5e9, #818cf8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2 style={{ width: 32, height: 32, color: "white", animation: "spin 1s linear infinite" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "white", fontSize: 18, fontWeight: 600, margin: 0 }}>Signing you out</p>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginTop: 6 }}>Please wait…</p>
      </div>

      <div
        style={{
          width: 200,
          height: 4,
          borderRadius: 9999,
          background: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "45%",
            borderRadius: 9999,
            background: "linear-gradient(90deg, #38bdf8, #818cf8, #e879f9, #f97316, #a3e635)",
            animation: "overlayBarScan 1.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devUser, setDevUser] = useState<AuthUser | null>(getDevUser);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const handleStorage = () => setDevUser(getDevUser());
    window.addEventListener("storage", handleStorage);
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  const { data: user, isLoading, isError } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    retry: (failureCount, error) => {
      const msg = (error as Error)?.message ?? "";
      if (msg.startsWith("401") || msg.startsWith("403")) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
    staleTime: 5 * 60 * 1000,
  });

  const effectiveUser = user ?? (isError || !isLoading ? devUser : null);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      localStorage.removeItem("dev_user");
      setDevUser(null);
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      setIsSigningOut(false);
    },
    onError: () => {
      localStorage.removeItem("dev_user");
      setDevUser(null);
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      setIsSigningOut(false);
    },
  });

  const logout = () => {
    setIsSigningOut(true);
    logoutMutation.mutate();
  };

  const value: AuthContextType = {
    user: effectiveUser ?? null,
    isLoading: isLoading && !devUser,
    isAuthenticated: !!effectiveUser,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };

  return (
    <AuthContext.Provider value={value}>
      {isSigningOut && <SigningOutOverlay />}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
