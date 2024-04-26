"use server";

import type { Twitch_integration } from "@/types/database/user";
import { createAdminClient } from "@/utils/supabase/admin";

const supabase = createAdminClient();

export async function add_twitch_integration(user: Twitch_integration) {
  const { error } = await supabase.from("twitch_integration").insert(user);
  if (error) {
    console.log(error);
  }
}

export async function get_twitch_integration(user_id: string, channel_id: string): Promise<Twitch_integration[] | null> {
  const { data, error } = await supabase.from("twitch_integration").select("*").eq("user_id", user_id).eq("channel_id", channel_id);

  const twitch_integration = data as Twitch_integration[] || [];

  if(twitch_integration.length === 0) return null;

  return twitch_integration
}


export async function update_twitch_integration(user_id: string, channel_id: string, data: Partial<Twitch_integration>) {
  const { error } = await supabase.from("twitch_integration").update(data).eq("user_id", user_id).eq("channel_id", channel_id);
  if (error) {
    console.log(error);
  }
}