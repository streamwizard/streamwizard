import { reportError } from "@repo/sentry";
import { describeError } from "@repo/sentry/safe-error";
import { supabase, Database } from "@repo/supabase";
import { getTwitchIntegrationByBroadcasterId, getTwitchUserIdByUserId } from "@repo/supabase/queries/users/user";
import { claimClipSync, updateClipSyncStatus } from "@repo/supabase/queries/clips/sync";
import { upsertClips } from "@repo/supabase/queries/clips/clips";
import { getVodsByVideoIds } from "@repo/supabase/queries/stream/vods";
import type { TwitchApi } from "@repo/twitch-api";
import { createClipSyncStarter, type ClipSyncSkipped } from "./clip-sync-start";

/** One full sync per user per hour. Each one fans out over Helix /clips on the shared app token. */
const SYNC_COOLDOWN_MS = 60 * 60 * 1000;

type ClaimedClipSync = { claimed: true; userId: string };

/** Takes the user's sync slot (cooldown and "already running" checks included). */
async function claimTwitchSync(broadcaster_id: string): Promise<ClaimedClipSync | ClipSyncSkipped> {
  const { data: user, error: userError } = await getTwitchIntegrationByBroadcasterId(supabase, broadcaster_id);

  if (userError || !user) {
    throw new Error(`User not found for broadcaster_id: ${broadcaster_id}`);
  }

  const claim = await claimClipSync(supabase, user.user_id, new Date(), SYNC_COOLDOWN_MS);
  if (!claim.claimed) {
    return { skipped: true, running: claim.status === "syncing", lastSync: claim.lastSync };
  }
  return { claimed: true, userId: user.user_id };
}

/** Runs a sync that has been claimed, and records how it ended on the sync row. */
async function runClaimedSync(userId: string, TwitchAPI: TwitchApi): Promise<number> {
  try {
    const totalClips = await syncTwitchClips(userId, TwitchAPI);
    await updateClipSyncStatus(supabase, userId, "completed", totalClips);
    return totalClips;
  } catch (error) {
    console.error(`[clip-sync] sync failed: ${describeError(error)}`);
    // Mark as failed; the status trigger posts clips.sync_failed with the message.
    const message = error instanceof Error ? error.message : String(error);
    await updateClipSyncStatus(supabase, userId, "failed", undefined, message);
    throw error;
  }
}

/**
 * Syncs Twitch clips for a given broadcaster_id and waits for it to finish.
 * For callers with no one waiting on them (the stream.offline handler).
 * @param broadcaster_id - The Twitch broadcaster/user ID to sync clips for
 * @param TwitchAPI - The TwitchApi instance to use for API calls
 * @returns The total number of clips synced, or `skipped` when a sync is
 * already running or one started less than an hour ago
 */
export async function syncTwitch(
  broadcaster_id: string,
  TwitchAPI: TwitchApi,
): Promise<{ clipsCount: number } | ClipSyncSkipped> {
  const claim = await claimTwitchSync(broadcaster_id);
  if (!("claimed" in claim)) return claim;
  return { clipsCount: await runClaimedSync(claim.userId, TwitchAPI) };
}

/**
 * Claims a sync and runs it in the background, for the manual sync request: a
 * full history pull can take hundreds of Helix pages, far longer than a
 * request should stay open. Progress lives on the twitch_clip_syncs row.
 */
export function startTwitchSync(broadcaster_id: string, TwitchAPI: TwitchApi) {
  return createClipSyncStarter({
    claim: claimTwitchSync,
    run: (userId) => runClaimedSync(userId, TwitchAPI),
    reportError,
  })(broadcaster_id);
}

export async function syncTwitchClips(user_id: string, TwitchAPI: TwitchApi) {
  let hasMoreClips = true;
  let cursor: string | undefined;
  let totalClips = 0;
  let iterationCount = 0;
  const MAX_ITERATIONS = 1000; // Safety limit: max 100,000 clips (1000 * 100)
  const seenCursors = new Set<string | undefined>(); // Track cursors to detect infinite loops

  // The throw below replaces a failed read with a generic message, so report
  // the original first or the actual cause never leaves this frame.
  const twitchUserId = await getTwitchUserIdByUserId(supabase, user_id).catch((error: unknown) => {
    reportError(error, "sync-twitch.integration-lookup", { user_id });
    return null;
  });
  if (!twitchUserId) throw new Error("Twitch integration not found for user");

  console.log("Starting sync for user:", user_id);
  // loop until there are no more clips
  while (hasMoreClips) {
    // Safety check: prevent infinite loops
    if (iterationCount >= MAX_ITERATIONS) {
      console.warn(`Sync stopped at ${MAX_ITERATIONS} iterations (${totalClips} clips synced). Possible infinite loop detected.`);
      break;
    }

    // Safety check: detect duplicate cursors (infinite loop protection)
    if (seenCursors.has(cursor)) {
      console.warn(`Duplicate cursor detected: ${cursor}. Stopping sync to prevent infinite loop.`);
      break;
    }
    seenCursors.add(cursor);

    iterationCount++;

    try {
      const clipsResponse = await fetchAndFormatTwitchClips(twitchUserId, TwitchAPI, cursor);

      if (!clipsResponse) {
        break;
      }

      const { clips, pagination } = clipsResponse;

      if (!clips.length) {
        break;
      }

      // format the clips for the database
      const formattedClips = await formatClipsForDB(clips, user_id);

      // upsert the clips into the database
      await upsertClips(supabase, formattedClips);

      // increment the total number of clips
      totalClips += clips.length;
      cursor = pagination!.cursor;
      hasMoreClips = !!cursor;

      // Clear the formatted clips array reference to help GC
      // (formattedClips will be garbage collected after upsert completes)
    } catch (error) {
      console.error(`[clip-sync] iteration ${iterationCount} failed: ${describeError(error)}`);
      throw error;
    }
  }

  // Clear the Set to free memory
  seenCursors.clear();

  console.log("Sync completed for user:", user_id);

  // return the total number of clips
  return totalClips;
}

export async function fetchAndFormatTwitchClips(broadcasterId: string, TwitchAPI: TwitchApi, cursor?: string) {
  // total number of clips to fetch
  const batchSize = 100;

  // fetch the clips
  const res = await TwitchAPI.clips.getClips({
    broadcaster_id: broadcasterId,
    first: batchSize,
    after: cursor,
  });

  // return the clips and pagination
  return {
    clips: res.data,
    pagination: res.pagination,
  };
}

export type TwitchClip = {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  is_featured: boolean;
};

async function getExistingVodVideoIds(videoIds: string[]): Promise<Set<string>> {
  if (!videoIds.length) {
    return new Set();
  }

  return getVodsByVideoIds(supabase, videoIds);
}

// format the clips for the database
export async function formatClipsForDB(clips: TwitchClip[], userId: string): Promise<Database["public"]["Tables"]["clips"]["Insert"][]> {
  const uniqueVideoIds = [...new Set(clips.map((clip) => clip.video_id).filter((videoId): videoId is string => !!videoId))];
  const existingVodVideoIds = await getExistingVodVideoIds(uniqueVideoIds);

  return clips.map((clip) => ({
    twitch_clip_id: clip.id,
    url: clip.url,
    embed_url: clip.embed_url,
    broadcaster_id: clip.broadcaster_id,
    broadcaster_name: clip.broadcaster_name,
    creator_id: clip.creator_id,
    creator_name: clip.creator_name,
    // Keep FK integrity: only persist video_id when the referenced VOD exists.
    video_id: clip.video_id && existingVodVideoIds.has(clip.video_id) ? clip.video_id : null,
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
