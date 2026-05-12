"use server";

import { createClient } from "@repo/supabase/next/server";
import {
  getLatestStreamForBroadcaster,
  getStreamViewerCounts,
  getStreamEvents,
  getVodByStreamId,
  getClipsByVideoId,
  getBroadcasterProfile,
} from "@repo/supabase/queries/stream-analytics";

export interface StreamSummary {
  title: string | null;
  category: string | null;
  categoryId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  peakViewers: number;
  averageViewers: number;
  totalSubs: number;
  totalFollows: number;
  totalChannelPoints: number;
  totalClips: number;
  totalClipViews: number;
}

export interface ViewerCountBucket {
  bucket: number;
  label: string;
  viewers: number;
}

export interface EventBucket {
  bucket: number;
  subs: number;
  follows: number;
  channelPoints: number;
}

export interface ClipData {
  twitch_clip_id: string;
  title: string;
  creator_name: string;
  url: string;
  thumbnail_url: string | null;
  view_count: number;
  duration: number | null;
  embed_url: string | null;
  vod_offset: number | null;
  broadcaster_id: string | null;
  created_at_twitch: string | null;
  is_featured: boolean | null;
}

export interface RawEvent {
  offsetSeconds: number;
}

export interface TitleCategorySegment {
  startSeconds: number;
  endSeconds: number | null;
  gameId: string | null;
  gameName: string | null;
  title: string | null;
}

export interface BroadcasterProfile {
  username: string;
  profileImageUrl: string | null;
  broadcasterType: "partner" | "affiliate" | "" | null;
}

export interface StreamAnalyticsData {
  streamId: string;
  broadcasterId: string;
  summary: StreamSummary;
  viewerBuckets: ViewerCountBucket[];
  eventBuckets: EventBucket[];
  clips: ClipData[];
  subEvents: RawEvent[];
  followEvents: RawEvent[];
  titleCategoryHistory: TitleCategorySegment[];
  broadcasterProfile: BroadcasterProfile | null;
}

function bucketLabel(bucket: number): string {
  const h = Math.floor(bucket / 3600);
  const m = Math.floor((bucket % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function buildTitleCategoryHistory(
  rows: Array<{ offset_seconds: number; game_id: string | null; game_name: string | null; title: string | null }>
): TitleCategorySegment[] {
  if (rows.length === 0) return [];

  const segments: TitleCategorySegment[] = [];
  let segStart = rows[0].offset_seconds;
  let segGameId = rows[0].game_id;
  let segGameName = rows[0].game_name;
  let segTitle = rows[0].title;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.game_name !== segGameName || row.title !== segTitle) {
      segments.push({ startSeconds: segStart, endSeconds: row.offset_seconds, gameId: segGameId, gameName: segGameName, title: segTitle });
      segStart = row.offset_seconds;
      segGameId = row.game_id;
      segGameName = row.game_name;
      segTitle = row.title;
    }
  }
  segments.push({ startSeconds: segStart, endSeconds: null, gameId: segGameId, gameName: segGameName, title: segTitle });

  return segments;
}

export async function getStreamAnalytics(broadcasterId: string): Promise<StreamAnalyticsData | null> {
  const supabase = await createClient();

  const stream = await getLatestStreamForBroadcaster(supabase, broadcasterId);
  if (!stream?.stream_id) return null;

  // Use broadcaster_id from the DB row if available, fall back to the argument
  const resolvedBroadcasterId = stream.broadcaster_id ?? broadcasterId;
  const streamId = stream.stream_id;

  const [viewerRows, eventRows, vod, profileRow] = await Promise.all([
    getStreamViewerCounts(supabase, streamId),
    getStreamEvents(supabase, streamId),
    getVodByStreamId(supabase, streamId),
    getBroadcasterProfile(supabase),
  ]);

  const clipRows = vod?.video_id ? await getClipsByVideoId(supabase, vod.video_id) : [];

  const clips: ClipData[] = clipRows.map((c) => ({
    twitch_clip_id: c.twitch_clip_id,
    title: c.title,
    creator_name: c.creator_name,
    url: c.url,
    thumbnail_url: c.thumbnail_url,
    view_count: c.view_count ?? 0,
    duration: c.duration,
    embed_url: c.embed_url,
    vod_offset: c.vod_offset,
    broadcaster_id: c.broadcaster_id,
    created_at_twitch: c.created_at_twitch,
    is_featured: c.is_featured,
  }));

  const SUB_TYPES = ["channel.subscribe", "channel.subscription.message", "channel.subscription.gift"];
  const FOLLOW_TYPE = "channel.follow";
  const POINTS_TYPE = "channel.channel_points_custom_reward_redemption.add";

  // Summary stats
  const peakViewers = viewerRows.length > 0 ? Math.max(...viewerRows.map((r) => r.viewer_count)) : 0;
  const averageViewers =
    viewerRows.length > 0
      ? Math.round(viewerRows.reduce((s, r) => s + r.viewer_count, 0) / viewerRows.length)
      : 0;
  const totalSubs = eventRows.filter((e) => SUB_TYPES.includes(e.event_type)).length;
  const totalFollows = eventRows.filter((e) => e.event_type === FOLLOW_TYPE).length;
  const totalChannelPoints = eventRows
    .filter((e) => e.event_type === POINTS_TYPE)
    .reduce((sum, e) => {
      const d = e.event_data as Record<string, unknown>;
      const reward = d?.reward as Record<string, unknown> | undefined;
      return sum + (typeof reward?.cost === "number" ? reward.cost : 0);
    }, 0);
  const totalClips = clips.length;
  const totalClipViews = clips.reduce((s, c) => s + (c.view_count ?? 0), 0);

  let durationSeconds: number | null = null;
  if (stream.stream_started_at && stream.stream_ended_at) {
    durationSeconds = Math.floor(
      (new Date(stream.stream_ended_at).getTime() - new Date(stream.stream_started_at).getTime()) / 1000
    );
  } else {
    const offlineEvent = eventRows.find((e) => e.event_type === "stream.offline");
    if (offlineEvent) durationSeconds = offlineEvent.offset_seconds;
  }

  // Bucket viewer counts (average per 5-min window)
  const viewerByBucket = new Map<number, number[]>();
  for (const row of viewerRows) {
    const bucket = Math.floor(row.offset_seconds / 300) * 300;
    const existing = viewerByBucket.get(bucket) ?? [];
    existing.push(row.viewer_count);
    viewerByBucket.set(bucket, existing);
  }

  const viewerBuckets: ViewerCountBucket[] = [...viewerByBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, values]) => ({
      bucket,
      label: bucketLabel(bucket),
      viewers: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));

  // Bucket events (totals per 5-min window)
  const eventByBucket = new Map<number, { subs: number; follows: number; channelPoints: number }>();
  for (const row of eventRows) {
    const bucket = Math.floor(row.offset_seconds / 300) * 300;
    const existing = eventByBucket.get(bucket) ?? { subs: 0, follows: 0, channelPoints: 0 };
    if (SUB_TYPES.includes(row.event_type)) existing.subs++;
    if (row.event_type === FOLLOW_TYPE) existing.follows++;
    if (row.event_type === POINTS_TYPE) {
      const d = row.event_data as Record<string, unknown>;
      const reward = d?.reward as Record<string, unknown> | undefined;
      existing.channelPoints += typeof reward?.cost === "number" ? reward.cost : 0;
    }
    eventByBucket.set(bucket, existing);
  }

  const eventBuckets: EventBucket[] = [...eventByBucket.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, data]) => ({ bucket, ...data }));

  const subEvents: RawEvent[] = eventRows
    .filter((e) => SUB_TYPES.includes(e.event_type))
    .map((e) => ({ offsetSeconds: e.offset_seconds }));

  const followEvents: RawEvent[] = eventRows
    .filter((e) => e.event_type === FOLLOW_TYPE)
    .map((e) => ({ offsetSeconds: e.offset_seconds }));

  const titleCategoryHistory = buildTitleCategoryHistory(viewerRows);

  const broadcasterProfile: BroadcasterProfile | null = profileRow
    ? {
        username: profileRow.twitch_username,
        profileImageUrl: profileRow.profile_image_url,
        broadcasterType: profileRow.broadcaster_type as BroadcasterProfile["broadcasterType"],
      }
    : null;

  return {
    streamId,
    broadcasterId: resolvedBroadcasterId,
    summary: {
      title: stream.title,
      category: stream.category_name,
      categoryId: stream.category_id,
      startedAt: stream.stream_started_at,
      endedAt: stream.stream_ended_at,
      durationSeconds,
      peakViewers,
      averageViewers,
      totalSubs,
      totalFollows,
      totalChannelPoints,
      totalClips,
      totalClipViews,
    },
    viewerBuckets,
    eventBuckets,
    clips,
    subEvents,
    followEvents,
    titleCategoryHistory,
    broadcasterProfile,
  };
}
