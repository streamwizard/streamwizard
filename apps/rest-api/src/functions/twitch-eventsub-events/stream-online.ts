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

export const handleStreamOnline = async (event: StreamOnlineEvent, TwitchAPI: TwitchApi) => {
  //   check if the stream is of type "live"
  if (event.type !== "live") return;

  // get the stream data from the twitch api
  const stream = await TwitchAPI.streams.getStream({ type: "live" });

  // Bailing out abandons the whole stream.online pipeline — no stream row, no
  // live status, no user_state, no viewer polling — while returning normally.
  // Sentry gets the error and the Discord log channel gets stream.online_failed
  // so staff can see it without digging.
  if (!stream) {
    reportError(new Error("stream.online: stream not found"), "eventsub.stream-online", {
      broadcasterUserId: event.broadcaster_user_id,
    });
    await logStreamOnlineFailed(event.broadcaster_user_id, "stream_not_found", null);
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
};
