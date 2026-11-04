import { TwitchApi } from "@repo/twitch-api";
import { reportError } from "@repo/sentry";
import type { NeededEventSubscription } from "@repo/twitch-eventsub/subscriptions";

export default async function CreateEventSubSubscription(subscription: NeededEventSubscription) {
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
