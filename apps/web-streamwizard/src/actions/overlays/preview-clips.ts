"use server";

import { toActionError } from "@/lib/action-error";

import type { ClipsWidgetConfig } from "@repo/ui/components/overlay/types/clips";
import { tryAuthContext } from "@/lib/auth";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/users/user";
import { getClipFolderJunctions, getOverlayClips } from "@repo/supabase/queries/clips/clips";
import { previewClipsConfigSchema } from "@/schemas/overlay-actions";
import type { PreviewClip } from "@/types/clips";

/**
 * The editor preview only needs enough clips to show the rotation working. The
 * live widget pages the DB one clip at a time and has no pool, so there is no
 * user-facing setting to mirror here.
 */
const PREVIEW_CLIP_SAMPLE = 25;

export async function getPreviewClips(widgetConfig: ClipsWidgetConfig): Promise<{
  clips: PreviewClip[];
  error: string | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { clips: [], error: "Unauthorized" };
  const { supabase, user } = ctx;

  const parsed = previewClipsConfigSchema.safeParse(widgetConfig);
  if (!parsed.success) return { clips: [], error: "These clip filters aren't valid." };
  const config = parsed.data;

  const twitchUserId = await getTwitchUserIdByUserIdMaybe(supabase, user.id);

  let clipTwitchIds: string[] | undefined;

  if (config.folderIds.length > 0) {
    const { data: junctions } = await getClipFolderJunctions(supabase, user.id, config.folderIds);

    if (junctions && junctions.length > 0) {
      clipTwitchIds = [...new Set(junctions.map((j) => j.clip_id))];
    } else {
      return { clips: [], error: null };
    }
  }

  const { data: clips, error } = await getOverlayClips(
    supabase,
    "id, twitch_clip_id, title, broadcaster_id, broadcaster_name, creator_name, game_name, view_count, duration, created_at_twitch, thumbnail_url",
    {
      gameIds: config.gameIds,
      creatorIds: config.creatorIds,
      isFeaturedOnly: config.isFeaturedOnly,
      minViewCount: config.minViewCount,
      timeWindow: config.timeWindow,
      customDateRange: config.customDateRange,
      sort: config.sort,
      limit: PREVIEW_CLIP_SAMPLE,
      broadcasterTwitchId: config.folderIds.length === 0 ? twitchUserId : null,
      clipTwitchIds,
    }
  );

  if (error) {
    return { clips: [], error: toActionError(error, "actions/overlays-preview", "Couldn't load preview clips. Try again?") };
  }

  let result = (clips ?? []) as unknown as PreviewClip[];

  if (config.sort === "random") {
    result = result.sort(() => Math.random() - 0.5);
  }

  return { clips: result, error: null };
}
