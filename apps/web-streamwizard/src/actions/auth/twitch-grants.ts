"use server";

import { getTwitchScopes } from "@repo/supabase/queries/twitch/scopes";
import { TWITCH_SCOPE_FEATURES, hasTwitchFeature, type TwitchScopeFeature } from "@repo/schemas/twitch-scopes";
import { tryAuthContext } from "@/lib/auth";

/**
 * The Twitch feature sets the signed-in user's token carries in full. The
 * alert box reads it to tell an alert it can turn on from one that has to ask
 * Twitch first. Empty when signed out or not yet validated.
 */
export async function getTwitchFeatureGrants(): Promise<TwitchScopeFeature[]> {
  const ctx = await tryAuthContext();
  if (!ctx) return [];
  const scopes = await getTwitchScopes(ctx.supabase);
  return TWITCH_SCOPE_FEATURES.filter((feature) => hasTwitchFeature(scopes, feature));
}
