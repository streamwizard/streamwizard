import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../../lib/with-metrics";

// StreamWizard Live sessions (bonded protocol). Service role only: the table
// holds encrypted session secrets, so every function here takes the user id
// (or is the ingest node's lookup) and callers pass the service-role client.

type DBClient = SupabaseClient<Database>;

type LiveSessionRow = Database["public"]["Tables"]["live_sessions"]["Row"];

export interface LiveSessionInsert {
  user_id: string;
  key_id: string;
  /** The key's current value; the insert is refused when it changed since the caller checked it. */
  stream_key: string;
  wire_id: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  protocol_version: number;
  created_ip: string | null;
}

const callCreateLiveSession = withMetrics("live_sessions", "insert", async (client: DBClient, row: LiveSessionInsert) =>
  client.rpc("create_live_session", {
    p_user_id: row.user_id,
    p_key_id: row.key_id,
    p_stream_key: row.stream_key,
    p_wire_id: row.wire_id,
    p_secret_ciphertext: row.secret_ciphertext,
    p_secret_iv: row.secret_iv,
    p_secret_tag: row.secret_tag,
    p_protocol_version: row.protocol_version,
    p_created_ip: row.created_ip,
  }),
);

/**
 * Opens a live session for a stream key and revokes the key's open ones, in
 * one transaction (`create_live_session`). `data` is null when the key was
 * rotated, turned off or changed owner after the caller checked it. `error`
 * is the PostgREST error; code 23505 means the wire id was taken.
 */
export async function createLiveSession(
  client: DBClient,
  row: LiveSessionInsert,
): Promise<{ data: { wire_id: string; expires_at: string } | null; error: { code: string } | null }> {
  const { data, error } = await callCreateLiveSession(client, row);
  if (error) return { data: null, error: { code: error.code } };
  return { data: data?.[0] ?? null, error: null };
}

const closeLiveSessionForUser = withMetrics(
  "live_sessions",
  "update",
  async (client: DBClient, wireId: string, userId: string) =>
    client
      .from("live_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("wire_id", wireId)
      .eq("user_id", userId)
      .is("ended_at", null)
      .select("id"),
);

const selectLiveSessionForUser = withMetrics(
  "live_sessions",
  "select",
  async (client: DBClient, wireId: string, userId: string) =>
    client.from("live_sessions").select("id").eq("wire_id", wireId).eq("user_id", userId).maybeSingle(),
);

/**
 * Ends one of the user's live sessions. The first call sets ended_at; later
 * calls change nothing (endedNow: false). null when the user has no session
 * with this wire id, the same answer as for someone else's. Throws on error.
 */
export async function endLiveSessionForUser(
  client: DBClient,
  wireId: string,
  userId: string,
): Promise<{ endedNow: boolean } | null> {
  const closed = await closeLiveSessionForUser(client, wireId, userId);
  if (closed.error) throw closed.error;
  if (closed.data?.[0]) return { endedNow: true };

  const existing = await selectLiveSessionForUser(client, wireId, userId);
  if (existing.error) throw existing.error;
  return existing.data ? { endedNow: false } : null;
}

/** A live session as the ingest node lookup reads it, with its key's state. */
export type LiveSessionLookup = Pick<
  LiveSessionRow,
  | "wire_id"
  | "user_id"
  | "key_id"
  | "secret_ciphertext"
  | "secret_iv"
  | "secret_tag"
  | "protocol_version"
  | "created_at"
  | "expires_at"
  | "ended_at"
  | "revoked_at"
> & { key_is_active: boolean };

const selectLiveSessionByWireId = withMetrics("live_sessions", "select", async (client: DBClient, wireId: string) =>
  client
    .from("live_sessions")
    .select(
      "wire_id, user_id, key_id, secret_ciphertext, secret_iv, secret_tag, protocol_version, created_at, expires_at, ended_at, revoked_at, ingest_stream_keys!inner(is_active)",
    )
    .eq("wire_id", wireId)
    .maybeSingle(),
);

/**
 * The session with this wire id, ended, revoked and expired ones included
 * (the caller decides), or null. Throws on error.
 */
export async function getLiveSessionByWireId(client: DBClient, wireId: string): Promise<LiveSessionLookup | null> {
  const { data, error } = await selectLiveSessionByWireId(client, wireId);
  if (error) throw error;
  if (!data) return null;
  const { ingest_stream_keys: key, ...session } = data;
  const keyRow = Array.isArray(key) ? key[0] : key;
  return { ...session, key_is_active: keyRow?.is_active ?? false };
}
