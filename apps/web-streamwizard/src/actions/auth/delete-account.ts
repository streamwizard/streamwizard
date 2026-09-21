"use server";

import { reportError } from "@repo/sentry";

import { tryAuthContext } from "@/lib/auth";
import { getDiscordIntegrationByUserId, deleteUserData } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets";
import { R2Storage } from "@repo/storage";
import { createAdminClient, supabaseAdmin } from "@repo/supabase/next/admin";
import { TwitchApi } from "@repo/twitch-api";
import { redirect } from "next/navigation";
import { removeRole } from "@/server/discord/roles";
import { env } from "@/lib/env";

export async function deleteAccount() {
  const ctx = await tryAuthContext();
  if (!ctx) return { success: false, error: "Unauthorized" };
  const { user, broadcasterId } = ctx;
  const supabase = createAdminClient();
  // Revoke the Twitch access token so it is immediately invalidated.
  // This cannot remove the app from the user's Twitch authorized connections
  // UI — they must do that manually from Twitch Settings → Connections.
  try {
    await new TwitchApi(broadcasterId).auth.revokeUserToken();
  } catch {
    // Non-fatal: token may already be expired; proceed with deletion.
  }

  // Delete all EventSub subscriptions for this broadcaster. Twitch changes
  // their status to authorization_revoked but does NOT delete them — they
  // keep counting against quota until explicitly removed.
  try {
    const eventsub = new TwitchApi().eventsub;
    const { data: subscriptions } =
      await eventsub.getSubscriptions(broadcasterId);
    await Promise.all(
      subscriptions.map((sub) =>
        eventsub.deleteSubscription(sub.id, broadcasterId),
      ),
    );
  } catch {
    // Non-fatal: proceed with data deletion even if cleanup fails.
  }

  // Best-effort: revoke the Verified Member role directly via the bot before
  // wiping the integration row, since deleting the account doesn't remove
  // the user from the Discord server itself. A failure here must not block
  // account deletion.
  try {
    const { data: integration } = await getDiscordIntegrationByUserId(supabase, user.id);
    const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
    if (integration?.discord_user_id && settings?.verified_role_id) {
      await removeRole(integration.discord_user_id, settings.verified_role_id);
    }
  } catch (revokeErr) {
    const { captureException } = await import("@sentry/nextjs");
    captureException(revokeErr);
  }

  // delete_user_data anonymises the user's Discord ticket messages but can't
  // reach R2, so remove the ticket screenshots they posted first. Best-effort,
  // like the steps above.
  try {
    const { data: integration } = await getDiscordIntegrationByUserId(supabase, user.id);
    if (
      integration?.discord_user_id &&
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_ASSETS_BUCKET
    ) {
      const r2 = new R2Storage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_ASSETS_BUCKET,
      });
      await deleteTicketAttachments(supabaseAdmin, integration.discord_user_id, (key) => r2.deleteObject(key));
    }
  } catch (ticketErr) {
    reportError(ticketErr, "actions/delete-account: ticket attachments");
  }

  const { error: rpcError } = await deleteUserData(supabase, broadcasterId);
  if (rpcError) {
    reportError(rpcError, "actions/delete-account");
    return { success: false, error: rpcError.message };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id,
  );
  if (authError) {
    reportError(authError, "actions/delete-account");
    return { success: false, error: authError.message };
  }

  // PostHog is left alone on purpose: the policy allows analytics linked to
  // the account for 12 months after last activity, and the scheduled
  // retention purge removes the person once that window passes.
  redirect("/goodbye");
}
