import { TwitchApi } from "@repo/twitch-api";
import { TtlCache } from "@repo/ttl-cache";
import axios, { type AxiosError } from "axios";

// Deliberately not "use server": every export of a "use server" file is a
// server action anyone can POST to, and this one takes any clip and
// broadcaster id and spends the shared app token on it. Its only caller is
// getNextOverlayClip, which authorises the overlay first.

/**
 * Twitch said the clip has no download (deleted, never downloadable, or a
 * channel we may not mint for). Retrying won't change that, so the caller can
 * remember the clip as dead. Anything else (a 429, a Twitch 5xx, a network
 * error) is thrown as a plain Error and should not.
 */
export class ClipUnavailableError extends Error {}

/** Statuses that say "this clip", not "right now". */
const UNAVAILABLE_STATUSES = new Set([400, 401, 403, 404]);

/**
 * The signed URL is good for hours, and a rotation plays the same clips over
 * and over, so each clip costs one Helix call per hour instead of one per
 * showing. Kept well under Twitch's expiry so a URL handed out near the end of
 * its hour still plays to the end.
 */
const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;
const downloadUrls = new TtlCache<string>({ ttlMs: DOWNLOAD_URL_TTL_MS, maxEntries: 5000 });

/**
 * Twitch's signed landscape MP4 URL. OBS plays it straight from Twitch's CDN;
 * no clip bytes pass through this server. Mirrors dashboard
 * `GetClipDownloadURL` in `apps/web-streamwizard/src/actions/twitch/clips.ts`:
 * `new TwitchApi(broadcasterId)` then `api.clips.getClipDownloadUrl(...)`.
 */
export async function getClipDownloadUrl(
  clipId: string,
  broadcasterId: string
): Promise<string> {
  const url = await downloadUrls.fetch(clipId, () => fetchClipDownloadUrl(clipId, broadcasterId));
  // fetch() only caches what the loader returns, and the loader never returns null.
  return url!;
}

async function fetchClipDownloadUrl(clipId: string, broadcasterId: string): Promise<string> {
  try {
    const api = new TwitchApi(broadcasterId);
    const result = await api.clips.getClipDownloadUrl({
      broadcaster_id: broadcasterId,
      editor_id: broadcasterId,
      clip_id: clipId,
    });

    const downloadUrl = result.data?.[0]?.landscape_download_url;
    if (!downloadUrl) {
      throw new ClipUnavailableError(`No landscape_download_url returned for clip ${clipId}`);
    }
    return downloadUrl;
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) throw err;
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;
    const body =
      typeof axiosErr.response?.data === "string"
        ? axiosErr.response.data
        : JSON.stringify(axiosErr.response?.data ?? {});
    const message = `Twitch API error ${status ?? "unknown"}: ${body}`;
    throw status !== undefined && UNAVAILABLE_STATUSES.has(status)
      ? new ClipUnavailableError(message)
      : new Error(message);
  }
}
