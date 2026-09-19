import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { upsertClips } from "@repo/supabase/queries/clips";
import { getTwitchIntegrationByBroadcasterId, getUserPreferencesByUserId } from "@repo/supabase/queries/user";
import { insertViewerCount } from "@repo/supabase/queries/viewer-counts";
import { TwitchApi } from "@repo/twitch-api";
import { formatClipsForDB } from "../functions/sync-twitch";

/**
 * Polling interval in milliseconds (5 minutes)
 */
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Pages of 100 clips fetched per tick. Only clips created since the stream
 * started are requested, so one page is the normal case; the cap keeps a
 * runaway stream from turning a tick into a full sync.
 */
const MAX_CLIP_PAGES_PER_TICK = 5;

/**
 * ViewerCountPoller manages periodic polling of viewer counts for active streams.
 * It starts polling when a stream goes online and stops when it goes offline.
 *
 * Each tick also pulls the clips made since the stream started and upserts
 * them, so the dashboard and clip widgets see new clips while live. There is no
 * EventSub for clip creation. The full sync on stream.offline stays the
 * reconciliation pass: view counts and vod_offset lag on Twitch for minutes
 * after a clip is made.
 */
class ViewerCountPoller {
  private activePollers = new Map<string, NodeJS.Timeout>();

  /**
   * Start polling viewer counts for a broadcaster's stream
   * @param broadcasterId - The broadcaster's Twitch user ID
   * @param streamId - The current stream ID
   */
  startPolling(broadcasterId: string, streamId: string): void {
    // Don't start if already polling
    if (this.activePollers.has(broadcasterId)) {
      console.log(`[ViewerCountPoller] Already polling for broadcaster ${broadcasterId}`);
      return;
    }

    console.log(
      `[ViewerCountPoller] Starting polling for broadcaster ${broadcasterId}, stream ${streamId}`,
    );

    // Record initial viewer count immediately
    this.recordViewerCount(broadcasterId, streamId).catch((error) =>
      reportError(error, "viewer-count-poller.start", { broadcasterId, streamId }),
    );

    // Set up interval for periodic polling
    const intervalId = setInterval(() => {
      this.recordViewerCount(broadcasterId, streamId).catch((error) =>
        reportError(error, "viewer-count-poller.tick", { broadcasterId, streamId }),
      );
    }, POLLING_INTERVAL_MS);

    this.activePollers.set(broadcasterId, intervalId);
  }

  /**
   * Stop polling for a broadcaster
   * @param broadcasterId - The broadcaster's Twitch user ID
   */
  stopPolling(broadcasterId: string): void {
    const intervalId = this.activePollers.get(broadcasterId);

    if (intervalId) {
      console.log(`[ViewerCountPoller] Stopping polling for broadcaster ${broadcasterId}`);
      clearInterval(intervalId);
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
   * Fetch current stream data and record viewer count to database
   */
  private async recordViewerCount(broadcasterId: string, streamId: string): Promise<void> {
    try {
      const twitchApi = new TwitchApi(broadcasterId);
      const stream = await twitchApi.streams.getStream({ type: "live" });

      if (!stream) {
        console.log(`[ViewerCountPoller] Stream not found for ${broadcasterId}, stopping polling`);
        this.stopPolling(broadcasterId);
        return;
      }

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

      // Clip pull is best-effort and must never cost the viewer sample above.
      try {
        await this.syncLiveClips(broadcasterId, streamId, stream.started_at, twitchApi);
      } catch (error) {
        reportError(error, "viewer-count-poller.clips", { broadcasterId, streamId });
      }
    } catch (error) {
      reportError(error, "viewer-count-poller.record", { broadcasterId, streamId });
    }
  }

  /**
   * Upsert the clips created since the stream started. Writes straight to
   * `clips`; `twitch_clip_syncs` is left alone on purpose, since every status
   * flip there posts a clips.sync_* event to the Discord log channel.
   */
  private async syncLiveClips(
    broadcasterId: string,
    streamId: string,
    streamStartedAt: string,
    twitchApi: TwitchApi,
  ): Promise<void> {
    const { data: integration } = await getTwitchIntegrationByBroadcasterId(supabase, broadcasterId);
    if (!integration) return;

    // Same opt-out as the sync on stream.offline.
    const preferences = await getUserPreferencesByUserId(supabase, integration.user_id);
    if (!preferences?.sync_clips_on_end) return;

    let cursor: string | undefined;
    let total = 0;

    for (let page = 0; page < MAX_CLIP_PAGES_PER_TICK; page++) {
      const res = await twitchApi.clips.getClips({
        broadcaster_id: broadcasterId,
        started_at: streamStartedAt,
        first: 100,
        after: cursor,
      });

      if (!res.data.length) break;

      await upsertClips(supabase, await formatClipsForDB(res.data, integration.user_id));
      total += res.data.length;

      cursor = res.pagination?.cursor;
      if (!cursor) break;
    }

    if (total > 0) {
      console.log(`[ViewerCountPoller] Upserted ${total} live clips for ${broadcasterId}, stream ${streamId}`);
    }
  }
}

// Export singleton instance
export const viewerCountPoller = new ViewerCountPoller();
