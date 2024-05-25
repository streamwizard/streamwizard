import { get_twitch_integration } from "@/actions/supabase/table-twitch_integration";
import { BannedSongsProvider } from "@/providers/banned-songs-provider";
import { createClient } from "@/lib/supabase/server";
import React from "react";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const { data, error } = await supabase.from("spotify_settings").select("*, spotify_banned_songs(*)").single();
  const userdata = await get_twitch_integration();

  if (error || !data || !userdata) {
    return <div>Loading...</div>;
  }

  return (
    <BannedSongsProvider
      broadcaster_id={data.broadcaster_id}
      editor={userdata?.account}
      initialBannedSongs={data.spotify_banned_songs}
      settings_id={data.id}
      user_id={data.user_id}
    >
      {children}
    </BannedSongsProvider>
  );

}
