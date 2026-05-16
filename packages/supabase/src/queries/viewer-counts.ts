import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

type ViewerCountInsert = Database["public"]["Tables"]["stream_viewer_counts"]["Insert"];

export async function insertViewerCount(client: DBClient, data: ViewerCountInsert) {
  const { error } = await client.from("stream_viewer_counts").insert(data);
  if (error) throw error;
}
