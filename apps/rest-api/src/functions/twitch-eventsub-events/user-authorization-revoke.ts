import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets";
import { getTwitchIntegrationByBroadcasterId, deleteUserData } from "@repo/supabase/queries/user";
import { R2Storage } from "@repo/storage";
import type { UserAuthorizationRevokeEvent } from "@repo/schemas";
import { env } from "../../lib/env";

// The user disconnected StreamWizard on Twitch. Same clean-up as the
// delete-account action, minus the Twitch-side steps the user already did.

const r2 =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_ASSETS_BUCKET
    ? new R2Storage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_ASSETS_BUCKET,
      })
    : null;

/**
 * delete_user_data anonymises the user's Discord ticket messages but can't
 * reach R2, so their ticket screenshots go first. Best-effort: a failure here
 * must not stop the deletion.
 */
async function purgeTicketAttachments(twitchUserId: string): Promise<void> {
  try {
    const { data: integration } = await getTwitchIntegrationByBroadcasterId(supabase, twitchUserId);
    if (!integration) return;
    const discordUserId = await getDiscordUserIdForUser(supabase, integration.user_id);
    if (!discordUserId) return;
    if (!r2) {
      reportError(new Error("R2 not configured; ticket attachments kept"), "eventsub.revoke: attachments", {
        twitchUserId,
      });
      return;
    }
    await deleteTicketAttachments(supabase, discordUserId, (key) => r2.deleteObject(key));
  } catch (error) {
    reportError(error, "eventsub.revoke: attachments", { twitchUserId });
  }
}

export const handleUserAuthorizationRevoke = async (event: UserAuthorizationRevokeEvent) => {
  await purgeTicketAttachments(event.user_id);

  const { data: userId, error } = await deleteUserData(supabase, event.user_id, "twitch_revoked");

  if (error) throw error;

  // User not found — already deleted or never registered
  if (!userId) return;

  // deleteUser removes the account and invalidates all active sessions
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) throw authError;
};
