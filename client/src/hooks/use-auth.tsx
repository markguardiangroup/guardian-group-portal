import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserRole } from "@shared/schema";
import { useIdleTimeout } from "./use-idle-timeout";

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

function IdleWarningModal({
  secondsRemaining,
  onStay,
  onLogout,
}: {
  secondsRemaining: number;
  onStay: () => void;
  onLogout: () => void;
}) {
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const display = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secs}s`;
  const urgent = secondsRemaining <= 10;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeInOverlay 0.18s ease-out forwards",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "32px 28px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: urgent
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            transition: "background 0.4s",
          }}
        >
          <Clock style={{ width: 28, height: 28, color: "white" }} />
        </div>

        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
          Session expiring
        </h2>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "#6b7280" }}>
          You've been inactive for a while.
        </p>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>
          You'll be logged out in{" "}
          <span
            style={{
              fontWeight: 700,
              color: urgent ? "#ef4444" : "#d97706",
              transition: "color 0.4s",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {display}
          </span>
          .
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onLogout}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "1.5px solid #e5e7eb",
              background: "white",
              color: "#374151",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
          <button
            onClick={onStay}
            style={{
              flex: 2,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #1d3057, #2d4a8a)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Stay logged in
          </button>
        </div>
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
  const isAuthenticated = !!effectiveUser;

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

  const { showWarning, secondsRemaining, resetTimer } = useIdleTimeout({
    enabled: isAuthenticated,
    onTimeout: logout,
  });

  const value: AuthContextType = {
    user: effectiveUser ?? null,
    isLoading: isLoading && !devUser,
    isAuthenticated,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };

  return (
    <AuthContext.Provider value={value}>
      {isSigningOut && <SigningOutOverlay />}
      {showWarning && !isSigningOut && (
        <IdleWarningModal
          secondsRemaining={secondsRemaining}
          onStay={resetTimer}
          onLogout={logout}
        />
      )}
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
