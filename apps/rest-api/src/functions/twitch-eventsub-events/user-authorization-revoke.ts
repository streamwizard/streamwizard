import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets";
import { getTwitchIntegrationByBroadcasterId, deleteUserData } from "@repo/supabase/queries/user";
import type { UserAuthorizationRevokeEvent } from "@repo/schemas";
import { r2 } from "../../lib/r2";

// The user disconnected StreamWizard on Twitch. Same clean-up as the
// delete-account action, minus the Twitch-side steps the user already did.

/**
 * delete_user_data can't reach R2, so the user's files go first: Discord
 * ticket screenshots (it only anonymises the messages) and media library
 * uploads (their rows cascade away with the account). Best-effort: a failure
 * here must not stop the deletion. The hourly asset reconciler removes media
 * left behind.
 */
async function purgeR2Files(twitchUserId: string): Promise<void> {
  let userId: string;
  try {
    const { data: integration } = await getTwitchIntegrationByBroadcasterId(supabase, twitchUserId);
    if (!integration) return;
    userId = integration.user_id;
  } catch (error) {
    reportError(error, "eventsub.revoke: r2 files", { twitchUserId });
    return;
  }
  const storage = r2;
  if (!storage) {
    reportError(new Error("R2 not configured; user files kept"), "eventsub.revoke: r2 files", { twitchUserId });
    return;
  }

  try {
    const discordUserId = await getDiscordUserIdForUser(supabase, userId);
    if (discordUserId) await deleteTicketAttachments(supabase, discordUserId, (key) => storage.deleteObject(key));
  } catch (error) {
    reportError(error, "eventsub.revoke: attachments", { twitchUserId });
  }

  try {
    await storage.deletePrefix(`assets/${userId}/`);
  } catch (error) {
    reportError(error, "eventsub.revoke: media", { twitchUserId });
  }
}

export const handleUserAuthorizationRevoke = async (event: UserAuthorizationRevokeEvent) => {
  await purgeR2Files(event.user_id);

  const { data: userId, error } = await deleteUserData(supabase, event.user_id, "twitch_revoked");

  if (error) throw error;

  // User not found — already deleted or never registered
  if (!userId) return;

  // deleteUser removes the account and invalidates all active sessions
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) throw authError;
};
