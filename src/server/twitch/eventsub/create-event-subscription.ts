import { env } from "@/lib/env";
import { CreateEventSubSubscriptionRequest } from "@/types/twitch";
import axios from "axios";

export default async function CreateEventSubSubscription(subscription: CreateEventSubSubscriptionRequest) {
  try {
    const res = await axios.post("https://api.twitch.tv/helix/eventsub/subscriptions", subscription, {
      headers: {
        "Client-Id": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  
    return res.data;
  } catch (error) {
    console.error('Failed to create event sub subscription for type:', subscription.type);

    if (axios.isAxiosError(error)) {
      console.error('Error message:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
  
}
