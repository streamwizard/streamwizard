"use server";
import { TwitchApi } from "@repo/twitch-api";
import { describeError } from "@repo/sentry/safe-error";
import type { ChannelSearchResult, TwitchCategory, TwitchUser, TwitchGame } from "@repo/twitch-api";
import { tryAuthContext } from "@/lib/auth";
import { twitchIdSchema } from "@/schemas/ids";
import { twitchSearchSchema } from "@/schemas/twitch";

// Search and lookups run on the app token; the signed-in check keeps them
// from being an open Helix proxy.

export async function searchTwitchChannels(value: string, first: number = 10): Promise<ChannelSearchResult[] | null> {
  const ctx = await tryAuthContext();
  if (!ctx) return null;
  const parsed = twitchSearchSchema.safeParse({ query: value, first });
  if (!parsed.success) return null;

  try {
    const api = new TwitchApi(ctx.broadcasterId);
    return await api.search.searchChannels(parsed.data.query, parsed.data.first);
  } catch (error) {
    console.error(`[twitch-search] channel search failed: ${describeError(error)}`);
    return null;
  }
}

// Category search is public data, so it runs on the signed-in user's own
// Twitch token. Never on a caller-named broadcaster's.
export async function searchTwitchCategories(query: string, first: number = 10): Promise<TwitchCategory[] | null> {
  const ctx = await tryAuthContext();
  if (!ctx) return null;
  const parsed = twitchSearchSchema.safeParse({ query, first });
  if (!parsed.success) return null;

  const api = new TwitchApi(ctx.broadcasterId);
  return api.search.searchCategories(parsed.data.query, parsed.data.first);
}

export async function LookupTwitchUser(user_id: string): Promise<TwitchUser | undefined> {
  const ctx = await tryAuthContext();
  if (!ctx) return undefined;
  const parsed = twitchIdSchema.safeParse(user_id);
  if (!parsed.success) return undefined;

  const api = new TwitchApi(ctx.broadcasterId);
  return api.search.lookupUser(parsed.data);
}

export async function LookupTwitchGame(game_id: string): Promise<TwitchGame | undefined> {
  const ctx = await tryAuthContext();
  if (!ctx) return undefined;
  const parsed = twitchIdSchema.safeParse(game_id);
  if (!parsed.success) return undefined;

  const api = new TwitchApi(ctx.broadcasterId);
  return api.search.lookupGame(parsed.data);
}
