import "server-only";
import { checkProductAccess } from "@repo/supabase/queries/subscriptions";
import { getTwitchScopes } from "@repo/supabase/queries/twitch-scopes";
import {
  TWITCH_SCOPE_FEATURES,
  TWITCH_SCOPE_FEATURE_PRODUCTS,
  twitchAuthorizationFeatures,
  twitchScopesFor,
  type TwitchScopeFeature,
} from "@repo/schemas";
import type { createClient } from "@repo/supabase/next/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Product feature sets the signed-in account holds the product for. */
async function entitledProductFeatures(supabase: Client): Promise<TwitchScopeFeature[]> {
  const entitled: TwitchScopeFeature[] = [];
  for (const feature of TWITCH_SCOPE_FEATURES) {
    const product = TWITCH_SCOPE_FEATURE_PRODUCTS[feature];
    if (product && (await checkProductAccess(supabase, product))) entitled.push(feature);
  }
  return entitled;
}

/**
 * Start a Twitch authorization for the signed-in user and return the URL to
 * send them to, or null when `requested` is a product set they do not hold.
 *
 * The scope list keeps everything the account already has (see
 * twitchAuthorizationFeatures), because Twitch replaces the token with
 * exactly what this request asks for. Scopes granted before are approved
 * without a consent screen, so for a returning user this is a bounce.
 *
 * `granted` overrides the stored scopes: the callback passes the token it is
 * about to replace, since by then the stored list already holds the new one.
 */
export async function twitchAuthorizationUrl(
  supabase: Client,
  {
    requested,
    next,
    origin,
    granted,
    reason = requested,
  }: {
    requested: TwitchScopeFeature | "base";
    next: string;
    origin: string;
    granted?: readonly string[] | null;
    /** What the callback records as `scope_upgrade`. */
    reason?: string;
  }
): Promise<string | null> {
  const entitled = await entitledProductFeatures(supabase);
  if (requested !== "base" && TWITCH_SCOPE_FEATURE_PRODUCTS[requested] && !entitled.includes(requested)) {
    return null;
  }

  const features = twitchAuthorizationFeatures({
    entitled,
    granted: granted === undefined ? await getTwitchScopes(supabase) : granted,
    requested,
  });

  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      // `scope_upgrade` tells the callback this is a signed-in user granting
      // more rights, so it does not count the round trip as a login.
      redirectTo: `${origin}/auth/callback/twitch?next=${encodeURIComponent(next)}&scope_upgrade=${reason}`,
      scopes: twitchScopesFor(features).join(" "),
    },
  });
  if (error) throw error;
  return data.url;
}
