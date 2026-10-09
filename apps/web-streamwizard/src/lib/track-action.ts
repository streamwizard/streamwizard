import type { EventMap } from "@repo/posthog";
import type { RelayedEvent } from "./activity-events";

// Reports something a signed-in user did in the dashboard that no server
// action sees (copying a link, playing a clip). The server records it under
// their account, so it counts whatever they answered on the cookie banner.
//
// Fire and forget: `keepalive` lets it finish if the click also navigates, and
// a failure is dropped silently. Analytics must never be why a button broke.
export function trackAction<E extends RelayedEvent>(event: E, properties: EventMap[E]): void {
  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fetch itself threw (no network stack in an odd webview): same answer.
  }
}
