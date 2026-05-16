import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function updateSmpPlayerOnlineStatus(client: DBClient, playerUuid: string, isOnline: boolean) {
  const { error } = await client
    .from("smp_players")
    .update({ is_online: isOnline })
    .eq("minecraft_player_uuid", playerUuid);
  if (error) throw error;
}

export async function getSmpActionsByTrigger(client: DBClient, trigger: string) {
  const { data, error } = await client
    .from("smp_actions")
    .select("id, name, action, metadata")
    .eq("trigger", trigger);
  if (error) throw error;
  return data ?? [];
}
