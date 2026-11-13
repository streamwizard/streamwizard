import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;
type WaitlistRow = Database["public"]["Tables"]["smp_waitlist_entries"]["Row"];

/**
 * The Minecraft SMP waitlist: one row per account (see the
 * smp_waitlist_entries migration).
 *
 * Users can only read their own row, so the read takes the user's client. The
 * writes need a service-role client and are only called from the web app's
 * server action, after it has authenticated the user and checked the Minecraft
 * account. Both writes filter on the user id they are given.
 */

const SMP_WAITLIST_ENTRY_COLUMNS = "status, minecraft_username, minecraft_uuid" as const;

export type SmpWaitlistEntry = Pick<WaitlistRow, "status" | "minecraft_username" | "minecraft_uuid">;

/** What the sign-up form and the server lookups add up to. */
export type SmpWaitlistApplication = Pick<
  WaitlistRow,
  | "minecraft_username"
  | "minecraft_uuid"
  | "average_viewers"
  | "stream_language"
  | "stream_frequency"
  | "twitch_broadcaster_type"
  | "twitch_follower_count"
>;

/** `minecraft_account_taken`: another account already applied with that Minecraft UUID. */
export type SmpWaitlistWriteResult = "ok" | "minecraft_account_taken" | "already_applied" | "not_pending";

const UNIQUE_VIOLATION = "23505";
const MINECRAFT_UUID_KEY = "smp_waitlist_entries_minecraft_uuid_key";

function uniqueViolation(error: { code?: string; message?: string }): SmpWaitlistWriteResult | null {
  if (error.code !== UNIQUE_VIOLATION) return null;
  return error.message?.includes(MINECRAFT_UUID_KEY) ? "minecraft_account_taken" : "already_applied";
}

export async function getSmpWaitlistEntry(client: DBClient, userId: string): Promise<SmpWaitlistEntry | null> {
  const { data, error } = await client
    .from("smp_waitlist_entries")
    .select(SMP_WAITLIST_ENTRY_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertSmpWaitlistEntry(
  admin: DBClient,
  userId: string,
  application: SmpWaitlistApplication,
): Promise<SmpWaitlistWriteResult> {
  const { error } = await admin.from("smp_waitlist_entries").insert({ ...application, user_id: userId });
  if (!error) return "ok";
  const conflict = uniqueViolation(error);
  if (conflict) return conflict;
  throw error;
}

/** Only while the application is still pending: an accepted player's UUID is what the game server lets in. */
export async function updateSmpMinecraftAccount(
  admin: DBClient,
  userId: string,
  account: Pick<WaitlistRow, "minecraft_username" | "minecraft_uuid">,
): Promise<SmpWaitlistWriteResult> {
  const { data, error } = await admin
    .from("smp_waitlist_entries")
    .update(account)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("user_id");
  if (error) {
    const conflict = uniqueViolation(error);
    if (conflict) return conflict;
    throw error;
  }
  return data.length > 0 ? "ok" : "not_pending";
}
