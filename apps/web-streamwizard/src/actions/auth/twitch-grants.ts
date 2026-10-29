"use server";

import { createClient } from "@repo/supabase/next/server";
import { getTwitchScopes } from "@repo/supabase/queries/twitch-scopes";
import { TWITCH_SCOPE_FEATURES, hasTwitchFeature, type TwitchScopeFeature } from "@repo/schemas";

/**
 * The Twitch feature sets the signed-in user's token carries in full. The
 * alert box reads it to tell an alert it can turn on from one that has to ask
 * Twitch first. Empty when signed out or not yet validated.
 */
export async function getTwitchFeatureGrants(): Promise<TwitchScopeFeature[]> {
  const supabase = await createClient();
  const scopes = await getTwitchScopes(supabase);
  return TWITCH_SCOPE_FEATURES.filter((feature) => hasTwitchFeature(scopes, feature));
}
