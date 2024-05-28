import { get_twitch_integration } from "@/actions/supabase/table-twitch_integration";
import { BannedSongsProvider } from "@/providers/banned-songs-provider";
import { createClient } from "@/lib/supabase/server";
import React from "react";
import { auth } from "@/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("spotify_settings").select("*, spotify_banned_songs(*)").single();
 

  if(error) {
    console.error(error);
    return;
  }


  return (
    <BannedSongsProvider
      editor={session?.user.name!}
      initialBannedSongs={data.spotify_banned_songs}
      settings_id={data.id}
      user_id={data.user_id}
    >
      {children}
    </BannedSongsProvider>
  );

}
