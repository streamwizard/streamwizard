import type { ViewerCountBucket, ClipData, RawEvent } from "@/actions/supabase/analytics/stream-analytics";
import type { HourlyViewerStat } from "@/lib/analytics/hourly-buckets";
import type { CategorySegmentStats } from "@/lib/analytics/category-segments";
import type { ActivityEvent } from "@/actions/supabase/analytics/activity-feed";

/*
 * One coherent demo stream for the landing page: 4h 12m, raid at 2:10:00,
 * peak 214 viewers right after. Every number here has to agree with every
 * other widget on the page (KPIs, charts, category table, activity feed),
 * and all of it is labeled demo data in the UI. Static literals only:
 * anything time- or random-derived would break hydration.
 */

const STREAM_START_ISO = "2026-08-14T19:00:00.000Z";

function atOffset(offsetSeconds: number): string {
  const base = new Date(STREAM_START_ISO).getTime();
  return new Date(base + offsetSeconds * 1000).toISOString();
}

function formatBucketLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const VIEWER_SERIES: Array<[number, number]> = [
  [0, 38],
  [600, 52],
  [1200, 67],
  [1800, 79],
  [2400, 88],
  [3000, 97],
  [3600, 104],
  [4200, 111],
  [4800, 118],
  [5400, 126],
  [6000, 131],
  [6600, 128],
  [7200, 135],
  [7800, 196],
  [8400, 214],
  [9000, 203],
  [9600, 191],
  [10200, 184],
  [10800, 176],
  [11400, 171],
  [12000, 168],
  [12600, 163],
  [13200, 158],
  [13800, 154],
  [14400, 151],
  [15000, 148],
];

export const demoViewerBuckets: ViewerCountBucket[] = VIEWER_SERIES.map(([bucket, viewers]) => ({
  bucket,
  label: formatBucketLabel(bucket),
  viewers,
}));

export const demoFollowEvents: RawEvent[] = [
  { offsetSeconds: 1980 },
  { offsetSeconds: 3120 },
  { offsetSeconds: 4260 },
  { offsetSeconds: 5040 },
  { offsetSeconds: 6480 },
  { offsetSeconds: 7920 },
  { offsetSeconds: 8160 },
  { offsetSeconds: 8460 },
  { offsetSeconds: 8880 },
  { offsetSeconds: 9420 },
  { offsetSeconds: 10380 },
  { offsetSeconds: 11520 },
  { offsetSeconds: 12780 },
  { offsetSeconds: 13500 },
];

export const demoSubEvents: RawEvent[] = [
  { offsetSeconds: 4680 },
  { offsetSeconds: 5460 },
  { offsetSeconds: 8520 },
  { offsetSeconds: 9660 },
  { offsetSeconds: 12240 },
];

export const demoClips: ClipData[] = [
  {
    twitch_clip_id: "demo-clip-1",
    title: "The 1v4 that saved the run",
    creator_name: "pixelpasta",
    url: "",
    thumbnail_url: null,
    view_count: 412,
    duration: 28,
    embed_url: null,
    vod_offset: 8280,
    broadcaster_id: null,
    created_at_twitch: atOffset(8280),
    is_featured: true,
  },
  {
    twitch_clip_id: "demo-clip-2",
    title: "Raid landed mid boss fight",
    creator_name: "night_owl_kat",
    url: "",
    thumbnail_url: null,
    view_count: 287,
    duration: 31,
    embed_url: null,
    vod_offset: 7860,
    broadcaster_id: null,
    created_at_twitch: atOffset(7860),
    is_featured: false,
  },
  {
    twitch_clip_id: "demo-clip-3",
    title: "Chat predicted it 10 seconds early",
    creator_name: "mossy_vt",
    url: "",
    thumbnail_url: null,
    view_count: 158,
    duration: 22,
    embed_url: null,
    vod_offset: 12300,
    broadcaster_id: null,
    created_at_twitch: atOffset(12300),
    is_featured: false,
  },
];

export const demoHourlyStats: HourlyViewerStat[] = [
  {
    hour: 0,
    startTime: atOffset(0),
    endTime: atOffset(3600),
    avgViewers: 70,
    peakViewers: 97,
    follows: 2,
    subs: 0,
    bits: 0,
    raids: 0,
    redemptions: 1,
    totalInteractions: 3,
    engagementScore: 0.21,
    isBestHour: false,
  },
  {
    hour: 1,
    startTime: atOffset(3600),
    endTime: atOffset(7200),
    avgViewers: 120,
    peakViewers: 131,
    follows: 3,
    subs: 2,
    bits: 100,
    raids: 0,
    redemptions: 0,
    totalInteractions: 6,
    engagementScore: 0.44,
    isBestHour: false,
  },
  {
    hour: 2,
    startTime: atOffset(7200),
    endTime: atOffset(10800),
    avgViewers: 187,
    peakViewers: 214,
    follows: 6,
    subs: 2,
    bits: 350,
    raids: 1,
    redemptions: 2,
    totalInteractions: 12,
    engagementScore: 1,
    isBestHour: true,
  },
  {
    hour: 3,
    startTime: atOffset(10800),
    endTime: atOffset(14400),
    avgViewers: 165,
    peakViewers: 176,
    follows: 3,
    subs: 1,
    bits: 0,
    raids: 0,
    redemptions: 1,
    totalInteractions: 5,
    engagementScore: 0.52,
    isBestHour: false,
  },
];

export const demoCategorySegments: CategorySegmentStats[] = [
  {
    gameId: "512953",
    gameName: "Elden Ring",
    startSeconds: 0,
    endSeconds: 9600,
    durationSeconds: 9600,
    avgViewers: 122,
    peakViewers: 214,
    follows: 9,
    subs: 3,
    bits: 450,
  },
  {
    gameId: "509658",
    gameName: "Just Chatting",
    startSeconds: 9600,
    endSeconds: 15120,
    durationSeconds: 5520,
    avgViewers: 164,
    peakViewers: 184,
    follows: 5,
    subs: 2,
    bits: 0,
  },
];

export const demoActivityEvents: ActivityEvent[] = [
  {
    id: "demo-event-1",
    event_type: "channel.raid",
    event_data: { from_broadcaster_user_name: "mossy_vt", viewers: 62 },
    created_at: atOffset(7800),
    offset_seconds: 7800,
  },
  {
    id: "demo-event-2",
    event_type: "channel.follow",
    event_data: { user_name: "night_owl_kat" },
    created_at: atOffset(7920),
    offset_seconds: 7920,
  },
  {
    id: "demo-event-3",
    event_type: "channel.cheer",
    event_data: { user_name: "pixelpasta", bits: 250 },
    created_at: atOffset(8100),
    offset_seconds: 8100,
  },
  {
    id: "demo-event-4",
    event_type: "channel.subscribe",
    event_data: { user_name: "grilledcheese_gg", tier: "1000" },
    created_at: atOffset(8520),
    offset_seconds: 8520,
  },
  {
    id: "demo-event-5",
    event_type: "channel.channel_points_custom_reward_redemption.add",
    event_data: { user_name: "sleepy_sre", reward: { title: "Hydrate", cost: 500 } },
    created_at: atOffset(9000),
    offset_seconds: 9000,
  },
];

/* KPI row values. Same stream, same totals as the widgets above. */
export const demoStats = {
  timeInAds: "4m 30s",
  peakViewers: 214,
  avgViewers: 137,
  onAir: "4h 12m",
  newFollows: 14,
  newSubs: 5,
} as const;

/*
 * Fallback for the clips marquee when the get_showcase_clips RPC returns too
 * few rows or errors (fresh local DB, Supabase down at revalidation time).
 * A static snapshot of real clips synced by real StreamWizard users, public
 * Twitch data, on hosts next.config.ts already allows.
 */
export interface RealClipCard {
  id: string;
  title: string;
  creator: string;
  broadcaster: string;
  duration: string;
  views: number;
  thumbnailUrl: string;
  /** twitch.tv page for the clip; null when unknown. */
  url: string | null;
  /** clips.twitch.tv embed URL (without parent params); null disables playback. */
  embedUrl: string | null;
  /** ISO timestamp the clip was created on Twitch. */
  createdAt?: string | null;
  /** Twitch category name, resolved from game_id; null when Twitch has no match. */
  category?: string | null;
}

export const fallbackClipCards: RealClipCard[] = [
  {
    id: "TalentedCogentSlothKappaWealth-OqcQ7nwuwl3hGU2K",
    title: "No shame",
    creator: "Harambemonkey",
    broadcaster: "xPudu",
    duration: "0:12",
    views: 921,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/TalentedCogentSlothKappaWealth-OqcQ7nwuwl3hGU2K/15fc1c99-efaa-4df3-9e5a-61643bfa753a/preview-480x272.jpg",
    url: "https://www.twitch.tv/xpudu/clip/TalentedCogentSlothKappaWealth-OqcQ7nwuwl3hGU2K",
    embedUrl: "https://clips.twitch.tv/embed?clip=TalentedCogentSlothKappaWealth-OqcQ7nwuwl3hGU2K",
    createdAt: "2024-08-28T10:36:55Z",
    category: "Just Chatting",
  },
  {
    id: "AltruisticDifficultTireMVGame",
    title: "Almost died",
    creator: "MaisterS",
    broadcaster: "MaisterS",
    duration: "0:35",
    views: 292,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/08b8bed7-95cb-42c2-b2a1-e9a8b448fed3/landscape/thumb/thumb-0000000000-480x272.jpg",
    url: "https://www.twitch.tv/maisters/clip/AltruisticDifficultTireMVGame",
    embedUrl: "https://clips.twitch.tv/embed?clip=AltruisticDifficultTireMVGame",
    createdAt: "2018-05-07T15:34:10Z",
    category: "Fortnite",
  },
  {
    id: "FunEnthusiasticTriangleStrawBeary",
    title: "You better not let go off the keyboard...",
    creator: "MonkTV",
    broadcaster: "mjvp94",
    duration: "0:17",
    views: 257,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-clips/AT-cm%7C283832465-preview-480x272.jpg",
    url: "https://clips.twitch.tv/FunEnthusiasticTriangleStrawBeary",
    embedUrl: "https://clips.twitch.tv/embed?clip=FunEnthusiasticTriangleStrawBeary",
    createdAt: "2018-08-03T17:24:45Z",
    category: "Emily Wants to Play",
  },
  {
    id: "GeniusFuriousSpindleKeepo-3ufURdCCQCUT9Nhq",
    title: "Vliegende dolfijnen",
    creator: "mjvp94",
    broadcaster: "CoenMetEenC",
    duration: "0:33",
    views: 253,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/47f50d4d-5867-4d30-a3e5-e511384f9f24/landscape/thumb/thumb-0000000000-480x272.jpg",
    url: "https://www.twitch.tv/coenmeteenc/clip/GeniusFuriousSpindleKeepo-3ufURdCCQCUT9Nhq",
    embedUrl: "https://clips.twitch.tv/embed?clip=GeniusFuriousSpindleKeepo-3ufURdCCQCUT9Nhq",
    createdAt: "2023-11-20T20:52:08Z",
    category: "Minecraft",
  },
  {
    id: "RepleteBigSandpiperGivePLZ-cX5ecJPJF5zfduCK",
    title: "deze mind control",
    creator: "Jochemwhite",
    broadcaster: "Ron0x",
    duration: "0:33",
    views: 238,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/94387d84-03eb-4dda-9dfa-8d523d7d512e/landscape/thumb/thumb-0000000000-480x272.jpg",
    url: "https://www.twitch.tv/ron0x/clip/RepleteBigSandpiperGivePLZ-cX5ecJPJF5zfduCK",
    embedUrl: "https://clips.twitch.tv/embed?clip=RepleteBigSandpiperGivePLZ-cX5ecJPJF5zfduCK",
    createdAt: "2022-08-05T20:43:33Z",
    category: "Just Chatting",
  },
  {
    id: "TastyDiligentClintCoolCat-SxId-MhyJbdOi1fM",
    title: "i knew it LOL",
    creator: "rdggx",
    broadcaster: "rdggx",
    duration: "0:13",
    views: 211,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-clips-thumbnails-prod/TastyDiligentClintCoolCat-SxId-MhyJbdOi1fM/7ece57f9-9e2a-4062-a9a9-f3a1039ebff4/preview-480x272.jpg",
    url: "https://www.twitch.tv/rdggx/clip/TastyDiligentClintCoolCat-SxId-MhyJbdOi1fM",
    embedUrl: "https://clips.twitch.tv/embed?clip=TastyDiligentClintCoolCat-SxId-MhyJbdOi1fM",
    createdAt: "2025-09-26T11:55:31Z",
    category: "World of Warcraft",
  },
  {
    id: "VivaciousHungryOcelotMcaT-rjhurfYmPL-o1gpm",
    title: "wanneer Pudu opstaat om thee te zetten",
    creator: "StiefbroerIkZitVast",
    broadcaster: "NorthernG1ant",
    duration: "0:05",
    views: 149,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-clips/u_s63a44bq32Jjy_qNYKZg/AT-cm%7Cu_s63a44bq32Jjy_qNYKZg-preview-480x272.jpg",
    url: "https://www.twitch.tv/northerng1ant/clip/VivaciousHungryOcelotMcaT-rjhurfYmPL-o1gpm",
    embedUrl: "https://clips.twitch.tv/embed?clip=VivaciousHungryOcelotMcaT-rjhurfYmPL-o1gpm",
    createdAt: "2023-05-31T18:08:10Z",
    category: "Grand Theft Auto V",
  },
  {
    id: "RelievedSaltyLionFeelsBadMan-fnE7Gr3Znodzz2MK",
    title: "Mo is gone",
    creator: "Ron0x",
    broadcaster: "Jochemwhite",
    duration: "0:13",
    views: 98,
    thumbnailUrl:
      "https://static-cdn.jtvnw.net/twitch-video-assets/twitch-vap-video-assets-prod-us-west-2/edd128ca-3227-42fd-8607-7f9acb993836/landscape/thumb/thumb-0000000000-480x272.jpg",
    url: "https://www.twitch.tv/jochemwhite/clip/RelievedSaltyLionFeelsBadMan-fnE7Gr3Znodzz2MK",
    embedUrl: "https://clips.twitch.tv/embed?clip=RelievedSaltyLionFeelsBadMan-fnE7Gr3Znodzz2MK",
    createdAt: "2023-08-28T12:15:37Z",
    category: "Fortnite",
  },
];

/*
 * The same stream the analytics widgets above render, seen from the VOD page:
 * 4h 12m, raid at 2:10:00, three clips cut out of it. Everything below is
 * derived from the arrays that already describe it, so a follow marker on the
 * timeline is the same follow the charts counted.
 */

export const DEMO_VOD_DURATION_SECONDS = 15120;

export const demoVodMeta = {
  id: "2451234567",
  title: "Elden Ring blind run, day 6 (chat picked the build)",
  category: "Elden Ring",
  duration: "4h 12m",
  views: 1842,
  recordedAt: STREAM_START_ISO,
} as const;

/** Timeline markers. Labels and colors come from the dashboard's event config. */
export interface DemoVodEvent {
  id: string;
  /** Legend/label text, as the dashboard writes it. */
  label: string;
  /** Tailwind background class, matching EVENT_TYPE_CONFIG. */
  color: string;
  offsetSeconds: number;
  detail?: string;
}

/** Striped bands on the track: the only two the real timeline draws. */
export interface DemoVodSegment {
  type: "muted" | "ad_break";
  startSeconds: number;
  endSeconds: number;
}

export const demoVodSegments: DemoVodSegment[] = [
  { type: "ad_break", startSeconds: 3600, endSeconds: 3780 },
  { type: "muted", startSeconds: 5400, endSeconds: 5760 },
  { type: "ad_break", startSeconds: 10800, endSeconds: 10980 },
];

export const demoVodEvents: DemoVodEvent[] = [
  ...demoFollowEvents.map((event, index) => ({
    id: `follow-${index}`,
    label: "Follow",
    color: "bg-blue-500",
    offsetSeconds: event.offsetSeconds,
  })),
  ...demoSubEvents.map((event, index) => ({
    id: `sub-${index}`,
    label: "Subscription",
    color: "bg-purple-500",
    offsetSeconds: event.offsetSeconds,
    detail: "Tier 1",
  })),
  ...demoVodSegments
    .filter((segment) => segment.type === "ad_break")
    .map((segment, index) => ({
      id: `ad-${index}`,
      label: "Ad Break",
      color: "bg-amber-500",
      offsetSeconds: segment.startSeconds,
      detail: "3m",
    })),
  { id: "raid", label: "Raid", color: "bg-indigo-500", offsetSeconds: 7800, detail: "mossy_vt · 62 viewers" },
  { id: "cheer", label: "Cheer", color: "bg-emerald-500", offsetSeconds: 8100, detail: "pixelpasta · 250 bits" },
  {
    id: "redemption",
    label: "Points Redemption",
    color: "bg-cyan-500",
    offsetSeconds: 9000,
    detail: "sleepy_sre · Hydrate",
  },
  ...demoClips.map((clip) => ({
    id: `clip-${clip.twitch_clip_id}`,
    label: "Clip",
    color: "bg-teal-500",
    offsetSeconds: clip.vod_offset ?? 0,
    detail: clip.title,
  })),
].sort((a, b) => a.offsetSeconds - b.offsetSeconds);
