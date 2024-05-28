"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { InsertTwitchIntegrationTable, TwitchIntegrationTable, UpdateTwitchIntegrationTable } from "@/types/database";

const supabase = createAdminClient();

export async function add_twitch_integration(user: InsertTwitchIntegrationTable) {
  const { error } = await supabase.from("twitch_integration").insert(user);
  if (error) {
    console.error(error);
  }
}

export async function get_twitch_integration(user_id: string, channel_id: string): Promise<TwitchIntegrationTable[] | null> {
  const { data, error } = await supabase.from("twitch_integration").select("*").eq("user_id", user_id).eq("broadcaster_id", channel_id);

  const twitch_integration = data || [];

  if(twitch_integration.length === 0) return null;

  return twitch_integration
}


export async function update_twitch_integration(user_id: string, channel_id: string, data: UpdateTwitchIntegrationTable) {
  const { error } = await supabase.from("twitch_integration").update(data).eq("user_id", user_id).eq("broadcaster_id", channel_id);
  if (error) {
    console.error(error);
  }
}