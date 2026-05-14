import { supabase } from "@repo/supabase";
import { upsertClips } from "@repo/supabase/queries/clips";
import { getPendingClips, updatePendingClipsReady, updatePendingClipRetry } from "@repo/supabase/queries/vods";
import { TwitchApi } from "@repo/twitch-api";

const BATCH_SIZE = 50;
const MAX_RETRIES = 20;
const POLL_INTERVAL_MS = 30_000;
const IDLE_INTERVAL_MS = 60_000;

async function fetchClipsFromTwitch(ids: string[], twitchApi: TwitchApi) {
  if (!ids.length) return [];
  const res = await twitchApi.clips.getClips({ id: ids });
  if (!res) throw new Error(`Twitch API error: ${res}`);
  return res.data ?? [];
}

function getNextRetryDelay(retryCount: number) {
  return Math.min(120, 2 ** retryCount) * 1000;
}

async function processBatch(twitchApi: TwitchApi) {
  const pending = await getPendingClips(supabase, BATCH_SIZE, MAX_RETRIES);

  if (!pending.length) {
    console.log("[pending-clips] No pending clips found");
    return { idle: true };
  }

  console.log(`[pending-clips] Processing ${pending.length} pending clips`);

  const ids = pending.map((p) => p.clip_id);
  const clips = await fetchClipsFromTwitch(ids, twitchApi);
  const foundIds = new Set(clips.map((c) => c.id));

  console.log(`[pending-clips] Found ${clips.length} clips from Twitch, ${pending.length - clips.length} not ready yet`);

  if (clips.length) {
    await upsertClips(
      supabase,
      clips
        .map((clip) => {
          const pendingClip = pending.find((p) => p.clip_id === clip.id);
          const userId = pendingClip?.integrations_twitch?.user_id;

          return {
            twitch_clip_id: clip.id,
            broadcaster_id: clip.broadcaster_id,
            broadcaster_name: clip.broadcaster_name,
            creator_id: clip.creator_id,
            creator_name: clip.creator_name,
            title: clip.title,
            url: clip.url,
            embed_url: clip.embed_url,
            thumbnail_url: clip.thumbnail_url,
            view_count: clip.view_count,
            duration: clip.duration,
            vod_offset: clip.vod_offset,
            created_at_twitch: clip.created_at,
            video_id: clip.video_id,
            game_id: clip.game_id,
            language: clip.language,
            user_id: userId,
          };
        })
        .filter((clip): clip is typeof clip & { user_id: string } => clip.user_id !== undefined),
    );
  }

  const readyIds = pending.filter((r) => foundIds.has(r.clip_id)).map((r) => r.clip_id);
  const notFoundRows = pending.filter((r) => !foundIds.has(r.clip_id));

  if (readyIds.length) {
    await updatePendingClipsReady(supabase, readyIds);
  }

  for (const row of notFoundRows) {
    const newRetryCount = row.retry_count + 1;
    const nextRetry = new Date(Date.now() + getNextRetryDelay(row.retry_count)).toISOString();
    await updatePendingClipRetry(supabase, row.clip_id, newRetryCount, nextRetry, newRetryCount >= MAX_RETRIES ? "failed" : "pending");
  }

  console.log(`[pending-clips] Marked ${readyIds.length} as ready, ${notFoundRows.length} rescheduled`);
  return { idle: false };
}

export async function runPendingClipsWorker(twitchApi: TwitchApi, isRunning: () => boolean) {
  while (isRunning()) {
    try {
      const { idle } = await processBatch(twitchApi);
      await new Promise((r) => setTimeout(r, idle ? IDLE_INTERVAL_MS : POLL_INTERVAL_MS));
    } catch (err) {
      console.error("[pending-clips] Worker error:", err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  console.log("[pending-clips] Worker stopped");
}
