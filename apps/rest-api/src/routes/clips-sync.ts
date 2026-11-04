import { type Context } from "hono";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getTwitchIntegrationWithTokenByUserId } from "@repo/supabase/queries/user";
import { getClipSync } from "@repo/supabase/queries/sync";
import { TwitchApi } from "@repo/twitch-api";
import { startTwitchSync } from "@/modules/streams/clip-sync";

/**
 * POST /api/clips/sync
 *
 * Starts a Twitch clips sync for the authenticated user and answers without
 * waiting for it: a full history pull can take hundreds of Helix pages.
 * GET /api/clips/sync-status reports how it ends.
 * Requires Supabase authentication via JWT token.
 *
 * Request:
 * - Headers: Authorization: Bearer <token> OR Cookie with Supabase auth token
 * - No body. The one-hour throttle can't be turned off from here.
 *
 * Response:
 * - 202: { success: true, started: true, status: "syncing", message: string }
 * - 429: { success: false, skipped: true, lastSync, message } (a sync is running or ran in the last hour)
 * - 400: { error: string }
 * - 401: { error: string } (if not authenticated)
 * - 404: { error: string } (if Twitch integration not found)
 * - 500: { error: string }
 */
export async function syncClipsHandler(c: Context) {
  try {
    // Get authenticated user from context (set by supabaseAuth middleware)
    const user = c.get("user");

    if (!user || !user.id) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const userId = user.id;

    // Look up the user's Twitch integration to get their broadcaster_id
    const { data: integration, error: integrationError } = await getTwitchIntegrationWithTokenByUserId(supabase, userId);

    if (integrationError || !integration) {
      return c.json(
        {
          error: "Twitch integration not found",
          message: "Please connect your Twitch account first",
        },
        404,
      );
    }

    if (!integration.access_token_ciphertext) {
      return c.json(
        {
          error: "Twitch authentication required",
          message:
            "Your Twitch access token is missing or expired. Please reconnect your Twitch account.",
        },
        400,
      );
    }

    // Initialize TwitchApi
    const TwitchAPI = new TwitchApi(integration.twitch_user_id);

    const result = await startTwitchSync(integration.twitch_user_id, TwitchAPI);

    if ("skipped" in result) {
      return c.json(
        {
          success: false,
          skipped: true,
          lastSync: result.lastSync,
          message: result.running
            ? "Already syncing your clips. Give it a minute."
            : "Synced less than an hour ago. Try again later.",
        },
        429,
      );
    }

    return c.json(
      {
        success: true,
        started: true,
        status: "syncing",
        message: "Syncing your clips",
      },
      202,
    );
  } catch (error) {
    // Answered as a 500 instead of rethrown.
    reportError(error, "clips-sync.start");
    return c.json({ error: "Sync failed", message: "Something broke on our end. Try again?" }, 500);
  }
}

/**
 * GET /api/clips/sync-status
 *
 * Get the current sync status for the authenticated user.
 *
 * Response:
 * - 200: { status: string, lastSync: string, clipCount: number }
 * - 404: { error: string } (if no sync record found)
 */
export async function syncStatusHandler(c: Context) {
  try {
    const user = c.get("user");

    if (!user || !user.id) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const userId = user.id;

    // Get sync status from database
    const syncStatus = await getClipSync(supabase, userId);

    if (!syncStatus) {
      return c.json(
        {
          message: "No sync history found",
          status: "never_synced",
        },
        200,
      );
    }

    return c.json(
      {
        status: syncStatus.sync_status,
        lastSync: syncStatus.last_sync,
        clipCount: syncStatus.clip_count,
      },
      200,
    );
  } catch (error) {
    reportError(error, "clips-sync.status");
    return c.json({ error: "Failed to get sync status", message: "Something broke on our end. Try again?" }, 500);
  }
}
