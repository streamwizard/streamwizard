"use server";

import { revalidatePath } from "next/cache";
import { MissLimiter } from "@repo/ttl-cache/miss-limiter";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getSmpWaitlistEntry,
  insertSmpWaitlistEntry,
  updateSmpMinecraftAccount,
} from "@repo/supabase/queries/smp/waitlist";
import { toActionError, zodErrorMessage } from "@/lib/action-error";
import { tryAuthContext } from "@/lib/auth";
import { track } from "@/lib/tracking/track";
import { minecraftNameSchema, smpWaitlistSchema } from "@/schemas/smp";
import { getDiscordStatusForUser } from "@/server/discord/user-status";
import { resolveMinecraftProfile } from "@/server/minecraft/profile";
import { applyToSmpWaitlist, changeSmpMinecraftName, type SmpFailure } from "@/server/smp/apply";
import { getSmpTwitchSnapshot } from "@/server/smp/twitch";

/*
 * The SMP waitlist on /smp. Both actions take the account from the session,
 * never from the caller, and the Twitch channel with it.
 *
 * The table gives users read access only, so the writes below use the service
 * role, after the session check, and always for `ctx.user.id`.
 */

export type SmpWaitlistActionResult = { success: true } | SmpFailure;

const UNAUTHORIZED: SmpWaitlistActionResult = { success: false, error: "Sign in first." };
const RATE_LIMITED: SmpWaitlistActionResult = {
  success: false,
  error: "Too many tries. Wait a few minutes and try again.",
};
const INVALID = "Check the form and try again.";
const FAILED = "That didn't save. Try again.";

// Every attempt costs a Mojang lookup, and a submit a few Twitch and Discord
// calls on top. Per account, per process: enough for typos, not for a script.
const attempts = new MissLimiter({ limit: 10, windowMs: 10 * 60_000 });

function rateLimited(userId: string): boolean {
  if (attempts.isBlocked(userId)) return true;
  attempts.recordMiss(userId);
  return false;
}

export async function joinSmpWaitlist(input: unknown): Promise<SmpWaitlistActionResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = smpWaitlistSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodErrorMessage(parsed.error, INVALID) };
  if (rateLimited(ctx.user.id)) return RATE_LIMITED;

  try {
    const result = await applyToSmpWaitlist(
      {
        hasEntry: async () => (await getSmpWaitlistEntry(ctx.supabase, ctx.user.id)) !== null,
        getDiscordStatus: () => getDiscordStatusForUser(ctx.supabase, ctx.user.id),
        resolveProfile: resolveMinecraftProfile,
        getTwitchSnapshot: () => getSmpTwitchSnapshot(ctx.broadcasterId),
        insertEntry: (application) => insertSmpWaitlistEntry(supabaseAdmin, ctx.user.id, application),
      },
      parsed.data,
    );
    if (!result.success) return result;

    await track(
      "smp_waitlist_joined",
      {
        broadcaster_type: result.twitch.broadcasterType ?? "unknown",
        stream_language: parsed.data.streamLanguage,
        stream_frequency: parsed.data.streamFrequency,
      },
      ctx.user,
    );
    revalidatePath("/smp");
    return { success: true };
  } catch (error) {
    return { success: false, error: toActionError(error, "actions/smp/waitlist.join", FAILED, { userId: ctx.user.id }) };
  }
}

export async function updateSmpMinecraftName(input: unknown): Promise<SmpWaitlistActionResult> {
  const ctx = await tryAuthContext();
  if (!ctx) return UNAUTHORIZED;
  const parsed = minecraftNameSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: zodErrorMessage(parsed.error, INVALID) };
  if (rateLimited(ctx.user.id)) return RATE_LIMITED;

  try {
    const result = await changeSmpMinecraftName(
      {
        resolveProfile: resolveMinecraftProfile,
        updateAccount: (account) => updateSmpMinecraftAccount(supabaseAdmin, ctx.user.id, account),
      },
      parsed.data,
    );
    if (!result.success) return result;

    await track("smp_minecraft_name_updated", {}, ctx.user);
    revalidatePath("/smp");
    return { success: true };
  } catch (error) {
    return { success: false, error: toActionError(error, "actions/smp/waitlist.rename", FAILED, { userId: ctx.user.id }) };
  }
}
