"use server";
import { createClient } from "@repo/supabase/next/server";
import { getClipBroadcasterId } from "@repo/supabase/queries/clips";
import { getBroadcasterId } from "@repo/supabase/queries/user";
import { TwitchApi } from "@repo/twitch-api";
import axios from "axios";
import { revalidatePath } from "next/cache";

interface returnObject<T = unknown> {
  message: string;
  success: boolean;
  data?: T;
}

export async function SyncBroadcasterClips(): Promise<{ message: string; success: boolean }> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    await axios.post(`https://api.streamwizard.org/api/clips/sync`, null, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    revalidatePath("/dashboard/clips", "page");
    return {
      message: "Clips synced successfully",
      success: true,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError<{ skipped: boolean; message: string; success: boolean }>(error)) {
      const skipped = error.response?.data?.skipped;
      if (skipped) {
        return {
          message: error.response?.data?.message || "Error syncing clips",
          success: false,
        };
      }
    }
    return {
      message: "Error syncing clips",
      success: false,
    };
  }
}

interface ClipDownloadURLData {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[];
}

export async function GetClipDownloadURL(clipId: string, user_id: string): Promise<returnObject<ClipDownloadURLData>> {
  const supabase = await createClient();

  try {
    const broadcasterId = await getClipBroadcasterId(supabase, clipId, user_id);

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
      console.error("GetClipDownloadURL axios error:", error.response?.status, error.response?.data);
      return {
        message: `Twitch API error: ${error.response?.status ?? "unknown"}`,
        success: false,
      };
    }

    console.error(error instanceof Error ? error.message : "Unknown error");
    return {
      message: "Error downloading clip",
      success: false,
    };
  }
}
