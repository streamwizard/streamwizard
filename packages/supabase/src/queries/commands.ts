import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getDefaultCommandsWithStatus(client: DBClient, channelId: string) {
  const { data: defaultCommands, error: defaultError } = await client
    .from("default_chat_commands")
    .select("*")
    .order("command", { ascending: true });

  if (defaultError) throw defaultError;

  const { data: channelCommands } = await client
    .from("commands")
    .select("default_command_id, enabled, id")
    .eq("channel_id", channelId);

  const enabledMap = new Map(
    channelCommands?.map((cmd) => [cmd.default_command_id, { enabled: cmd.enabled, commandId: cmd.id }]) ?? []
  );

  return defaultCommands.map((cmd) => ({
    ...cmd,
    enabled: enabledMap.get(cmd.id)?.enabled ?? false,
    channelCommandId: enabledMap.get(cmd.id)?.commandId,
  }));
}

export async function getEnabledCommandsByChannel(client: DBClient, channelId: string) {
  const { data, error } = await client
    .from("commands")
    .select(`
      custom_commands(id, message, action, command),
      default_chat_commands(id, message, action, command)
    `)
    .eq("enabled", true)
    .eq("channel_id", channelId);
  if (error) throw error;
  return data ?? [];
}

export async function toggleDefaultCommand(client: DBClient, channelId: string, defaultCommandId: string, enabled: boolean) {
  const { data: existing } = await client
    .from("commands")
    .select("id")
    .eq("channel_id", channelId)
    .eq("default_command_id", defaultCommandId)
    .single();

  if (existing) {
    const { error } = await client.from("commands").update({ enabled }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await client.from("commands").insert({ channel_id: channelId, default_command_id: defaultCommandId, enabled });
    if (error) throw error;
  }
}
