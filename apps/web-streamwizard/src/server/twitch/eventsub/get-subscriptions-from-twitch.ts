import { TwitchApi } from "@repo/twitch-api";

export default async function getSubscriptionFromTwitch(twitchUserId: string) {
  const api = new TwitchApi(null);
  const res = await api.eventsub.getSubscriptions(twitchUserId);
  return res.data;
}
