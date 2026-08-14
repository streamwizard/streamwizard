import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

/**
 * What the monitoring engine evaluates rules against: the node fleets, the
 * ingest sessions currently open, and how many broadcasters are live.
 */

type DBClient = SupabaseClient<Database>;

export async function selectObsNodeRegistry(client: DBClient) {
  return client.from("obs_nodes").select("id, name, status, maintenance, created_at, api_url");
}

export async function selectIngestNodeRegistry(client: DBClient) {
  return client.from("ingest_nodes").select("id, name, status, maintenance, created_at, tailscale_ip");
}

export async function selectOpenIngestSessions(client: DBClient) {
  return client.from("ingest_sessions").select("id, started_at").is("ended_at", null);
}

export async function countLiveBroadcasters(client: DBClient) {
  return client
    .from("broadcaster_live_status")
    .select("broadcaster_id", { count: "exact", head: true })
    .eq("is_live", true);
}
