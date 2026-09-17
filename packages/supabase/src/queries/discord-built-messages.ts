import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";

type DBClient = SupabaseClient<Database>;
export type DiscordBuiltMessage = Database["public"]["Tables"]["discord_built_messages"]["Row"];

// Messages from the web-admin message builder. `draft` and `published` hold
// @repo/discord-message's BuiltMessage; parse them with parseBuiltMessage.
// Every read and write is scoped to the guild, so an id from one server never
// reaches another's row.

/** The dashboard's list, oldest first so new messages land at the bottom. */
export async function listBuiltMessages(client: DBClient, guildId: string): Promise<DiscordBuiltMessage[]> {
  const { data, error } = await client
    .from("discord_built_messages")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getBuiltMessage(client: DBClient, guildId: string, id: string): Promise<DiscordBuiltMessage | null> {
  const { data, error } = await client
    .from("discord_built_messages")
    .select("*")
    .eq("guild_id", guildId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createBuiltMessage(client: DBClient, guildId: string, input: { name: string; draft: Json }): Promise<string> {
  const { data, error } = await client
    .from("discord_built_messages")
    .insert({ guild_id: guildId, name: input.name, draft: input.draft })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export interface BuiltMessageDraftPatch {
  name?: string;
  draft: Json;
  draft_channel_id: string | null;
  draft_create_channel: boolean;
}

/** web-admin's autosave. Never touches what the bot published. False when the message is gone. */
export async function saveBuiltMessageDraft(client: DBClient, guildId: string, id: string, patch: BuiltMessageDraftPatch): Promise<boolean> {
  const { data, error } = await client
    .from("discord_built_messages")
    .update(patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .select("id");

  if (error) throw error;
  return data.length > 0;
}

export interface BuiltMessagePublication {
  published: Json;
  channel_id: string;
  message_ids: string[];
}

/** The bot's write after a publish: what it sent and where. */
export async function recordBuiltMessagePublication(
  client: DBClient,
  guildId: string,
  id: string,
  publication: BuiltMessagePublication,
): Promise<void> {
  const { error } = await client
    .from("discord_built_messages")
    .update({ ...publication, published_at: new Date().toISOString() })
    .eq("guild_id", guildId)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteBuiltMessage(client: DBClient, guildId: string, id: string): Promise<void> {
  const { error } = await client.from("discord_built_messages").delete().eq("guild_id", guildId).eq("id", id);
  if (error) throw error;
}
