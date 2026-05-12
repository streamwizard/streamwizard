"use client";

import { useMemo } from "react";
import type { StreamAnalyticsData, ClipData } from "@/actions/supabase/analytics/stream-analytics";
import type { MergedBucket } from "./types";
import { StreamSummaryBar } from "./stream-summary-bar";
import { ViewerCountChart } from "./viewer-count-chart";
import { TopClipsRow } from "./top-clips-row";
import { ClipActivityChart } from "./clip-activity-chart";
import { SubsFollowsChart } from "./subs-follows-chart";
import { ChannelPointsChart } from "./channel-points-chart";
import { BroadcasterProfileStrip } from "./broadcaster-profile-strip";
import { TitleCategoryHistory } from "./title-category-history";
import { UpdateChannelCard } from "./update-channel-card";

function bucketToLabel(bucket: number): string {
  const h = Math.floor(bucket / 3600);
  const m = Math.floor((bucket % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

function buildMergedBuckets(data: StreamAnalyticsData): MergedBucket[] {
  const eventMap = new Map(data.eventBuckets.map((e) => [e.bucket, e]));

  const clipsByBucket = new Map<number, ClipData[]>();
  for (const clip of data.clips) {
    if (clip.vod_offset == null) continue;
    const bucket = Math.floor(clip.vod_offset / 300) * 300;
    const existing = clipsByBucket.get(bucket) ?? [];
    existing.push(clip);
    clipsByBucket.set(bucket, existing);
  }

  const allBuckets = new Set<number>([
    ...data.viewerBuckets.map((v) => v.bucket),
    ...data.eventBuckets.map((e) => e.bucket),
    ...clipsByBucket.keys(),
  ]);

  return [...allBuckets]
    .sort((a, b) => a - b)
    .map((bucket) => {
      const viewer = data.viewerBuckets.find((v) => v.bucket === bucket);
      const event = eventMap.get(bucket);
      const clips = clipsByBucket.get(bucket) ?? [];
      const subs = event?.subs ?? 0;
      const follows = event?.follows ?? 0;
      return {
        bucket,
        label: bucketToLabel(bucket),
        viewers: viewer?.viewers ?? 0,
        subs,
        follows,
        channelPoints: event?.channelPoints ?? 0,
        clipCount: clips.length,
        clips,
      };
    });
}


interface StreamAnalyticsDashboardProps {
  data: StreamAnalyticsData;
}

export function StreamAnalyticsDashboard({ data }: StreamAnalyticsDashboardProps) {
  const merged = useMemo(() => buildMergedBuckets(data), [data]);

  const xTicks = useMemo(() => {
    const every = Math.max(1, Math.ceil(merged.length / 12));
    return merged.filter((_, i) => i % every === 0).map((b) => b.label);
  }, [merged]);

  return (
    <>
      {data.broadcasterProfile && (
        <BroadcasterProfileStrip profile={data.broadcasterProfile} />
      )}

      <StreamSummaryBar summary={data.summary} />

      <UpdateChannelCard
        broadcasterId={data.broadcasterId}
        currentTitle={data.summary.title}
        currentCategory={data.summary.category}
        currentGameId={data.summary.categoryId}
      />

      <ViewerCountChart
        viewerBuckets={data.viewerBuckets}
        subEvents={data.subEvents}
        followEvents={data.followEvents}
        clips={data.clips}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClipActivityChart data={merged} xTicks={xTicks} />
        <SubsFollowsChart data={merged} xTicks={xTicks} />
      </div>

      <ChannelPointsChart
        data={merged}
        xTicks={xTicks}
        totalPoints={data.summary.totalChannelPoints}
      />

      <TitleCategoryHistory segments={data.titleCategoryHistory} />

      <TopClipsRow clips={data.clips} />
    </>
  );
}
