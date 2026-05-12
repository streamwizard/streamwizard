import type { ClipData, ViewerCountBucket, RawEvent, TitleCategorySegment, BroadcasterProfile } from "@/actions/supabase/analytics/stream-analytics";

export type { ClipData, ViewerCountBucket, RawEvent, TitleCategorySegment, BroadcasterProfile };

export interface MergedBucket {
  bucket: number;
  label: string;
  viewers: number;
  subs: number;
  follows: number;
  channelPoints: number;
  clipCount: number;
  clips: ClipData[];
}

export interface HypeMoment {
  bucket: number;
  label: string;
  viewers: number;
  clipCount: number;
  topClip: ClipData | null;
}
