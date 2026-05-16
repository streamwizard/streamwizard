"use server";

import { TwitchApi } from "@repo/twitch-api";
import axios, { type AxiosError } from "axios";

/**
 * Signed landscape MP4 URL for OBS playback. Mirrors dashboard
 * `GetClipDownloadURL` in `apps/web-streamwizard/src/actions/twitch/clips.ts`:
 * `new TwitchApi(broadcasterId)` then `api.clips.getClipDownloadUrl(...)`.
 */
export async function getClipDownloadUrl(
  clipId: string,
  broadcasterId: string
): Promise<string> {
  try {
    const api = new TwitchApi(broadcasterId);
    const result = await api.clips.getClipDownloadUrl({
      broadcaster_id: broadcasterId,
      editor_id: broadcasterId,
      clip_id: clipId,
    });

    const downloadUrl = result.data?.[0]?.landscape_download_url;
    if (!downloadUrl) {
      throw new Error(`No landscape_download_url returned for clip ${clipId}`);
    }
    return downloadUrl;
  } catch (err: unknown) {
    if (!axios.isAxiosError(err)) throw err;
    const axiosErr = err as AxiosError;
    const body =
      typeof axiosErr.response?.data === "string"
        ? axiosErr.response.data
        : JSON.stringify(axiosErr.response?.data ?? {});
    throw new Error(
      `Twitch API error ${axiosErr.response?.status ?? "unknown"}: ${body}`
    );
  }
}
