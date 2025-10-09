'use server'
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { timerSchema } from "@/schemas/timer";

export async function listTimers(channelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timers")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertTimer(channelId: string, values: z.infer<typeof timerSchema>, id?: string) {
  const parsed = timerSchema.parse(values);
  const supabase = await createClient();
  const payload = { ...parsed, channel_id: channelId, ...(id ? { id } : {}) };
  const { data, error } = await supabase.from("timers").upsert(payload, { onConflict: "id" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteTimer(channelId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("timers").delete().eq("id", id).eq("channel_id", channelId);
  if (error) throw error;
  return true;
}


