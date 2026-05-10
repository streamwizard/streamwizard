"use server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getTwitchAppToken } from "@/server/axios/twitch-app-token";
import axios from "axios";
import { revalidatePath } from "next/cache";

interface returnObject<T = unknown> {
  message: string;
  success: boolean;
  data?: T;
}

export async function SyncBroadcasterClips(): Promise<{ message: string; success: boolean }> {
  const supabase = await createClient();

  // get session token
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

interface clipDownloadURL {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[];
}

export async function GetClipDownloadURL(clipId: string, user_id: string): Promise<returnObject<clipDownloadURL>> {
  const supabase = await createClient();
  const appToken = await getTwitchAppToken();

  try {
    // Primary lookup: clip owned by current user
    const { data: ownedRows, error: ownedError } = await supabase
      .from("clips")
      .select("broadcaster_id")
      .eq("twitch_clip_id", clipId)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1);

    let broadcasterId = ownedRows?.[0]?.broadcaster_id ?? null;

    // Fallback for legacy data mismatches: use clip id only
    if (!broadcasterId) {
      const { data: anyRows, error: anyError } = await supabase
        .from("clips")
        .select("broadcaster_id")
        .eq("twitch_clip_id", clipId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (anyError) {
        return {
          message: `Clip lookup failed: ${anyError.message}`,
          success: false,
        };
      }

      broadcasterId = anyRows?.[0]?.broadcaster_id ?? null;
    }

    if (ownedError && !broadcasterId) {
      return {
        message: `Clip lookup failed: ${ownedError.message}`,
        success: false,
      };
    }

    if (!broadcasterId) {
      return {
        message: `Clip not found for clipId=${clipId}`,
        success: false,
      };
    }

    const res = await axios.get<clipDownloadURL>(`https://api.twitch.tv/helix/clips/downloads`, {
      headers: {
        "Client-ID": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        Authorization: `Bearer ${appToken}`,
      },
      params: {
        broadcaster_id: broadcasterId,
        editor_id: broadcasterId,
        clip_id: clipId,
      },
    });

    if (res.status !== 200) { 
      console.error(res.data);
      return {
        message: "Error downloading clip",
        success: false,
      };
    }


    return {
      message: "Clip downloaded successfully",
      success: true,
      data: res.data,
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
