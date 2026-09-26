import type { SupabaseClient } from "@supabase/supabase-js";
import { LABEL_EVENT_TYPES, type LabelCalendarPeriod, type LabelEntry, type LabelEventRow, type LabelLeader } from "@repo/schemas";
import type { Database } from "../types/supabase";

/**
 * The stream_labels row (see its migration): one row per streamer, one
 * `latest_*` column per kind of event. The bot upserts it, the overlay route
 * reads it with the service role, so the broadcaster filter here is what
 * keeps channels apart.
 *
 * The generated Database types don't carry this table yet, so its name is
 * cast the same way user-states.ts does.
 */

type DBClient = SupabaseClient<Database>;

const TABLE = "stream_labels" as never;

export async function selectStreamLabelsRow(client: DBClient, broadcasterId: string) {
  return client.from(TABLE).select("*").eq("broadcaster_id", broadcasterId).maybeSingle() as unknown as Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
}

/**
 * Overwrites only the columns given. Upsert on the primary key, so a
 * streamer's first event creates the row, and two events for different
 * columns never clobber each other.
 */
export async function upsertLatestLabels(client: DBClient, broadcasterId: string, columns: Record<string, LabelEntry>) {
  return client
    .from(TABLE)
    .upsert({ broadcaster_id: broadcasterId, ...columns, updated_at: new Date().toISOString() } as never, {
      onConflict: "broadcaster_id",
    }) as unknown as Promise<{ error: { message: string } | null }>;
}

/** One stream's label events, oldest first. */
export async function selectLabelEventRows(
  client: DBClient,
  streamId: string,
  broadcasterId: string,
): Promise<LabelEventRow[]> {
  const { data, error } = await client
    .from("stream_events")
    .select("event_type, event_data, created_at")
    .eq("stream_id", streamId)
    .eq("broadcaster_id", broadcasterId)
    .in("event_type", [...LABEL_EVENT_TYPES])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** The newest label events across all streams, newest first (the event list's history). */
export async function selectRecentLabelEventRows(
  client: DBClient,
  broadcasterId: string,
  limit: number,
): Promise<LabelEventRow[]> {
  const { data, error } = await client
    .from("stream_events")
    .select("event_type, event_data, created_at")
    .eq("broadcaster_id", broadcasterId)
    .in("event_type", [...LABEL_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** Top 10 cheerers per calendar period (get_label_period_leaders). */
export async function selectLabelPeriodLeaders(client: DBClient, broadcasterId: string) {
  return client.rpc("get_label_period_leaders" as never, { p_broadcaster_id: broadcasterId } as never) as unknown as Promise<{
    data: Record<LabelCalendarPeriod, LabelLeader[]> | null;
    error: { message: string } | null;
  }>;
}
