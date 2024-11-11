"use server";
import { createClient } from "@/lib/supabase/server";
import { syncTwitchClips } from "@/server/twitch/clips";
import { revalidatePath } from "next/cache";

export async function SyncBroadcasterClips() {
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
      throw new Error(`Sorry, you can sync again in ${timeRemaining} minutes.`);
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
    const totalClips = await syncTwitchClips();

    // Update sync status to success and clip count
    const { error: updateError } = await supabase
      .from("twitch_clip_syncs")
      .update({
        clip_count: totalClips,
        sync_status: "success",
      })
      .eq("user_id", userData.user.id);

    if (updateError) {
      console.error("Error updating sync status:", updateError);
      throw new Error("Error updating sync status");
    }
    revalidatePath("/dashboard/clips", "page");
    return `Success syncing ${totalClips} clips. Next sync available in 60 minutes.`;
  } catch (error) {
    // Update sync status to failed
    const { error: updateError } = await supabase.from("twitch_clip_syncs").update({ sync_status: "failed" }).eq("user_id", userData.user.id);

    if (updateError) {
      console.error("Error updating sync status:", updateError);
      throw new Error("Error updating sync status");
    }

    throw error;
  }
}
