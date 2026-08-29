"use client";

import { useCallback } from "react";
import { captureEvent } from "@repo/posthog";

/*
 * `demo_interacted` for the playable mocks on the public pages.
 *
 * Each (demo, action) pair fires once per page visit. The question the event
 * answers is "did they touch the demo, and which controls", not "how many
 * times": a visitor scrubbing the VOD timeline would otherwise send an event
 * per frame, and request batching is off.
 *
 * The dedupe registry is module-level and keyed by pathname, not per hook
 * instance: the clip lightbox is mounted by both the marquee and the folders
 * mock on the same page, and per-instance sets let the same (demo, action)
 * fire once per mount. Navigating to another page clears the registry, so a
 * return visit counts again.
 */
const seenByPage = new Map<string, Set<string>>();

export function useDemoTracking(demo: string) {
  return useCallback(
    (action: string, properties?: Record<string, unknown>) => {
      const page = window.location.pathname;
      let seen = seenByPage.get(page);
      if (!seen) {
        seenByPage.clear();
        seen = new Set();
        seenByPage.set(page, seen);
      }
      const key = `${demo}:${action}`;
      if (seen.has(key)) return;
      seen.add(key);
      captureEvent("demo_interacted", { demo, action, ...properties });
    },
    [demo],
  );
}
