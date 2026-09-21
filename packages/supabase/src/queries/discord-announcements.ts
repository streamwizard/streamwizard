import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
export type DiscordAnnouncement = Database["public"]["Tables"]["discord_announcements"]["Row"];
export type DiscordAnnouncementStatus = "draft" | "scheduled" | "posting" | "posted" | "failed";

// Announcements staff write in web-admin. `draft` and `posted` hold
// @repo/discord-message's Announcement; parse them with parseAnnouncement.
// web-admin moves a row between draft and scheduled; the bot owns the rest.
// Every read and write is scoped to the guild.

/** Newest first: the list is a history. */
export async function listAnnouncements(client: DBClient, guildId: string): Promise<DiscordAnnouncement[]> {
  const { data, error } = await client
    .from("discord_announcements")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAnnouncement(client: DBClient, guildId: string, id: string): Promise<DiscordAnnouncement | null> {
  const { data, error } = await client
    .from("discord_announcements")
    .select("*")
    .eq("guild_id", guildId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createAnnouncement(
  client: DBClient,
  guildId: string,
  input: { draft: Json; created_by: string | null },
): Promise<string> {
  const { data, error } = await client
    .from("discord_announcements")
    .insert({ guild_id: guildId, draft: input.draft, created_by: input.created_by })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** web-admin's autosave. Never while the bot is sending it. False when the row is gone or mid-post. */
export async function saveAnnouncementDraft(
  client: DBClient,
  guildId: string,
  id: string,
  patch: { draft: Json; channel_id: string | null },
): Promise<boolean> {
  const { data, error } = await client
    .from("discord_announcements")
    .update(patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .neq("status", "posting")
    .select("id");

  if (error) throw error;
  return data.length > 0;
}

/** Puts a draft (or a failed one) in the queue. False when it isn't in a state that can be scheduled. */
export async function scheduleAnnouncement(client: DBClient, guildId: string, id: string, scheduledFor: Date): Promise<boolean> {
  const { data, error } = await client
    .from("discord_announcements")
    .update({ status: "scheduled", scheduled_for: scheduledFor.toISOString(), last_error: null })
    .eq("guild_id", guildId)
    .eq("id", id)
    .in("status", ["draft", "failed"])
    .select("id");

  if (error) throw error;
  return data.length > 0;
}

/** Back to a draft. False when it already went out (or was never scheduled). */
export async function unscheduleAnnouncement(client: DBClient, guildId: string, id: string): Promise<boolean> {
  const { data, error } = await client
    .from("discord_announcements")
    .update({ status: "draft", scheduled_for: null })
    .eq("guild_id", guildId)
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id");

  if (error) throw error;
  return data.length > 0;
}

/** Everything due across guilds, oldest first. The scheduler claims each one before posting. */
export async function listDueAnnouncements(client: DBClient, now = new Date()): Promise<DiscordAnnouncement[]> {
  const { data, error } = await client
    .from("discord_announcements")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true });

  if (error) throw error;
  return data;
}

/** Claims a due announcement: whoever wins this UPDATE posts it. Returns the row as claimed, or null. */
export async function claimAnnouncement(client: DBClient, id: string, now = new Date()): Promise<DiscordAnnouncement | null> {
  const { data, error } = await client
    .from("discord_announcements")
    .update({ status: "posting", claimed_at: now.toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface AnnouncementPublication {
  posted: Json;
  channel_id: string;
  message_id: string;
}

/**
 * The bot's write after a send or edit. The scheduler passes `fromStatus`
 * "posting" so a row someone unscheduled underneath it is left alone.
 */
export async function recordAnnouncementPosted(
  client: DBClient,
  guildId: string,
  id: string,
  publication: AnnouncementPublication,
  fromStatus?: DiscordAnnouncementStatus,
): Promise<void> {
  let query = client
    .from("discord_announcements")
    .update({
      ...publication,
      status: "posted",
      posted_at: new Date().toISOString(),
      scheduled_for: null,
      claimed_at: null,
      last_error: null,
    })
    .eq("guild_id", guildId)
    .eq("id", id);
  if (fromStatus) query = query.eq("status", fromStatus);

  const { error } = await query;
  if (error) throw error;
}

/** A scheduled send that didn't make it. The sentence is shown to the admin, who can post it again or delete it. */
export async function markAnnouncementFailed(client: DBClient, guildId: string, id: string, lastError: string): Promise<void> {
  const { error } = await client
    .from("discord_announcements")
    .update({ status: "failed", last_error: lastError.slice(0, 500), claimed_at: null })
    .eq("guild_id", guildId)
    .eq("id", id)
    .eq("status", "posting");

  if (error) throw error;
}

/**
 * Rows a previous bot process claimed and never finished. Marked failed rather
 * than retried: the message may already be in the channel, and a second send
 * would ping everyone twice. Returns how many were marked.
 */
export async function failStalePosting(client: DBClient, cutoff: Date, lastError: string): Promise<number> {
  const { data, error } = await client
    .from("discord_announcements")
    .update({ status: "failed", last_error: lastError, claimed_at: null })
    .eq("status", "posting")
    .lt("claimed_at", cutoff.toISOString())
    .select("id");

  if (error) throw error;
  return data.length;
}

export async function deleteAnnouncement(client: DBClient, guildId: string, id: string): Promise<void> {
  const { error } = await client.from("discord_announcements").delete().eq("guild_id", guildId).eq("id", id);
  if (error) throw error;
}

/** Display names for the "By" column; `created_by` references auth.users, so PostgREST can't embed the profile. */
export async function getUserNames(client: DBClient, userIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("users").select("id, name").in("id", ids);
  if (error) throw error;
  return new Map(data.map((user) => [user.id, user.name]));
}
