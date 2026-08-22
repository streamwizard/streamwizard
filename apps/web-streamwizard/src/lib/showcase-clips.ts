import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatClipDuration } from "@/lib/format";
import { getGameNames } from "@/lib/twitch-games";
import { fallbackClipCards, type RealClipCard } from "@/components/public/home/demo-data";

/*
 * Clips for the landing-page marquee, via the get_showcase_clips RPC (top
 * clips by views, capped per broadcaster so one channel cannot fill the row).
 *
 * The public routes render dynamically (the CSP nonce in JsonLd reads
 * headers()), so the hourly refresh lives on this data call, not the page:
 * unstable_cache serves the same result to every visitor and re-runs the RPC
 * at most once an hour. Bare anon client on purpose: the cookie-bound server
 * client cannot be used inside unstable_cache, and anon is all the
 * world-readable clips table needs.
 */

interface ShowcaseClipRow {
  twitch_clip_id: string;
  title: string;
  creator_name: string;
  broadcaster_name: string;
  view_count: number;
  duration: number | string | null;
  thumbnail_url: string;
  url: string | null;
  embed_url: string | null;
  created_at_twitch: string | null;
  game_id: string | null;
}

/* Clips the marquee scrolls and the filter demo below it works on. */
const SHOWCASE_SIZE = 12;

/* next.config.ts images.remotePatterns; anything else would crash next/image. */
const ALLOWED_THUMBNAIL_HOSTS = new Set([
  "static-cdn.jtvnw.net",
  "vod-secure.twitch.tv",
  "clips-media-assets2.twitch.tv",
]);

function isRenderableThumbnail(url: string): boolean {
  try {
    return ALLOWED_THUMBNAIL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function fetchShowcaseClips(): Promise<RealClipCard[]> {
  try {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLIC_KEY, {
      auth: { persistSession: false },
    });
    // Cast until gen-types picks the function up from the deployed schema.
    const { data, error } = await client.rpc("get_showcase_clips" as never, {
      p_limit: 12,
      p_per_broadcaster: 2,
    } as never);
    if (error) throw error;

    const rows = (data ?? []) as ShowcaseClipRow[];
    const usable = rows.filter((row) => isRenderableThumbnail(row.thumbnail_url)).slice(0, SHOWCASE_SIZE);
    /* Clip rows store game_id, never game_name; the clips demo filters by
     * category, so resolve the names once per refresh. */
    const gameNames = await getGameNames(usable.map((row) => row.game_id ?? ""));

    const live = usable.map((row) => ({
      id: row.twitch_clip_id,
      title: row.title.trim(),
      creator: row.creator_name,
      broadcaster: row.broadcaster_name,
      duration: formatClipDuration(Number(row.duration ?? 0)),
      views: row.view_count,
      thumbnailUrl: row.thumbnail_url,
      url: row.url,
      embedUrl: row.embed_url,
      createdAt: row.created_at_twitch,
      category: (row.game_id && gameNames[row.game_id]) || null,
    }));

    // A short marquee looks broken (few broadcasters in the DB, e.g. a fresh
    // local stack), so live clips come first and the snapshot pads the rest.
    if (live.length >= SHOWCASE_SIZE) return live;
    const seen = new Set(live.map((clip) => clip.id));
    return [...live, ...fallbackClipCards.filter((clip) => !seen.has(clip.id))].slice(0, SHOWCASE_SIZE);
  } catch {
    return fallbackClipCards;
  }
}

export const getShowcaseClips = unstable_cache(fetchShowcaseClips, ["showcase-clips", "v5"], {
  revalidate: 3600,
});
