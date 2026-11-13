import type { SmpWaitlistEntry } from "@repo/supabase/queries/smp/waitlist";
import type { SmpStreamLanguage } from "@/schemas/smp";
import type { DiscordStatus } from "@/server/discord/status";

/**
 * Where a visitor is in the SMP sign-up on /smp. Each step is true on the
 * server before the stepper shows it as done; nothing here trusts the browser.
 */
export type SmpSignupState =
  | { step: "signed_out" }
  | { step: "link_discord" }
  | { step: "join_discord" }
  /** Steps one to three are done. `streamLanguage` is the channel's own, to start the form on. */
  | { step: "form"; streamLanguage: SmpStreamLanguage | null }
  | { step: "done"; entry: SmpWaitlistEntry }
  /** Signed in, but the database or Discord did not answer. The stepper offers a retry. */
  | { step: "unavailable" };

/** Passed in, so the loader runs without a session, a database or Discord in tests. */
export interface SmpSignupDeps {
  /** Null for a visitor who is not signed in. */
  getUserId: () => Promise<string | null>;
  getEntry: (userId: string) => Promise<SmpWaitlistEntry | null>;
  getDiscordStatus: (userId: string) => Promise<DiscordStatus>;
  getStreamLanguage: () => Promise<SmpStreamLanguage | null>;
  reportError: (error: unknown, context: string) => void;
}

export async function loadSmpSignupState(deps: SmpSignupDeps): Promise<SmpSignupState> {
  const userId = await deps.getUserId();
  if (!userId) return { step: "signed_out" };

  try {
    // Someone on the waitlist passed the Discord steps when they applied, so
    // their later visits skip the Discord call.
    const entry = await deps.getEntry(userId);
    if (entry) return { step: "done", entry };

    const discordStatus = await deps.getDiscordStatus(userId);
    if (discordStatus === "not_linked") return { step: "link_discord" };
    if (discordStatus === "not_member") return { step: "join_discord" };
  } catch (error) {
    // Not "link Discord": sending a linked user to link again ends in an error
    // page. A failed check is its own state.
    deps.reportError(error, "smp.signup-state");
    return { step: "unavailable" };
  }

  // The prefill is a convenience. Without it the field starts empty.
  const streamLanguage = await deps.getStreamLanguage().catch(() => null);
  return { step: "form", streamLanguage };
}
