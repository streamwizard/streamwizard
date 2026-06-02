import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { withMetrics } from "./with-metrics";

type DBClient = SupabaseClient<Database>;

export interface IrlGeoTrackRow {
  id: string;
  user_id: string;
  session_id: string;
  stream_id: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
  inserted_at: string;
}

export interface IrlGeoTrackInsert {
  user_id: string;
  session_id: string;
  stream_id?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recorded_at: string;
}

export interface IrlSessionSummary {
  session_id: string;
  stream_id: string | null;
  first_recorded_at: string;
  last_recorded_at: string;
}

export async function getIrlGeoTrackBySession(client: DBClient, sessionId: string) {
  return client
    .from("irl_geo_track" as never)
    .select("*")
    .eq("session_id", sessionId)
    .order("recorded_at", { ascending: true });
}

export const insertIrlGeoTrack = withMetrics(
  "irl_geo_track",
  "insert",
  async (client: DBClient, data: IrlGeoTrackInsert) => client.from("irl_geo_track" as never).insert(data as never),
);

export async function getIrlCollectorTokenUserId(
  client: DBClient,
  token: string
): Promise<string | null> {
  const { data } = await client
    .from("irl_collector_tokens" as never)
    .select("user_id")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle() as { data: { user_id: string } | null };
  return data?.user_id ?? null;
}

export async function touchIrlCollectorToken(client: DBClient, token: string): Promise<void> {
  await client
    .from("irl_collector_tokens" as never)
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("token", token);
}

export async function getIrlSessionsByUser(
  client: DBClient,
  userId: string
): Promise<{ data: IrlSessionSummary[] | null; error: Error | null }> {
  const { data, error } = await client
    .from("irl_geo_track" as never)
    .select("session_id, stream_id, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false });

  if (error) return { data: null, error: new Error((error as { message: string }).message) };

  const rows = (data ?? []) as Array<{
    session_id: string;
    stream_id: string | null;
    recorded_at: string;
  }>;

  const bySession = new Map<string, IrlSessionSummary>();
  for (const row of rows) {
    const existing = bySession.get(row.session_id);
    if (!existing) {
      bySession.set(row.session_id, {
        session_id: row.session_id,
        stream_id: row.stream_id,
        first_recorded_at: row.recorded_at,
        last_recorded_at: row.recorded_at,
      });
    } else {
      if (row.recorded_at < existing.first_recorded_at) {
        existing.first_recorded_at = row.recorded_at;
      }
      if (row.recorded_at > existing.last_recorded_at) {
        existing.last_recorded_at = row.recorded_at;
      }
    }
  }

  const sessions = Array.from(bySession.values()).sort(
    (a, b) => b.last_recorded_at.localeCompare(a.last_recorded_at)
  );

  return { data: sessions, error: null };
}
