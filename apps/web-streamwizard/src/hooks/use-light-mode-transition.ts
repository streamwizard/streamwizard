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

  function switchToDark() {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    setTheme("dark");
    setTimeout(() => root.classList.remove("theme-transitioning"), 400);
  }

  function switchToSystem() {
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    setTheme("system");
    setTimeout(() => root.classList.remove("theme-transitioning"), 400);
  }

  return { switchToLight, switchToDark, switchToSystem };
}
