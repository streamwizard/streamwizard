'use server'
import { Twitch_integration } from "@/types/database/user";
import { createClient } from "@/utils/supabase/server";

export async function get_twitch_integration(){
  const supabase = createClient();
  const { data, error } = await supabase.from("twitch_integration").select("*").single();
  if (error) {
    console.error(error);
    return;
  }
  return data as Twitch_integration
}