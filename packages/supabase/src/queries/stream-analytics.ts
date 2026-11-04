import type { SupabaseClient } from "@supabase/supabase-js";
import { reportError } from "@repo/sentry";
import type { Database } from "../types/supabase";
import { fetchAllPages } from "./fetch-all-pages";

type DBClient = SupabaseClient<Database>;

/** These reads log and fall back to no rows, so one failed chart doesn't fail the page. */
async function allPagesOrEmpty<T>(label: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    reportError(error, `stream-analytics: ${label}`);
    return [];
  }
}

export async function getLatestStreamForBroadcaster(client: DBClient, broadcasterId: string) {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("stream_id, stream_started_at, stream_ended_at, title, category_name, category_id, broadcaster_id, is_live")
    .eq("broadcaster_id", broadcasterId)
    .not("stream_id", "is", null)
    .order("stream_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) reportError(error, "stream-analytics: getLatestStreamForBroadcaster");
  return data ?? null;
}

export async function getPreviousStreamForBroadcaster(
  client: DBClient,
  broadcasterId: string,
  currentStreamId: string
) {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("stream_id, stream_started_at, stream_ended_at")
    .eq("broadcaster_id", broadcasterId)
    .not("stream_id", "is", null)
    .neq("stream_id", currentStreamId)
    .order("stream_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data ?? null;
}

const ACTIVITY_FEED_EVENT_TYPES = [
  "channel.follow",
  "channel.subscribe",
  "channel.subscription.message",
  "channel.cheer",
  "channel.raid",
  "channel.channel_points_custom_reward_redemption.add",
  "channel.update",
  "stream.online",
  "stream.offline",
  "channel.ad_break.begin",
] as const;

export async function getActivityFeedEvents(client: DBClient, streamId: string, broadcasterId: string) {
  const { data, error } = await client
    .from("stream_events")
    .select("id, event_type, event_data, created_at, offset_seconds")
    .eq("stream_id", streamId)
    .eq("broadcaster_id", broadcasterId)
    .in("event_type", [...ACTIVITY_FEED_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) reportError(error, "stream-analytics: getActivityFeedEvents");
  return data ?? [];
}

export async function getRecentStreamsForBroadcaster(client: DBClient, broadcasterId: string, limit = 6) {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("stream_id, title, category_name, stream_started_at, stream_ended_at")
    .eq("broadcaster_id", broadcasterId)
    .not("stream_id", "is", null)
    .order("stream_started_at", { ascending: false })
    .limit(limit);

  if (error) reportError(error, "stream-analytics: getRecentStreamsForBroadcaster");
  return data ?? [];
}

export async function getBulkStreamPeakViewers(client: DBClient, streamIds: string[]) {
  if (streamIds.length === 0) return new Map<string, number>();

  const data = await allPagesOrEmpty("getBulkStreamPeakViewers", () =>
    fetchAllPages((from, to) =>
      client
        .from("stream_viewer_counts")
        .select("stream_id, viewer_count")
        .in("stream_id", streamIds)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );

  const peakByStream = new Map<string, number>();
  for (const row of data) {
    const current = peakByStream.get(row.stream_id) ?? 0;
    if (row.viewer_count > current) peakByStream.set(row.stream_id, row.viewer_count);
  }
  return peakByStream;
}

/** Every viewer sample of the stream, in stream order, paged past max_rows. */
export function getStreamViewerCounts(client: DBClient, streamId: string) {
  return allPagesOrEmpty("getStreamViewerCounts", () =>
    fetchAllPages((from, to) =>
      client
        .from("stream_viewer_counts")
        .select("offset_seconds, viewer_count, game_id, game_name, title")
        .eq("stream_id", streamId)
        .order("offset_seconds", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

export async function getBroadcasterProfile(client: DBClient) {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_username, profile_image_url, broadcaster_type")
    .maybeSingle();

  if (error) reportError(error, "stream-analytics: getBroadcasterProfile");
  return data ?? null;
}

/** Every event of the stream, oldest first, paged past max_rows: the stats count them all. */
export function getStreamEvents(client: DBClient, streamId: string) {
  return allPagesOrEmpty("getStreamEvents", () =>
    fetchAllPages((from, to) =>
      client
        .from("stream_events")
        .select("event_type, event_data, offset_seconds")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  );
}

export async function getVodByStreamId(client: DBClient, streamId: string) {
  const { data, error } = await client
    .from("vods")
    .select("video_id")
    .eq("stream_id", streamId)
    .maybeSingle();

  if (error) reportError(error, "stream-analytics: getVodByStreamId");
  return data ?? null;
}

export async function getClipsByVideoId(client: DBClient, videoId: string) {
  const { data, error } = await client
    .from("clips")
    .select(
      "twitch_clip_id, title, creator_name, url, thumbnail_url, view_count, duration, embed_url, vod_offset, broadcaster_id, created_at_twitch, is_featured"
    )
    .eq("video_id", videoId)
    .order("view_count", { ascending: false });

  if (error) reportError(error, "stream-analytics: getClipsByVideoId");
  return data ?? [];
}
