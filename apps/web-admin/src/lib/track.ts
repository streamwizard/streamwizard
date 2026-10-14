import { configureTracking, trackServer, type AppEvent, type EventMap } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";

configureTracking({
  app: "web-admin",
  onError: (error) => reportError(error, "posthog: server capture"),
});

// Records something an admin did, keyed on the admin's account id (the value
// assertAdmin() returns). Server-side only: web-admin has no browser PostHog.
// Not flagged internal_user: these events exist to measure admin work, and
// dashboards that hide internal users would hide them too.
// Never throws: tracking must not fail the action it describes.
export function trackAdmin<E extends AppEvent>(actorId: string, event: E, properties: EventMap[E]): void {
  try {
    trackServer(actorId, event, properties);
  } catch (error) {
    reportError(error, "posthog: track admin");
  }
}
