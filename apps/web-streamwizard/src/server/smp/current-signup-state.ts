import "server-only";

import { reportError } from "@repo/sentry";
import { getSmpWaitlistEntry } from "@repo/supabase/queries/smp/waitlist";
import { tryAuthContext } from "@/lib/auth";
import { getDiscordStatusForUser } from "@/server/discord/user-status";
import { loadSmpSignupState, type SmpSignupState } from "@/server/smp/signup-state";
import { getSmpStreamLanguage } from "@/server/smp/twitch";

/** The sign-up state of whoever the session cookie says is signed in. */
export async function loadCurrentSmpSignupState(): Promise<SmpSignupState> {
  const ctx = await tryAuthContext();
  if (!ctx) return { step: "signed_out" };

  return loadSmpSignupState({
    getUserId: async () => ctx.user.id,
    getEntry: (userId) => getSmpWaitlistEntry(ctx.supabase, userId),
    getDiscordStatus: (userId) => getDiscordStatusForUser(ctx.supabase, userId),
    getStreamLanguage: () => getSmpStreamLanguage(ctx.broadcasterId),
    reportError,
  });
}
