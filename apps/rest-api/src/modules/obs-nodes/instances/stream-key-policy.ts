import { missingTwitchScopes } from "@repo/schemas";

/**
 * Why a stream key is or is not available. The node treats `scope_missing`
 * and `no_integration` as "do not boot": the user has to connect Twitch on the
 * cloud OBS page first. `error` is a lookup failure on our side, which the
 * node tolerates with a keyless boot rather than punishing the user for it.
 */
export type StreamKeyReason = "granted" | "no_integration" | "scope_missing" | "error";

export interface StreamKeyLookup {
  key: string | null;
  reason: StreamKeyReason;
}

export interface StreamKeyDeps {
  twitchUserId: string | null;
  scopes: string[] | null;
  fetchKey: () => Promise<string>;
}

/**
 * The decision, kept apart from the Supabase and Twitch lookups so it can be
 * tested without either.
 */
export async function resolveStreamKey({ twitchUserId, scopes, fetchKey }: StreamKeyDeps): Promise<StreamKeyLookup> {
  if (!twitchUserId) return { key: null, reason: "no_integration" };
  if (missingTwitchScopes(scopes, "cloud_obs").length > 0) return { key: null, reason: "scope_missing" };
  try {
    return { key: await fetchKey(), reason: "granted" };
  } catch {
    return { key: null, reason: "error" };
  }
}
