import { env } from "@/lib/env";
import axios from "axios";

interface TwitchAppTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Gets a Twitch app access token using the client credentials flow.
 * This token is used for server-to-server API calls that don't require user context.
 * 
 * @returns Promise<string> - The app access token
 * @throws Error if token retrieval fails
 */
export async function getTwitchAppToken(): Promise<string> {
  try {
    const response = await axios.post<TwitchAppTokenResponse>(
      "https://id.twitch.tv/oauth2/token",
      null,
      {
        params: {
          client_id: env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
          client_secret: env.TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        },
      }
    );

    if (!response.data.access_token) {
      throw new Error("No access token received from Twitch");
    }

    console.log(response.data);
    return response.data.access_token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Failed to get Twitch app token:", error.response?.data || error.message);
      throw new Error(`Failed to get Twitch app token: ${error.response?.data?.message || error.message}`);
    } else {
      console.error("Failed to get Twitch app token:", error);
      throw new Error("Failed to get Twitch app token: Unknown error");
    }
  }
}



getTwitchAppToken();