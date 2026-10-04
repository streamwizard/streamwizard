import { TwitchApi } from "@repo/twitch-api";
import { buildNeededEventSubscriptions, eventSubWebhookCallback, type NeededEventSubscription } from "@repo/types";
import { env } from "@/lib/env";
import { diffUserSubscriptions, type UserSubscriptionDiff } from "./user-eventsub";

// Server-only. Reads one channel's subscriptions from Helix with the app
// token, the same call web-streamwizard's login check makes.

export type UserEventSubState =
  | { configured: false; reason: string }
  | { configured: true; diff: UserSubscriptionDiff; fetchedAt: string };

/**
 * The expected list for a channel. Webhooks are left out in development like
 * web-streamwizard does (no HTTPS callback there). The secret is only
 * included when set, so the diff still works without it.
 */
export function neededFor(twitchUserId: string, scopes: readonly string[] | null): NeededEventSubscription[] | null {
  if (!env.TWITCH_CONDUIT_ID) return null;
  return buildNeededEventSubscriptions({
    twitchUserId,
    grantedScopes: scopes,
    conduitId: env.TWITCH_CONDUIT_ID,
    webhook:
      env.NODE_ENV === "development"
        ? null
        : { callback: eventSubWebhookCallback(env.STREAMWIZARD_API_URL), secret: env.TWITCH_WEBHOOK_SECRET },
  });
}

export function helixConfigured(): boolean {
  return !!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET && env.TWITCH_CONDUIT_ID);
}

export async function loadUserEventSub(twitchUserId: string, scopes: readonly string[] | null): Promise<UserEventSubState> {
  const needed = neededFor(twitchUserId, scopes);
  if (!needed || !helixConfigured()) {
    return { configured: false, reason: "Set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET and TWITCH_CONDUIT_ID to read EventSub." };
  }
  const { data } = await new TwitchApi().eventsub.getSubscriptions(twitchUserId);
  return { configured: true, diff: diffUserSubscriptions(data, needed), fetchedAt: new Date().toISOString() };
}
