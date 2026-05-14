import { supabase } from "@repo/supabase";
import { insertVod } from "@repo/supabase/queries/vods";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { TwitchApi } from "@repo/twitch-api";
import type { StreamOnlineEvent } from "@repo/schemas";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";

export const handleStreamOnline = async (event: StreamOnlineEvent, TwitchAPI: TwitchApi) => {
  //   check if the stream is of type "live"
  if (event.type !== "live") return;

  // get the stream data from the twitch api
  const stream = await TwitchAPI.streams.getStream({ type: "live" });
  const video = await TwitchAPI.videos.getVodByBroadcasterId(event.broadcaster_user_id);

  if (!stream) {
    console.error("Stream not found", { event });
    return;
  }

  const video_id = video.data.find((v) => v.stream_id === stream.id)?.id;

  if (!video_id) {
    console.error("Video not found", { event });
    return;
  }

  await insertVod(supabase, {
    broadcaster_id: stream.user_id,
    video_id: video_id,
    stream_id: stream.id,
    started_at: stream.started_at,
  });

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

  await streamEventsLogger.logTwitchEvent({
    broadcaster_id: stream.user_id,
    event_type: "stream.online",
    event_data: event,
    metadata: null,
  });

  // Start polling viewer counts for this stream
  viewerCountPoller.startPolling(stream.user_id, stream.id);
};
