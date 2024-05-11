'use server'

import { BannedChatter } from "@/types/database/banned-chatter";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";


interface Response {
  error?: string;
  affectedRows?: number | null;
}


export async function getBannedChatters(): Promise<Response>	{
  const supabase = createClient();
  const { data, error } = await supabase.from("banned_chatters").select("*");

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return {

  };
}

export async function addBannedChatter(chatter: BannedChatter, url: string): Promise<Response> {
  const supabase = createClient();
  console.log(chatter);
  const { count, error } = await supabase.from("spotify_banned_chatters").insert([chatter]);

  if (error) {
    console.log(error);
    revalidatePath(url);
    return { error: error.message };
  }
  revalidatePath(url)
  return { affectedRows: count };
}

export async function removeBannedChatter(id: string, url: string): Promise<Response> {
  const supabase = createClient();
  const { error, count } = await supabase.from("spotify_banned_chatters").delete().eq("id", id);

  if (error) {
    console.error(error);
    revalidatePath(url)
    return { error: error.message };
  }
  revalidatePath(url)
  return { affectedRows: count };
}