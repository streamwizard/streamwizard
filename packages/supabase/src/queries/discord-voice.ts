import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// Join-to-create voice channels (SW-335). Hubs are configured in web-admin;
// temp channels are written by the bot only, one row per channel that exists
// right now.

export type VoiceHub = Database["public"]["Tables"]["discord_voice_hubs"]["Row"];
export type VoiceChannelRow = Database["public"]["Tables"]["discord_voice_channels"]["Row"];

export const VOICE_HUBS_MAX = 20;
export const VOICE_NAME_TEMPLATE_MAX = 100;
/** Discord's ceiling for a voice channel's user limit. 0 means no limit. */
export const VOICE_USER_LIMIT_MAX = 99;
export const VOICE_BANNED_MAX = 100;
export const DEFAULT_VOICE_NAME_TEMPLATE = "{username}'s channel";

/** What a name template may contain, with what each one turns into. */
export const VOICE_NAME_PLACEHOLDERS = [
  { key: "username", label: "Discord username" },
  { key: "displayname", label: "Server nickname, or display name" },
] as const;

export type VoiceNamePlaceholder = (typeof VOICE_NAME_PLACEHOLDERS)[number]["key"];

const PLACEHOLDER = /\{([^{}]*)\}/g;

/** Placeholders in `template` that aren't in VOICE_NAME_PLACEHOLDERS, as written (lowercased). */
export function findUnknownVoicePlaceholders(template: string): string[] {
  const known = new Set<string>(VOICE_NAME_PLACEHOLDERS.map((p) => p.key));
  const unknown = new Set<string>();
  for (const [, key = ""] of template.matchAll(PLACEHOLDER)) {
    const clean = key.trim().toLowerCase();
    if (!known.has(clean)) unknown.add(clean);
  }
  return [...unknown];
}

export interface VoiceHubInput {
  lobby_channel_id: string;
  category_id: string | null;
  name_template: string;
  default_user_limit: number;
}

// ---------------------------------------------------------------------------
// Hubs
// ---------------------------------------------------------------------------

export async function listVoiceHubs(client: DBClient, guildId: string): Promise<VoiceHub[]> {
  const { data, error } = await client
    .from("discord_voice_hubs")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function createVoiceHub(client: DBClient, guildId: string, input: VoiceHubInput): Promise<VoiceHub> {
  const { data, error } = await client
    .from("discord_voice_hubs")
    .insert({ guild_id: guildId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Null when the hub is gone. */
export async function updateVoiceHub(
  client: DBClient,
  guildId: string,
  id: string,
  patch: Partial<VoiceHubInput>,
): Promise<VoiceHub | null> {
  const { data, error } = await client
    .from("discord_voice_hubs")
    .update(patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** False when there was nothing to delete. */
export async function deleteVoiceHub(client: DBClient, guildId: string, id: string): Promise<boolean> {
  const { data, error } = await client.from("discord_voice_hubs").delete().eq("guild_id", guildId).eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}

// ---------------------------------------------------------------------------
// Temp channels
// ---------------------------------------------------------------------------

/** Every temp channel the bot knows about, across servers. For the bot's startup reconcile. */
export async function listAllVoiceChannels(client: DBClient): Promise<VoiceChannelRow[]> {
  const { data, error } = await client.from("discord_voice_channels").select("*");
  if (error) throw error;
  return data;
}

export async function listVoiceChannels(client: DBClient, guildId: string): Promise<VoiceChannelRow[]> {
  const { data, error } = await client.from("discord_voice_channels").select("*").eq("guild_id", guildId).order("created_at");
  if (error) throw error;
  return data;
}

export async function insertVoiceChannel(
  client: DBClient,
  row: Pick<VoiceChannelRow, "channel_id" | "guild_id" | "hub_id" | "owner_discord_user_id">,
): Promise<VoiceChannelRow> {
  const { data, error } = await client.from("discord_voice_channels").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateVoiceChannel(
  client: DBClient,
  channelId: string,
  patch: Partial<Pick<VoiceChannelRow, "owner_discord_user_id" | "locked" | "hidden" | "banned_user_ids">>,
): Promise<VoiceChannelRow | null> {
  const { data, error } = await client
    .from("discord_voice_channels")
    .update(patch)
    .eq("channel_id", channelId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteVoiceChannels(client: DBClient, channelIds: string[]): Promise<void> {
  if (channelIds.length === 0) return;
  const { error } = await client.from("discord_voice_channels").delete().in("channel_id", channelIds);
  if (error) throw error;
}
