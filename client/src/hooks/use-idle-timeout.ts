import { useState, useEffect, useCallback, useRef } from "react";

const IDLE_TIMEOUT_MS = import.meta.env.DEV ? 30 * 60 * 1000 : 5 * 60 * 1000;
const WARNING_LEAD_MS = 60 * 1000;
const ACTIVITY_KEY = "guardian_last_activity";

interface UseIdleTimeoutOptions {
  timeoutMs?: number;
  warningLeadMs?: number;
  onTimeout: () => void;
  enabled: boolean;
}

interface UseIdleTimeoutResult {
  showWarning: boolean;
  secondsRemaining: number;
  resetTimer: () => void;
}

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keypress",
  "scroll",
  "touchstart",
  "click",
] as const;

export function useIdleTimeout({
  timeoutMs = IDLE_TIMEOUT_MS,
  warningLeadMs = WARNING_LEAD_MS,
  onTimeout,
  enabled,
}: UseIdleTimeoutOptions): UseIdleTimeoutResult {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningLeadMs / 1000);

  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const warningActiveRef = useRef(false);
  // Throttle local→localStorage writes (at most once per second)
  const lastBroadcastRef = useRef(0);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const clearAll = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    logoutTimerRef.current = null;
    warningTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    warningActiveRef.current = false;
    clearAll();
    setShowWarning(false);
    setSecondsRemaining(warningLeadMs / 1000);

    warningTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true;
      setShowWarning(true);
      setSecondsRemaining(warningLeadMs / 1000);

      countdownRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeoutMs - warningLeadMs);

    logoutTimerRef.current = setTimeout(() => {
      // Before signing out, check if another tab was active within the timeout window.
      // If so, reset our timer instead of logging out.
      try {
        const lastActivity = parseInt(localStorage.getItem(ACTIVITY_KEY) ?? "0", 10);
        const elapsed = Date.now() - lastActivity;
        if (elapsed < timeoutMs) {
          resetTimer();
          return;
        }
      } catch {
        // localStorage unavailable — proceed with logout
      }
      clearAll();
      onTimeoutRef.current();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningLeadMs, clearAll]);

  useEffect(() => {
    if (!enabled) {
      warningActiveRef.current = false;
      clearAll();
      setShowWarning(false);
      return;
    }

    const handle = () => {
      // Broadcast this tab's activity to other tabs (throttled to 1/s)
      const now = Date.now();
      if (now - lastBroadcastRef.current > 1000) {
        lastBroadcastRef.current = now;
        try {
          localStorage.setItem(ACTIVITY_KEY, String(now));
        } catch {
          // ignore
        }
      }

      if (!warningActiveRef.current) {
        resetTimer();
      }
    };

    // Listen for activity broadcast from OTHER tabs via the storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY) return;
      // Another tab was active — reset our timer if we're not already in the warning
      if (!warningActiveRef.current) {
        resetTimer();
      } else {
        // Even if warning is showing, a truly active other tab should dismiss it
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      document.addEventListener(ev, handle, { passive: true })
    );
    window.addEventListener("storage", handleStorage);
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, handle));
      window.removeEventListener("storage", handleStorage);
      clearAll();
    };
  }, [enabled, resetTimer, clearAll]);

  return { showWarning, secondsRemaining, resetTimer };
}
