import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

// Go-live posts in the StreamWizard Discord (SW-336). rest-api writes one
// row per message it posts; the newest row per broadcaster is what the
// cooldown and the stream.offline edit key on. web-admin reads for the
// dashboard. Service-role only.

type DBClient = SupabaseClient<Database>;
export type DiscordLivePost = Database["public"]["Tables"]["discord_live_posts"]["Row"];
export type DiscordLivePostInsert = Database["public"]["Tables"]["discord_live_posts"]["Insert"];

/** Newest post for a broadcaster, ended or not. */
export async function getLatestLivePost(client: DBClient, broadcasterId: string): Promise<DiscordLivePost | null> {
  const { data, error } = await client
    .from("discord_live_posts")
    .select("*")
    .eq("broadcaster_id", broadcasterId)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function insertLivePost(client: DBClient, row: DiscordLivePostInsert): Promise<DiscordLivePost> {
  const { data, error } = await client.from("discord_live_posts").insert(row).select("*").single();

  if (error) throw error;
  return data;
}

export async function markLivePostEnded(client: DBClient, id: string, endedAt: string): Promise<void> {
  const { error } = await client.from("discord_live_posts").update({ ended_at: endedAt }).eq("id", id);

  if (error) throw error;
}

/**
 * A stream that dropped and came back within the cooldown reuses its message
 * instead of posting again. The row follows the new stream: fresh stream id,
 * start time and title, and it is open again.
 */
export async function reviveLivePost(
  client: DBClient,
  id: string,
  patch: Pick<DiscordLivePostInsert, "stream_id" | "started_at" | "title" | "game_name">,
): Promise<void> {
  const { error } = await client
    .from("discord_live_posts")
    .update({ ...patch, ended_at: null })
    .eq("id", id);

  if (error) throw error;
}

/** channel.update changed the title or category while the post is open. */
export async function updateLivePostDetails(
  client: DBClient,
  id: string,
  patch: Pick<DiscordLivePostInsert, "title" | "game_name">,
): Promise<void> {
  const { error } = await client.from("discord_live_posts").update(patch).eq("id", id);

  if (error) throw error;
}

export interface DiscordLiveOptIn {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  discordUserId: string;
  discordUsername: string | null;
  twitchUsername: string | null;
  /** Go-live posts, the user's switch. */
  livePosts: boolean;
  /** The live role, the user's switch. */
  liveRole: boolean;
  lastPostedAt: string | null;
}

/**
 * Everyone with Discord linked, with both of their switches. Defaults are
 * on, so the list starts from integrations_discord and only reads
 * user_preferences for the explicit offs. No PostgREST embeds here:
 * user_preferences points at auth.users, not public.users.
 */
export async function listDiscordLiveOptIns(client: DBClient): Promise<DiscordLiveOptIn[]> {
  const { data: linked, error: linkedError } = await client
    .from("integrations_discord")
    .select("user_id, discord_user_id, discord_username");
  if (linkedError) throw linkedError;
  const rows = linked ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.user_id);
  const [
    { data: users, error: usersError },
    { data: twitch, error: twitchError },
    { data: prefs, error: prefsError },
    { data: posts, error: postsError },
  ] = await Promise.all([
    client.from("users").select("id, name, avatar_url").in("id", ids),
    client.from("integrations_twitch").select("user_id, twitch_username").in("user_id", ids),
    client.from("user_preferences").select("user_id, discord_live_notifications, discord_live_role").in("user_id", ids),
    client.from("discord_live_posts").select("user_id, posted_at").in("user_id", ids).order("posted_at", { ascending: false }),
  ]);
  if (usersError) throw usersError;
  if (twitchError) throw twitchError;
  if (prefsError) throw prefsError;
  if (postsError) throw postsError;

  const userById = new Map((users ?? []).map((row) => [row.id, row]));
  const twitchByUser = new Map((twitch ?? []).map((row) => [row.user_id, row.twitch_username]));
  const prefsByUser = new Map((prefs ?? []).map((row) => [row.user_id, row]));
  const lastPostByUser = new Map<string, string>();
  for (const post of posts ?? []) {
    if (post.user_id && !lastPostByUser.has(post.user_id)) lastPostByUser.set(post.user_id, post.posted_at);
  }

  return rows
    .map((row) => ({
      userId: row.user_id,
      name: userById.get(row.user_id)?.name ?? null,
      avatarUrl: userById.get(row.user_id)?.avatar_url ?? null,
      discordUserId: row.discord_user_id,
      discordUsername: row.discord_username,
      twitchUsername: twitchByUser.get(row.user_id) ?? null,
      livePosts: prefsByUser.get(row.user_id)?.discord_live_notifications ?? true,
      liveRole: prefsByUser.get(row.user_id)?.discord_live_role ?? true,
      lastPostedAt: lastPostByUser.get(row.user_id) ?? null,
    }))
    .sort((a, b) => (a.name ?? a.twitchUsername ?? "").localeCompare(b.name ?? b.twitchUsername ?? ""));
}
