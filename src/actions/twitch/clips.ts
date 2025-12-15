"use server";
import { TwitchAPI } from "@/lib/axios/twitch-api";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import axios from "axios";
import { revalidatePath } from "next/cache";

interface returnObject <T = any> {
  message: string;
  success: boolean;
  data?: T;
}

export async function SyncBroadcasterClips(): Promise<any> {
  const supabase = await createClient();

  
  
}

interface clipDownloadURL {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[]
}


export async function GetClipDownloadURL(clipId: string, user_id: string, broadcaster_id: string): Promise<returnObject<clipDownloadURL>> {
  const supabase = await createClient();
  const { data: user, error: userError } = await supabaseAdmin.from("twitch_app_token").select("access_token").single();
  if (userError || !user?.access_token) {
    throw new Error("Error fetching user");
  }

  try {
    const res = await axios.get<clipDownloadURL>(`https://api.twitch.tv/helix/clips/downloads`, {
      headers: {
        "Client-ID": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${env.TWITCH_APP_TOKEN}`,
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
