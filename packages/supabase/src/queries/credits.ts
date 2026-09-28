import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDITS_EVENT_TYPES, type CreditsEventRow } from "@repo/schemas";
import type { Database } from "../types/supabase";

/**
 * Reads for the end-of-stream credits widget: which stream to roll, its
 * events, and its peak viewers. The roll-up itself is `aggregateCredits` in
 * @repo/schemas; these only fetch.
 *
 * Every read is scoped by broadcaster. The overlay route calls these with the
 * service role, so this scoping is the only thing keeping one channel's
 * credits from another's.
 */

type DBClient = SupabaseClient<Database>;

export interface CreditsStreamPick {
  stream_id: string;
  is_live: boolean;
  started_at: string | null;
}

/**
 * The stream to roll credits for. An explicit `streamId` must belong to the
 * broadcaster. Otherwise the live stream wins, and failing that the most
 * recent one StreamWizard tracked.
 */
export async function selectCreditsStream(
  client: DBClient,
  broadcasterId: string,
  streamId?: string,
): Promise<CreditsStreamPick | null> {
  const { data: live } = await client
    .from("broadcaster_live_status")
    .select("stream_id, is_live, stream_started_at")
    .eq("broadcaster_id", broadcasterId)
    .maybeSingle();

  if (streamId) {
    const { data: vod } = await client
      .from("vods")
      .select("stream_id, started_at")
      .eq("broadcaster_id", broadcasterId)
      .eq("stream_id", streamId)
      .maybeSingle();
    if (!vod?.stream_id) return null;
    const isLive = live?.is_live === true && live.stream_id === streamId;
    return { stream_id: vod.stream_id, is_live: isLive, started_at: vod.started_at ?? live?.stream_started_at ?? null };
  }

  if (live?.is_live && live.stream_id) {
    return { stream_id: live.stream_id, is_live: true, started_at: live.stream_started_at ?? null };
  }

  const { data: latest } = await client
    .from("vods")
    .select("stream_id, started_at")
    .eq("broadcaster_id", broadcasterId)
    .not("stream_id", "is", null)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.stream_id) return null;
  return { stream_id: latest.stream_id, is_live: false, started_at: latest.started_at ?? null };
}

/** The stream's events credits read, oldest first. */
export async function selectCreditsEventRows(
  client: DBClient,
  streamId: string,
  broadcasterId: string,
): Promise<CreditsEventRow[]> {
  const { data, error } = await client
    .from("stream_events")
    .select("event_type, event_data, created_at, offset_seconds")
    .eq("stream_id", streamId)
    .eq("broadcaster_id", broadcasterId)
    .in("event_type", [...CREDITS_EVENT_TYPES])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** The highest viewer sample for the stream, or null when there were none. */
export async function selectStreamPeakViewers(client: DBClient, streamId: string): Promise<number | null> {
  const { data, error } = await client
    .from("stream_viewer_counts")
    .select("viewer_count")
    .eq("stream_id", streamId)
    .order("viewer_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.viewer_count ?? null;
}
