import { PostHog } from "posthog-node";
import type { AppEvent, EventMap } from "./event-map";

export { isInternalEmail } from "./internal";
export type { AppEvent, EventMap } from "./event-map";

interface TrackingConfig {
  // Which app sent the event ("web-streamwizard", "discord-bot", ...). Lands on
  // every event as `app`, so a chart can tell the sources apart.
  app: string;
  // Transport failures surface here, long after trackServer returned, so the
  // caller's own try/catch never sees them.
  onError?: (error: unknown) => void;
}

export interface TrackOptions {
  // The visitor's own request, when the event is a reaction to one. Only its
  // user agent is forwarded: PostHog derives `$virt_traffic_type` from
  // `$raw_user_agent` at query time, and an event without one is classed as
  // "Automation", which every bot-filtered chart (web analytics included) then
  // hides. Nothing else from the request — no IP, no geo — because these
  // events don't wait for consent.
  request?: Pick<Request, "headers">;
  // For callers that know the account is one of ours by something other than
  // its id (the web app checks the email domain).
  internal?: boolean;
  // The browser reported this one (through an authenticated route) rather
  // than the server seeing it happen. Lands on the event as `relayed: true`.
  relayed?: boolean;
}

let config: TrackingConfig | undefined;
let client: PostHog | null | undefined;

// Call once per app, before the first event.
export function configureTracking(next: TrackingConfig): void {
  config = next;
}

function report(error: unknown): void {
  if (config?.onError) config.onError(error);
  else console.error("[posthog]", error);
}

// Same source as @repo/sentry: Doppler's NODE_ENV, which the Next apps copy
// into APP_ENV at build time because their runtime NODE_ENV is always
// "production".
function environment(): string | undefined {
  return process.env.APP_ENV || process.env.NODE_ENV || undefined;
}

// Only deployed environments send. The dev Doppler configs carry the staging
// key, so without this every local click lands in the staging project.
const SENDING_ENVIRONMENTS = new Set(["production", "staging"]);

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
  client.on("error", report);
  return client;
}

// These events have no person profile, so the "Internal / Test users" cohort
// (a person property) can't exclude them. An event property can: the project's
// test-account filter also drops `internal_user = true`. The id list is the one
// check that works everywhere, including apps that only ever see an account id
// (the overlay, the bots).
const isInternalUserId = idList("POSTHOG_INTERNAL_USER_IDS");

// The privacy policy lets anyone object to these events (they rest on
// legitimate interest, so GDPR Art. 21 applies). An account on this list is
// never sent to PostHog at all, from any app.
const hasOptedOut = idList("POSTHOG_OPT_OUT_USER_IDS");

// A comma-separated env var as a membership test. Re-parsed only when the
// value changes, so a test (or a config reload) can swap it without a restart.
function idList(envKey: string): (userId: string) => boolean {
  let source: string | undefined;
  let ids = new Set<string>();
  return (userId) => {
    const current = process.env[envKey] ?? "";
    if (current !== source) {
      source = current;
      ids = new Set(
        current
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    }
    return ids.has(userId);
  };
}

// Records something an account did, keyed on the account id, whatever the
// visitor answered on the cookie banner (legitimate interest).
//
// $process_person_profile: false — so it must not create a PostHog person
// profile on its own; the privacy policy promises "no profile" to anyone who
// declined. The event still carries the user id as distinct_id, and once a
// consenting user is identified client-side it attaches to their profile like
// any other event.
//
// Never throws and never waits: tracking must not be able to fail or slow the
// action it describes.
export function trackServer<E extends AppEvent>(
  userId: string,
  event: E,
  properties: EventMap[E],
  options?: TrackOptions,
): void {
  try {
    const env = environment();
    if (!env || !SENDING_ENVIRONMENTS.has(env)) return;
    if (hasOptedOut(userId)) return;
    const userAgent = options?.request?.headers.get("user-agent");
    getClient()?.capture({
      distinctId: userId,
      event,
      // Ours go last so a caller's properties can't switch the profile back on
      // or relabel the environment.
      properties: {
        ...properties,
        ...(userAgent ? { $raw_user_agent: userAgent } : {}),
        ...(config?.app ? { app: config.app } : {}),
        ...(options?.internal || isInternalUserId(userId) ? { internal_user: true } : {}),
        ...(options?.relayed ? { relayed: true } : {}),
        environment: env,
        $process_person_profile: false,
      },
    });
  } catch (error) {
    report(error);
  }
}

// Await before a deliberate exit (SIGTERM on deploy), or the events still in
// flight go down with the process.
export async function flushTracking(): Promise<void> {
  try {
    await client?.shutdown();
  } catch (error) {
    report(error);
  }
}
