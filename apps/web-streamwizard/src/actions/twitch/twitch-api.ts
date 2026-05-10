"use server";
import { TwitchAPI } from "@/lib/axios/twitch-api";
import { createClient } from "@/lib/supabase/server";
import { ChannelSearchResults, GetGamesResponse, GetUserResponse, SearchCategories } from "@/types/twitch";

export async function searchTwitchChannels(value: string, first: number = 10) {
  const supabase = await createClient();

  const { data, error: DBerror } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (DBerror) {
    console.error("Twitch user ID not found");
    return null;
  }

  try {
    const res = await TwitchAPI.get<ChannelSearchResults>(`/search/channels`, {
      params: {
        query: value,
        first: first,
      },
      broadcasterID: data.twitch_user_id,
    });
    return res.data.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function searchTwitchCategories(broadcaster_id: string, query: string, first: number = 10) {
  const response = await TwitchAPI.get<SearchCategories>("/search/categories", {
    params: {
      first: first,
      query: query,
    },
    broadcasterID: broadcaster_id,
  });
  return response.data.data;
}

// look up a user based on their id
export async function LookupTwitchUser(user_id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("integrations_twitch").select("twitch_user_id").single();
  if (error) {
    console.error("Twitch user ID not found");
    return null;
  }
  const response = await TwitchAPI.get<GetUserResponse>(`/users`, {
    broadcasterID: data.twitch_user_id,
    params: {
      id: user_id,
    },
  });
  return response.data.data[0];
}

// look up games based on game ID
export async function LookupTwitchGame(game_id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("integrations_twitch").select("twitch_user_id").single();
  if (error) {
    console.error("Twitch user ID not found");
    return null;
  }
  const { data: res, status } = await TwitchAPI.get<GetGamesResponse>(`/games`, {

    broadcasterID: data.twitch_user_id,
    params: {
      id: game_id,
    },
  });

  if (status !== 200) {
    console.error("Error fetching game data");
    return null;
  }
  return res.data[0];
}
