import posthog from "posthog-js";
import type { AppEvent, EventProps } from "./event-map";

export type { AppEvent, EventMap } from "./event-map";

// Browser capture, so it follows the visitor's cookie choice. That makes it
// right for the public pages and wrong for anything a signed-in user does:
// most of them decline, their id then changes daily, and the event can't be
// tied to the account. Those go through `trackServer` instead.
export function captureEvent<E extends AppEvent>(event: E, ...[properties]: EventProps<E>) {
  posthog.capture(event, properties);
}
