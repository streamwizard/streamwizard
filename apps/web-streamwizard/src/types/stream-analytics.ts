// Shapes the stream analytics loaders (src/server/analytics/) hand to the
// dashboard's charts and lists.

export interface ViewerCountBucket {
  bucket: number;
  label: string;
  viewers: number;
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

export interface BroadcasterProfile {
  username: string;
  profileImageUrl: string | null;
  broadcasterType: "partner" | "affiliate" | "" | null;
}

export interface ActivityEvent {
  id: string;
  event_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event_data: any;
  created_at: string;
  offset_seconds: number;
}

export interface RecentStream {
  streamId: string;
  title: string | null;
  categoryName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  peakViewers: number;
}
