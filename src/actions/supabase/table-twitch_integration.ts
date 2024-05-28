'use server'
import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";

export async function get_twitch_integration(){
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);
  const { data, error } = await supabase.from("twitch_integration").select("*").single();
  if (error) {
    console.error(error);
    return;
  }
  return data 
}