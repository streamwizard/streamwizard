import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

type LiveStatusInsert = Database["public"]["Tables"]["broadcaster_live_status"]["Insert"];

export async function upsertBroadcasterLiveStatus(client: DBClient, data: LiveStatusInsert) {
  const { error } = await client
    .from("broadcaster_live_status")
    .upsert(data, { onConflict: "broadcaster_id" });
  if (error) throw error;
}
