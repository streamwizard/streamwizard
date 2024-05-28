"use server";

import { SpotifyWebAPi } from "@/config/axios/spotify-web-api";
import { SearchResponse } from "@/types/API/spotify-web-api";
import { createClient } from "@/lib/supabase/server";
import { auth } from "@/auth";

export async function SearchSongs({ query, limit = 10, offset = 0 }: { query: string; limit: number; offset: number }) {
  const sessions = await auth();
  const supabase = createClient(sessions?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("spotify_integrations").select("access_token").single();

  if (error || !data) {
    console.error("Error getting access token");
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
      user_id: sessions?.user.id,
    });

    return res.data.tracks;
  } catch (error) {
    console.error(error);
  }
}
