"use server";
import { createClient } from "@/utils/supabase/server";
import { TwitchAPI } from "@/config/axios/twitch-api";

export async function searchChatter(value: string) {
  // get the tokens from the database
  const supabase = createClient();

  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    const res = await TwitchAPI.get(`/search/channels`, {
      params: {
        query: value,
        first: 10,
      },

      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "client-id": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
      },
      broadcasterID: data.broadcaster_id,
    });
    return res.data.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}
