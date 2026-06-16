import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
export type DiscordCommandPermission = Database["public"]["Tables"]["discord_command_permissions"]["Row"];
export type DiscordGuildSettings = Database["public"]["Tables"]["discord_guild_settings"]["Row"];

export async function getCommandRoles(client: DBClient, guildId: string, commandName: string): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client
    .from("discord_command_permissions")
    .select("*")
    .eq("guild_id", guildId)
    .eq("command_name", commandName);

  if (error) throw error;
  return data ?? [];
}

export async function getGuildCommandPermissions(client: DBClient, guildId: string): Promise<DiscordCommandPermission[]> {
  const { data, error } = await client.from("discord_command_permissions").select("*").eq("guild_id", guildId);

  if (error) throw error;
  return data ?? [];
}

export async function addCommandRole(client: DBClient, guildId: string, commandName: string, roleId: string): Promise<void> {
  const { error } = await client
    .from("discord_command_permissions")
    .upsert({ guild_id: guildId, command_name: commandName, role_id: roleId }, { onConflict: "guild_id,command_name,role_id" });

  if (error) throw error;
}

export async function removeCommandRole(client: DBClient, guildId: string, commandName: string, roleId: string): Promise<void> {
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

export async function setWelcomeEnabled(client: DBClient, guildId: string, enabled: boolean): Promise<void> {
  const { error } = await client
    .from("discord_guild_settings")
    .upsert({ guild_id: guildId, welcome_enabled: enabled }, { onConflict: "guild_id" });

  if (error) throw error;
}
