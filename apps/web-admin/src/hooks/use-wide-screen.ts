"use client";

import { useSyncExternalStore } from "react";

// Same line as the sidebar: below it the app is in phone layout.
const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * True from 768px up, false below, and null until the browser has answered
 * (server render and hydration). Callers that must not mount something on a
 * phone treat null as "not yet".
 */
export function useWideScreen(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
}
