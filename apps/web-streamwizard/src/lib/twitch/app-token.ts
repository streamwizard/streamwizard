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

/**
 * Gets a cached Twitch app token or fetches a new one.
 * This is a simple in-memory cache that expires after 50 days (tokens typically last 60 days).
 * 
 * @returns Promise<string> - The cached or newly fetched app access token
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getCachedTwitchAppToken(): Promise<string> {
  const now = Date.now();
  
  // Check if we have a cached token that's still valid (with 10 day buffer)
  if (cachedToken && now < cachedToken.expiresAt - (10 * 24 * 60 * 60 * 1000)) {
    return cachedToken.token;
  }

  // Fetch new token
  const token = await getTwitchAppToken();
  
  // Cache the token for 50 days (tokens typically last 60 days)
  cachedToken = {
    token,
    expiresAt: now + (50 * 24 * 60 * 60 * 1000),
  };

  return token;
}

/**
 * Simple function to get the Twitch app token - uses cached version by default.
 * This is the main function you should use in your application.
 * 
 * @returns Promise<string> - The Twitch app access token
 */
export async function getTwitchToken(): Promise<string> {
  return getCachedTwitchAppToken();
}
