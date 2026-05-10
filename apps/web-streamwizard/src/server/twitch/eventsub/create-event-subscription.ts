import { TwitchApi } from "@repo/twitch-api";
import type { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import axios from "axios";

export default async function CreateEventSubSubscription(subscription: CreateEventSubSubscriptionRequest) {
  try {
    const api = new TwitchApi(null);
    const res = await api.eventsub.createSubscription(subscription, "");
    return res.data;
  } catch (error) {
    console.error("Failed to create event sub subscription for type:", subscription.type);

    if (axios.isAxiosError(error)) {
      console.error("Error message:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
      }
    } else {
      console.error("Unexpected error:", error);
    }
  }
}
