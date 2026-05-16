"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import {
  getStreamViewerCounts,
  getStreamEvents,
  getVodByStreamId,
  getClipsByVideoId,
} from "@repo/supabase/queries/stream-analytics";
import type { ViewerCountBucket, RawEvent, ClipData } from "@/actions/supabase/analytics/stream-analytics";
import { SUB_EVENT_TYPES } from "@/lib/utils/stream-events";

export interface ViewerChartData {
  viewerBuckets: ViewerCountBucket[];
  subEvents: RawEvent[];
  followEvents: RawEvent[];
  clips: ClipData[];
}


export const getViewerChartData = cache(
  async (streamId: string, broadcasterId: string): Promise<ViewerChartData> => {
    const supabase = await createClient();

    const [viewerRows, eventRows, vod] = await Promise.all([
      getStreamViewerCounts(supabase, streamId),
      getStreamEvents(supabase, streamId),
      getVodByStreamId(supabase, streamId),
    ]);

    const clipRows = vod?.video_id ? await getClipsByVideoId(supabase, vod.video_id) : [];

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
        label: `${Math.floor(bucket / 3600)}:${String(Math.floor((bucket % 3600) / 60)).padStart(2, "0")}`,
        viewers: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      }));

    const subEvents: RawEvent[] = eventRows
      .filter((e) => (SUB_EVENT_TYPES as readonly string[]).includes(e.event_type))
      .map((e) => ({ offsetSeconds: e.offset_seconds }));

    const followEvents: RawEvent[] = eventRows
      .filter((e) => e.event_type === "channel.follow")
      .map((e) => ({ offsetSeconds: e.offset_seconds }));

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

    return { viewerBuckets, subEvents, followEvents, clips };
  }
);
