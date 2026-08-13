import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

/**
 * Durable per-user key/value state (see the user_states migration).
 *
 * Keys prefixed `sys.` are server-owned — RLS rejects a user write to them, so
 * only service-role callers (the bot, the rest-api EventSub handlers) may set
 * them. Everything else is the streamer's own.
 *
 * The generated Database types are refreshed by `bun run gen-types`, which
 * needs a running database; until that has been run against a stack carrying
 * this table, the casts below stand in for it.
 */

export interface UserStateRow {
  user_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface UserStateEntry {
  key: string;
  value: unknown;
}

const TABLE = "user_states" as never;

export async function getUserStates(
  client: DBClient,
  userId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await client
    .from(TABLE)
    .select("key, value")
    .eq("user_id", userId);
  if (error) throw error;

  const out: Record<string, unknown> = {};
  for (const row of (data ?? []) as unknown as UserStateEntry[]) out[row.key] = row.value;
  return out;
}

export async function getUserState(
  client: DBClient,
  userId: string,
  key: string
): Promise<unknown> {
  const { data, error } = await client
    .from(TABLE)
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as { value?: unknown } | null)?.value ?? null;
}

export async function setUserState(
  client: DBClient,
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  await setUserStates(client, userId, [{ key, value }]);
}

/**
 * Upsert several keys at once. Still one statement per row underneath, so no
 * key can clobber another's concurrent write — the batching is about round
 * trips, not atomicity across keys.
 */
export async function setUserStates(
  client: DBClient,
  userId: string,
  entries: UserStateEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const rows = entries.map((entry) => ({
    user_id: userId,
    key: entry.key,
    value: entry.value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from(TABLE)
    .upsert(rows as never, { onConflict: "user_id,key" });
  if (error) throw error;
}

export async function deleteUserState(
  client: DBClient,
  userId: string,
  key: string
): Promise<void> {
  const { error } = await client.from(TABLE).delete().eq("user_id", userId).eq("key", key);
  if (error) throw error;
}
