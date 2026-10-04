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
