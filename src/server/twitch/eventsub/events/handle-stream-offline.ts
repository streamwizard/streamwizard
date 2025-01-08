import { StreamOfflineObject } from "@/types/twitch-eventsub";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncTwitchClips } from "../../clips";
import { env } from "@/lib/env";

export default async function handleStreamOffline(event: StreamOfflineObject) {
  // get the user_ID based of the broadcaster_user_id

  const { data: user, error: userError } = await supabaseAdmin
    .from("integrations_twitch")
    .select("user_id")
    .eq("twitch_user_id", event.broadcaster_user_id)
    .single();

  if (userError || !user) throw new Error("User not found");

  const { user_id } = user;

  // check the user preferences if they want to sync twitch clips when the stream goes offline
  const { data: preferences, error: preferencesError } = await supabaseAdmin
    .from("user_preferences")
    .select("sync_clips_on_end")
    .eq("user_id", user_id)
    .single();

  if (preferencesError || !preferences) return;

  if (preferences.sync_clips_on_end) {
    // check if the last sync was more than an hour ago
    const { data: syncData, error } = await supabaseAdmin
      .from("twitch_clip_syncs")
      .select("last_sync")
      .order("last_sync", { ascending: false })
      .limit(1)
      .single();

    if (error) return;

    // Get current time
    const currentTime = new Date();

    // if we have a last sync timestamp
    // if (syncData?.last_sync) {
    //   const lastSync = new Date(syncData.last_sync);
    //   const thirtyMinutesAgo = new Date(currentTime.getTime() - 30 * 60 * 1000);

    //   // Check if lastSync is older than one hour ago if so return a message to the user
    //   if (lastSync > thirtyMinutesAgo) {
    //     console.log("Last sync was less than 30 minutes ago");
    //     return {
    //       success: false,
    //       message: "Last sync was less than 30 minutes ago",
    //     };
    //   }
    // }

    // Update last sync time
    const { error: updateError } = await supabaseAdmin.from("twitch_clip_syncs").upsert(
      {
        last_sync: currentTime.toISOString(),
        user_id: user_id,
        sync_status: "syncing",
        clip_count: 0,
      },
      {
        onConflict: "user_id", // Specify the column to use for conflict resolution
      }
    );

    // throw a new error when there is an error updating the last sync
    if (updateError) return;

    try {
      const totalClips = await syncTwitchClips(user_id);

      // Update sync status to success and clip count
      const { error: updateError } = await supabaseAdmin
        .from("twitch_clip_syncs")
        .update({
          clip_count: totalClips,
          sync_status: "success",
        })
        .eq("user_id", user_id);

      if (updateError) {
        throw new Error("Error updating sync status");
      }

      if (env.NODE_ENV === "development") {
        console.log(`Synced ${totalClips} clips for user ${user_id}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      // Update sync status to failed
      const { error: updateError } = await supabaseAdmin.from("twitch_clip_syncs").update({ sync_status: "failed" }).eq("user_id", user_id);

      if (updateError) {
        throw new Error("Error updating sync status");
      }

      throw error;
    }
  }
}
