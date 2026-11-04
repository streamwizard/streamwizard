import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true after. For output that
 * depends on the browser, like times in the viewer's locale: render nothing
 * (or a neutral placeholder) until hydrated so both sides produce the same
 * markup, instead of scattering suppressHydrationWarning.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
