import { TwitchApi } from "@repo/twitch-api";
import { singleFlight } from "./cache";
import { toPublicAdSchedule } from "./ads";
import { toPublicPoll } from "./polls";
import type { LiveAdSchedule, LiveGoals, LivePoll, PublicGoal, PublicStream } from "./types";

/**
 * Class B: live counters.
 *
 * NOTHING IN THIS FILE IS CACHED. Not for a minute, not for five seconds.
 *
 * A goal widget's contract is: read the true value at load, adjust it from
 * events, and come back correct when the streamer refreshes mid-stream. A TTL
 * of any length breaks the last part — the refresh would restore a number that
 * was right whenever the cache happened to fill, which is exactly the bug the
 * widget was refreshing to escape.
 *
 * Stampede protection is `singleFlight` instead: concurrent callers share one
 * in-flight request and the promise is dropped as soon as it settles. 500
 * viewers reloading an overlay produce one Helix call, and all 500 get a value
 * that was fetched just now. Correctness and one upstream call, not a trade
 * between them.
 *
 * If you are tempted to add a "tiny" TTL here because of rate limits: raise the
 * per-token rate limit in the route instead. Wrong numbers are not a rate-limit
 * solution.
 */

export async function liveFollowerTotal(broadcasterId: string): Promise<number> {
  return singleFlight(`live:followers:${broadcasterId}`, () =>
    new TwitchApi(broadcasterId).followers.getFollowerCount()
  );
}

/**
 * The one call here that needs the broadcaster's own token rather than the app
 * token — /subscriptions requires channel:read:subscriptions.
 */
export async function liveSubscriberTotal(broadcasterId: string): Promise<number> {
  return singleFlight(`live:subs:${broadcasterId}`, () =>
    new TwitchApi(broadcasterId).subscriptions.getSubscriberCount()
  );
}

export async function liveStream(broadcasterId: string): Promise<PublicStream> {
  return singleFlight(`live:stream:${broadcasterId}`, async () => {
    const stream = await new TwitchApi(broadcasterId).streams.getStreamWithAppToken(broadcasterId);

    if (!stream) {
      return {
        is_live: false,
        viewer_count: 0,
        game_id: null,
        game_name: null,
        title: null,
        started_at: null,
        thumbnail_url: null,
      };
    }

    return {
      is_live: true,
      viewer_count: stream.viewer_count,
      game_id: stream.game_id ?? null,
      game_name: stream.game_name ?? null,
      title: stream.title ?? null,
      started_at: stream.started_at ?? null,
      thumbnail_url: stream.thumbnail_url ?? null,
    };
  });
}

/**
 * The channel's active Creator Goals. A token signed in before
 * channel:read:goals joined base gets a 401 "Missing scope"; that comes back as
 * `missing_scope` so the editor can offer a reconnect instead of an error.
 */
export async function liveGoals(broadcasterId: string): Promise<LiveGoals> {
  return singleFlight(`live:goals:${broadcasterId}`, async () => {
    try {
      const goals = await new TwitchApi(broadcasterId).goals.getCreatorGoals();
      return {
        missing_scope: false,
        goals: goals.map(
          (g): PublicGoal => ({
            id: g.id,
            // Helix says "follower", the events say "follow"; widgets get one spelling.
            type: g.type === "follower" ? "follow" : g.type,
            description: g.description,
            current_amount: g.current_amount,
            target_amount: g.target_amount,
            started_at: g.created_at,
          }),
        ),
      };
    } catch (error) {
      if (isMissingScope(error)) return { missing_scope: true, goals: [] };
      throw error;
    }
  });
}

/**
 * The channel's running poll, or the one that just ended (see
 * `toPublicPoll`). Missing channel:read:polls comes back as `missing_scope`,
 * like goals.
 */
export async function livePoll(broadcasterId: string): Promise<LivePoll> {
  return singleFlight(`live:poll:${broadcasterId}`, async () => {
    try {
      const poll = await new TwitchApi(broadcasterId).polls.getLatestPoll();
      return { missing_scope: false, poll: toPublicPoll(poll) };
    } catch (error) {
      if (isMissingScope(error)) return { missing_scope: true, poll: null };
      throw error;
    }
  });
}

/**
 * The channel's ad schedule (next ad, length, snoozes left). Nothing tells us
 * when a streamer snoozes, so the ad widget asks again every so often; see
 * AdWidgetRenderer. Missing channel:read:ads comes back as `missing_scope`.
 */
export async function liveAdSchedule(broadcasterId: string): Promise<LiveAdSchedule> {
  return singleFlight(`live:ads:${broadcasterId}`, async () => {
    try {
      const schedule = await new TwitchApi(broadcasterId).ads.getAdSchedule();
      return { missing_scope: false, schedule: toPublicAdSchedule(schedule) };
    } catch (error) {
      if (isMissingScope(error)) return { missing_scope: true, schedule: null };
      throw error;
    }
  });
}

function isMissingScope(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } }).response;
  const message = response?.data?.message;
  return response?.status === 401 && typeof message === "string" && message.startsWith("Missing scope");
}
