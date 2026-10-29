import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// Join-to-create voice channels (SW-335). Hubs are configured in web-admin;
// temp channels are written by the bot only, one row per channel that exists
// right now.

export type VoiceHub = Database["public"]["Tables"]["discord_voice_hubs"]["Row"];
export type VoiceChannelRow = Database["public"]["Tables"]["discord_voice_channels"]["Row"];
export type VoiceSettings = Database["public"]["Tables"]["discord_voice_settings"]["Row"];
export type VoiceOwnerPrefs = Database["public"]["Tables"]["discord_voice_owner_prefs"]["Row"];
export type VoiceRenameBlock = Database["public"]["Tables"]["discord_voice_rename_blocks"]["Row"];

export const VOICE_HUBS_MAX = 20;
export const VOICE_NAME_TEMPLATE_MAX = 100;
/** Discord's ceiling for a voice channel's user limit. 0 means no limit. */
export const VOICE_USER_LIMIT_MAX = 99;
export const VOICE_BANNED_MAX = 100;
/** Voice staff roles a server (or a hub) may have; the tables' check. */
export const VOICE_STAFF_ROLES_MAX = 25;
/** Characters a rename block's reason may have; the table's check. */
export const VOICE_RENAME_BLOCK_REASON_MAX = 200;
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
  /** Null: use the server's voice staff roles. */
  staff_role_ids: string[] | null;
  /** Owners' last name, limit, bans, lock and hide carry over to their next channel. */
  remember_owner_settings: boolean;
}

/**
 * Voice staff roles for a temp channel: its hub's own list when the hub has
 * one, otherwise the server's. A channel whose hub was deleted uses the
 * server's.
 */
export function staffRolesFor(
  hub: Pick<VoiceHub, "staff_role_ids"> | null | undefined,
  settings: Pick<VoiceSettings, "staff_role_ids"> | null | undefined,
): string[] {
  return hub?.staff_role_ids ?? settings?.staff_role_ids ?? [];
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
// Server-wide settings
// ---------------------------------------------------------------------------

/** Null when the server never saved any: no voice staff roles. */
export async function getVoiceSettings(client: DBClient, guildId: string): Promise<VoiceSettings | null> {
  const { data, error } = await client.from("discord_voice_settings").select("*").eq("guild_id", guildId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertVoiceSettings(
  client: DBClient,
  guildId: string,
  patch: Pick<VoiceSettings, "staff_role_ids">,
): Promise<void> {
  const { error } = await client.from("discord_voice_settings").upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });
  if (error) throw error;
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
  row: Pick<VoiceChannelRow, "channel_id" | "guild_id" | "hub_id" | "owner_discord_user_id"> &
    Partial<Pick<VoiceChannelRow, "locked" | "hidden" | "banned_user_ids">>,
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

// ---------------------------------------------------------------------------
// Remembered owner settings
// ---------------------------------------------------------------------------

export type VoiceOwnerPrefsPatch = Partial<Pick<VoiceOwnerPrefs, "name" | "user_limit" | "locked" | "hidden" | "banned_user_ids">>;

/** What `userId` saved for `hubId`'s channels. Null when nothing. */
export async function getVoiceOwnerPrefs(client: DBClient, hubId: string, userId: string): Promise<VoiceOwnerPrefs | null> {
  const { data, error } = await client
    .from("discord_voice_owner_prefs")
    .select("*")
    .eq("hub_id", hubId)
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Saves the fields in `patch`, leaving the others as they were. */
export async function upsertVoiceOwnerPrefs(
  client: DBClient,
  key: Pick<VoiceOwnerPrefs, "hub_id" | "guild_id" | "discord_user_id">,
  patch: VoiceOwnerPrefsPatch,
): Promise<void> {
  const { error } = await client
    .from("discord_voice_owner_prefs")
    .upsert({ ...key, ...patch }, { onConflict: "hub_id,discord_user_id" });
  if (error) throw error;
}

/** False when there was nothing saved. */
export async function deleteVoiceOwnerPrefs(client: DBClient, hubId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("discord_voice_owner_prefs")
    .delete()
    .eq("hub_id", hubId)
    .eq("discord_user_id", userId)
    .select("hub_id");
  if (error) throw error;
  return data.length > 0;
}

// ---------------------------------------------------------------------------
// Rename blocks
// ---------------------------------------------------------------------------

export async function listVoiceRenameBlocks(client: DBClient, guildId: string): Promise<VoiceRenameBlock[]> {
  const { data, error } = await client
    .from("discord_voice_rename_blocks")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Blocks a member from renaming, and deletes the names they saved in every lobby. A second block replaces the first. */
export async function blockVoiceRename(
  client: DBClient,
  block: Omit<VoiceRenameBlock, "created_at">,
): Promise<void> {
  const { error } = await client.from("discord_voice_rename_blocks").upsert(block, { onConflict: "guild_id,discord_user_id" });
  if (error) throw error;
  const { error: prefsError } = await client
    .from("discord_voice_owner_prefs")
    .update({ name: null })
    .eq("guild_id", block.guild_id)
    .eq("discord_user_id", block.discord_user_id);
  if (prefsError) throw prefsError;
}

/** The lifted block, or null when there wasn't one. */
export async function unblockVoiceRename(client: DBClient, guildId: string, userId: string): Promise<VoiceRenameBlock | null> {
  const { data, error } = await client
    .from("discord_voice_rename_blocks")
    .delete()
    .eq("guild_id", guildId)
    .eq("discord_user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
