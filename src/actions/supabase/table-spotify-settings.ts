"use server";

import { BannedChatter } from "@/types/database/banned-chatter";
import { createClient } from "@/lib/supabase/server";

interface Response {
  error?: string;
  affectedRows?: number | null;
}

export async function getSpotifySettings() {
  const supabase = createClient();
  const { data, error } = await supabase.from("spotify_settings").select("*, spotify_banned_chatters(*)").single();

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return {
    data,
  };
}

