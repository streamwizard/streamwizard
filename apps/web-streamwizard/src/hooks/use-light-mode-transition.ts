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

  return { switchToLight, setTheme };
}
