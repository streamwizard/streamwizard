import { CreateEventSubSubscriptionRequest, EventSubSubscriptionType } from "@/types/twitch";
import { env } from "process";

// Common transport configurations
const CONDUIT_TRANSPORT = {
  method: "conduit" as const,
  conduit_id: "874cdaa4-dd40-4092-8cad-b7691fa2d0dc"
};

const createWebhookTransport = () => ({
  method: "webhook" as const,
  callback: "https://streamwizard.org/api/twitch/eventsub",
  secret: env.TWITCH_WEBHOOK_SECRET
});

// Type for subscription configuration
type SubscriptionConfig = {
  type: EventSubSubscriptionType;
  version: string;
  condition: (userId: string) => Record<string, any>;
};

// Configure all conduit subscriptions with their conditions
const conduitSubscriptions: SubscriptionConfig[] = [
  {
    type: "stream.online",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "stream.offline",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },

  {
    type: "channel.chat.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId, user_id: userId })
  },
  {
    type: "channel.follow",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId, moderator_user_id: userId })
  },
  {
    type: "channel.raid",
    version: "1",
    condition: (userId) => ({ to_broadcaster_user_id: userId })

  },
  {
    type: "channel.cheer",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.subscribe",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.subscription.gift",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.subscription.message",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.update",
    version: "2",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.channel_points_custom_reward_redemption.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.channel_points_custom_reward.add",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.channel_points_custom_reward.remove",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.channel_points_custom_reward.update",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.poll.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.poll.progress",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.poll.end",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.hype_train.begin",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.hype_train.progress",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
  {
    type: "channel.hype_train.end",
    version: "1",
    condition: (userId) => ({ broadcaster_user_id: userId })
  },
];

export default async function NeededEventSubscriptions(
  twitchUserId: string
): Promise<CreateEventSubSubscriptionRequest[]> {
  // Generate conduit subscriptions with conditions
  const conduitRequests = conduitSubscriptions.map(({ type, version, condition }) => ({
    type,
    version,
    condition: condition(twitchUserId),
    transport: CONDUIT_TRANSPORT
  }));

  // Webhook subscription
  const webhookRequest = {
    type: "stream.offline" as const,
    version: "1",
    condition: { broadcaster_user_id: twitchUserId },
    transport: createWebhookTransport()
  };

  return [webhookRequest, ...conduitRequests];
}