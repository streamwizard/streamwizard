"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { ADMIN_ROLE, deleteUserRole, getAdminRoleId, grantAdminRole } from "@repo/supabase/queries/auth/roles";
import { countActiveObsInstances, getAdminUser, revokeUserSessions } from "@repo/supabase/queries/users/admin-users";
import { getGuildSettings } from "@repo/supabase/queries/discord/discord";
import { logPlatformEvent } from "@repo/supabase/queries/platform/events";
import { deleteTicketAttachments } from "@repo/supabase/queries/tickets/tickets";
import { deleteDiscordIntegration, deleteUserData, getDiscordUserIdByUserId, getTwitchLinkByUserId, type TwitchLink } from "@repo/supabase/queries/users/user";
import { TwitchApi } from "@repo/twitch-api";
import { BAD_INPUT, toActionError } from "@/lib/actions/action-error";
import { requireAdminContext, type AdminContext } from "@/lib/auth/admin-context";
import { getAssetsStorage } from "@/lib/assets-storage";
import { getDiscordContext } from "@/lib/discord/api";
import { actorIdentity, eventIdentity } from "@/lib/platform-events";
import { PERMANENT_BAN, type BanNote } from "@/lib/users/user-auth";
import { helixConfigured, loadUserEventSub } from "@/lib/users/user-eventsub-server";
import { userDisplayName } from "@/lib/users/users";
import { revokeWsSockets } from "@/lib/ws-revoke";
import type { ModerationResult } from "@/types/users";

// Admin actions on one user (/users/[id]). Plan grants live in
// actions/users/subscriptions.ts. Role and Discord changes are logged to
// platform_events by the triggers on user_roles and integrations_discord,
// so these don't emit their own events.

type Result = { error: string | null };

interface ResyncResult extends Result {
  created: number;
  deleted: number;
  /** Creates or deletes Twitch refused, with its message. */
  failed: { type: string; message: string }[];
}

const NO_USER = "That user doesn't exist.";
const noResync = () => ({ created: 0, deleted: 0, failed: [] });

const setAdminSchema = z.object({ userId: guidSchema, admin: z.boolean() });
const removeTotpSchema = z.object({ userId: guidSchema, factorId: guidSchema });
const banSchema = z.object({
  userId: guidSchema,
  // The log keeps the first 500 characters.
  reason: z
    .string()
    .max(2000)
    .transform((reason) => reason.trim().slice(0, 500)),
  banDiscord: z.boolean(),
  stopEventSub: z.boolean(),
});
const unbanSchema = z.object({ userId: guidSchema, unbanDiscord: z.boolean() });
const deleteSchema = z.object({ userId: guidSchema, confirmation: z.string().max(500), banDiscord: z.boolean() });

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

const SET_ADMIN_FAILED = "Couldn't change the admin role. Try again?";

export async function setAdminRoleAction(userId: string, admin: boolean): Promise<Result> {
  try {
    const ctx = await requireAdminContext();
    const parsed = setAdminSchema.safeParse({ userId, admin });
    if (!parsed.success) return { error: NO_USER };
    return await setAdminRole(ctx, parsed.data.userId, parsed.data.admin);
  } catch (e) {
    return toActionError(e, "users.set-admin", SET_ADMIN_FAILED);
  }
}

async function setAdminRole(ctx: AdminContext, userId: string, admin: boolean): Promise<Result> {
  const { userId: actorId, adminClient: client } = ctx;
  const failed = { error: SET_ADMIN_FAILED };
  if (!admin && actorId === userId) return { error: "You can't remove your own admin role." };

  let existing: string | null;
  try {
    existing = await getAdminRoleId(client, userId);
  } catch (e) {
    reportError(e, "users.set-admin");
    return failed;
  }

  if (admin && !existing) {
    let inserted: string;
    try {
      inserted = await grantAdminRole(client, userId);
    } catch (e) {
      reportError(e, "users.set-admin");
      return failed;
    }
    // The new admin has no second factor yet, so whichever session enrols one
    // first becomes a full admin. Only a sign-in made after the grant may.
    const ended = await endAllSessions(userId, "users.set-admin-sessions");
    if (!ended) {
      await deleteUserRole(client, inserted).catch((e) => reportError(e, "users.set-admin-rollback"));
      return { error: "Couldn't end their sessions, so the admin role was not granted. Try again." };
    }
  }
  if (!admin && existing) {
    try {
      await deleteUserRole(client, existing);
    } catch (e) {
      reportError(e, "users.set-admin");
      return failed;
    }
  }

  revalidateUser(userId);
  return { error: null };
}

export async function unlinkDiscordAction(userId: string): Promise<Result> {
  const failed = "Couldn't unlink Discord. Try again?";
  try {
    const { adminClient: client } = await requireAdminContext();
    const id = guidSchema.safeParse(userId);
    if (!id.success) return { error: NO_USER };

    const discordUserId = await getDiscordUserIdByUserId(client, id.data);
    if (!discordUserId) return { error: "This user has no Discord account linked." };

    // Best effort, like the user's own unlink: take back the Verified Member
    // role. A Discord failure must not block the unlink itself.
    const discord = getDiscordContext();
    if (discord) {
      try {
        const settings = await getGuildSettings(client, discord.guildId);
        if (settings?.verified_role_id) {
          await discord.api.members.removeRole(discordUserId, settings.verified_role_id);
        }
      } catch (error) {
        reportError(error, "users.unlink-discord-role");
      }
    }

    await deleteDiscordIntegration(client, id.data);
    revalidateUser(id.data);
    return { error: null };
  } catch (error) {
    return toActionError(error, "users.unlink-discord", failed);
  }
}

/**
 * Creates the channel's missing subscriptions and deletes its dead ones, the
 * same repair a login does plus the cleanup. Webhook creates need
 * TWITCH_WEBHOOK_SECRET; without it they're reported as failed.
 */
export async function resyncEventSubAction(userId: string): Promise<ResyncResult> {
  const empty = noResync();
  try {
    const { adminClient } = await requireAdminContext();
    const id = guidSchema.safeParse(userId);
    if (!id.success) return { ...empty, error: NO_USER };
    if (!helixConfigured()) return { ...empty, error: "Twitch isn't configured for web-admin." };

    let twitch: TwitchLink | null;
    try {
      twitch = await getTwitchLinkByUserId(adminClient, id.data);
    } catch (readError) {
      reportError(readError, "users.resync-eventsub");
      return { ...empty, error: "Couldn't read their Twitch link. Try again?" };
    }
    if (!twitch) return { ...empty, error: "This user has no Twitch account linked." };
    return await resyncEventSub(id.data, twitch);
  } catch (error) {
    return { ...empty, ...toActionError(error, "users.resync-eventsub", "Couldn't resync EventSub. Try again?") };
  }
}

async function resyncEventSub(userId: string, twitch: TwitchLink): Promise<ResyncResult> {
  const state = await loadUserEventSub(twitch.twitch_user_id, twitch.twitch_scopes);
  if (!state.configured) return { ...noResync(), error: state.reason };

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

  if (failed.length) reportError(new Error(`EventSub resync: ${failed.length} failed`), "users.resync-eventsub");
  revalidatePath(`${userPath(userId)}/eventsub`);
  return { error: null, created, deleted, failed };
}

// ── Second factors ──────────────────────────────────────────────────────────
// For an admin who lost their phone: removing their authenticator signs them
// out everywhere and sends them through /auth/setup on their next sign-in. You can't remove your own (it is
// your only second factor); another admin has to.

const REMOVE_TOTP_FAILED = "Couldn't remove the authenticator. Try again?";

export async function removeUserTotpAction(userId: string, factorId: string): Promise<Result> {
  try {
    const { userId: actorId } = await requireAdminContext();
    const parsed = removeTotpSchema.safeParse({ userId, factorId });
    if (!parsed.success) return { error: "That authenticator is already gone. Reload the page." };
    return await removeUserTotp(actorId, parsed.data.userId, parsed.data.factorId);
  } catch (error) {
    return toActionError(error, "users.remove-totp", REMOVE_TOTP_FAILED);
  }
}

async function removeUserTotp(actorId: string, userId: string, factorId: string): Promise<Result> {
  if (actorId === userId) return { error: "Another admin has to reset your authenticator." };
  // With no factor left, whichever session enrols a new one first becomes a
  // full admin. Only a sign-in made after the reset may, so every session is
  // ended before the factor goes (none left to race) and again after.
  if (!(await endAllSessions(userId, "users.remove-totp-sessions"))) {
    return { error: "Couldn't end their sessions, so the authenticator was not reset. Try again." };
  }
  const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
  if (error) {
    reportError(error, "users.remove-totp");
    return { error: REMOVE_TOTP_FAILED };
  }
  await endAllSessions(userId, "users.remove-totp-sessions");
  revalidateUser(userId);
  return { error: null };
}

// ── Ban, unban, delete ──────────────────────────────────────────────────────

const failure = (error: string | null): ModerationResult => ({ error, warnings: [] });

/** Admins can't be banned or deleted from here: take the role away first, on purpose. */
async function guardTarget({ userId: actorId, adminClient }: AdminContext, userId: string) {
  if (actorId === userId) return { error: "You can't do that to your own account.", user: null };
  const user = await getAdminUser(adminClient, userId);
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
  try {
    const ctx = await requireAdminContext();
    const parsed = banSchema.safeParse({ userId, ...options });
    if (!parsed.success) return failure(BAD_INPUT);
    if (!parsed.data.reason) return failure("Write down why. It goes in the log.");
    return await banUser(ctx, parsed.data);
  } catch (error) {
    return failure(toActionError(error, "users.ban", "Couldn't ban them. Try again?").error);
  }
}

async function banUser(ctx: AdminContext, options: z.infer<typeof banSchema>): Promise<ModerationResult> {
  const { userId, reason } = options;
  const actorId = ctx.userId;
  const { error: guardError, user } = await guardTarget(ctx, userId);
  if (!user) return failure(guardError ?? "User not found.");

  const discord = options.banDiscord && user.discord ? getDiscordContext() : null;
  const note: BanNote = { reason, by: actorId, at: new Date().toISOString(), discord: !!discord };
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: PERMANENT_BAN,
    app_metadata: { ban: note },
  });
  if (error) {
    reportError(error, "users.ban");
    return failure("Couldn't ban them. Try again?");
  }

  const warnings: string[] = [];
  // Dashboard sockets ride the session; end them with it.
  await revokeWsSockets(userId, "session");
  try {
    await revokeUserSessions(supabaseAdmin, userId);
  } catch (e) {
    reportError(e, "users.ban-sessions");
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
        reportError(e, "users.ban-discord");
        warnings.push("Discord ban failed. The bot needs Ban Members and a role above theirs.");
      }
    }
  }

  if (options.stopEventSub && user.twitch && helixConfigured()) {
    try {
      await deleteAllEventSub(user.twitch.userId);
    } catch (e) {
      reportError(e, "users.ban-eventsub");
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
    "users.platform-event",
  );

  revalidateUser(userId);
  return { error: null, warnings };
}

export async function unbanUserAction(userId: string, options: { unbanDiscord: boolean }): Promise<ModerationResult> {
  try {
    const ctx = await requireAdminContext();
    const parsed = unbanSchema.safeParse({ userId, ...options });
    if (!parsed.success) return failure(BAD_INPUT);
    return await unbanUser(ctx, parsed.data);
  } catch (error) {
    return failure(toActionError(error, "users.unban", "Couldn't unban them. Try again?").error);
  }
}

async function unbanUser({ userId: actorId, adminClient }: AdminContext, options: z.infer<typeof unbanSchema>): Promise<ModerationResult> {
  const { userId } = options;
  const user = await getAdminUser(adminClient, userId);
  if (!user) return failure("User not found.");

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none", app_metadata: { ban: null } });
  if (error) {
    reportError(error, "users.unban");
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
        reportError(e, "users.unban-discord");
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
    "users.platform-event",
  );

  revalidateUser(userId);
  return { error: null, warnings };
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
  try {
    const ctx = await requireAdminContext();
    const parsed = deleteSchema.safeParse({ userId, ...options });
    if (!parsed.success) return failure(BAD_INPUT);
    return await deleteUser(ctx, parsed.data);
  } catch (error) {
    return failure(toActionError(error, "users.delete", "Couldn't delete their data. Try again?").error);
  }
}

async function deleteUser(ctx: AdminContext, options: z.infer<typeof deleteSchema>): Promise<ModerationResult> {
  const { userId } = options;
  const { userId: actorId, adminClient: client } = ctx;
  const { error: guardError, user } = await guardTarget(ctx, userId);
  if (!user) return failure(guardError ?? "User not found.");
  if (options.confirmation.trim() !== userDisplayName(user)) return failure("The name doesn't match.");

  if ((await countActiveObsInstances(client, userId)) > 0) {
    return failure("They have a Cloud OBS instance running. Stop it on the OBS page first.");
  }

  const warnings: string[] = [];
  const best = async (label: string, step: () => Promise<unknown>) => {
    try {
      await step();
    } catch (e) {
      reportError(e, "users.delete-step", { step: label });
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
    const r2 = getAssetsStorage();
    if (r2) await best("Ticket attachments", () => deleteTicketAttachments(supabaseAdmin, discordUserId, (key) => r2.deleteObject(key)));
    else warnings.push("R2 isn't configured for web-admin, so their ticket screenshots were kept.");
  }

  if (user.twitch) {
    // Emits user.deleted (reason admin, with the actor) and wipes their rows.
    const { error } = await deleteUserData(client, user.twitch.userId, "admin", actorId);
    if (error) {
      reportError(error, "users.delete");
      return { error: "Couldn't delete their data. Try again?", warnings };
    }
  } else {
    // No Twitch, so delete_user_data can't find them; the auth delete below
    // cascades to public.users. Log it ourselves first, while the identity resolves.
    const [identity, actor] = await Promise.all([eventIdentity(userId), actorIdentity(actorId)]);
    await logPlatformEvent(
      supabaseAdmin,
      { type: "user.deleted", subjectUserId: userId, actorUserId: actorId, payload: { ...identity, ...actor, reason: "admin" } },
      "users.platform-event",
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    reportError(error, "users.delete-auth");
    return { error: "Their data is gone but the sign-in account wasn't deleted. Try again?", warnings };
  }
  await revokeWsSockets(userId, "all");

  revalidatePath("/users");
  return { error: null, warnings };
}
