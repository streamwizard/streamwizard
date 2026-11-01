import { reportError } from "@repo/sentry";
import type { TwitchApi } from "@repo/twitch-api";

/**
 * The Twitch archive video for a live or finished stream, if Twitch has one.
 *
 * Returns null when the broadcaster has VODs turned off, or when Helix hasn't
 * listed the archive yet (it can take a few minutes after go-live). Callers
 * treat the lookup as best-effort, so a Helix error is reported and read as
 * "not yet" rather than thrown.
 */
export async function findVideoIdForStream(
  twitchApi: TwitchApi,
  broadcasterId: string,
  streamId: string,
): Promise<string | null> {
  try {
    const { data } = await twitchApi.videos.getVods({
      user_id: broadcasterId,
      type: "archive",
      sort: "time",
      first: 5,
    });
    return data.find((video) => video.stream_id === streamId)?.id ?? null;
  } catch (error) {
    reportError(error, "stream-video.lookup", { broadcasterId, streamId });
    return null;
  }
}
