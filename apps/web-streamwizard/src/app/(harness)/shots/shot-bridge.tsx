"use client";

import { useEffect } from "react";
import { buildDemoEvent, type DemoEventType } from "@repo/schemas";
import { ALERT_TEST_BROWSER_EVENT } from "@repo/ui/overlay";

/**
 * One fake viewer roster for every screenshot, so no real person's name ever
 * lands in the documentation and the images do not date when someone changes
 * their Twitch handle.
 */
export const SHOT_VIEWERS = ["novaplays", "kettlecorn", "bitpilot", "m0ss", "ravenought"] as const;

declare global {
  interface Window {
    __shots?: {
      fire: (
        type: DemoEventType,
        opts?: { variant?: string; userName?: string; nth?: number },
      ) => void;
    };
  }
}

/**
 * Exposes the app's own fixture builders on window, so the Playwright side
 * never has to reimplement an EventSub payload. Every stateful widget already
 * listens for ALERT_TEST_BROWSER_EVENT, which is what the editor's demo bar
 * uses in Local mode.
 */
export function ShotBridge({ sceneId }: { sceneId: string }) {
  useEffect(() => {
    window.__shots = {
      fire(type, opts) {
        const userName = opts?.userName ?? SHOT_VIEWERS[(opts?.nth ?? 0) % SHOT_VIEWERS.length];
        const message = buildDemoEvent(type, { userName }, opts?.variant);
        window.dispatchEvent(
          new CustomEvent(ALERT_TEST_BROWSER_EVENT, { detail: { sceneId, message } }),
        );
      },
    };
    document.documentElement.setAttribute("data-shot-ready", "1");
    return () => {
      delete window.__shots;
      document.documentElement.removeAttribute("data-shot-ready");
    };
  }, [sceneId]);

  return null;
}
