"use client";

import { useTheme } from "next-themes";
import { useThemeTransitionStore } from "@/stores/light-mode-transition-store";
import { useSessionStore } from "@/stores/session-store";

export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const { isPlaying, trigger } = useThemeTransitionStore();
  const animationsEnabled = useSessionStore((s) => s.preferences.memes_enabled);

  function switchToLight() {
    if (resolvedTheme === "light") return;
    if (isPlaying) return;
    if (!animationsEnabled) { setTheme("light"); return; }
    trigger();
  }

  function withTransition(callback: () => void) {
    if (!document.startViewTransition || document.visibilityState === "hidden") {
      callback();
      return;
    }
    document.startViewTransition(callback);
  }

  function switchToDark() {
    if (resolvedTheme === "dark") return;
    if (!animationsEnabled) { withTransition(() => setTheme("dark")); return; }

    const audio = new Audio(
      `${process.env.NEXT_PUBLIC_CDN_URL}/public/animations/darkmode-transfer.e012277a6b60.webm`
    );
    audio.volume = 0.05;
    audio.play().catch(() => {});

    setTimeout(() => {
      withTransition(() => setTheme("dark"));
    }, 4000);
  }

  function switchToSystem() {
    withTransition(() => setTheme("system"));
  }

  return { switchToLight, switchToDark, switchToSystem };
}
