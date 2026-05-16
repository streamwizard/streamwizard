import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

interface ClipFolder {
  clipId: string;
  userId: string;
  folderId?: number;
  folderName: string;
}

export async function addClipToFolder(client: DBClient, { clipId, userId, folderId, folderName }: ClipFolder) {
  if (!folderId && folderName) {
    const { data, error } = await client
      .from("clip_folders")
      .insert({ user_id: userId, name: folderName, href: encodeURIComponent(folderName) })
      .select();

    if (error) throw error;
    folderId = data[0].id;
  }

  const { error } = await client.from("clip_folder_junction").insert({
    clip_id: clipId,
    folder_id: folderId,
    user_id: userId,
  });

  if (error) throw error;
  return { success: true, message: `Clip added to ${folderName}` };
}

export async function removeClipFromFolder(client: DBClient, clipId: string, folderId: number, userId: string) {
  const { error } = await client
    .from("clip_folder_junction")
    .delete()
    .eq("clip_id", clipId)
    .eq("folder_id", folderId)
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true, message: "Clip removed from folder" };
}

export async function createClipFolder(client: DBClient, folderName: string, userId: string, parentFolderId?: number) {
  const { data, error } = await client
    .from("clip_folders")
    .insert({ name: folderName, parent_folder_id: parentFolderId, user_id: userId, href: encodeURIComponent(folderName) })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function editClipFolder(client: DBClient, folderId: number, folderName: string, userId: string) {
  const { error } = await client
    .from("clip_folders")
    .update({ name: folderName, href: encodeURIComponent(folderName) })
    .eq("id", folderId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteClipFolder(client: DBClient, folderId: number) {
  const { error } = await client.from("clip_folders").delete().eq("id", folderId);
  if (error) throw error;
}

export async function getClipFolders(client: DBClient, userId: string) {
  return client.from("clip_folders").select("*").eq("user_id", userId);
}

export async function getClipFolderJunctions(client: DBClient, userId: string, folderIds: number[]) {
  return client
    .from("clip_folder_junction")
    .select("clip_id")
    .eq("user_id", userId)
    .in("folder_id", folderIds);
}

/** Columns streamed by OBS overlay playlists (dedupe by `twitch_clip_id` in the app layer). */
export const OVERLAY_PLAYLIST_CLIP_COLUMNS =
  "id, twitch_clip_id, broadcaster_id, title, creator_name, game_name, created_at_twitch, view_count, duration";

export function createOverlayPlaylistClipQuery(client: DBClient) {
  return client.from("clips").select(OVERLAY_PLAYLIST_CLIP_COLUMNS);
}

export interface OverlayClipFilter {
  gameIds: string[];
  creatorIds: string[];
  isFeaturedOnly: boolean;
  minViewCount: number;
  timeWindow: string;
  customDateRange?: { start: string; end: string };
  sort: string;
  maxClips: number;
  broadcasterTwitchId?: string | null;
  clipTwitchIds?: string[];
}

export async function getOverlayClips(client: DBClient, selectFields: string, filter: OverlayClipFilter) {
  let query = client.from("clips").select(selectFields);

  if (filter.gameIds.length > 0) query = query.in("game_id", filter.gameIds) as typeof query;
  if (filter.creatorIds.length > 0) query = query.in("creator_id", filter.creatorIds) as typeof query;
  if (filter.isFeaturedOnly) query = query.eq("is_featured", true) as typeof query;
  if (filter.minViewCount > 0) query = query.gte("view_count", filter.minViewCount) as typeof query;

  if (filter.timeWindow !== "all" && filter.timeWindow !== "custom") {
    const daysMap: Record<string, number> = { last7d: 7, last30d: 30, last90d: 90, last365d: 365 };
    const days = daysMap[filter.timeWindow];
    if (days) {
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query = query.gte("created_at_twitch", start.toISOString()) as typeof query;
    }
  } else if (filter.timeWindow === "custom" && filter.customDateRange) {
    if (filter.customDateRange.start) query = query.gte("created_at_twitch", new Date(filter.customDateRange.start).toISOString()) as typeof query;
    if (filter.customDateRange.end) query = query.lte("created_at_twitch", new Date(filter.customDateRange.end).toISOString()) as typeof query;
  }

  if (filter.sort !== "random") {
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      newest: { column: "created_at_twitch", ascending: false },
      oldest: { column: "created_at_twitch", ascending: true },
      most_viewed: { column: "view_count", ascending: false },
      least_viewed: { column: "view_count", ascending: true },
    };
    const sortConfig = sortMap[filter.sort];
    if (sortConfig) query = query.order(sortConfig.column, { ascending: sortConfig.ascending }) as typeof query;
  }

  query = query.limit(filter.maxClips) as typeof query;

  if (filter.clipTwitchIds && filter.clipTwitchIds.length > 0) {
    query = query.in("twitch_clip_id", filter.clipTwitchIds) as typeof query;
  } else if (filter.broadcasterTwitchId) {
    query = query.eq("broadcaster_id", filter.broadcasterTwitchId) as typeof query;
  }

  return query;
}

export async function upsertClips(client: DBClient, clips: Database["public"]["Tables"]["clips"]["Insert"][]) {
  const { error } = await client.from("clips").upsert(clips, { onConflict: "twitch_clip_id", ignoreDuplicates: false });
  if (error) throw error;
}

export async function getClipBroadcasterId(client: DBClient, clipId: string, userId: string): Promise<string | null> {
  const { data: ownedRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (ownedRows?.[0]?.broadcaster_id) return ownedRows[0].broadcaster_id;

  const { data: anyRows } = await client
    .from("clips")
    .select("broadcaster_id")
    .eq("twitch_clip_id", clipId)
    .order("created_at", { ascending: false })
    .limit(1);

  return anyRows?.[0]?.broadcaster_id ?? null;
}
