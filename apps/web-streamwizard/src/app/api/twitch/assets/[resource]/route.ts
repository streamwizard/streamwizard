import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserId } from "@repo/supabase/queries/user";
import { reportError } from "@repo/sentry";
import {
  isThirdPartyProvider,
  liveGoals,
  livePoll,
  liveAdSchedule,
  liveCredits,
  liveLabels,
  liveStream,
  resolveBadges,
  resolveCheermotes,
  resolveThirdPartyEmotes,
  resolveUsers,
  resolveChannelEmotes,
  resolveEmoteLibrary,
  searchEmotes,
  isEmoteSearchProvider,
} from "@repo/twitch-assets";

/**
 * Twitch chat assets for signed-in app surfaces (the deck's chat tab, the
 * overlay editor's widgets), plus the live goals, poll and ad schedule
 * the goal, poll and ad widgets start from.
 *
 * The overlay has an equivalent route, but it authorises with a scene's
 * subscriber token — a credential the deck neither has nor should mint. Same
 * resolvers underneath, same Supabase-backed asset cache; only the way the
 * caller proves who it is differs. Being same-origin, this one needs no CORS
 * and no per-token bucket: the session is the limit.
 *
 * The broadcaster id comes from the session's Twitch integration and never
 * from the request, so this can't be used as an open Helix proxy.
 */

// Server-side TTLs are 1h–1d; this only smooths repeat calls in one page load.
const ASSET_CACHE_CONTROL = "private, max-age=60";
// Live numbers are never cached; see packages/twitch-assets/src/live.ts.
const LIVE_CACHE_CONTROL = "no-store";
// Credits for a stream that ended can't change; the handler picks this once is_live is false.
const ENDED_CREDITS_CACHE_CONTROL = "private, max-age=300";

type Resource =
  | "badges"
  | "cheermotes"
  | "emotes"
  | "emote_library"
  | "emote_search"
  | "goals"
  | "poll"
  | "ads"
  | "stream"
  | "credits"
  | "labels"
  | "users";

type LiveResource = "goals" | "poll" | "ads";

const LIVE_RESOURCES = new Set<Resource>(["goals", "poll", "ads", "stream", "credits", "labels"]);

const RESOURCES = new Set<Resource>([
  "badges",
  "cheermotes",
  "emotes",
  "emote_library",
  "emote_search",
  "goals",
  "poll",
  "ads",
  "stream",
  "credits",
  "labels",
  "users",
]);

function isResource(value: string): value is Resource {
  return RESOURCES.has(value as Resource);
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/twitch/assets/[resource]">,
) {
  const { resource } = await ctx.params;

  if (!isResource(resource)) {
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const broadcasterId = await getTwitchUserId(supabase);
  if (!broadcasterId) {
    return NextResponse.json({ error: "No Twitch integration" }, { status: 403 });
  }

  try {
    const body =
      resource === "goals" || resource === "poll" || resource === "ads"
        ? await handleLive(resource, supabase, broadcasterId)
        : await handle(resource, broadcasterId, req.nextUrl.searchParams);
    if ("error" in body) {
      return NextResponse.json(body, { status: body.status ?? 400 });
    }
    const cacheControl =
      body.cacheControl ?? (LIVE_RESOURCES.has(resource) ? LIVE_CACHE_CONTROL : ASSET_CACHE_CONTROL);
    return NextResponse.json(body.data, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    reportError(error, `api/twitch/assets/${resource}`);
    return NextResponse.json({ error: "Upstream failure" }, { status: 502 });
  }
}

type Handled = { data: unknown; cacheControl?: string } | { error: string; status?: number };

async function handle(
  resource: Resource,
  broadcasterId: string,
  params: URLSearchParams,
): Promise<Handled> {
  switch (resource) {
    case "badges":
      return { data: { badges: await resolveBadges(broadcasterId) } };

    case "cheermotes":
      return { data: { cheermotes: await resolveCheermotes(broadcasterId) } };

    case "emotes": {
      const provider = params.get("provider")?.trim() ?? "";
      // The channel's own Twitch emotes, for the emote widget's event bursts.
      if (provider === "twitch") {
        return { data: { emotes: await resolveChannelEmotes(broadcasterId) } };
      }
      if (!isThirdPartyProvider(provider)) {
        return { error: "Unknown provider", status: 400 };
      }
      return { data: { emotes: await resolveThirdPartyEmotes(provider, broadcasterId) } };
    }

    // The editor's emote picker: every emote group the channel has.
    case "emote_library":
      return { data: { sections: await resolveEmoteLibrary(broadcasterId) } };

    // The emote picker's search across all of 7TV or FFZ.
    case "emote_search": {
      const provider = params.get("provider")?.trim() ?? "";
      if (!isEmoteSearchProvider(provider)) return { error: "Unknown provider", status: 400 };
      const q = params.get("q")?.trim() ?? "";
      if (q.length < 2 || q.length > 50) return { error: "Search must be 2 to 50 characters", status: 400 };
      return { data: { emotes: await searchEmotes(provider, q) }, cacheControl: "private, max-age=300" };
    }

    case "goals":
    case "poll":
    case "ads":
      return handleLive(resource, null, broadcasterId);

    // The uptime widget's canvas preview: is the channel live, and since when.
    case "stream":
      return { data: { stream: await liveStream(broadcasterId) } };

    // The credits widget's canvas preview and its settings' status line.
    case "credits": {
      const stream = params.get("stream")?.trim() || undefined;
      if (stream && !/^\d+$/.test(stream)) return { error: "Stream must be a numeric stream id", status: 400 };
      const data = await liveCredits(broadcasterId, { streamId: stream, avatars: params.get("avatars") === "1" });
      if (stream && data.missing.stream) return { error: "Stream not found", status: 404 };
      return { data, cacheControl: data.is_live ? LIVE_CACHE_CONTROL : ENDED_CREDITS_CACHE_CONTROL };
    }

    // The label widget's canvas preview.
    case "labels":
      return { data: await liveLabels(broadcasterId) };

    // Avatars for the hype train widget's riders. Same bounds as the overlay route.
    case "users": {
      const raw = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      if (raw.length === 0) return { error: "Missing ids", status: 400 };
      if (raw.length > 100) return { error: "At most 100 ids per request", status: 400 };
      if (raw.some((id) => !/^\d+$/.test(id))) {
        return { error: "Ids must be numeric Twitch user ids", status: 400 };
      }
      return { data: { users: await resolveUsers(raw) } };
    }
  }
}

/**
 * Goals, the poll or the ad schedule, plus the streamer's login, so the widget settings can
 * link into their own Creator Dashboard.
 */
async function handleLive(
  resource: LiveResource,
  supabase: Awaited<ReturnType<typeof createClient>> | null,
  broadcasterId: string,
): Promise<Handled> {
  const [live, login] = await Promise.all([
    resource === "goals"
      ? liveGoals(broadcasterId)
      : resource === "poll"
        ? livePoll(broadcasterId)
        : liveAdSchedule(broadcasterId),
    supabase
      ? supabase
          .from("integrations_twitch")
          .select("twitch_username")
          .maybeSingle()
          .then(({ data }) => data?.twitch_username?.trim().toLowerCase() || null)
      : Promise.resolve(null),
  ]);
  return { data: { ...live, login } };
}
