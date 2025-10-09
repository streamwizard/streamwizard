"use server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { commandSchema } from "@/schemas/command";

export async function listCommands(channelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commands").select("*").eq("channel_id", channelId).order("trigger", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertCommand(channelId: string, values: z.infer<typeof commandSchema>, id?: string) {
  const parsed = commandSchema.parse(values);
  const supabase = await createClient();
  const payload = { ...parsed, channel_id: channelId, ...(id ? { id } : {}) };
  const { data, error } = await supabase.from("commands").upsert(payload, { onConflict: "id" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteCommand(channelId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("commands").delete().eq("id", id).eq("channel_id", channelId);
  if (error) throw error;
  return true;
}

export async function toggleShare(channelId: string, id: string, shared: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commands").update({ shared }).eq("id", id).eq("channel_id", channelId).select("*").single();
  if (error) throw error;
  return data;
}

export async function getSharedCommands(excludeChannelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commands")
    .select("id, trigger, response, channel_id")
    .eq("shared", true)
    .neq("channel_id", excludeChannelId)
    .order("trigger");
  if (error) throw error;
  return data ?? [];
}

export async function importCommand(channelId: string, sourceCommandId: string) {
  const supabase = await createClient();
  const { data: source, error: sErr } = await supabase
    .from("commands")
    .select("trigger,response,permission,cooldown_seconds,shared")
    .eq("id", sourceCommandId)
    .single();
  if (sErr) throw sErr;
  const { data, error } = await supabase
    .from("commands")
    .insert({ ...source, channel_id: channelId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getCommandById(channelId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commands").select("*").eq("id", id).eq("channel_id", channelId).single();
  if (error) throw error;
  return data;
}

export async function incrementUsage(commandId: string, channelId: string, userName: string) {
  const supabase = await createClient();
  const { error: logError } = await supabase.from("command_logs").insert({ command_id: commandId, channel_id: channelId, user_name: userName });
  if (logError) throw logError;
  const { data: current } = await supabase.from("commands").select("usage_count").eq("id", commandId).single();
  const nextCount = (current?.usage_count ?? 0) + 1;
  await supabase.from("commands").update({ usage_count: nextCount }).eq("id", commandId);
}

export async function parseResponseTemplate(template: string, context: { user: string; count: number }) {
  return template.replace(/\{user\}/g, context.user).replace(/\{count\}/g, String(context.count));
}
