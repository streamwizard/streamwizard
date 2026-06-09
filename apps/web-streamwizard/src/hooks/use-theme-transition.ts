"use client";

import { useTheme } from "next-themes";
import { useThemeTransitionStore } from "@/stores/light-mode-transition-store";

export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isPlaying, trigger } = useThemeTransitionStore();

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
    if (resolvedTheme === "dark") return;

    const audio = new Audio(
      `${process.env.NEXT_PUBLIC_CDN_URL}/public/animations/darkmode-transfer.e012277a6b60.webm`
    );
    audio.volume = 0.25;
    audio.play().catch(() => {});

    setTimeout(() => {
      withTransition(() => setTheme("dark"));
    }, 3500);
  }

  function switchToSystem() {
    withTransition(() => setTheme("system"));
  }

  return { switchToLight, switchToDark, switchToSystem };
}
