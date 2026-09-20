import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { upsertClips } from "@repo/supabase/queries/clips";
import { getLiveBroadcasters } from "@repo/supabase/queries/live-status";
import { getVodVideoIdByStreamId, setVodVideoId } from "@repo/supabase/queries/vods";
import { getTwitchIntegrationByBroadcasterId, getUserPreferencesByUserId } from "@repo/supabase/queries/user";
import { insertViewerCount } from "@repo/supabase/queries/viewer-counts";
import { TwitchApi } from "@repo/twitch-api";
import { formatClipsForDB } from "../functions/sync-twitch";
import { findVideoIdForStream } from "../lib/stream-video";

/**
 * Polling interval in milliseconds (5 minutes)
 */
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Pages of 100 clips fetched per tick. Each tick only asks for clips created
 * since the previous pull (plus overlap), so one page is the normal case; the
 * cap keeps a runaway stream from turning a tick into a full sync.
 */
const MAX_CLIP_PAGES_PER_TICK = 5;

/**
 * How far the clip window reaches back before the previous pull. Twitch
 * indexes a new clip into Get Clips minutes after it is made, so a clip
 * created just before a pull may only show up on the next one.
 */
const CLIP_WINDOW_OVERLAP_MS = 15 * 60 * 1000;

/**
 * Helix /streams occasionally omits a live channel for a single request. Only
 * this many empty answers in a row are treated as the stream having ended.
 */
const MAX_CONSECUTIVE_STREAM_MISSES = 3;

/**
 * How many ticks look for the stream's archive video when the row was created
 * without one. Helix lists the archive within minutes of go-live, so 30
 * minutes covers that; after the budget a VODs-off channel costs nothing
 * more, and stream.offline makes one last attempt.
 */
const MAX_VIDEO_ID_LOOKUPS = 6;

type PollerState = {
  intervalId: NodeJS.Timeout;
  streamId: string;
  /** Bumped on every start; a tick carrying an older value must not write. */
  generation: number;
  consecutiveMisses: number;
  /** End of the last successful clip pull; null until the first one lands. */
  lastClipPullAt: Date | null;
  /**
   * Twitch archive video for this stream. null = known missing, keep
   * looking; undefined = not read from the database yet (resume after a
   * restart).
   */
  videoId: string | null | undefined;
  videoLookupsLeft: number;
};

/**
 * ViewerCountPoller manages periodic polling of viewer counts for active streams.
 * It starts polling when a stream goes online and stops when it goes offline.
 *
 * Each tick also pulls the clips made since the previous tick and upserts
 * them, so the dashboard and clip widgets see new clips while live. There is no
 * EventSub for clip creation. The full sync on stream.offline stays the
 * reconciliation pass: view counts and vod_offset lag on Twitch for minutes
 * after a clip is made, and this poller never re-reads older clips.
 */
class ViewerCountPoller {
  private activePollers = new Map<string, PollerState>();
  private nextGeneration = 0;

  /**
   * Start polling viewer counts for a broadcaster's stream
   * @param broadcasterId - The broadcaster's Twitch user ID
   * @param streamId - The current stream ID
   * @param videoId - Twitch archive video id if stream.online already found
   *   one, null if it didn't, undefined when unknown (resume after restart)
   */
  startPolling(broadcasterId: string, streamId: string, videoId?: string | null): void {
    const existing = this.activePollers.get(broadcasterId);

    if (existing?.streamId === streamId) {
      console.log(`[ViewerCountPoller] Already polling for broadcaster ${broadcasterId}`);
      return;
    }

    // A different stream id means stream.offline never reached us and the
    // streamer has since restarted. The old poller would keep filing samples
    // under the dead stream id, so replace it.
    if (existing) {
      console.log(
        `[ViewerCountPoller] Stream changed for broadcaster ${broadcasterId} ` +
          `(${existing.streamId} -> ${streamId}), restarting poller`,
      );
      this.stopPolling(broadcasterId);
    }

    console.log(`[ViewerCountPoller] Starting polling for broadcaster ${broadcasterId}, stream ${streamId}`);

    const generation = ++this.nextGeneration;

    const intervalId = setInterval(() => {
      this.tick(broadcasterId, generation).catch((error) =>
        reportError(error, "viewer-count-poller.tick", { broadcasterId, streamId }),
      );
    }, POLLING_INTERVAL_MS);

    this.activePollers.set(broadcasterId, {
      intervalId,
      streamId,
      generation,
      consecutiveMisses: 0,
      lastClipPullAt: null,
      videoId,
      videoLookupsLeft: MAX_VIDEO_ID_LOOKUPS,
    });

    // Record initial viewer count immediately
    this.tick(broadcasterId, generation).catch((error) =>
      reportError(error, "viewer-count-poller.start", { broadcasterId, streamId }),
    );
  }

  /**
   * Stop polling for a broadcaster
   * @param broadcasterId - The broadcaster's Twitch user ID
   */
  stopPolling(broadcasterId: string): void {
    const state = this.activePollers.get(broadcasterId);

    if (state) {
      console.log(`[ViewerCountPoller] Stopping polling for broadcaster ${broadcasterId}`);
      clearInterval(state.intervalId);
      this.activePollers.delete(broadcasterId);
    } else {
      console.log(`[ViewerCountPoller] No active polling found for broadcaster ${broadcasterId}`);
    }
  }

  /**
   * Check if a broadcaster is currently being polled
   * @param broadcasterId - The broadcaster's Twitch user ID
   */
  isPolling(broadcasterId: string): boolean {
    return this.activePollers.has(broadcasterId);
  }

  /**
   * Get count of active pollers (for monitoring)
   */
  getActivePollerCount(): number {
    return this.activePollers.size;
  }

  /**
   * Restart pollers for every broadcaster the database still marks live.
   * Pollers only exist in memory, so a deploy mid-stream would otherwise end
   * viewer samples and live clips for that stream. Never throws: a failure
   * here must not take the API down with it.
   */
  async resume(): Promise<void> {
    try {
      const live = await getLiveBroadcasters(supabase);
      for (const { broadcaster_id, stream_id } of live) {
        this.startPolling(broadcaster_id, stream_id);
      }
      console.log(`[ViewerCountPoller] Resumed ${live.length} poller(s) from broadcaster_live_status`);
    } catch (error) {
      reportError(error, "viewer-count-poller.resume");
    }
  }

  /**
   * One polling round: viewer sample, then clip pull. Public so tests can
   * drive it without timers; the interval is the only production caller.
   *
   * `generation` ties the round to the start call that scheduled it. After
   * stopPolling (or a restart for a new stream) a round still awaiting Twitch
   * or the database must not write, or its stale data lands on top of the
   * full sync that stream.offline just ran.
   */
  async tick(broadcasterId: string, generation?: number): Promise<void> {
    generation ??= this.activePollers.get(broadcasterId)?.generation;
    if (generation === undefined) return;
    const state = this.current(broadcasterId, generation);
    if (!state) return;
    const { streamId } = state;

    try {
      const twitchApi = new TwitchApi(broadcasterId);
      const stream = await twitchApi.streams.getStream({ type: "live" });

      if (!this.current(broadcasterId, generation)) return;

      if (!stream) {
        state.consecutiveMisses++;
        if (state.consecutiveMisses >= MAX_CONSECUTIVE_STREAM_MISSES) {
          console.log(
            `[ViewerCountPoller] Stream not found for ${broadcasterId} ` +
              `${state.consecutiveMisses} times in a row, stopping polling`,
          );
          this.stopPolling(broadcasterId);
        } else {
          console.log(
            `[ViewerCountPoller] Stream not found for ${broadcasterId} ` +
              `(miss ${state.consecutiveMisses}/${MAX_CONSECUTIVE_STREAM_MISSES}), keeping poller`,
          );
        }
        return;
      }

      if (stream.id !== streamId) {
        // stream.offline was missed and a new stream is up. Samples for the new
        // stream need its own start call; nothing to record for the old one.
        console.log(
          `[ViewerCountPoller] Stream id changed for ${broadcasterId} ` +
            `(${streamId} -> ${stream.id}), stopping polling`,
        );
        this.stopPolling(broadcasterId);
        return;
      }

      state.consecutiveMisses = 0;

      // Calculate offset from stream start
      const streamStartedAt = new Date(stream.started_at);
      const now = new Date();
      const offsetSeconds = Math.floor((now.getTime() - streamStartedAt.getTime()) / 1000);

      // Insert viewer count record
      await insertViewerCount(supabase, {
        stream_id: streamId,
        broadcaster_id: broadcasterId,
        viewer_count: stream.viewer_count,
        game_id: stream.game_id || null,
        game_name: stream.game_name || null,
        title: stream.title || null,
        offset_seconds: offsetSeconds,
        recorded_at: now.toISOString(),
      });

      console.log(
        `[ViewerCountPoller] Recorded ${stream.viewer_count} viewers for ${broadcasterId} ` +
          `at offset ${Math.floor(offsetSeconds / 60)}m ${offsetSeconds % 60}s`,
      );

      // Video id first, so the clip pull in this same tick can link its rows
      // to the archive. Best-effort like the clip pull: never costs the sample.
      try {
        await this.backfillVideoId(broadcasterId, generation, twitchApi);
      } catch (error) {
        reportError(error, "viewer-count-poller.video-id", { broadcasterId, streamId });
      }

      // Clip pull is best-effort and must never cost the viewer sample above.
      try {
        await this.syncLiveClips(broadcasterId, generation, streamStartedAt, now, twitchApi);
      } catch (error) {
        reportError(error, "viewer-count-poller.clips", { broadcasterId, streamId });
      }
    } catch (error) {
      reportError(error, "viewer-count-poller.record", { broadcasterId, streamId });
    }
  }

  /**
   * Upsert the clips created since the previous pull. Writes straight to
   * `clips`; `twitch_clip_syncs` is left alone on purpose, since every status
   * flip there posts a clips.sync_* event to the Discord log channel.
   *
   * Helix returns clips by view count, not by age, so asking for the whole
   * stream every tick would let the page cap drop exactly the newest clips.
   * The window therefore starts at the previous pull minus an overlap, and
   * only moves forward once every page of a pull has landed.
   */
  private async syncLiveClips(
    broadcasterId: string,
    generation: number,
    streamStartedAt: Date,
    now: Date,
    twitchApi: TwitchApi,
  ): Promise<void> {
    const state = this.current(broadcasterId, generation);
    if (!state) return;
    const { streamId } = state;

    const { data: integration, error: integrationError } = await getTwitchIntegrationByBroadcasterId(
      supabase,
      broadcasterId,
    );
    if (integrationError) {
      reportError(integrationError, "viewer-count-poller.integration", { broadcasterId, streamId });
      return;
    }
    if (!integration) return;

    // Same opt-out as the sync on stream.offline.
    const preferences = await getUserPreferencesByUserId(supabase, integration.user_id);
    if (!preferences?.sync_clips_on_end) return;

    const windowStart = clipWindowStart(streamStartedAt, state.lastClipPullAt);

    let cursor: string | undefined;
    let total = 0;
    let page = 0;

    for (; page < MAX_CLIP_PAGES_PER_TICK; page++) {
      const res = await twitchApi.clips.getClips({
        broadcaster_id: broadcasterId,
        started_at: windowStart.toISOString(),
        ended_at: now.toISOString(),
        first: 100,
        after: cursor,
      });

      if (!res.data.length) break;

      const rows = await formatClipsForDB(res.data, integration.user_id);
      if (!this.current(broadcasterId, generation)) return;

      await upsertClips(supabase, rows);
      total += res.data.length;

      cursor = res.pagination?.cursor;
      if (!cursor) break;
    }

    if (page === MAX_CLIP_PAGES_PER_TICK && cursor) {
      console.warn(
        `[ViewerCountPoller] Clip page cap hit for ${broadcasterId}, stream ${streamId}: ` +
          `${total} clips in window, rest left to the sync on stream.offline`,
      );
    }

    if (!this.current(broadcasterId, generation)) return;
    state.lastClipPullAt = now;

    if (total > 0) {
      console.log(`[ViewerCountPoller] Upserted ${total} live clips for ${broadcasterId}, stream ${streamId}`);
    }
  }

  /**
   * Attach the Twitch archive video to a stream row created without one.
   * Runs at most MAX_VIDEO_ID_LOOKUPS Helix lookups per start; a stream with
   * VODs off stops costing anything after that.
   */
  private async backfillVideoId(broadcasterId: string, generation: number, twitchApi: TwitchApi): Promise<void> {
    const state = this.current(broadcasterId, generation);
    if (!state || typeof state.videoId === "string" || state.videoLookupsLeft <= 0) return;
    const { streamId } = state;

    // After a restart the poller doesn't know whether the row already has one.
    if (state.videoId === undefined) {
      const known = await getVodVideoIdByStreamId(supabase, streamId);
      if (!this.current(broadcasterId, generation)) return;
      state.videoId = known;
      if (known) return;
    }

    state.videoLookupsLeft--;
    const attempt = MAX_VIDEO_ID_LOOKUPS - state.videoLookupsLeft;

    const videoId = await findVideoIdForStream(twitchApi, broadcasterId, streamId);
    if (!this.current(broadcasterId, generation)) return;

    if (!videoId) {
      console.log(
        `[ViewerCountPoller] No archive video yet for ${broadcasterId}, stream ${streamId} ` +
          `(lookup ${attempt}/${MAX_VIDEO_ID_LOOKUPS})`,
      );
      return;
    }

    await setVodVideoId(supabase, streamId, videoId);
    if (!this.current(broadcasterId, generation)) return;
    state.videoId = videoId;
    console.log(`[ViewerCountPoller] Attached video ${videoId} to stream ${streamId} for ${broadcasterId}`);
  }

  /** The poller state for this broadcaster, if the given generation still owns it. */
  private current(broadcasterId: string, generation: number): PollerState | undefined {
    const state = this.activePollers.get(broadcasterId);
    return state?.generation === generation ? state : undefined;
  }
}

/**
 * Start of the clip window for a pull: the previous pull minus the overlap,
 * but never before the stream started.
 */
export function clipWindowStart(streamStartedAt: Date, lastClipPullAt: Date | null): Date {
  if (!lastClipPullAt) return streamStartedAt;
  const overlapped = new Date(lastClipPullAt.getTime() - CLIP_WINDOW_OVERLAP_MS);
  return overlapped > streamStartedAt ? overlapped : streamStartedAt;
}

// Export singleton instance
export const viewerCountPoller = new ViewerCountPoller();
