"use server";

import {
  createOverlayPlaylistClipQuery,
  getClipFolderJunctions,
} from "@repo/supabase/queries/clips";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import type { Json } from "@repo/supabase";
import { slimClipsWidgetItemConfig, type ClipsWidgetItemConfig } from "@repo/ui/overlay";
import { buildOverlayClipQuery } from "@/lib/overlay-clip-query-builder";
import { supabaseAdmin } from "@repo/supabase/next/admin";

/** Minimal clip identity for Twitch Helix downloads (broadcaster id from clips row). */
export type PlaylistClip = {
  twitchClipId: string;
  broadcasterId: string;
};

export type OverlayClipForDisplay = PlaylistClip & {
  id: string;
  title: string;
  creator_name: string;
  game_name: string | null;
  created_at_twitch: string;
  view_count: number | null;
  duration: number | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getTwitchClipIdsInFolders(
  ownerUserId: string,
  folderIds: string[]
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const { data, error } = await getClipFolderJunctions(
    supabaseAdmin,
    ownerUserId,
    folderIds
  );

  if (error) return { ok: false };

  const junctionRows = (data ?? []) as { clip_id: string }[];

  const ids = [...new Set(junctionRows.map((r) => r.clip_id).filter(Boolean))];

  return { ok: true, ids };
}

/** Fetch extra rows before dedupe so duplicate twitch_clip_id rows do not collapse the playlist. */
function sqlFetchLimit(config: ClipsWidgetItemConfig): number {
  const maxClips = config.maxClips;
  return Math.min(500, Math.max(maxClips * 50, maxClips));
}

function dedupeAndSliceClips(
  rows: Array<{
    id: string;
    twitch_clip_id: string;
    broadcaster_id: string;
    title: string;
    creator_name: string;
    game_name: string | null;
    created_at_twitch: string;
    view_count: number | null;
    duration: number | null;
  }>,
  maxClips: number
): OverlayClipForDisplay[] {
  const out: OverlayClipForDisplay[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.twitch_clip_id)) continue;
    seen.add(row.twitch_clip_id);
    out.push({
      id: row.id,
      twitchClipId: row.twitch_clip_id,
      broadcasterId: row.broadcaster_id,
      title: row.title,
      creator_name: row.creator_name,
      game_name: row.game_name,
      created_at_twitch: row.created_at_twitch,
      view_count: row.view_count,
      duration: row.duration,
    });
    if (out.length >= maxClips) break;
  }

  return out;
}

/**
 * Mirrors overlay editor `getPreviewClips`: `buildOverlayClipQuery` first, then broadcaster or folders.
 *
 * **Tenant scope:** With **no folders**, we require `clips.user_id = sceneUserId` (same as your library)
 * plus `broadcaster_id = linked Twitch id`. With **folders**, clip IDs come from
 * `clip_folder_junction` already filtered by `sceneUserId`; requiring `clips.user_id` as well often
 * matches zero or one row because junction membership and `clips.user_id` are not always aligned.
 */
export async function loadOverlayClipPlaylistForWidget(
  sceneUserId: string,
  config: Json
): Promise<OverlayClipForDisplay[]> {
  const c = slimClipsWidgetItemConfig(config);

  let query = createOverlayPlaylistClipQuery(supabaseAdmin);

  const folderMode = c.folderIds.length > 0;
  query = folderMode
    ? buildOverlayClipQuery(c, query)
    : buildOverlayClipQuery(c, query, { userId: sceneUserId });

  if (folderMode) {
    const junction = await getTwitchClipIdsInFolders(sceneUserId, c.folderIds);
    if (!junction.ok) return [];
    if (junction.ids.length === 0) return [];
    query = query.in("twitch_clip_id", junction.ids);
  } else {
    const twitchUserId = await getTwitchUserIdByUserIdMaybe(
      supabaseAdmin,
      sceneUserId
    );
    if (!twitchUserId) return [];
    query = query.eq("broadcaster_id", twitchUserId);
  }

  query = query.limit(sqlFetchLimit(c));

  const { data: rows, error } = await query;
  if (error || !rows?.length) return [];

  let ordered = [...rows];

  if (c.sort === "random") {
    ordered = shuffle(ordered);
  }

  return dedupeAndSliceClips(ordered, c.maxClips);
}
