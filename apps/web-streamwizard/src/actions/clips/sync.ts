"use server";
import { track } from "@/lib/tracking/track";
import { reportError } from "@repo/sentry";
import { clipSyncErrorMessage } from "@/lib/clips/clip-sync-error";
import { tryAuthContext } from "@/lib/auth";
import axios from "axios";
import { env } from "@/lib/env";

/**
 * Starts a clip sync. rest-api answers as soon as the sync is claimed and runs
 * it in the background, so success means "started", not "finished": the clips
 * come in over the next minute or so.
 */
export async function SyncBroadcasterClips(): Promise<{
  message: string;
  success: boolean;
  started?: boolean;
  skipped?: boolean;
  lastSync?: string;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { message: "Unauthorized", success: false };

  // tryAuthContext has checked the session with getUser; this only reads its
  // access token, which rest-api verifies again.
  const {
    data: { session },
  } = await ctx.supabase.auth.getSession();

  try {
    await axios.post(`${env.STREAMWIZARD_API_URL}/api/clips/sync`, null, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    await track("clips_synced", { trigger: "manual", skipped: false }, ctx.user);
    return {
      message: "Syncing your clips. They show up here as they come in.",
      success: true,
      started: true,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError<{ skipped: boolean; message: string; success: boolean; lastSync?: string }>(error)) {
      const data = error.response?.data;
      if (data?.skipped) {
        // Throttled: they asked, we said "not yet". Still a sync attempt.
        await track("clips_synced", { trigger: "manual", skipped: true }, ctx.user);
        return {
          message: data.message || "Already synced recently",
          success: false,
          skipped: true,
          lastSync: data.lastSync,
        };
      }
      // No response means the request never got an answer (API down, wrong
      // URL): report it. rest-api reports its own 5xx, and a 4xx is the
      // user's own state (no Twitch link, expired token).
      if (!error.response) reportError(error, "clips: sync request");
      else console.warn(`[clip-sync] rest-api answered ${error.response.status}`);
      return { message: clipSyncErrorMessage(error.response?.status), success: false };
    }
    reportError(error, "clips: sync request");
    return { message: clipSyncErrorMessage(500), success: false };
  }
}
