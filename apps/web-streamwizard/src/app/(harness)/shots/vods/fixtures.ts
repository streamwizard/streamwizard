import type { TwitchVideo } from "@/types/twitch-video";

/**
 * The VODs area reads Twitch Helix live rather than the database, so it cannot
 * be seeded. These stand in for what Helix would answer with.
 *
 * The channel and the broadcasts are the same fixtures the seeded pages use,
 * so a reader moving between screenshots sees one consistent account.
 */
const BROADCASTER = { id: "900000001", login: "novaplays", name: "novaplays" };

function video(opts: {
  id: string;
  title: string;
  startedAt: string;
  duration: string;
  views: number;
  live?: boolean;
  muted?: Array<{ duration: number; offset: number }>;
}): TwitchVideo {
  return {
    id: opts.id,
    stream_id: `4${opts.id}`,
    user_id: BROADCASTER.id,
    user_login: BROADCASTER.login,
    user_name: BROADCASTER.name,
    title: opts.title,
    description: "",
    created_at: opts.startedAt,
    published_at: opts.startedAt,
    url: `https://www.twitch.tv/videos/${opts.id}`,
    // Intercepted by the harness and answered with a generated image.
    thumbnail_url:
      "https://static-cdn.jtvnw.net/shot-previews/vod-%{width}x%{height}.jpg",
    viewable: "public",
    view_count: opts.views,
    language: "en",
    type: "archive",
    duration: opts.duration,
    muted_segments: opts.muted ?? null,
    is_live: opts.live,
  };
}

export const SHOT_VODS: TwitchVideo[] = [
  video({
    id: "2451234571",
    title: "late night rust, no plan",
    startedAt: "2026-08-14T17:00:00Z",
    duration: "4h12m0s",
    views: 1842,
    muted: [{ duration: 360, offset: 5400 }],
  }),
  video({
    id: "2451234570",
    title: "finishing the base before someone raids it",
    startedAt: "2026-08-12T18:30:00Z",
    duration: "3h48m0s",
    views: 1204,
  }),
  video({
    id: "2451234569",
    title: "just chatting, then whatever chat picks",
    startedAt: "2026-08-10T19:00:00Z",
    duration: "2h05m0s",
    views: 876,
  }),
  video({
    id: "2451234568",
    title: "ranked grind, one more game",
    startedAt: "2026-08-08T20:15:00Z",
    duration: "5h31m0s",
    views: 2310,
  }),
  video({
    id: "2451234567",
    title: "first stream back after the break",
    startedAt: "2026-08-05T17:45:00Z",
    duration: "1h58m0s",
    views: 3022,
  }),
];

export const SHOT_VOD = SHOT_VODS[0]!;
