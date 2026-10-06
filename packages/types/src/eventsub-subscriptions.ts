import type { EventSubSubscriptionType } from "./eventsub";

/**
 * The EventSub subscriptions StreamWizard creates for every connected
 * channel. web-streamwizard creates them on login; web-admin's /eventsub page
 * reads the same lists to show which types should exist and how each arrives.
 */
export type EventSubSubscriptionConfig = {
  type: EventSubSubscriptionType;
  version: string;
  condition: (userId: string) => Record<string, unknown>;
  /** Scope added to base after launch; skipped until the token carries it. */
  requiredScope?: string;
};

/** Delivered over the conduit to streamwizard-bot's WebSocket shards. */
export const CONDUIT_SUBSCRIPTIONS: readonly EventSubSubscriptionConfig[] = [
  {
    type: "channel.chat.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.notification",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.message_delete",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.clear",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.chat.clear_user_messages",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId }),
  },
  {
    type: "channel.shoutout.create",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.shoutout.receive",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.follow",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId }),
  },
  {
    type: "channel.raid",
    version: "1",
    condition: (userId) => ({ to_broadcaster_user_id: userId }),
  },
  {
    type: "channel.cheer",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscribe",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscription.gift",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.subscription.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.update",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward_redemption.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.remove",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.channel_points_custom_reward.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.poll.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:polls",
  },
  {
    type: "channel.poll.progress",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:polls",
  },
  {
    type: "channel.poll.end",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:polls",
  },
  {
    type: "channel.hype_train.begin",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.hype_train.progress",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.hype_train.end",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.ad_break.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:ads",
  },
  {
    type: "channel.goal.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:goals",
  },
  {
    type: "channel.goal.progress",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:goals",
  },
  {
    type: "channel.goal.end",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
    requiredScope: "channel:read:goals",
  },
];

/** Delivered to rest-api's webhook. Needs HTTPS, so development skips these. */
export const WEBHOOK_SUBSCRIPTIONS: readonly EventSubSubscriptionConfig[] = [
  {
    type: "stream.offline",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "stream.online",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
  {
    type: "channel.update",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId }),
  },
];

/** A Create EventSub Subscription body for one channel. */
export type NeededEventSubscription = {
  type: EventSubSubscriptionType;
  version: string;
  condition: Record<string, unknown>;
  transport:
    | { method: "conduit"; conduit_id: string }
    | { method: "webhook"; callback: string; secret?: string };
};

/**
 * The subscriptions one channel should have. `grantedScopes` is the token's
 * scope list: a subscription with a `requiredScope` is left out when the list
 * lacks it or is unknown (null), so a token from before that scope existed
 * doesn't fail the create on every login. `webhook` null skips the webhook
 * set (development has no HTTPS callback). `secret` is only needed to create;
 * comparing against Twitch needs just the callback.
 */
export function buildNeededEventSubscriptions(options: {
  twitchUserId: string;
  grantedScopes: readonly string[] | null;
  conduitId: string;
  webhook: { callback: string; secret?: string } | null;
}): NeededEventSubscription[] {
  const { twitchUserId, conduitId, webhook } = options;
  const granted = new Set(options.grantedScopes ?? []);

  const conduit = CONDUIT_SUBSCRIPTIONS.filter(({ requiredScope }) => !requiredScope || granted.has(requiredScope)).map(
    ({ type, version, condition }): NeededEventSubscription => ({
      type,
      version,
      condition: condition(twitchUserId),
      transport: { method: "conduit", conduit_id: conduitId },
    }),
  );
  if (!webhook) return conduit;

  const webhooks = WEBHOOK_SUBSCRIPTIONS.map(
    ({ type, version, condition }): NeededEventSubscription => ({
      type,
      version,
      condition: condition(twitchUserId),
      transport: { method: "webhook", ...webhook },
    }),
  );
  return [...webhooks, ...conduit];
}

/** rest-api's EventSub webhook route, from its base URL. */
export const eventSubWebhookCallback = (apiUrl: string) => `${apiUrl}/webhooks/twitch/eventsub`;
