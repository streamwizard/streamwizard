import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type BackupPollStateRow = Database["public"]["Tables"]["backup_poll_state"]["Row"];
export type BackupEventRow = Database["public"]["Tables"]["backup_events"]["Row"];
export type BackupEventInsert = Database["public"]["Tables"]["backup_events"]["Insert"];

/**
 * Claim the next poll for `id`. Returns true when this caller should poll.
 * The row is created on first use; the conditional update is atomic per row,
 * so of two replicas racing on the same interval only one gets it back.
 */
export async function claimBackupPoll(client: DBClient, id: string, minIntervalSeconds: number, owner: string): Promise<boolean> {
  const { error: insertError } = await client.from("backup_poll_state").upsert({ id }, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw new Error(`Couldn't create backup poll state: ${insertError.message}`);

  const now = new Date();
  const cutoff = new Date(now.getTime() - minIntervalSeconds * 1000).toISOString();
  const { data, error } = await client
    .from("backup_poll_state")
    .update({ claimed_at: now.toISOString(), claimed_by: owner })
    .eq("id", id)
    .or(`claimed_at.is.null,claimed_at.lt.${cutoff}`)
    .select("id");
  if (error) throw new Error(`Couldn't claim backup poll: ${error.message}`);
  return data.length === 1;
}

export async function getBackupPollState(client: DBClient, id: string): Promise<BackupPollStateRow | null> {
  const { data, error } = await client.from("backup_poll_state").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load backup poll state: ${error.message}`);
  return data;
}

export async function saveBackupPollState(client: DBClient, id: string, data: Json): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client.from("backup_poll_state").update({ data, polled_at: now, updated_at: now }).eq("id", id);
  if (error) throw new Error(`Couldn't save backup poll state: ${error.message}`);
}

/** The columns status needs: no message/fields, which can be ~64 KB per
 * event. This is what the overview and the alert rules read on every refresh. */
export type BackupEventLiteRow = Pick<
  BackupEventRow,
  "id" | "source" | "event_type" | "job_id" | "severity" | "title" | "occurred_at" | "received_at" | "guests"
>;

/** Matched events since `sinceIso`, newest first by occurred_at (slim columns). */
export async function listBackupEventsSince(client: DBClient, sinceIso: string, limit = 500): Promise<BackupEventLiteRow[]> {
  const { data, error } = await client
    .from("backup_events")
    .select("id,source,event_type,job_id,severity,title,occurred_at,received_at,guests")
    .eq("matched", true)
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Couldn't list backup events: ${error.message}`);
  return data;
}

/** Cursor-paged history, newest first. `before` is an occurred_at ISO time. */
export async function listBackupEvents(
  client: DBClient,
  opts: { before?: string; limit?: number; vmid?: number } = {},
): Promise<BackupEventRow[]> {
  let query = client.from("backup_events").select("*").eq("matched", true).order("occurred_at", { ascending: false });
  if (opts.before) query = query.lt("occurred_at", opts.before);
  // A JSON string, not an array: supabase-js turns arrays into a Postgres
  // array literal ({...}), which jsonb containment rejects.
  if (opts.vmid !== undefined) query = query.contains("guests", JSON.stringify([{ vmid: opts.vmid }]));
  const { data, error } = await query.limit(opts.limit ?? 50);
  if (error) throw new Error(`Couldn't list backup events: ${error.message}`);
  return data;
}

/** Returns false when the dedupe_key already existed (a redelivery). */
export async function insertBackupEvent(client: DBClient, row: BackupEventInsert): Promise<boolean> {
  const { data, error } = await client
    .from("backup_events")
    .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`Couldn't store backup event: ${error.message}`);
  return data.length === 1;
}

/** Unmatched events waiting for job discovery. */
export async function listUnmatchedBackupEvents(client: DBClient, limit = 200): Promise<BackupEventRow[]> {
  const { data, error } = await client.from("backup_events").select("*").eq("matched", false).order("occurred_at").limit(limit);
  if (error) throw new Error(`Couldn't list unmatched backup events: ${error.message}`);
  return data;
}

export async function markBackupEventsMatched(client: DBClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from("backup_events").update({ matched: true }).in("id", ids);
  if (error) throw new Error(`Couldn't update backup events: ${error.message}`);
}

export async function deleteBackupEvents(client: DBClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from("backup_events").delete().in("id", ids);
  if (error) throw new Error(`Couldn't delete backup events: ${error.message}`);
}
