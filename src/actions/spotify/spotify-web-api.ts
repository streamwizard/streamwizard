"use server";

import { SpotifyWebAPi } from "@/config/axios/spotify-web-api";
import { SearchResponse } from "@/types/API/spotify-web-api";
import { createClient } from "@/utils/supabase/server";

export async function SearchSongs({ query, limit = 10, offset = 0 }: { query: string; limit: number; offset: number }) {
  const supabase = createClient();

  const { data, error } = await supabase.from("spotify_integrations").select("access_token, twitch_channel_id").single();

  if (error || !data) {
    console.log("Error getting access token");
    return;
  }

  try {
    const res = await SpotifyWebAPi.get<SearchResponse>("/search", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
      params: {
        q: query,
        type: "track",
        limit,
        offset,
      },
      broadcasterID: data.twitch_channel_id,
    });

    return res.data.tracks;
  } catch (error) {
    console.log(error);
  }
}
