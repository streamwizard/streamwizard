"use server";

import { cache } from "react";
import { createClient } from "@repo/supabase/next/server";
import {
  getStreamViewerCounts,
  getStreamEvents,
  getPreviousStreamForBroadcaster,
} from "@repo/supabase/queries/stream-analytics";

export interface StreamStatValues {
  peakViewers: number;
  avgViewers: number;
  durationSeconds: number | null;
  follows: number;
  subs: number;
}

export interface StatsRowData {
  current: StreamStatValues;
  previous: StreamStatValues | null;
}

const SUB_TYPES = ["channel.subscribe", "channel.subscription.message", "channel.subscription.gift"];

async function computeStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  streamId: string,
  startedAt: string | null,
  endedAt: string | null
): Promise<StreamStatValues> {
  const [viewerRows, eventRows] = await Promise.all([
    getStreamViewerCounts(supabase, streamId),
    getStreamEvents(supabase, streamId),
  ]);

  const peakViewers = viewerRows.length ? Math.max(...viewerRows.map((r) => r.viewer_count)) : 0;
  const avgViewers = viewerRows.length
    ? Math.round(viewerRows.reduce((s, r) => s + r.viewer_count, 0) / viewerRows.length)
    : 0;
  const follows = eventRows.filter((e) => e.event_type === "channel.follow").length;
  const subs = eventRows.filter((e) => SUB_TYPES.includes(e.event_type)).length;

  let durationSeconds: number | null = null;
  if (startedAt && endedAt) {
    durationSeconds = Math.floor(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    );
  }

  return { peakViewers, avgViewers, durationSeconds, follows, subs };
}

export const getStatsRowData = cache(
  async (
    streamId: string,
    broadcasterId: string,
    startedAt: string | null,
    endedAt: string | null
  ): Promise<StatsRowData> => {
    const supabase = await createClient();

    const [current, prevStream] = await Promise.all([
      computeStats(supabase, streamId, startedAt, endedAt),
      getPreviousStreamForBroadcaster(supabase, broadcasterId, streamId),
    ]);

    let previous: StreamStatValues | null = null;
    if (prevStream?.stream_id) {
      previous = await computeStats(
        supabase,
        prevStream.stream_id,
        prevStream.stream_started_at,
        prevStream.stream_ended_at
      );
    }

    return { current, previous };
  }
);
