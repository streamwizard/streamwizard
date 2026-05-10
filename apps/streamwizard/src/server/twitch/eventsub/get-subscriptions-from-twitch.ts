  import { GetEventSubSubscriptionsResponse } from "@/types/twitch";
import { TwitchAppAPI } from "@/server/axios/twitch-app-token";

export default async function getSubscriptionFromTwitch(twitchUserId: string) {
  const res = await TwitchAppAPI.get<GetEventSubSubscriptionsResponse>(`/eventsub/subscriptions?user_id=${twitchUserId}`);

  return res.data.data;
}
