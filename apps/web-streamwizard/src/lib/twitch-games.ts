import "server-only";
import { unstable_cache } from "next/cache";
import { TwitchApi } from "@repo/twitch-api";

/*
 * Category names for public pages. Clip rows carry game_id but not game_name
 * (the dashboard resolves names through the Twitch API), and the landing page
 * has no logged-in user to borrow a token from, so this runs on the app token
 * like the showcase clip videos do.
 *
 * Category names effectively never change, so the map is cached for a day. Any
 * failure resolves to an empty map: callers treat a missing name as "no
 * category" rather than blocking the page on Twitch being up.
 */

/** Twitch takes up to 100 ids per /games call. */
const HELIX_GAMES_LIMIT = 100;

async function fetchGameNames(gameIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(gameIds.filter(Boolean))].slice(0, HELIX_GAMES_LIMIT);
  if (ids.length === 0) return {};

  try {
    const games = await new TwitchApi().search.lookupGames(ids);
    return Object.fromEntries(games.map((game) => [game.id, game.name]));
  } catch (error) {
    console.error("[twitch-games] lookup failed", error);
    return {};
  }
}

/** id → category name, for the ids Twitch knows. Unknown ids are absent. */
export async function getGameNames(gameIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(gameIds.filter(Boolean))].sort();
  if (ids.length === 0) return {};

  /* The id list is part of the cache key: a different set of clips looks up a
   * different set of categories. */
  return unstable_cache(() => fetchGameNames(ids), ["twitch-game-names", ids.join(",")], {
    revalidate: 60 * 60 * 24,
  })();
}
