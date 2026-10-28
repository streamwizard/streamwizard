"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import type { TwitchScopeFeature } from "@repo/schemas";
import { reportAndRedirect } from "@/lib/report-redirect";
import { safeNextPath } from "@/lib/safe-next-path";
import { twitchAuthorizationUrl } from "@/lib/twitch-authorize";

/**
 * Re-run the Twitch authorization so the stored token gains a feature's
 * scopes. Twitch issues a token with exactly the scopes of this request, so
 * it asks for base, every product set the account is entitled to and every
 * free set it already granted, plus the one that triggered it. Scopes the
 * user granted before are approved without a consent screen, so for a
 * returning user this is a redirect bounce.
 *
 * The callback route overwrites the stored tokens and records the new scopes.
 */
export async function authorizeTwitchFeature(feature: TwitchScopeFeature | "base", next?: string | null) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const safeNext = safeNextPath(next) ?? "/dashboard";

  const headersList = await headers();
  const origin = headersList.get("origin");

  let url: string | null;
  try {
    url = await twitchAuthorizationUrl(supabase, { requested: feature, next: safeNext, origin: origin ?? "" });
  } catch (error) {
    reportAndRedirect(error, "/error?code=auth");
  }

  // A product set is only ever requested for an account that holds its
  // product, so this action cannot be used to widen consent past what the
  // account can use.
  redirect(url ?? safeNext);
}
