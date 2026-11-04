import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { getUserNames } from "../users/user";

type DBClient = SupabaseClient<Database>;

export type DiscordSettingsAudit = Database["public"]["Tables"]["discord_settings_audit"]["Row"];
export type DiscordSettingsAuditInsert = Database["public"]["Tables"]["discord_settings_audit"]["Insert"];

export async function insertDiscordSettingsAudit(client: DBClient, row: DiscordSettingsAuditInsert): Promise<void> {
  const { error } = await client.from("discord_settings_audit").insert(row);
  if (error) throw error;
}

export type DiscordSettingsAuditWithUser = DiscordSettingsAudit & {
  changed_by_user: { name: string | null } | null;
};

export async function listDiscordSettingsAudit(
  client: DBClient,
  guildId: string,
  limit = 10,
): Promise<DiscordSettingsAuditWithUser[]> {
  const { data, error } = await client
    .from("discord_settings_audit")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data.length) return [];

  // changed_by references auth.users, not public.users, so PostgREST can't
  // embed the profile; look the names up separately.
  const names = await getUserNames(
    client,
    data.map((row) => row.changed_by).filter((id): id is string => !!id),
  );

  return data.map((row) => ({
    ...row,
    changed_by_user: row.changed_by ? { name: names.get(row.changed_by) ?? null } : null,
  }));
}
