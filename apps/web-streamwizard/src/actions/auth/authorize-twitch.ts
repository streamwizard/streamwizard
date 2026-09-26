"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { checkProductAccess } from "@repo/supabase/queries/subscriptions";
import { TWITCH_SCOPE_FEATURES, TWITCH_SCOPE_FEATURE_PRODUCTS, twitchScopesFor, type TwitchScopeFeature } from "@repo/schemas";
import { reportAndRedirect } from "@/lib/report-redirect";

/**
 * Re-run the Twitch authorization so the stored token gains a feature's
 * scopes. Twitch issues a token with exactly the scopes of this request, so
 * it asks for base plus every feature set the account is entitled to, not
 * just the one that triggered it. Scopes the user granted before are approved
 * without a consent screen, so for a returning user this is a redirect bounce.
 *
 * The callback route overwrites the stored tokens and records the new scopes.
 */
export async function authorizeTwitchFeature(feature: TwitchScopeFeature | "base", next?: string | null) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://") ? next : "/dashboard";

  // A feature set is only ever requested for an account that holds its
  // product, so this action cannot be used to widen consent past what the
  // account can use. The triggering feature must be among them.
  const entitled: TwitchScopeFeature[] = [];
  for (const candidate of TWITCH_SCOPE_FEATURES) {
    if (await checkProductAccess(supabase, TWITCH_SCOPE_FEATURE_PRODUCTS[candidate])) entitled.push(candidate);
  }
  // "base" is a scope every account gets; it comes up when base grew after the
  // token was issued (channel:read:goals for the goal widgets).
  if (feature !== "base" && !entitled.includes(feature)) redirect(safeNext);

  const headersList = await headers();
  const origin = headersList.get("origin");

  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback/twitch?next=${encodeURIComponent(safeNext)}`,
      scopes: twitchScopesFor(entitled).join(" "),
    },
  });

  if (error) {
    reportAndRedirect(error, "/error?code=auth");
  }

  redirect(data.url);
}
