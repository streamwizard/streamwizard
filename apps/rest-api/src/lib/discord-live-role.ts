import { DiscordApi, DiscordMemberNotFoundError, DiscordRoleNotFoundError } from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import {
  deleteLiveRoleGrant,
  getLiveRoleGrantByBroadcaster,
  listLiveLinkedBroadcasters,
  listLiveRoleGrants,
  upsertLiveRoleGrant,
  type DiscordLiveRoleGrant,
} from "@repo/supabase/queries/discord-live-role";
import type { Stream } from "@repo/types";
import { liveEnv, resolveLiveTarget, type LiveTarget } from "./discord-live-target";

// Live role in the StreamWizard Discord. stream.online gives a broadcaster
// with Discord linked the guild's live role, stream.offline takes it away.
// A hoisted role puts them at the top of the member list. Runs on its own:
// the guild picks a role in web-admin and the role is on; go-live posts are
// a separate switch. Each user can turn it off in the main app.
//
// discord_live_roles records what was handed out. reconcileLiveRoles diffs
// it against broadcaster_live_status on boot and on a timer, so a missed
// stream.offline, a swapped role or an opt-out heals itself.
//
// Every entry point swallows everything: the stream pipeline never waits on
// Discord and never fails because of it.

let api: DiscordApi | null = null;

/** The REST client, or null when the env isn't set. Same bot token the bot itself uses. */
function discordApi(): DiscordApi | null {
  const live = liveEnv();
  if (!live) return null;
  api ??= new DiscordApi({ botToken: live.botToken, guildId: live.guildId });
  return api;
}

/**
 * Gives the broadcaster the live role. Takes the resolved target when the
 * caller already has it. Never throws.
 */
export async function grantLiveRole(stream: Stream, target?: LiveTarget | null): Promise<"granted" | "skipped"> {
  try {
    const discord = discordApi();
    if (!discord) return "skipped";

    const resolved = target === undefined ? await resolveLiveTarget(stream.user_id) : target;
    if (!resolved) return "skipped";

    const roleId = resolved.settings.live_role_id;
    if (!roleId) return "skipped";
    // On by default: only an explicit false opts out.
    if (resolved.preferences?.discord_live_role === false) return "skipped";

    return await grant(discord, {
      discordUserId: resolved.discordUserId,
      broadcasterId: stream.user_id,
      userId: resolved.userId,
      roleId,
    });
  } catch (error) {
    reportError(error, "eventsub.stream-online.discord-live-role", { broadcasterUserId: stream.user_id, streamId: stream.id });
    return "skipped";
  }
}

/** Takes the live role away again. Keys on the grant row, so it works without a Discord lookup. Never throws. */
export async function revokeLiveRole(broadcasterId: string): Promise<"revoked" | "skipped"> {
  try {
    const discord = discordApi();
    if (!discord) return "skipped";

    const existing = await getLiveRoleGrantByBroadcaster(supabase, broadcasterId);
    if (!existing) return "skipped";

    await revoke(discord, existing);
    return "revoked";
  } catch (error) {
    reportError(error, "eventsub.stream-offline.discord-live-role", { broadcasterUserId: broadcasterId });
    return "skipped";
  }
}

export interface ReconcileResult {
  granted: number;
  revoked: number;
  /** Grants moved from a previous role to the one now configured. */
  moved: number;
  failed: number;
}

/**
 * Makes Discord match the database: everyone live, linked and opted in
 * holds the configured role, nobody else does. Discord is only called for
 * the differences, so a quiet sweep is one database round trip. A failure
 * for one member is counted and reported, never thrown.
 */
export async function reconcileLiveRoles(): Promise<ReconcileResult> {
  const result: ReconcileResult = { granted: 0, revoked: 0, moved: 0, failed: 0 };
  const discord = discordApi();
  if (!discord) return result;

  let roleId: string | null;
  let grants: DiscordLiveRoleGrant[];
  try {
    const live = liveEnv();
    const settings = live ? await getGuildSettings(supabase, live.guildId) : null;
    roleId = settings?.live_role_id ?? null;
    grants = await listLiveRoleGrants(supabase);
  } catch (error) {
    reportError(error, "discord-live-role: reconcile read");
    return result;
  }

  // No role configured: anything still handed out comes off.
  if (!roleId) {
    for (const existing of grants) {
      try {
        await revoke(discord, existing);
        result.revoked++;
      } catch (error) {
        result.failed++;
        reportError(error, "discord-live-role: reconcile revoke", { discordUserId: existing.discord_user_id });
      }
    }
    return result;
  }

  let wanted: Map<string, { broadcasterId: string; userId: string; discordUserId: string }>;
  try {
    wanted = new Map((await listLiveLinkedBroadcasters(supabase)).map((row) => [row.discordUserId, row]));
  } catch (error) {
    reportError(error, "discord-live-role: reconcile read");
    return result;
  }

  for (const existing of grants) {
    const desired = wanted.get(existing.discord_user_id);
    try {
      if (!desired) {
        await revoke(discord, existing);
        result.revoked++;
      } else if (existing.role_id !== roleId) {
        // The admin picked a different role: swap it in place.
        await removeQuietly(discord, existing.discord_user_id, existing.role_id);
        await grant(discord, { ...desired, roleId });
        result.moved++;
      }
    } catch (error) {
      result.failed++;
      reportError(error, "discord-live-role: reconcile grant", { discordUserId: existing.discord_user_id });
    }
  }

  const held = new Set(grants.map((row) => row.discord_user_id));
  for (const [discordUserId, desired] of wanted) {
    if (held.has(discordUserId)) continue;
    try {
      if ((await grant(discord, { ...desired, roleId })) === "granted") result.granted++;
    } catch (error) {
      result.failed++;
      reportError(error, "discord-live-role: reconcile grant", { discordUserId });
    }
  }

  return result;
}

interface GrantInput {
  discordUserId: string;
  broadcasterId: string;
  userId: string;
  roleId: string;
}

/**
 * Assigns and records. Someone who isn't in the server can't hold a role:
 * that's a quiet skip, and any stale record goes with it.
 */
async function grant(discord: DiscordApi, input: GrantInput): Promise<"granted" | "skipped"> {
  try {
    await discord.members.assignRole(input.discordUserId, input.roleId);
  } catch (error) {
    if (error instanceof DiscordMemberNotFoundError) {
      await deleteLiveRoleGrant(supabase, input.discordUserId);
      return "skipped";
    }
    throw error;
  }
  await upsertLiveRoleGrant(supabase, {
    discord_user_id: input.discordUserId,
    broadcaster_id: input.broadcasterId,
    user_id: input.userId,
    role_id: input.roleId,
    granted_at: new Date().toISOString(),
  });
  return "granted";
}

/** Removes and forgets. A member who left or a role that was deleted counts as removed. */
async function revoke(discord: DiscordApi, existing: DiscordLiveRoleGrant): Promise<void> {
  await removeQuietly(discord, existing.discord_user_id, existing.role_id);
  await deleteLiveRoleGrant(supabase, existing.discord_user_id);
}

async function removeQuietly(discord: DiscordApi, discordUserId: string, roleId: string): Promise<void> {
  try {
    await discord.members.removeRole(discordUserId, roleId);
  } catch (error) {
    if (error instanceof DiscordMemberNotFoundError || error instanceof DiscordRoleNotFoundError) return;
    throw error;
  }
}
