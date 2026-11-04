import "server-only";
import { TwitchApi } from "@repo/twitch-api";
import { createClient } from "@repo/supabase/next/server";
import { getClipBroadcasterId } from "@repo/supabase/queries/clips/clips";
import axios from "axios";
import { reportError } from "@repo/sentry";

/**
 * Signed MP4 URLs for one clip, for the route handlers that serve clip
 * previews and downloads. Not a server action: callers pass the id of the
 * user they already authenticated, and the clip is looked up among that
 * user's clips first.
 */

interface returnObject<T = unknown> {
  message: string;
  success: boolean;
  data?: T;
}

interface ClipDownloadURLData {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[];
}

export async function getClipDownloadUrl(clipId: string, userId: string): Promise<returnObject<ClipDownloadURLData>> {
  const supabase = await createClient();

  try {
    const broadcasterId = await getClipBroadcasterId(supabase, clipId, userId);

    if (!broadcasterId) {
      return {
        message: `Clip not found for clipId=${clipId}`,
        success: false,
      };
    }

    const api = new TwitchApi(broadcasterId);
    const result = await api.clips.getClipDownloadUrl({
      broadcaster_id: broadcasterId,
      editor_id: broadcasterId,
      clip_id: clipId,
    });

    return {
      message: "Clip downloaded successfully",
      success: true,
      data: result as ClipDownloadURLData,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      reportError(error, "twitch.clipDownloadUrl");
      return {
        message: `Twitch API error: ${error.response?.status ?? "unknown"}`,
        success: false,
      };
    }

    reportError(error, "twitch.clipDownloadUrl");
    return {
      message: "Error downloading clip",
      success: false,
    };
  }
}
