"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import {
  getRecentStreamsForBroadcaster,
  getBulkStreamPeakViewers,
} from "@repo/supabase/queries/stream-analytics";

export interface RecentStream {
  streamId: string;
  title: string | null;
  categoryName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  peakViewers: number;
}

export const getRecentStreamsData = cache(
  async (broadcasterId: string, excludeStreamId?: string): Promise<RecentStream[]> => {
    const supabase = await createClient();

    const streams = await getRecentStreamsForBroadcaster(supabase, broadcasterId, 6);

    const filtered = excludeStreamId
      ? streams.filter((s) => s.stream_id !== excludeStreamId).slice(0, 5)
      : streams.slice(0, 5);

    if (filtered.length === 0) return [];

    const streamIds = filtered.map((s) => s.stream_id!).filter(Boolean);
    const peakViewersMap = await getBulkStreamPeakViewers(supabase, streamIds);

    return filtered.map((s) => {
      let durationSeconds: number | null = null;
      if (s.stream_started_at && s.stream_ended_at) {
        durationSeconds = Math.floor(
          (new Date(s.stream_ended_at).getTime() - new Date(s.stream_started_at).getTime()) / 1000
        );
      }
      return {
        streamId: s.stream_id!,
        title: s.title,
        categoryName: s.category_name,
        startedAt: s.stream_started_at,
        endedAt: s.stream_ended_at,
        durationSeconds,
        peakViewers: peakViewersMap.get(s.stream_id!) ?? 0,
      };
    });
  }
);
