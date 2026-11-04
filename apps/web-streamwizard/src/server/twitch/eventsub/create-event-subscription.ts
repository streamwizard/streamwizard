import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import type { CreateEventSubSubscriptionRequest } from "@/types/twitch";

export default async function CreateEventSubSubscription(subscription: CreateEventSubSubscriptionRequest) {
  try {
    const api = new TwitchApi(null);
    const res = await api.eventsub.createSubscription(subscription, "");
    return res.data;
  } catch (error) {
    // A missing EventSub subscription means Twitch events silently stop
    // flowing for this broadcaster — that must reach Sentry, not just logs.
    // reportError logs the method, path, status and Twitch's error message.
    reportError(error, `eventsub.createSubscription: ${subscription.type}`);
  }
}
