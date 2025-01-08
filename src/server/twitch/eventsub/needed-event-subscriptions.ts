import { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import { env } from "process";

export default async function NeededEventSubscriptions(twitchUserId: string): Promise<CreateEventSubSubscriptionRequest[]> {
  return [
    // webhooks
    {
      type: "stream.offline",
      version: "1",
      condition: {
        broadcaster_user_id: twitchUserId,
      },
      transport: {
        method: "webhook",
        callback: "https://streamwizard.org/api/twitch/eventsub",
        secret: env.TWITCH_WEBHOOK_SECRET,
      },
    },
  ];
}
