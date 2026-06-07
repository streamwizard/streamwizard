"use server";

import { getAuthContext } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;

async function fetchAll<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return results;
}

export async function requestUserData() {
  let supabase: SupabaseClient, user: { id: string }, broadcasterId: string;
  try {
    ({ supabase, user, broadcasterId } = await getAuthContext());
  } catch {
    return { data: null, error: "Unauthorized" };
  }

  const userId = user.id;

  const [
    profileRes,
    preferences,
    twitchIntegration,
    overlayScenes,
    widgets,
    widgetLibrary,
    clips,
    clipFolders,
    clipFolderJunction,
    clipSyncs,
    commands,
    smpPlayers,
    vods,
    streamEvents,
    viewerCounts,
    irlGeoTrack,
    irlCollectorTokens,
    feedback,
    testimonials,
  ] = await Promise.all([
    supabase.from("users").select("name, email, avatar_url, created_at").eq("id", userId).single(),
    fetchAll((from, to) =>
      supabase.from("user_preferences").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("integrations_twitch")
        .select(
          "twitch_user_id, twitch_username, broadcaster_type, description, profile_image_url, email, created_at, updated_at",
        )
        .eq("user_id", userId)
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("overlay_scenes").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("widgets").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("widget_library_entries").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("clips").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("clip_folders").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("clip_folder_junction").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("twitch_clip_syncs").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("commands").select("*").eq("channel_id", broadcasterId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("smp_players").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("vods").select("*").eq("broadcaster_id", broadcasterId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("stream_events").select("*").eq("broadcaster_id", broadcasterId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("stream_viewer_counts")
        .select("*")
        .eq("broadcaster_id", broadcasterId)
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("irl_geo_track").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("irl_collector_tokens").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("feedback").select("*").eq("user_id", userId).range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("testimonials").select("*").eq("user_id", userId).range(from, to),
    ),
  ]);

  const export_data: Record<string, unknown> = {};

  if (profileRes.data) export_data.profile = profileRes.data;
  if (preferences.length) export_data.preferences = preferences;
  if (twitchIntegration.length) export_data.twitch_integration = twitchIntegration;
  if (overlayScenes.length) export_data.overlay_scenes = overlayScenes;
  if (widgets.length) export_data.widgets = widgets;
  if (widgetLibrary.length) export_data.widget_library = widgetLibrary;
  if (clips.length) export_data.clips = clips;
  if (clipFolders.length) export_data.clip_folders = clipFolders;
  if (clipFolderJunction.length) export_data.clip_folder_junction = clipFolderJunction;
  if (clipSyncs.length) export_data.twitch_clip_syncs = clipSyncs;
  if (commands.length) export_data.commands = commands;
  if (smpPlayers.length) export_data.smp_players = smpPlayers;
  if (vods.length) export_data.vods = vods;
  if (streamEvents.length) export_data.stream_events = streamEvents;
  if (viewerCounts.length) export_data.stream_viewer_counts = viewerCounts;
  if (irlGeoTrack.length) export_data.irl_geo_track = irlGeoTrack;
  if (irlCollectorTokens.length) export_data.irl_collector_tokens = irlCollectorTokens;
  if (feedback.length) export_data.feedback = feedback;
  if (testimonials.length) export_data.testimonials = testimonials;

  return { data: export_data, error: null };
}
