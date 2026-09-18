import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getPlatformEventIdentity, type PlatformEventIdentity } from "@repo/supabase/queries/platform-events";

// Server-only. Identity lookups for platform events (SW-334) emitted from
// web-admin actions. Emitting itself is `logPlatformEvent` in @repo/supabase.

const EMPTY_IDENTITY: PlatformEventIdentity = {
  display_name: null,
  avatar_url: null,
  twitch_username: null,
  twitch_user_id: null,
  discord_user_id: null,
};

/** Twitch and Discord ids for the event payload. Falls back to empty so a lookup failure still logs the event. */
export async function eventIdentity(userId: string): Promise<PlatformEventIdentity> {
  try {
    return await getPlatformEventIdentity(supabaseAdmin, userId);
  } catch (error) {
    reportError(error, "web-admin platform-events: identity");
    return EMPTY_IDENTITY;
  }
}

/** The acting admin, for `actor_twitch_username` and `actor_avatar_url`. */
export async function actorIdentity(
  userId: string,
): Promise<{ actor_twitch_username: string | null; actor_avatar_url: string | null }> {
  const identity = await eventIdentity(userId);
  return { actor_twitch_username: identity.twitch_username, actor_avatar_url: identity.avatar_url };
}
