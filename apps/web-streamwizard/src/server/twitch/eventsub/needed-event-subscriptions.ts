import { buildNeededEventSubscriptions, eventSubWebhookCallback } from "@repo/types";
import { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import { env } from "@/lib/env";

/**
 * The subscriptions this channel should have; see buildNeededEventSubscriptions
 * for how `grantedScopes` filters them. Webhook subscriptions require HTTPS,
 * so development skips them.
 */
export default async function NeededEventSubscriptions(
  twitchUserId: string,
  grantedScopes: readonly string[] | null,
): Promise<CreateEventSubSubscriptionRequest[]> {
  const conduitId = env.TWITCH_CONDUIT_ID;
  const apiUrl = env.STREAMWIZARD_API_URL;

  if (!conduitId || !apiUrl) {
    throw new Error(
      "TWITCH_CONDUIT_ID and STREAMWIZARD_API_URL must be set in the environment for EventSub subscription setup.",
    );
  }

  return buildNeededEventSubscriptions({
    twitchUserId,
    grantedScopes,
    conduitId,
    webhook:
      env.NODE_ENV === "development"
        ? null
        : { callback: eventSubWebhookCallback(apiUrl), secret: env.TWITCH_WEBHOOK_SECRET },
  });
}
