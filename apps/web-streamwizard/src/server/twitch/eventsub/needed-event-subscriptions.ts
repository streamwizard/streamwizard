import { CONDUIT_SUBSCRIPTIONS, WEBHOOK_SUBSCRIPTIONS } from "@repo/types";
import { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import { env } from "@/lib/env";

/**
 * `grantedScopes` is the token's scope list. A subscription with a
 * `requiredScope` is left out when the list lacks it or is unknown (null), so
 * a token from before that scope existed doesn't fail the create on every
 * login.
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

  const conduitTransport = {
    method: "conduit" as const,
    conduit_id: conduitId,
  };

  // Generate conduit subscriptions with conditions
  const granted = new Set(grantedScopes ?? []);
  const conduitRequests = CONDUIT_SUBSCRIPTIONS
    .filter(({ requiredScope }) => !requiredScope || granted.has(requiredScope))
    .map(({ type, version, condition }) => ({
    type,
    version,
    condition: condition(twitchUserId),
    transport: conduitTransport,
  }));

  // Webhook subscriptions require HTTPS — skip in development
  if (env.NODE_ENV === "development") {
    return conduitRequests;
  }

  const createWebhookTransport = () => ({
    method: "webhook" as const,
    callback: `${apiUrl}/webhooks/twitch/eventsub`,
    secret: env.TWITCH_WEBHOOK_SECRET,
  });

  const webhookRequests = WEBHOOK_SUBSCRIPTIONS.map(({ type, version, condition }) => ({
    type,
    version,
    condition: condition(twitchUserId),
    transport: createWebhookTransport(),
  }));

  return [...webhookRequests, ...conduitRequests];
}
