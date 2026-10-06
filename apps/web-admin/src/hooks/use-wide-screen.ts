"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same line as the sidebar: below it the app is in phone layout.
const DEFAULT_MIN_WIDTH = 768;

/**
 * True from `minWidth` (768px unless given) up, false below, and null until
 * the browser has answered (server render and hydration). Callers that must
 * not mount something on a phone treat null as "not yet".
 */
export function useWideScreen(minWidth: number = DEFAULT_MIN_WIDTH): boolean | null {
  const query = `(min-width: ${minWidth}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => null,
  );
}
