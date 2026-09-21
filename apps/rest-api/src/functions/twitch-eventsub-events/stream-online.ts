import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { setVodVideoId, upsertVod } from "@repo/supabase/queries/vods";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { TwitchApi } from "@repo/twitch-api";
import type { StreamOnlineEvent } from "@repo/schemas";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";
import { notifyStreamStatus } from "../../lib/ws-server";
import { setStreamUserState } from "../../lib/user-state";
import { logStreamOnlineFailed } from "../../lib/platform-events";
import { findVideoIdForStream } from "../../lib/stream-video";
import { postGoLive } from "../../lib/discord-live";
import { grantLiveRole } from "../../lib/discord-live-role";
import { resolveLiveTarget } from "../../lib/discord-live-target";
import { wentOfflineSince } from "../../lib/stream-offline-marker";

/**
 * Waits between Helix lookups. EventSub can fire before /streams lists the
 * stream, so one empty answer doesn't mean it's gone. About two minutes total;
 * the handler runs detached, so the webhook reply doesn't wait on this.
 */
export const STREAM_LOOKUP_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The live stream matching this stream.online event, retrying while Helix
 * returns nothing or a different stream. Stops early once stream.offline
 * arrives for the broadcaster.
 */
async function waitForStream(TwitchAPI: TwitchApi, event: StreamOnlineEvent, since: number, delays: number[]) {
  for (let attempt = 0; ; attempt++) {
    const stream = await TwitchAPI.streams.getStream({ type: "live" });
    if (stream?.id === event.id) return stream;
    if (attempt >= delays.length || wentOfflineSince(event.broadcaster_user_id, since)) return undefined;
    await sleep(delays[attempt]!);
  }
}

export const handleStreamOnline = async (
  event: StreamOnlineEvent,
  TwitchAPI: TwitchApi,
  delays: number[] = STREAM_LOOKUP_DELAYS_MS,
) => {
  //   check if the stream is of type "live"
  if (event.type !== "live") return;

  const startedAt = Date.now();
  const stream = await waitForStream(TwitchAPI, event, startedAt, delays);
  const waitedSeconds = Math.round((Date.now() - startedAt) / 1000);

  // Bailing out abandons the whole stream.online pipeline — no stream row, no
  // live status, no user_state, no viewer polling — while returning normally.
  // An offline that landed while we waited means the stream ended straight
  // away (a quick restart): expected, so no Sentry. Checked even when Helix
  // did return the stream, so a late answer can't mark the channel live again
  // after offline already cleared it.
  if (wentOfflineSince(event.broadcaster_user_id, startedAt)) {
    await logStreamOnlineFailed(event.broadcaster_user_id, "ended_before_tracked", event.id, waitedSeconds);
    return;
  }

  // Twitch still doesn't list a stream it told us is live. Sentry gets the
  // error and the Discord log channel gets stream.online_failed so staff can
  // see it without digging.
  if (!stream) {
    reportError(new Error("stream.online: stream not found"), "eventsub.stream-online", {
      broadcasterUserId: event.broadcaster_user_id,
      streamId: event.id,
      waitedSeconds,
    });
    await logStreamOnlineFailed(event.broadcaster_user_id, "stream_not_found", event.id, waitedSeconds);
    return;
  }

  // The archive video is optional. VODs may be off for this channel, or Helix
  // may not list the archive for a few minutes yet. Either way the stream is
  // tracked; the viewer poller and stream.offline keep trying to fill it in.
  const videoId = await findVideoIdForStream(TwitchAPI, stream.user_id, stream.id);

  // vods is the per-stream row every other table hangs off, so it goes first.
  await upsertVod(supabase, {
    broadcaster_id: stream.user_id,
    stream_id: stream.id,
    started_at: stream.started_at,
  });

  if (videoId) {
    await setVodVideoId(supabase, stream.id, videoId);
  } else {
    console.log(`[stream.online] No archive video yet for stream ${stream.id} (${stream.user_id}), will backfill`);
  }

  // update the database with the stream online event
  await upsertBroadcasterLiveStatus(supabase, {
    broadcaster_id: stream.user_id,
    broadcaster_name: stream.user_name,
    is_live: true,
    stream_started_at: stream.started_at,
    title: stream.title,
    stream_id: stream.id,
    category_id: stream.game_id,
    category_name: stream.game_name,
  });

  // Stamp any already-connected GPS overlay room with the new stream_id.
  // Must run after upsertVod — irl_geo_track.stream_id is an FK onto vods.
  await notifyStreamStatus(stream.user_id, stream.id);

  // Durable copy for overlays that were NOT connected when this fired.
  await setStreamUserState(stream.user_id, { id: stream.id, startedAt: stream.started_at });

  await streamEventsLogger.logTwitchEvent({
    broadcaster_id: stream.user_id,
    event_type: "stream.online",
    event_data: event,
    metadata: null,
  });

  // Start polling viewer counts for this stream
  viewerCountPoller.startPolling(stream.user_id, stream.id, videoId);

  // Go-live post and live role in the StreamWizard Discord. One lookup of the
  // guild settings and the linked account feeds both. None of it throws and
  // nothing here waits on Discord, so a slow or failing API can't hold up
  // the pipeline.
  void resolveLiveTarget(stream.user_id).then((target) =>
    Promise.all([postGoLive(stream, target), grantLiveRole(stream, target)]),
  );
};
