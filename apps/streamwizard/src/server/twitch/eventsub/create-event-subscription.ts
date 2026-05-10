import { TwitchAppAPI } from "@/server/axios/twitch-app-token";
import { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import axios from "axios";

export default async function CreateEventSubSubscription(subscription: CreateEventSubSubscriptionRequest) {
  try {
    const res = await TwitchAppAPI.post("/eventsub/subscriptions", subscription);
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

// get the app token from supabase
