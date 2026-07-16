import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Clock, Lock } from "lucide-react";
import { apiRequest, queryClient, ApiError } from "@/lib/queryClient";
import type { UserRole } from "@shared/schema";
import { useIdleTimeout } from "./use-idle-timeout";

export const AUTH_CACHE_KEY = "gg_auth_v1";
const AUTH_CACHE_TTL = 5 * 60 * 1000;
const LOCK_KEY = "guardian_session_lock";
const AUTO_SIGNOUT_MS = 30 * 60 * 1000;

function readAuthCache(): { user: AuthUser; ts: number } | undefined {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { user: AuthUser; ts: number };
    if (Date.now() - parsed.ts > AUTH_CACHE_TTL) {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeAuthCache(user: AuthUser): void {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, ts: Date.now() }));
  } catch { /* non-fatal */ }
}

export function clearAuthCache(): void {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch { /* non-fatal */ }
}

interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  consultantTier?: string | null;
  consultantPermissions?: { caseAdvocate?: boolean; trainingLibrary?: boolean; templateLibrary?: boolean; services?: boolean; reportIncident?: boolean } | null;
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
  sources?: string[] | null;
  isGroupPrimaryContact?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
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
            Log out now
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

function LockScreen({
  user,
  lockedAt,
  onUnlock,
  onSignOut,
}: {
  user: AuthUser;
  lockedAt: number;
  onUnlock: (password: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
    const update = () => {
      const remaining = Math.max(0, AUTO_SIGNOUT_MS - (Date.now() - lockedAt));
      setSecondsLeft(Math.floor(remaining / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [lockedAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdownDisplay = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const initials = (user.fullName || user.username)
    .split(" ").map((n: string) => n[0] ?? "").join("").slice(0, 2).toUpperCase();

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!password.trim() || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await onUnlock(password);
      if (!result.ok) {
        setError(result.error || "Incorrect password");
        setPassword("");
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    } finally {
      setIsPending(false);
    }
  };

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
        gap: "28px",
        padding: "16px",
        animation: "fadeInOverlay 0.22s ease-out forwards",
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .lock-input:focus {
          outline: none;
          border-color: #4f8ef7 !important;
          box-shadow: 0 0 0 3px rgba(79,142,247,0.25);
        }
        .lock-btn:hover:not(:disabled) {
          opacity: 0.88;
        }
        .lock-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .lock-signout:hover {
          opacity: 0.7;
        }
      `}</style>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, #0ea5e9, #818cf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <Lock style={{ width: 26, height: 26, color: "white" }} />
        </div>
        <p style={{ color: "white", fontSize: 20, fontWeight: 700, margin: 0 }}>
          Session locked
        </p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
          Enter your password to continue
        </p>
      </div>

      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #334155, #475569)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          color: "white",
          letterSpacing: "0.04em",
          border: "2px solid rgba(255,255,255,0.15)",
        }}
      >
        {initials}
      </div>

      <div style={{ textAlign: "center", marginTop: -12 }}>
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: 600, margin: 0 }}>
          {user.fullName || user.username}
        </p>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
          {user.email}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <input
          ref={inputRef}
          className="lock-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(null); }}
          disabled={isPending}
          data-testid="input-lock-password"
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: 10,
            border: error ? "1.5px solid #f87171" : "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontSize: 15,
            boxSizing: "border-box",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {error && (
          <p
            style={{ color: "#f87171", fontSize: 13, margin: 0, textAlign: "center" }}
            data-testid="text-lock-error"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="lock-btn"
          disabled={isPending || !password.trim()}
          data-testid="button-lock-unlock"
          style={{
            padding: "11px 0",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #2563eb, #4f8ef7)",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: isPending || !password.trim() ? "not-allowed" : "pointer",
            opacity: isPending || !password.trim() ? 0.6 : 1,
            transition: "opacity 0.15s, transform 0.1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {isPending && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
          {isPending ? "Verifying…" : "Unlock"}
        </button>
      </form>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "0 0 8px" }}>
          Auto sign-out in{" "}
          <span style={{ fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.55)" }}>
            {countdownDisplay}
          </span>
        </p>
        <button
          className="lock-signout"
          onClick={onSignOut}
          data-testid="button-lock-signout"
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.45)",
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            transition: "opacity 0.15s",
          }}
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [devUser, setDevUser] = useState<AuthUser | null>(getDevUser);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // Initialize lock state from localStorage so a page refresh preserves the lock.
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try { return Number(localStorage.getItem(LOCK_KEY) ?? "0") > 0; } catch { return false; }
  });
  const lockedAtRef = useRef<number>((() => {
    try { return Number(localStorage.getItem(LOCK_KEY) ?? "0") || 0; } catch { return 0; }
  })());
  const autoSignoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logoutRef = useRef<() => void>(() => {});

  const startAutoSignout = (lockedAt: number) => {
    if (autoSignoutTimerRef.current) clearTimeout(autoSignoutTimerRef.current);
    const remaining = Math.max(0, AUTO_SIGNOUT_MS - (Date.now() - lockedAt));
    autoSignoutTimerRef.current = setTimeout(() => {
      // Auto sign-out: call the real logout flow so the server session is terminated.
      logoutRef.current();
    }, remaining);
  };

  const doLock = (ts: number) => {
    lockedAtRef.current = ts;
    setIsLocked(true);
    startAutoSignout(ts);
  };

  const doUnlock = () => {
    setIsLocked(false);
    lockedAtRef.current = 0;
    if (autoSignoutTimerRef.current) {
      clearTimeout(autoSignoutTimerRef.current);
      autoSignoutTimerRef.current = null;
    }
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      setDevUser(getDevUser());
      if (e.key === LOCK_KEY) {
        if (e.newValue) {
          doLock(Number(e.newValue));
        } else {
          doUnlock();
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    const interval = setInterval(() => setDevUser(getDevUser()), 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: if already locked (from localStorage, e.g. after page refresh),
  // start the auto-signout timer so the countdown and eventual logout still fire.
  useEffect(() => {
    if (isLocked && lockedAtRef.current > 0) {
      startAutoSignout(lockedAtRef.current);
    }
    return () => {
      if (autoSignoutTimerRef.current) clearTimeout(autoSignoutTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAuthenticatedRef = useRef(false);

  const cached = readAuthCache();

  const { data: user, isLoading, isError } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    initialData: cached?.user,
    initialDataUpdatedAt: cached?.ts ?? 0,
    // /api/auth/me is exempt from the session-lock middleware, so polling always works.
    // Disable refetch on window focus while locked to avoid unnecessary requests.
    retry: (failureCount, error) => {
      const status = (error as ApiError)?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5000),
    staleTime: AUTH_CACHE_TTL,
    refetchOnWindowFocus: () => hasAuthenticatedRef.current && !isLocked,
  });

  useEffect(() => {
    if (user) {
      hasAuthenticatedRef.current = true;
      writeAuthCache(user);
    }
  }, [user]);

  const effectiveUser = user ?? (isError || !isLoading ? devUser : null);
  const isAuthenticated = !!effectiveUser;

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      clearAuthCache();
      localStorage.removeItem("dev_user");
      localStorage.removeItem("sidebar_hint_seen");
      window.location.replace("/");
    },
    onError: () => {
      clearAuthCache();
      localStorage.removeItem("dev_user");
      localStorage.removeItem("sidebar_hint_seen");
      window.location.replace("/");
    },
  });

  const logout = () => {
    doUnlock();
    try { localStorage.removeItem(LOCK_KEY); } catch {}
    clearAuthCache();
    setIsSigningOut(true);
    logoutMutation.mutate();
  };
  // Keep logoutRef always pointing at the latest logout so the auto-signout
  // timer (set inside doLock/startAutoSignout) can call it without stale closure.
  logoutRef.current = logout;

  const lock = async () => {
    const ts = Date.now();
    // Fail-closed: only lock locally if the server successfully marks the session as
    // locked. Without this guarantee, the lock screen could appear while the server
    // session is still active, letting DevTools bypass the lock via direct API calls.
    try {
      await apiRequest("POST", "/api/auth/lock-session");
    } catch {
      return; // Server unreachable or call failed — stay unlocked
    }
    try { localStorage.setItem(LOCK_KEY, String(ts)); } catch {}
    doLock(ts);
  };

  const unlock = async (password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiRequest("POST", "/api/auth/verify-password", { password });
      const result = await res.json() as { ok: boolean; error?: string };
      if (result.ok) {
        doUnlock();
        try { localStorage.removeItem(LOCK_KEY); } catch {}
      }
      return result;
    } catch {
      return { ok: false, error: "Failed to verify password" };
    }
  };

  const { showWarning, secondsRemaining, resetTimer } = useIdleTimeout({
    enabled: isAuthenticated && !isLocked,
    onTimeout: () => { lock(); },
  });

  const value: AuthContextType = {
    user: effectiveUser ?? null,
    isLoading: isLoading && !devUser,
    isAuthenticated,
    isLocked,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };

  return (
    <AuthContext.Provider value={value}>
      {isSigningOut && <SigningOutOverlay />}
      {isLocked && effectiveUser && !isSigningOut && (
        <LockScreen
          user={effectiveUser}
          lockedAt={lockedAtRef.current}
          onUnlock={unlock}
          onSignOut={logout}
        />
      )}
      {showWarning && !isSigningOut && !isLocked && (
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
