"use server";
import { BannedSongs } from "@/types/database/banned-songs";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// add a banned song to the database
export async function addBannedSong(song: BannedSongs) {
  const supabase = createClient();

  const { data, error } = await supabase.from("spotify_banned_songs").insert([song]);

  if (error) {
    console.error(error);
    throw error;
  }
  revalidatePath("/dashboard/banned-songs");
  return data;
}

// get all banned songs from the database
export async function getBannedSongs() {
  const supabase = createClient();
  const { data, error } = await supabase.from("spotify_banned_songs").select("*");

  if (error) throw error;
  return data;
}

// delete a banned song from the database
export async function deleteBannedSong(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("spotify_banned_songs").delete().match({ id });

  if (error) {
    console.error(error);
    throw new Error("Failed to delete the song");
  }
  revalidatePath("/dashboard/banned-songs");
}
