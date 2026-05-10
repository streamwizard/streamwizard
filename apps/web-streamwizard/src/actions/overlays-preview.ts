"use server";

import { buildOverlayClipQuery } from "@/components/overlays/clip-query-builder";
import type { ClipsWidgetConfig } from "@/types/overlays";
import { createClient } from "@/lib/supabase/server";

export interface PreviewClip {
  id: number;
  twitch_clip_id: string;
  title: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_name: string;
  game_name: string | null;
  view_count: number | null;
  duration: number | null;
  created_at_twitch: string;
  thumbnail_url: string | null;
}

export async function getPreviewClips(config: ClipsWidgetConfig): Promise<{
  clips: PreviewClip[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { clips: [], error: "Unauthorized" };

  const { data: twitchIntegration } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", user.user.id)
    .single();

  const twitchUserId = twitchIntegration?.twitch_user_id ?? null;

  let query = supabase
    .from("clips")
    .select(
      "id, twitch_clip_id, title, broadcaster_id, broadcaster_name, creator_name, game_name, view_count, duration, created_at_twitch, thumbnail_url"
    );

  query = buildOverlayClipQuery(config, query);

  if (config.folderIds.length === 0 && twitchUserId) {
    query = query.eq("broadcaster_id", twitchUserId);
  }

  if (config.folderIds.length > 0) {
    const { data: junctions } = await supabase
      .from("clip_folder_junction")
      .select("clip_id")
      .eq("user_id", user.user.id)
      .in("folder_id", config.folderIds);

    if (junctions && junctions.length > 0) {
      const clipIds = [...new Set(junctions.map((j) => j.clip_id))];
      query = query.in("twitch_clip_id", clipIds);
    } else {
      return { clips: [], error: null };
    }
  }

  const { data: clips, error } = await query;

  if (error) return { clips: [], error: error.message };

  let result = (clips ?? []) as PreviewClip[];

  if (config.sort === "random") {
    result = result.sort(() => Math.random() - 0.5);
  }

  return { clips: result, error: null };
}
