import { supabase } from "@repo/supabase";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { TwitchApi } from "@repo/twitch-api";

/**
 * A user's Twitch stream key on behalf of a node. Token decryption, the
 * 401-triggered refresh and the refresh log all happen inside @repo/twitch-api.
 *
 * Null when there's no Twitch integration or the lookup failed — non-fatal,
 * OBS then shows its "Enter Stream Key" screen.
 */
export async function getStreamKeyForUser(userId: string): Promise<string | null> {
  try {
    const twitchUserId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
    if (!twitchUserId) return null;
    return await new TwitchApi(twitchUserId).streams.getStreamKey();
  } catch (err) {
    console.warn("[nodes] failed to fetch Twitch stream key", {
      userId,
      error: (err as Error).message,
    });
    return null;
  }
}
