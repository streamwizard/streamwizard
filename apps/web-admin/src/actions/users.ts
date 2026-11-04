"use server";

import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import { R2Storage } from "@repo/storage";
import { createAdminClient, supabaseAdmin } from "@repo/supabase/next/admin";
import { countActiveObsInstances, getAdminUser, revokeUserSessions } from "@repo/supabase/queries/admin-users";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { logPlatformEvent } from "@repo/supabase/queries/platform-events";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets";
import { deleteDiscordIntegration, deleteUserData } from "@repo/supabase/queries/user";
import { TwitchApi } from "@repo/twitch-api";
import { assertAdmin } from "@/lib/assert-admin";
import { getDiscordContext } from "@/lib/discord/api";
import { env } from "@/lib/env";
import { actorIdentity, eventIdentity } from "@/lib/platform-events";
import { PERMANENT_BAN, type BanNote } from "@/lib/user-auth";
import { helixConfigured, loadUserEventSub } from "@/lib/user-eventsub-server";
import { userDisplayName } from "@/lib/users";
import { revokeWsSockets } from "@/lib/ws-revoke";

// Admin actions on one user (/users/[id]). Plan grants live in
// actions/subscriptions.ts. Role and Discord changes are logged to
// platform_events by the triggers on user_roles and integrations_discord,
// so these don't emit their own events.

type Result = { error: string | null };

const ADMIN_ROLE = "admin";
const userPath = (userId: string) => `/users/${userId}`;

function revalidateUser(userId: string) {
  revalidatePath(userPath(userId), "layout");
  revalidatePath("/users");
}

/** Signs the user out everywhere: GoTrue sessions and dashboard sockets. False when the sessions couldn't be ended. */
async function endAllSessions(userId: string, where: string): Promise<boolean> {
  await revokeWsSockets(userId, "session");
  try {
    await revokeUserSessions(supabaseAdmin, userId);
    return true;
  } catch (e) {
    reportError(e, where);
    return false;
  }
}

export async function setAdminRoleAction(userId: string, admin: boolean): Promise<Result> {
  const actorId = await assertAdmin();
  if (!admin && actorId === userId) return { error: "You can't remove your own admin role." };

  const client = createAdminClient();
  const { data: existing, error: readError } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", ADMIN_ROLE)
    .maybeSingle();
  if (readError) {
    reportError(readError, "actions/users:set-admin");
    return { error: "Couldn't change the admin role. Try again?" };
  }

  if (admin && !existing) {
    const { data: inserted, error } = await client
      .from("user_roles")
      .insert({ user_id: userId, role: ADMIN_ROLE })
      .select("id")
      .single();
    if (error) {
      reportError(error, "actions/users:set-admin");
      return { error: "Couldn't change the admin role. Try again?" };
    }
    // The new admin has no second factor yet, so whichever session enrols one
    // first becomes a full admin. Only a sign-in made after the grant may.
    const ended = await endAllSessions(userId, "actions/users:set-admin-sessions");
    if (!ended) {
      await client.from("user_roles").delete().eq("id", inserted.id);
      return { error: "Couldn't end their sessions, so the admin role was not granted. Try again." };
    }
  }
  if (!admin && existing) {
    const { error } = await client.from("user_roles").delete().eq("id", existing.id);
    if (error) {
      reportError(error, "actions/users:set-admin");
      return { error: "Couldn't change the admin role. Try again?" };
    }
  }

  revalidateUser(userId);
  return { error: null };
}

export async function unlinkDiscordAction(userId: string): Promise<Result> {
  await assertAdmin();
  const client = createAdminClient();

  const { data: integration, error: readError } = await client
    .from("integrations_discord")
    .select("discord_user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    reportError(readError, "actions/users:unlink-discord");
    return { error: "Couldn't unlink Discord. Try again?" };
  }
  if (!integration) return { error: "This user has no Discord account linked." };

  // Best effort, like the user's own unlink: take back the Verified Member
  // role. A Discord failure must not block the unlink itself.
  const discord = getDiscordContext();
  if (discord) {
    try {
      const settings = await getGuildSettings(client, discord.guildId);
      if (settings?.verified_role_id) {
        await discord.api.members.removeRole(integration.discord_user_id, settings.verified_role_id);
      }
    } catch (error) {
      reportError(error, "actions/users:unlink-discord-role");
    }
  }

  try {
    await deleteDiscordIntegration(client, userId);
  } catch (error) {
    reportError(error, "actions/users:unlink-discord");
    return { error: "Couldn't unlink Discord. Try again?" };
  }

  revalidateUser(userId);
  return { error: null };
}

export interface ResyncResult extends Result {
  created: number;
  deleted: number;
  /** Creates or deletes Twitch refused, with its message. */
  failed: { type: string; message: string }[];
}

/**
 * Creates the channel's missing subscriptions and deletes its dead ones, the
 * same repair a login does plus the cleanup. Webhook creates need
 * TWITCH_WEBHOOK_SECRET; without it they're reported as failed.
 */
export async function resyncEventSubAction(userId: string): Promise<ResyncResult> {
  await assertAdmin();
  const empty = { created: 0, deleted: 0, failed: [] };
  if (!helixConfigured()) return { ...empty, error: "Twitch isn't configured for web-admin." };

  const client = createAdminClient();
  const { data: twitch, error: readError } = await client
    .from("integrations_twitch")
    .select("twitch_user_id, twitch_scopes")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    reportError(readError, "actions/users:resync-eventsub");
    return { ...empty, error: "Couldn't read their Twitch link. Try again?" };
  }
  if (!twitch) return { ...empty, error: "This user has no Twitch account linked." };

  const state = await loadUserEventSub(twitch.twitch_user_id, twitch.twitch_scopes);
  if (!state.configured) return { ...empty, error: state.reason };

  const api = new TwitchApi();
  const failed: ResyncResult["failed"] = [];
  const message = (error: unknown) => {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    return data?.message ?? (error instanceof Error ? error.message : "Unknown error");
  };

  let deleted = 0;
  for (const id of state.diff.failedIds) {
    try {
      await api.eventsub.deleteSubscription(id, twitch.twitch_user_id);
      deleted++;
    } catch (error) {
      failed.push({ type: `delete ${id}`, message: message(error) });
    }
  }

  let created = 0;
  for (const sub of state.diff.missing) {
    if (sub.transport.method === "webhook" && !sub.transport.secret) {
      failed.push({ type: sub.type, message: "TWITCH_WEBHOOK_SECRET isn't set for web-admin." });
      continue;
    }
    try {
      await api.eventsub.createSubscription(sub, twitch.twitch_user_id);
      created++;
    } catch (error) {
      failed.push({ type: sub.type, message: message(error) });
    }
  }

  if (failed.length) reportError(new Error(`EventSub resync: ${failed.length} failed`), "actions/users:resync-eventsub");
  revalidatePath(`${userPath(userId)}/eventsub`);
  return { error: null, created, deleted, failed };
}

// ── Second factors ──────────────────────────────────────────────────────────
// For an admin who lost their phone: removing their authenticator signs them
// out everywhere and sends them through /auth/setup on their next sign-in. You can't remove your own (it is
// your only second factor); another admin has to.

export async function removeUserTotpAction(userId: string, factorId: string): Promise<Result> {
  const actorId = await assertAdmin();
  if (actorId === userId) return { error: "Another admin has to reset your authenticator." };
  // With no factor left, whichever session enrols a new one first becomes a
  // full admin. Only a sign-in made after the reset may, so every session is
  // ended before the factor goes (none left to race) and again after.
  if (!(await endAllSessions(userId, "actions/users:remove-totp-sessions"))) {
    return { error: "Couldn't end their sessions, so the authenticator was not reset. Try again." };
  }
  const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
  if (error) {
    reportError(error, "actions/users:remove-totp");
    return { error: "Couldn't remove the authenticator. Try again?" };
  }
  await endAllSessions(userId, "actions/users:remove-totp-sessions");
  revalidateUser(userId);
  return { error: null };
}

// ── Ban, unban, delete ──────────────────────────────────────────────────────

export interface ModerationResult extends Result {
  /** Side steps that failed without stopping the main one. */
  warnings: string[];
}

const failure = (error: string): ModerationResult => ({ error, warnings: [] });

/** Admins can't be banned or deleted from here: take the role away first, on purpose. */
async function guardTarget(actorId: string, userId: string) {
  if (actorId === userId) return { error: "You can't do that to your own account.", user: null };
  const user = await getAdminUser(createAdminClient(), userId);
  if (!user) return { error: "User not found.", user: null };
  if (user.roles.includes(ADMIN_ROLE)) return { error: "Remove their admin role first.", user: null };
  return { error: null, user };
}

async function deleteAllEventSub(twitchUserId: string): Promise<number> {
  const eventsub = new TwitchApi().eventsub;
  const { data } = await eventsub.getSubscriptions(twitchUserId);
  await Promise.all(data.map((sub) => eventsub.deleteSubscription(sub.id, twitchUserId)));
  return data.length;
}

export async function banUserAction(
  userId: string,
  options: { reason: string; banDiscord: boolean; stopEventSub: boolean },
): Promise<ModerationResult> {
  const actorId = await assertAdmin();
  const reason = options.reason.trim().slice(0, 500);
  if (!reason) return failure("Write down why. It goes in the log.");
  const { error: guardError, user } = await guardTarget(actorId, userId);
  if (!user) return failure(guardError ?? "User not found.");

  const discord = options.banDiscord && user.discord ? getDiscordContext() : null;
  const note: BanNote = { reason, by: actorId, at: new Date().toISOString(), discord: !!discord };
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: PERMANENT_BAN,
    app_metadata: { ban: note },
  });
  if (error) {
    reportError(error, "actions/users:ban");
    return failure("Couldn't ban them. Try again?");
  }

  const warnings: string[] = [];
  // Dashboard sockets ride the session; end them with it.
  await revokeWsSockets(userId, "session");
  try {
    await revokeUserSessions(supabaseAdmin, userId);
  } catch (e) {
    reportError(e, "actions/users:ban-sessions");
    warnings.push("Couldn't end their sessions; they stay signed in until their token expires, within the hour.");
  }

  let discordBanned = false;
  if (options.banDiscord && user.discord) {
    if (!discord) {
      warnings.push("Discord isn't configured for web-admin, so they're still in the server.");
    } else {
      try {
        await discord.api.members.ban(user.discord.userId, { reason: `StreamWizard ban: ${reason}` });
        discordBanned = true;
      } catch (e) {
        reportError(e, "actions/users:ban-discord");
        warnings.push("Discord ban failed. The bot needs Ban Members and a role above theirs.");
      }
    }
  }

  if (options.stopEventSub && user.twitch && helixConfigured()) {
    try {
      await deleteAllEventSub(user.twitch.userId);
    } catch (e) {
      reportError(e, "actions/users:ban-eventsub");
      warnings.push("Couldn't delete their EventSub subscriptions. Run Resync on the EventSub tab.");
    }
  }

  const [identity, actor] = await Promise.all([eventIdentity(userId), actorIdentity(actorId)]);
  await logPlatformEvent(
    supabaseAdmin,
    {
      type: "user.banned",
      subjectUserId: userId,
      actorUserId: actorId,
      payload: { ...identity, ...actor, reason, discord_banned: discordBanned },
    },
    "web-admin users",
  );

  revalidateUser(userId);
  return { error: null, warnings };
}

export async function unbanUserAction(userId: string, options: { unbanDiscord: boolean }): Promise<ModerationResult> {
  const actorId = await assertAdmin();
  const user = await getAdminUser(createAdminClient(), userId);
  if (!user) return failure("User not found.");

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none", app_metadata: { ban: null } });
  if (error) {
    reportError(error, "actions/users:unban");
    return failure("Couldn't unban them. Try again?");
  }

  const warnings: string[] = [];
  let discordUnbanned = false;
  if (options.unbanDiscord && user.discord) {
    const discord = getDiscordContext();
    if (!discord) {
      warnings.push("Discord isn't configured for web-admin, so their server ban stays.");
    } else {
      try {
        await discord.api.members.unban(user.discord.userId, "StreamWizard ban lifted");
        discordUnbanned = true;
      } catch (e) {
        reportError(e, "actions/users:unban-discord");
        warnings.push("Discord unban failed. Unban them in the server settings.");
      }
    }
  }
  if (user.twitch) warnings.push("If their EventSub subscriptions were deleted, run Resync on the EventSub tab.");

  const [identity, actor] = await Promise.all([eventIdentity(userId), actorIdentity(actorId)]);
  await logPlatformEvent(
    supabaseAdmin,
    {
      type: "user.unbanned",
      subjectUserId: userId,
      actorUserId: actorId,
      payload: { ...identity, ...actor, discord_unbanned: discordUnbanned },
    },
    "web-admin users",
  );

  revalidateUser(userId);
  return { error: null, warnings };
}

function ticketStorage(): R2Storage | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ASSETS_BUCKET) return null;
  return new R2Storage({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_ASSETS_BUCKET,
  });
}

/**
 * Deletes the account and its data, the same steps as the user's own
 * "Delete account" plus an optional Discord ban. `confirmation` must be the
 * name the page shows, checked here so a stale or forged call can't skip it.
 * Blocks while a Cloud OBS container is up, since the rows go but the
 * container wouldn't.
 */
export async function deleteUserAction(
  userId: string,
  options: { confirmation: string; banDiscord: boolean },
): Promise<ModerationResult> {
  const actorId = await assertAdmin();
  const { error: guardError, user } = await guardTarget(actorId, userId);
  if (!user) return failure(guardError ?? "User not found.");
  if (options.confirmation.trim() !== userDisplayName(user)) return failure("The name doesn't match.");

  const client = createAdminClient();
  if ((await countActiveObsInstances(client, userId)) > 0) {
    return failure("They have a Cloud OBS instance running. Stop it on the OBS page first.");
  }

  const warnings: string[] = [];
  const best = async (label: string, step: () => Promise<unknown>) => {
    try {
      await step();
    } catch (e) {
      reportError(e, `actions/users:delete-${label}`);
      warnings.push(`${label}: failed, see Sentry for the detail.`);
    }
  };

  if (user.twitch) {
    const twitchUserId = user.twitch.userId;
    // Revoking the token ends StreamWizard's access at Twitch. Twitch marks
    // EventSub subscriptions revoked but keeps counting them until deleted.
    await best("Twitch token", () => new TwitchApi(twitchUserId).auth.revokeUserToken());
    if (helixConfigured()) await best("EventSub", () => deleteAllEventSub(twitchUserId));
  }

  if (user.discord) {
    const discordUserId = user.discord.userId;
    const discord = getDiscordContext();
    if (discord && options.banDiscord) {
      await best("Discord ban", () => discord.api.members.ban(discordUserId, { reason: "StreamWizard account deleted by an admin" }));
    } else if (discord) {
      await best("Discord role", async () => {
        const settings = await getGuildSettings(client, discord.guildId);
        if (settings?.verified_role_id) await discord.api.members.removeRole(discordUserId, settings.verified_role_id);
      });
    } else if (options.banDiscord) {
      warnings.push("Discord isn't configured for web-admin, so they weren't banned from the server.");
    }
    // delete_user_data anonymises their ticket messages but can't reach R2.
    const r2 = ticketStorage();
    if (r2) await best("Ticket attachments", () => deleteTicketAttachments(supabaseAdmin, discordUserId, (key) => r2.deleteObject(key)));
    else warnings.push("R2 isn't configured for web-admin, so their ticket screenshots were kept.");
  }

  if (user.twitch) {
    // Emits user.deleted (reason admin, with the actor) and wipes their rows.
    const { error } = await deleteUserData(client, user.twitch.userId, "admin", actorId);
    if (error) {
      reportError(error, "actions/users:delete");
      return { error: "Couldn't delete their data. Try again?", warnings };
    }
  } else {
    // No Twitch, so delete_user_data can't find them; the auth delete below
    // cascades to public.users. Log it ourselves first, while the identity resolves.
    const [identity, actor] = await Promise.all([eventIdentity(userId), actorIdentity(actorId)]);
    await logPlatformEvent(
      supabaseAdmin,
      { type: "user.deleted", subjectUserId: userId, actorUserId: actorId, payload: { ...identity, ...actor, reason: "admin" } },
      "web-admin users",
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    reportError(error, "actions/users:delete-auth");
    return { error: "Their data is gone but the sign-in account wasn't deleted. Try again?", warnings };
  }
  await revokeWsSockets(userId, "all");

  revalidatePath("/users");
  return { error: null, warnings };
}
