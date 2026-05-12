import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getLatestStreamForBroadcaster(client: DBClient, broadcasterId: string) {
  const { data, error } = await client
    .from("broadcaster_live_status")
    .select("stream_id, stream_started_at, stream_ended_at, title, category_name, category_id, broadcaster_id, is_live")
    .eq("broadcaster_id", broadcasterId)
    .not("stream_id", "is", null)
    .order("stream_started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) console.error("[stream-analytics] getLatestStreamForBroadcaster:", error.message);
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
    .single();

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

  if (error) console.error("[stream-analytics] getActivityFeedEvents:", error.message);
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

  if (error) console.error("[stream-analytics] getRecentStreamsForBroadcaster:", error.message);
  return data ?? [];
}

export async function getBulkStreamPeakViewers(client: DBClient, streamIds: string[]) {
  if (streamIds.length === 0) return new Map<string, number>();

  const { data, error } = await client
    .from("stream_viewer_counts")
    .select("stream_id, viewer_count")
    .in("stream_id", streamIds);

  if (error) console.error("[stream-analytics] getBulkStreamPeakViewers:", error.message);

  const peakByStream = new Map<string, number>();
  for (const row of data ?? []) {
    const current = peakByStream.get(row.stream_id) ?? 0;
    if (row.viewer_count > current) peakByStream.set(row.stream_id, row.viewer_count);
  }
  return peakByStream;
}

export async function getStreamViewerCounts(client: DBClient, streamId: string) {
  const { data, error } = await client
    .from("stream_viewer_counts")
    .select("offset_seconds, viewer_count, game_id, game_name, title")
    .eq("stream_id", streamId)
    .order("offset_seconds", { ascending: true });

  if (error) console.error("[stream-analytics] getStreamViewerCounts:", error.message);
  return data ?? [];
}

export async function getBroadcasterProfile(client: DBClient) {
  const { data, error } = await client
    .from("integrations_twitch")
    .select("twitch_username, profile_image_url, broadcaster_type")
    .maybeSingle();

  if (error) console.error("[stream-analytics] getBroadcasterProfile:", error.message);
  return data ?? null;
}

export async function getStreamEvents(client: DBClient, streamId: string) {
  const { data, error } = await client
    .from("stream_events")
    .select("event_type, event_data, offset_seconds")
    .eq("stream_id", streamId);

  if (error) console.error("[stream-analytics] getStreamEvents:", error.message);
  return data ?? [];
}

export async function getVodByStreamId(client: DBClient, streamId: string) {
  const { data, error } = await client
    .from("vods")
    .select("video_id")
    .eq("stream_id", streamId)
    .maybeSingle();

  if (error) console.error("[stream-analytics] getVodByStreamId:", error.message);
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

  if (error) console.error("[stream-analytics] getClipsByVideoId:", error.message);
  return data ?? [];
}
