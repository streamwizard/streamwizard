import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type AlertState = Database["public"]["Tables"]["alert_state"]["Row"];
export type AlertStateUpsert = Database["public"]["Tables"]["alert_state"]["Insert"];
export type AlertEventInsert = Database["public"]["Tables"]["alert_events"]["Insert"];
export type AlertEvent = Database["public"]["Tables"]["alert_events"]["Row"];

export async function getAlertStates(client: DBClient, env: string): Promise<AlertState[]> {
  const { data, error } = await client.from("alert_state").select("*").eq("env", env);
  if (error) throw new Error(`Couldn't load alert state for ${env}: ${error.message}`);
  return data;
}

// Keyed on (rule_id, env, entity_id) so the engine can write every touched
// state row of a tick in one round trip.
export async function upsertAlertStates(client: DBClient, rows: AlertStateUpsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from("alert_state").upsert(rows, { onConflict: "rule_id,env,entity_id" });
  if (error) throw new Error(`Couldn't upsert alert state: ${error.message}`);
}

export async function insertAlertEvents(client: DBClient, rows: AlertEventInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from("alert_events").insert(rows);
  if (error) throw new Error(`Couldn't insert alert events: ${error.message}`);
}

export async function listAlertEvents(
  client: DBClient,
  opts: { env?: string; limit?: number; before?: string } = {},
): Promise<AlertEvent[]> {
  let query = client.from("alert_events").select("*").order("created_at", { ascending: false });
  if (opts.env) query = query.eq("env", opts.env);
  if (opts.before) query = query.lt("created_at", opts.before);
  const { data, error } = await query.limit(opts.limit ?? 100);
  if (error) throw new Error(`Couldn't list alert events: ${error.message}`);
  return data;
}

/**
 * Lease-style overlap guard for the evaluate tick. Returns true when the
 * lease was acquired. A row whose expires_at has passed belonged to a pass
 * that crashed without releasing — it gets stolen rather than blocking
 * alerting forever.
 */
export async function tryAcquireAlertLock(
  client: DBClient,
  name: string,
  ttlSeconds: number,
  owner: string,
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const { error: insertError } = await client
    .from("alert_locks")
    .insert({ name, locked_at: now.toISOString(), expires_at: expiresAt, locked_by: owner });
  if (!insertError) return true;
  // 23505 = someone holds (or held) the lock; anything else is a real failure.
  if (insertError.code !== "23505") {
    throw new Error(`Couldn't acquire alert lock ${name}: ${insertError.message}`);
  }

  const { data, error: stealError } = await client
    .from("alert_locks")
    .update({ locked_at: now.toISOString(), expires_at: expiresAt, locked_by: owner })
    .eq("name", name)
    .lt("expires_at", now.toISOString())
    .select("name");
  if (stealError) throw new Error(`Couldn't steal expired alert lock ${name}: ${stealError.message}`);
  return (data?.length ?? 0) > 0;
}

export async function releaseAlertLock(client: DBClient, name: string, owner: string): Promise<void> {
  const { error } = await client.from("alert_locks").delete().eq("name", name).eq("locked_by", owner);
  if (error) throw new Error(`Couldn't release alert lock ${name}: ${error.message}`);
}
