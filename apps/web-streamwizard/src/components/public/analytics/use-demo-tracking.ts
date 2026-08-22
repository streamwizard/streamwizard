"use client";

import { useCallback, useRef } from "react";
import { captureEvent } from "@repo/posthog";

/*
 * `demo_interacted` for the playable mocks on the public pages.
 *
 * Each (demo, action) pair fires once per mount. The question the event
 * answers is "did they touch the demo, and which controls", not "how many
 * times": a visitor scrubbing the VOD timeline would otherwise send an event
 * per frame, and request batching is off.
 */
export function useDemoTracking(demo: string) {
  const seen = useRef(new Set<string>());

  return useCallback(
    (action: string, properties?: Record<string, unknown>) => {
      if (seen.current.has(action)) return;
      seen.current.add(action);
      captureEvent("demo_interacted", { demo, action, ...properties });
    },
    [demo],
  );
}
