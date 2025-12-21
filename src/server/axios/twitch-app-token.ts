"use server";

import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import axios from "axios";

export const TwitchAppAPI = axios.create({
  baseURL: "https://api.twitch.tv/helix",
  headers: {
    "Client-Id": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
    "Content-Type": "application/json",
    Authorization: `Bearer ${await getTwitchAppToken()}`,
  },
});

export async function getTwitchAppToken(): Promise<string> {
  const { data, error } = await supabaseAdmin.from("twitch_app_token").select("*").single();

  if (error) {
    throw error;
  }

  // Check if token is expired by comparing current time with updated_at + expires_in
  const updatedAtTimestamp = new Date(data.updated_at).getTime();
  const expiresInMs = data.expires_in * 1000; // Convert seconds to milliseconds
  const isExpired = Date.now() > updatedAtTimestamp + expiresInMs;

  if (isExpired) {
    // Refresh token

    const response = await axios.post("https://id.twitch.tv/oauth2/token", null, {
      params: {
        client_id: env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      },
    });
    const { access_token, expires_in } = response.data;
    await updateTwitchAppToken(access_token, expires_in);
    return access_token;
  }

  return data.access_token;
}

// update the app token in supabase
export async function updateTwitchAppToken(accessToken: string, expiresIn: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("twitch_app_token")
    .update({ access_token: accessToken, expires_in: expiresIn })
    .eq("id", "d8a84af6-eb48-4569-ba8c-ae8835e5a3b2")
    .single();

  if (error) {
    throw error;
  }
}
