"use server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import axios from "axios";

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

export async function GetClipDownloadURL(clipId: string, user_id: string, broadcaster_id: string): Promise<returnObject<clipDownloadURL>> {
  const { data: user, error: userError } = await supabaseAdmin.from("twitch_app_token").select("access_token").single();
  if (userError || !user?.access_token) {
    throw new Error("Error fetching user");
  }

  try {
    const res = await axios.get<clipDownloadURL>(`https://api.twitch.tv/helix/clips/downloads`, {
      headers: {
        "Client-ID": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`,
      },
      params: {
        broadcaster_id: broadcaster_id,
        editor_id: broadcaster_id,
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
    console.error(error instanceof Error ? error.message : "Unknown error");
    return {
      message: "Error downloading clip",
      success: false,
    };
  }
}
