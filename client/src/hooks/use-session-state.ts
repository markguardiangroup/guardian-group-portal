import { useState, useEffect, useRef } from "react";

/**
 * Like useState, but the value is persisted to sessionStorage under `key` so it
 * survives page navigations and refreshes for the current browser tab/session,
 * while resetting when the tab/browser is closed. Used to remember list-page
 * filters (search, status, sort, etc.) without persisting them permanently.
 */
export function useSessionState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const isFirstRender = useRef(true);
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // ignore malformed/inaccessible storage and fall back to default
    }
    return defaultValue;
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage may be unavailable (e.g. private browsing quota) — safe to ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return [value, setValue];
}
