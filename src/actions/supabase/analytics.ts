'use server'
import { createClient } from "@/lib/supabase/server";

export async function getTopCommands(channelId: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commands")
    .select("trigger, usage_count")
    .eq("channel_id", channelId)
    .order("usage_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getUsageOverTime(channelId: string, days = 30) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("command_logs")
    .select("used_at")
    .eq("channel_id", channelId)
    .gte("used_at", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  if (error) throw error;
  return data ?? [];
}

export async function getTopUsers(channelId: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("command_logs")
    .select("user_name")
    .eq("channel_id", channelId);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.user_name, (map.get(row.user_name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([user_name, count]) => ({ user_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getCommandDrilldown(channelId: string, trigger: string) {
  const supabase = await createClient();
  const { data: cmd, error: cmdErr } = await supabase
    .from("commands")
    .select("id, trigger, usage_count, updated_at, created_at")
    .eq("channel_id", channelId)
    .eq("trigger", trigger)
    .single();
  if (cmdErr) throw cmdErr;
  const { data: logs, error: logsErr } = await supabase
    .from("command_logs")
    .select("used_at, user_name")
    .eq("channel_id", channelId)
    .eq("command_id", cmd?.id ?? "");
  if (logsErr) throw logsErr;
  return { command: cmd, logs: logs ?? [] };
}


