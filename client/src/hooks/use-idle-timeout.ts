import { useState, useEffect, useCallback, useRef } from "react";

const IDLE_TIMEOUT_MS = import.meta.env.DEV ? 30 * 60 * 1000 : 5 * 60 * 1000;
const WARNING_LEAD_MS = 60 * 1000;

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
  // True while the warning modal is visible — activity events are ignored in this state
  const warningActiveRef = useRef(false);

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

    // Clear warning state so the modal is dismissed
    warningActiveRef.current = false;
    clearAll();
    setShowWarning(false);
    setSecondsRemaining(warningLeadMs / 1000);

    warningTimerRef.current = setTimeout(() => {
      // Mark warning as active — activity events will now be ignored
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

    // Only reset timer on activity when the warning is NOT showing
    const handle = () => {
      if (!warningActiveRef.current) {
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      document.addEventListener(ev, handle, { passive: true })
    );
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, handle));
      clearAll();
    };
  }, [enabled, resetTimer, clearAll]);

  return { showWarning, secondsRemaining, resetTimer };
}
