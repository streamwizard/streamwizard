import { createClient } from "@repo/supabase/next/server";
import { getTwitchScopes } from "@repo/supabase/queries/twitch-scopes";
import { missingTwitchScopes, type TwitchScopeFeature } from "@repo/schemas";

/**
 * Which of a feature's Twitch scopes the signed-in user's token lacks. Empty
 * means the page can use the feature; anything else means it should show the
 * TwitchScopeBanner so the user can grant them.
 */
export async function getMissingTwitchScopes(feature: TwitchScopeFeature): Promise<string[]> {
  const supabase = await createClient();
  return missingTwitchScopes(await getTwitchScopes(supabase), feature);
}
