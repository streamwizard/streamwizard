import { env } from "@/lib/env";
import { GetEventSubSubscriptionsResponse } from "@/types/twitch";
import axios from "axios";

export default async function getSubscriptionFromTwitch(twitchUserId: string) {
  const res = await axios.get<GetEventSubSubscriptionsResponse>("https://api.twitch.tv/helix/eventsub/subscriptions", {
    headers: {
      "Client-Id": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
      Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`,
    },
    params: {
      user_id: twitchUserId,
    },
  });

  return res.data.data;
}
