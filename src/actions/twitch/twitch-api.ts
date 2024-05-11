"use server";
import { createClient } from "@/utils/supabase/server";
import { TwitchAPI } from "@/config/axios/twitch-api";
import { ChannelSearchResult, ChannelSearchResults, getTwitchUserResponse } from "@/types/API/twitch";

export async function searchChatter(value: string, first: number = 10) {
  // get the tokens from the database
  const supabase = createClient();

  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    const res = await TwitchAPI.get<ChannelSearchResults>(`/search/channels`, {
      params: {
        query: value,
        first: first,
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

export async function getUser({ id }: { id: string }) {
  
  // get broadcaster_id
  const supabase = createClient();
  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }


  
  try {
    const res = await TwitchAPI.get<getTwitchUserResponse>(`/users`, {
      params: {
        id: id,
      },
      broadcasterID: data.broadcaster_id,
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });
  
    return res.data.data;
  } catch (error) {
    console.log(error);
  }
}
