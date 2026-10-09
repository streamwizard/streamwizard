"use client";

import { useSyncExternalStore } from "react";
import { isConsentResolved, onConsentResolved } from "./consent";

// Whether the cookie banner question is settled. False on the server and
// during hydration (the answer lives in the browser), then the real value.
export function useConsentResolved(): boolean {
  return useSyncExternalStore(onConsentResolved, isConsentResolved, () => false);
}
