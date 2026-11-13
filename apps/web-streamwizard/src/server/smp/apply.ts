import type { SmpWaitlistApplication, SmpWaitlistWriteResult } from "@repo/supabase/queries/smp/waitlist";
import type { MinecraftNameInput, SmpWaitlistInput } from "@/schemas/smp";
import type { DiscordStatus } from "@/server/discord/status";
import type { MinecraftProfileLookup } from "@/server/minecraft/profile";

/*
 * The decisions behind the two SMP waitlist actions, without the session, the
 * database or the network: those come in as `deps`. The server action in
 * actions/smp/waitlist.ts does the auth check, the input parsing and the rate
 * limit, then calls these.
 */

export type SmpBroadcasterType = "none" | "affiliate" | "partner";

export interface SmpTwitchSnapshot {
  broadcasterType: SmpBroadcasterType | null;
  followerCount: number | null;
}

/** `field` is set when the error is about the Minecraft name, so the form can show it under that input. */
export interface SmpFailure {
  success: false;
  error: string;
  field?: "minecraftUsername";
}

export type SmpApplyResult = { success: true; twitch: SmpTwitchSnapshot } | SmpFailure;
export type SmpRenameResult = { success: true } | SmpFailure;

export interface SmpApplyDeps {
  hasEntry: () => Promise<boolean>;
  getDiscordStatus: () => Promise<DiscordStatus>;
  resolveProfile: (name: string) => Promise<MinecraftProfileLookup>;
  /** Best effort: resolves with nulls rather than rejecting. */
  getTwitchSnapshot: () => Promise<SmpTwitchSnapshot>;
  insertEntry: (application: SmpWaitlistApplication) => Promise<SmpWaitlistWriteResult>;
}

export interface SmpRenameDeps {
  resolveProfile: (name: string) => Promise<MinecraftProfileLookup>;
  updateAccount: (account: { minecraft_username: string; minecraft_uuid: string }) => Promise<SmpWaitlistWriteResult>;
}

export const SMP_MESSAGES = {
  alreadyApplied: "You're already on the waitlist.",
  discordFirst: "Link Discord and join the server first.",
  nameNotFound: "No Minecraft Java account has that name. Check the spelling.",
  mojangDown: "Mojang isn't answering right now. Try again in a minute.",
  accountTaken: "That Minecraft account is already on the waitlist.",
  reviewed: "Your application has been reviewed, so the name can't be changed here.",
} as const;

const fail = (error: string): SmpFailure => ({ success: false, error });
const failName = (error: string): SmpFailure => ({ success: false, error, field: "minecraftUsername" });

function profileError(profile: Exclude<MinecraftProfileLookup, { status: "found" }>): SmpFailure {
  return profile.status === "not_found" ? failName(SMP_MESSAGES.nameNotFound) : fail(SMP_MESSAGES.mojangDown);
}

function writeError(result: Exclude<SmpWaitlistWriteResult, "ok">): SmpFailure {
  if (result === "minecraft_account_taken") return failName(SMP_MESSAGES.accountTaken);
  return fail(result === "not_pending" ? SMP_MESSAGES.reviewed : SMP_MESSAGES.alreadyApplied);
}

export async function applyToSmpWaitlist(deps: SmpApplyDeps, values: SmpWaitlistInput): Promise<SmpApplyResult> {
  if (await deps.hasEntry()) return fail(SMP_MESSAGES.alreadyApplied);
  // The stepper only shows the form to a verified user, but the action is a
  // public endpoint, so the gate is checked again here.
  if ((await deps.getDiscordStatus()) !== "verified") return fail(SMP_MESSAGES.discordFirst);

  const [profile, twitch] = await Promise.all([deps.resolveProfile(values.minecraftUsername), deps.getTwitchSnapshot()]);
  if (profile.status !== "found") return profileError(profile);

  const result = await deps.insertEntry({
    minecraft_username: profile.name,
    minecraft_uuid: profile.uuid,
    average_viewers: values.averageViewers,
    stream_language: values.streamLanguage,
    stream_frequency: values.streamFrequency,
    twitch_broadcaster_type: twitch.broadcasterType,
    twitch_follower_count: twitch.followerCount,
  });
  return result === "ok" ? { success: true, twitch } : writeError(result);
}

export async function changeSmpMinecraftName(deps: SmpRenameDeps, values: MinecraftNameInput): Promise<SmpRenameResult> {
  const profile = await deps.resolveProfile(values.minecraftUsername);
  if (profile.status !== "found") return profileError(profile);

  const result = await deps.updateAccount({ minecraft_username: profile.name, minecraft_uuid: profile.uuid });
  return result === "ok" ? { success: true } : writeError(result);
}
