import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { getCurrentStreamDetails, getVodVideoIdByStreamId, setVodVideoId } from "@repo/supabase/queries/vods";
import { getTwitchIntegrationByBroadcasterId, getUserPreferencesByUserId } from "@repo/supabase/queries/user";
import type { TwitchApi } from "@repo/twitch-api";
import type { StreamOfflineEvent } from "@repo/schemas";
import { syncTwitch } from "../sync-twitch";
import { streamEventsLogger } from "@repo/logger";
import { viewerCountPoller } from "../../services/viewer-count-poller";
import { notifyStreamStatus } from "../../lib/ws-server";
import { setStreamUserState } from "../../lib/user-state";
import { findVideoIdForStream } from "../../lib/stream-video";
import { markStreamOffline } from "../../lib/stream-offline-marker";
import { endGoLive } from "../../lib/discord-live";
import { revokeLiveRole } from "../../lib/discord-live-role";

export const handleStreamOffline = async (event: StreamOfflineEvent, TwitchAPI: TwitchApi) => {
  // First, so a stream.online still waiting on Helix sees it and backs off.
  markStreamOffline(event.broadcaster_user_id);

  // Stop polling viewer counts for this broadcaster
  viewerCountPoller.stopPolling(event.broadcaster_user_id);

  // The event carries no stream id; read it while the live row still says live.
  const streamId = await getCurrentStreamDetails(supabase, event.broadcaster_user_id);

  // Flip the go-live post in Discord to "ended" and take the live role away.
  // Both key on this broadcaster's rows, never throw, and nothing below
  // waits on them.
  void endGoLive(event.broadcaster_user_id);
  void revokeLiveRole(event.broadcaster_user_id);

  // Log the offline event while broadcaster_live_status still says live: the
  // logger stamps the row with the live stream_id and offset, and refuses
  // once is_live is false. Logging must never block the clip sync below —
  // rest-api may have missed stream.online (deploy, revoked sub), in which
  // case there is no live row to stamp against.
  try {
    await streamEventsLogger.logTwitchEvent({
      broadcaster_id: event.broadcaster_user_id,
      event_type: "stream.offline",
      event_data: event,
      metadata: null,
    });
  } catch (error) {
    reportError(error, "eventsub.stream-offline.log-event", { broadcasterUserId: event.broadcaster_user_id });
  }

  // update the database with the stream offline event
  await upsertBroadcasterLiveStatus(supabase, {
    broadcaster_id: event.broadcaster_user_id,
    is_live: false,
    broadcaster_name: event.broadcaster_user_name,
  });

  // Clear stream_id on a still-connected GPS overlay room so fixes logged
  // after the stream ends aren't attributed to it.
  await notifyStreamStatus(event.broadcaster_user_id, null);
  await setStreamUserState(event.broadcaster_user_id, null);

  // Last chance to attach the archive video to the stream row. The poller
  // gives up after a while; this runs before the clip sync below so clips
  // link to the video when it exists. Best-effort: the stream is tracked
  // either way.
  if (streamId) {
    try {
      if (!(await getVodVideoIdByStreamId(supabase, streamId))) {
        const videoId = await findVideoIdForStream(TwitchAPI, event.broadcaster_user_id, streamId);
        if (videoId) {
          await setVodVideoId(supabase, streamId, videoId);
        } else {
          console.warn(`[stream.offline] Stream ${streamId} (${event.broadcaster_user_id}) ended without an archive video (VODs off?)`);
        }
      }
    } catch (error) {
      reportError(error, "eventsub.stream-offline.video-id", { broadcasterUserId: event.broadcaster_user_id, streamId });
    }
  }

  const { data: user, error: userError } = await getTwitchIntegrationByBroadcasterId(supabase, event.broadcaster_user_id);

  if (userError || !user) throw new Error("User not found");

  // check the user preferences if they want to sync twitch clips when the stream goes offline
  const preferences = await getUserPreferencesByUserId(supabase, user.user_id);

  if (!preferences) throw new Error("Preferences not found");

  if (!preferences.sync_clips_on_end) return;

  // Use the reusable syncTwitch function
  await syncTwitch(event.broadcaster_user_id, TwitchAPI);
};
