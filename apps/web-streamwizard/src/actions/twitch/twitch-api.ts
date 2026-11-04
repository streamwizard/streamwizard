"use server";
import { TwitchApi } from "@repo/twitch-api";
import { describeError } from "@repo/sentry/safe-error";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserId } from "@repo/supabase/queries/user";
import type { ChannelSearchResult, TwitchUser, TwitchGame } from "@repo/twitch-api";

export async function searchTwitchChannels(value: string, first: number = 10) {
  const supabase = await createClient();
  const twitchUserId = await getTwitchUserId(supabase);

  if (!twitchUserId) {
    console.error("Twitch user ID not found");
    return null;
  }

  try {
    const api = new TwitchApi(twitchUserId);
    return await api.search.searchChannels(value, first);
  } catch (error) {
    console.error(`[twitch-search] channel search failed: ${describeError(error)}`);
    return null;
  }
}

// Category search is public data, so it runs on the signed-in user's own
// Twitch token. Never on a caller-named broadcaster's.
export async function searchTwitchCategories(query: string, first: number = 10) {
  const supabase = await createClient();
  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) return null;
  const api = new TwitchApi(twitchUserId);
  return api.search.searchCategories(query, first);
}

export async function LookupTwitchUser(user_id: string): Promise<TwitchUser | undefined> {
  const supabase = await createClient();
  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) {
    console.error("Twitch user ID not found");
    return undefined;
  }
  const api = new TwitchApi(twitchUserId);
  return api.search.lookupUser(user_id);
}

export async function LookupTwitchGame(game_id: string): Promise<TwitchGame | undefined> {
  const supabase = await createClient();
  const twitchUserId = await getTwitchUserId(supabase);
  if (!twitchUserId) {
    console.error("Twitch user ID not found");
    return undefined;
  }
  const api = new TwitchApi(twitchUserId);
  return api.search.lookupGame(game_id);
}
