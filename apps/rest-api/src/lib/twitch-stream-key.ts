import { supabase } from "@repo/supabase";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { getTwitchScopesByBroadcasterId } from "@repo/supabase/queries/twitch-scopes";
import { TwitchApi } from "@repo/twitch-api";
import { resolveStreamKey, type StreamKeyLookup } from "./stream-key-policy";

export type { StreamKeyLookup, StreamKeyReason } from "./stream-key-policy";

/**
 * A user's Twitch stream key on behalf of a node. Token decryption, the
 * 401-triggered refresh and the refresh log all happen inside @repo/twitch-api.
 */
export async function getStreamKeyForUser(userId: string): Promise<StreamKeyLookup> {
  try {
    const twitchUserId = await getTwitchUserIdByUserIdMaybe(supabase, userId);
    const scopes = twitchUserId ? await getTwitchScopesByBroadcasterId(supabase, twitchUserId) : null;
    const lookup = await resolveStreamKey({
      twitchUserId,
      scopes,
      fetchKey: () => new TwitchApi(twitchUserId!).streams.getStreamKey(),
    });
    if (lookup.reason !== "granted") {
      console.warn("[nodes] no Twitch stream key for user", { userId, reason: lookup.reason });
    }
    return lookup;
  } catch (err) {
    console.warn("[nodes] failed to fetch Twitch stream key", {
      userId,
      error: (err as Error).message,
    });
    return { key: null, reason: "error" };
  }
}
