"use client";

import { useTheme } from "next-themes";
import { useLightModeTransitionStore } from "@/stores/light-mode-transition-store";

export function useLightModeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isPlaying, trigger } = useLightModeTransitionStore();

  function switchToLight() {
    if (resolvedTheme === "light") return;
    if (isPlaying) return;
    trigger();
  }

  function withTransition(callback: () => void) {
    if (!document.startViewTransition) {
      callback();
      return;
    }
    document.startViewTransition(callback);
  }

  function switchToDark() {
    withTransition(() => setTheme("dark"));
  }

  function switchToSystem() {
    withTransition(() => setTheme("system"));
  }

  return { switchToLight, switchToDark, switchToSystem };
}
