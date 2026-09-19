import { PostHog } from "posthog-node";
import type { AppEvent } from "./events";

let client: PostHog | null | undefined;

// Server-side events skip the /ingest reverse proxy (that exists to dodge
// ad blockers, which don't apply here) and talk to PostHog directly.
// flushAt 1 / flushInterval 0 because route handlers and gateway callbacks
// are too short-lived for batching — an unflushed batch is a lost event.
function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    client = null;
    return client;
  }
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

// $process_person_profile: false — these fire regardless of the visitor's
// cookie choice (legitimate interest), so they must not create a PostHog
// person profile on their own; the privacy policy promises "no profile" to
// anyone who declined. The event still carries the user id as distinct_id,
// and once a consenting user is identified client-side it attaches to their
// profile like any other event.
//
// `request` is the visitor's own request when the event is a reaction to one
// (an OAuth callback, say). Only its user agent is forwarded: PostHog derives
// `$virt_traffic_type` from `$raw_user_agent` at query time, and an event
// without one is classed as "Automation", which every bot-filtered chart
// (web analytics included) then hides. Nothing else from the request — no IP,
// no geo — because these events don't wait for consent.
export function captureServerEvent(
  distinctId: string,
  event: AppEvent,
  properties?: Record<string, unknown>,
  request?: Pick<Request, "headers">,
) {
  const userAgent = request?.headers.get("user-agent");
  getClient()?.capture({
    distinctId,
    event,
    properties: {
      $process_person_profile: false,
      ...(userAgent ? { $raw_user_agent: userAgent } : {}),
      ...properties,
    },
  });
}

export async function shutdownPostHog(): Promise<void> {
  await client?.shutdown();
}
