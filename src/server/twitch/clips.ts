import { TwitchAPI } from "@/lib/axios/twitch-api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TwitchClip, TwitchClipResponse } from "@/types/twitch";

/**
 * Fetches all the clips from a user's Twitch channel and inserts them into the database.
 * @returns The number of clips inserted.
 * @throws If there is no Twitch integration for the user.
 * @throws If inserting the clips into the database fails.
 */
export async function syncTwitchClips(user_id: string) {
  let hasMoreClips = true;
  let cursor: string | undefined;
  let totalClips = 0;

  const { data: integration, error } = await supabaseAdmin
    .from("integrations_twitch")
    .select("access_token, twitch_user_id, user_id")
    .eq("user_id", user_id)
    .single();

  if (error || !integration || !integration.access_token || !integration.twitch_user_id) {
    console.error(error);
    throw new Error("Twitch integration not found for user");
  }

  // delete all clips from the database
  const { error: deleteError } = await supabaseAdmin.from("clips").delete().eq("user_id", user_id).eq("broadcaster_id", integration.twitch_user_id);

  if (deleteError) {
    throw new Error(`Failed to delete clips: ${deleteError.message}`);
  }

  // loop until there are no more clips
  while (hasMoreClips) {
    const clipsResponse = await fetchAndFormatTwitchClips(integration.access_token, integration.twitch_user_id, cursor);

    if (!clipsResponse) {
      break;
    }

    const { clips, pagination } = clipsResponse;

    if (!clips.length) {
      break;
    }
    // format the clips for the database

    const formattedClips = formatClipsForDB(clips, integration.user_id);

    // upsert the clips into the database
    const { error: upsertError } = await supabaseAdmin.from("clips").upsert(formattedClips, {
      onConflict: "twitch_clip_id",
      ignoreDuplicates: false,
    });

    // if there is an error, throw an error

    if (upsertError) {
      throw new Error(`Failed to insert clips: ${upsertError.message}`);
    }

    // increment the total number of clips
    totalClips += clips.length;
    cursor = pagination.cursor;
    hasMoreClips = !!cursor;
  }

  // return the total number of clips
  return totalClips;
}

export async function fetchAndFormatTwitchClips(accessToken: string, broadcasterId: string, cursor?: string) {
  // total number of clips to fetch
  const batchSize = 100;

  // fetch the clips
  const res = await TwitchAPI.get<TwitchClipResponse>("/clips", {
    params: {
      broadcaster_id: broadcasterId,
      first: batchSize,
      after: cursor,
    },

    broadcasterID: broadcasterId,
  });

  // return the clips and pagination
  return {
    clips: res.data.data,
    pagination: res.data.pagination,
  };
}

// format the clips for the database
export function formatClipsForDB(clips: TwitchClip[], userId: string) {
  return clips.map((clip) => ({
    twitch_clip_id: clip.id,
    url: clip.url,
    embed_url: clip.embed_url,
    broadcaster_id: clip.broadcaster_id,
    broadcaster_name: clip.broadcaster_name,
    creator_id: clip.creator_id,
    creator_name: clip.creator_name,
    video_id: clip.video_id || null,
    game_id: clip.game_id,
    language: clip.language,
    title: clip.title,
    view_count: clip.view_count,
    created_at_twitch: clip.created_at,
    thumbnail_url: clip.thumbnail_url,
    duration: clip.duration,
    vod_offset: clip.vod_offset,
    is_featured: clip.is_featured,
    user_id: userId,
  }));
}



