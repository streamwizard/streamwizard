"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { UpdateSpotifySettingsTable } from "@/types/database";
import { revalidatePath } from "next/cache";

interface Response {
  error?: string;
  affectedRows?: number | null;
}

export async function getSpotifySettings() {
  const sessions = await auth();

  const supabase = createClient(sessions?.supabaseAccessToken as string);
  const { data, error } = await supabase.from("spotify_settings").select("*, spotify_banned_chatters(*)").single();

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return {
    data,
  };
}



export async function updateSpotifySettings(Settings: UpdateSpotifySettingsTable, id: string) {
  const sessions = await auth();

  const supabase = createClient(sessions?.supabaseAccessToken as string);
  const { error } = await supabase.from("spotify_settings").update(Settings).eq("id", id);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/spotify/song-request-settings");
  return {
    affectedRows: 1,
  };

}