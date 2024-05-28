"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { InserSpotifyBannedChatterTable, SpotifyBannedSongsTable } from "@/types/database";
import { revalidatePath } from "next/cache";

interface Response {
  error?: string;
  affectedRows?: number | null;
}

export async function getBannedChatters() {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);
  const { data, error } = await supabase.from("spotify_banned_chatters").select("*");

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return {
    data,
  };
}

export async function addBannedChatter(chatter: InserSpotifyBannedChatterTable, url: string): Promise<Response> {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);
  const { count, error } = await supabase.from("spotify_banned_chatters").insert([chatter]);

  if (error) {
    console.error(error);
    revalidatePath(url);
    return { error: error.message };
  }
  revalidatePath(url);
  return { affectedRows: count };
}

export async function removeBannedChatter(id: string, url: string): Promise<Response> {
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);
  const { error, count } = await supabase.from("spotify_banned_chatters").delete().eq("id", id);

  if (error) {
    console.error(error);
    revalidatePath(url);
    return { error: error.message };
  }
  revalidatePath(url);
  return { affectedRows: count };
}
