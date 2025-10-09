"use server";
import { TwitchAPI } from "@/lib/axios/twitch-api";
import { createClient } from "@/lib/supabase/server";
import { syncTwitchClips } from "@/server/twitch/clips";
import { revalidatePath } from "next/cache";

interface returnObject <T = any> {
  message: string;
  success: boolean;
  data?: T;
}

export async function SyncBroadcasterClips(): Promise<returnObject> {
  const supabase = await createClient();

  // Fetch the last sync timestamp
  const { data: syncData, error } = await supabase
    .from("twitch_clip_syncs")
    .select("last_sync")
    .order("last_sync", { ascending: false })
    .limit(1)
    .single();

  // throw a new error when there is an error fetching the last sync
  if (error) {
    if (error.code !== "PGRST116") {
      throw new Error("Error fetching last sync data");
    }
  }

  // Get current time
  const currentTime = new Date();

  // if we have a last sync timestamp
  if (syncData?.last_sync) {
    const lastSync = new Date(syncData.last_sync);
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

    // Check if lastSync is older than one hour ago if so return a message to the user
    if (lastSync > oneHourAgo) {
      const timeRemaining = 60 - Math.floor((currentTime.getTime() - lastSync.getTime()) / (60 * 1000));
      return {
        message: `Last sync was ${timeRemaining} minutes ago`,
        success: false,
      };
    }
  }

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error("Error fetching user data");
  }

  // Update last sync time
  const { error: updateError } = await supabase.from("twitch_clip_syncs").upsert(
    {
      last_sync: currentTime.toISOString(),
      user_id: userData.user.id,
      sync_status: "syncing",
      clip_count: 0,
    },
    {
      onConflict: "user_id", // Specify the column to use for conflict resolution
    }
  );

  // throw a new error when there is an error updating the last sync
  if (updateError) {
    console.error("Error updating last sync:", updateError);
    throw new Error("Error updating sync status");
  }

  // Sync clips
  try {
    const totalClips = await syncTwitchClips(userData.user.id);

    // Update sync status to success and clip count
    const { error: updateError } = await supabase
      .from("twitch_clip_syncs")
      .update({
        clip_count: totalClips,
        sync_status: "success",
      })
      .eq("user_id", userData.user.id);

    if (updateError) {
      throw new Error("Error updating sync status");
    }
    revalidatePath("/dashboard/clips", "page");

    return {
      message: `Success syncing ${totalClips} clips. Next sync available in 60 minutes.`,
      success: true,
    };
  } catch (error) {
    // Update sync status to failed
    const { error: updateError } = await supabase.from("twitch_clip_syncs").update({ sync_status: "failed" }).eq("user_id", userData.user.id);

    if (updateError) {
      throw new Error("Error updating sync status");
    }

    throw error;
  }
}

interface clipDownloadURL {
  data: {
    clip_id: string;
    landscape_download_url: string | null;
    portrait_download_url: string | null;
  }[]
}


export async function GetClipDownloadURL(clipId: string, user_id: string): Promise<returnObject<clipDownloadURL>> {
  console.log("Getting clip download URL for clipId:", clipId, "and user_id:", user_id);
  const supabase = await createClient();
  const { data: user, error: userError } = await supabase.from("integrations_twitch").select("twitch_user_id").eq("user_id", user_id).single();
  if (userError || !user.twitch_user_id) {
    throw new Error("Error fetching user");
  }

  console.log("User:", user);
  try {
    const res = await TwitchAPI.get<clipDownloadURL>(`/clips/downloads`, {
      params: {
        editor_id: user.twitch_user_id,
        broadcaster_id: user.twitch_user_id,
        clip_id: clipId,
      },
      broadcasterID: user.twitch_user_id,
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
    return {
      message: "Error downloading clip",
      success: false,
    };
  }
}
