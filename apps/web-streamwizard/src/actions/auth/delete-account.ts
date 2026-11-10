"use server";

import { reportError } from "@repo/sentry";

import { tryAuthContext } from "@/lib/auth";
import { getDiscordIntegrationByUserId, deleteUserData } from "@repo/supabase/queries/users/user";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets/tickets";
import { createAdminClient, supabaseAdmin } from "@repo/supabase/next/admin";
import { TwitchApi } from "@repo/twitch-api";
import { redirect } from "next/navigation";
import { revokeVerifiedRole } from "@/server/discord/roles";
import { getAssetsStorage } from "@/lib/media/assets-storage";
import { track } from "@/lib/tracking/track";
import { revokeWsSockets } from "@/lib/overlays/ws-revoke";

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
  } catch (err) {
    // Non-fatal: proceed with data deletion. Left behind, the subscriptions
    // keep counting against the EventSub quota, so report it.
    reportError(err, "actions/delete-account: eventsub cleanup", { broadcasterId });
  }

  // Deleting the account doesn't remove the user from the Discord server
  // itself, so the Verified Member role goes first, while the integration row
  // still says who they are on Discord.
  await revokeVerifiedRole(supabase, user.id);

  // delete_user_data can't reach R2, so the user's files go first: Discord
  // ticket screenshots (it only anonymises the messages) and media library
  // uploads (their rows cascade away with the account). Best-effort, like the
  // steps above; rest-api's hourly asset reconciler removes media left behind.
  const r2 = getAssetsStorage();
  if (r2) {
    try {
      const { data: integration } = await getDiscordIntegrationByUserId(supabase, user.id);
      if (integration?.discord_user_id) {
        await deleteTicketAttachments(supabaseAdmin, integration.discord_user_id, (key) => r2.deleteObject(key));
      }
    } catch (ticketErr) {
      reportError(ticketErr, "actions/delete-account: ticket attachments");
    }

    try {
      await r2.deletePrefix(`assets/${user.id}/`);
    } catch (mediaErr) {
      reportError(mediaErr, "actions/delete-account: media");
    }
  }

  const { error: rpcError } = await deleteUserData(supabase, broadcasterId);
  if (rpcError) {
    reportError(rpcError, "actions/delete-account");
    return { success: false, error: "Couldn't delete your account. Try again, or contact us if it keeps failing." };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id,
  );
  if (authError) {
    reportError(authError, "actions/delete-account");
    return { success: false, error: "Couldn't finish deleting your account. Try again, or contact us if it keeps failing." };
  }

  await revokeWsSockets(user.id, "all");

  // PostHog's existing data is left alone on purpose: the policy allows
  // analytics linked to the account for 12 months after last activity, and
  // the scheduled retention purge removes the person once that window passes.
  // The deletion itself is recorded: it is the clearest "I'm leaving" there is.
  const createdAt = Date.parse(user.created_at);
  await track(
    "account_deleted",
    { account_age_days: Number.isFinite(createdAt) ? Math.floor((Date.now() - createdAt) / 86_400_000) : null },
    user,
  );
  redirect("/goodbye");
}
