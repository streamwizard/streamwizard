"use server";
import { TwitchApi } from "@repo/twitch-api";
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
    console.error(error);
    return null;
  }
}

export async function searchTwitchCategories(broadcaster_id: string, query: string, first: number = 10) {
  const api = new TwitchApi(broadcaster_id);
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
