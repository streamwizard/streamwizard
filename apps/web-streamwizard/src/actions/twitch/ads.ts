"use server";
import { TwitchApi } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getBroadcasterId } from "@repo/supabase/queries/user";

export async function getAdSchedule(userId: string) {
  const supabase = await createClient();
  const broadcasterId = await getBroadcasterId(supabase);
  const api = new TwitchApi(broadcasterId);
  return api.ads.getAdSchedule();
}
