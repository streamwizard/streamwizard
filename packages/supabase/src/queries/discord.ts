import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { getUserIdentity, type UserIdentity } from "./identity";

type DBClient = SupabaseClient<Database>;
export type DiscordCommandPermission = Database["public"]["Tables"]["discord_command_permissions"]["Row"];
export type DiscordGuildSettings = Database["public"]["Tables"]["discord_guild_settings"]["Row"];

export async function getCommandRoles(
  client: DBClient,
  guildId: string,
  commandName: string,
): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client
    .from("discord_command_permissions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("command_name", commandName);

  if (error) throw error;
  return data ?? [];
}

export async function getGuildCommandPermissions(
  client: DBClient,
  guildId: string,
): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client.from("discord_command_permissions").select("*").eq("guild_id", guildId);

  if (error) throw error;
  return data ?? [];
}

export async function addCommandRole(
  client: DBClient,
  guildId: string,
  commandName: string,
  roleId: string,
): Promise<void> {
  const { error } = await client
    .from("discord_command_permissions")
    .upsert(
      { guild_id: guildId, command_name: commandName, role_id: roleId },
      { onConflict: "guild_id,command_name,role_id" },
    );

  if (error) throw error;
}

export async function removeCommandRole(
  client: DBClient,
  guildId: string,
  commandName: string,
  roleId: string,
): Promise<void> {
  const { error } = await client
    .from("discord_command_permissions")
    .delete()
    .eq("guild_id", guildId)
    .eq("command_name", commandName)
    .eq("role_id", roleId);

  if (error) throw error;
}

export async function getGuildSettings(client: DBClient, guildId: string): Promise<DiscordGuildSettings | null> {
  const { data, error } = await client.from("discord_guild_settings").select("*").eq("guild_id", guildId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function setWelcomeChannel(client: DBClient, guildId: string, channelId: string): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, welcome_channel_id: channelId }, { onConflict: "guild_id" });

  if (error) throw error;
}

export async function setVerifiedRoleId(client: DBClient, guildId: string, roleId: string): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, verified_role_id: roleId }, { onConflict: "guild_id" });

  if (error) throw error;
}

type GuildSettingsPatch = Partial<Omit<Database["public"]["Tables"]["discord_guild_settings"]["Insert"], "guild_id">>;

// Multi-field write for the web-admin dashboard; unlike the single setters it
// accepts null, so a channel or role can be cleared.
export async function upsertGuildSettings(client: DBClient, guildId: string, patch: GuildSettingsPatch): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" });

  if (error) throw error;
}

export async function setWelcomeEnabled(client: DBClient, guildId: string, enabled: boolean): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, welcome_enabled: enabled }, { onConflict: "guild_id" });

  if (error) throw error;
}

// Snapshots the guild's live member count as the member's join number.
// Idempotent: calling it again for the same guild/user returns their original number.
export async function recordGuildMemberJoin(
  client: DBClient,
  guildId: string,
  userId: string,
  memberCount: number,
): Promise<number> {
  const { data, error } = await client.rpc("record_guild_member_join", {
    p_guild_id: guildId,
    p_user_id: userId,
    p_member_count: memberCount,
  });

  if (error) throw error;
  return data;
}

export async function getDiscordIntegrationByDiscordUserId(client: DBClient, discordUserId: string) {
  return client
    .from("integrations_discord")
    .select("user_id, discord_username")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
}

export async function getDiscordUserIdForUser(client: DBClient, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from("integrations_discord")
    .select("discord_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.discord_user_id ?? null;
}

export type PublicTwitchIntegration = {
  twitch_username: string;
  broadcaster_type: string | null;
  profile_image_url: string | null;
};

/** The public Twitch profile (no tokens, no email) of an identity, or null without Twitch. */
export function toPublicTwitchIntegration(identity: UserIdentity | null): PublicTwitchIntegration | null {
  if (!identity?.twitch) return null;
  return {
    twitch_username: identity.twitch.username,
    broadcaster_type: identity.twitch.broadcasterType,
    profile_image_url: identity.twitch.profileImageUrl,
  };
}

// Looks up the public Twitch profile (no tokens/email) linked to the same
// StreamWizard account as the given Discord user, if any.
export async function getPublicTwitchIntegrationByDiscordUserId(
  client: DBClient,
  discordUserId: string,
): Promise<PublicTwitchIntegration | null> {
  return toPublicTwitchIntegration(await getUserIdentity(client, { discordUserId }));
}

export interface LinkedStreamWizardAccount {
  userId: string;
  name: string;
  email: string;
  twitchUsername: string | null;
  twitchAvatarUrl: string | null;
}

/**
 * The StreamWizard account a Discord user is linked to right now (falls back
 * to `fallbackUserId`, e.g. the opener recorded on a ticket, when the link
 * was since removed). Null when neither resolves to a user.
 */
export async function getLinkedStreamWizardAccount(
  client: DBClient,
  discordUserId: string,
  fallbackUserId: string | null = null,
): Promise<LinkedStreamWizardAccount | null> {
  const identity =
    (await getUserIdentity(client, { discordUserId })) ??
    (fallbackUserId ? await getUserIdentity(client, { userId: fallbackUserId }) : null);
  if (!identity) return null;

  return {
    userId: identity.userId,
    name: identity.name,
    email: identity.email,
    twitchUsername: identity.twitch?.username ?? null,
    twitchAvatarUrl: identity.twitch?.profileImageUrl ?? null,
  };
}
