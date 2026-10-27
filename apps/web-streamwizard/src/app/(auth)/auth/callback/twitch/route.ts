import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@repo/supabase/next/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";
import { encryptToken } from "@repo/supabase/crypto";
import { updateTwitchTokens } from "@repo/supabase/queries/user";
import { getTwitchScopes, setTwitchScopesByUserId } from "@repo/supabase/queries/twitch-scopes";
import { lostTwitchFeatures } from "@repo/schemas";
import { validateTwitchToken } from "@repo/twitch-api";
import { track } from "@/lib/track";
import { reportError } from "@repo/sentry";
import { safeNextPath } from "@/lib/safe-next-path";
import { twitchAuthorizationUrl } from "@/lib/twitch-authorize";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const isLocalEnv = process.env.NODE_ENV === "development";

  // Use the configured base URL in production to prevent x-forwarded-host spoofing
  const origin = isLocalEnv
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_BASE_URL ?? requestUrl.origin);

  const code = searchParams.get("code");
  // Sanitize next to a relative path only to prevent open redirect
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  // Set when a signed-in user is granting more rights (authorizeTwitchFeature),
  // or when this callback sent them round again to keep what they had.
  const scopeUpgradeParam = searchParams.get("scope_upgrade");
  const scopeUpgrade = scopeUpgradeParam && /^[a-z_]{1,32}$/.test(scopeUpgradeParam) ? scopeUpgradeParam : null;

  const oauthError = searchParams.get("error");
  const oauthErrorCode = searchParams.get("error_code");
  const oauthErrorDescription = searchParams.get("error_description");

  const errorRedirect = (reason: string) =>
    NextResponse.redirect(`${origin}/auth/auth-code-error?provider=twitch&reason=${reason}`);

  if (oauthError) {
    console.error("[twitch callback] OAuth provider returned an error", {
      error: oauthError,
      error_code: oauthErrorCode,
      error_description: oauthErrorDescription,
    });
  }

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      console.error("[twitch callback] exchangeCodeForSession failed", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
      });
      return errorRedirect("exchange_failed");
    }

    if (
      !data.session?.provider_token ||
      !data.session?.provider_refresh_token
    ) {
      console.error("[twitch callback] missing provider tokens on session", {
        hasProviderToken: !!data.session?.provider_token,
        hasProviderRefreshToken: !!data.session?.provider_refresh_token,
        userId: data.session?.user?.id,
      });
      return errorRedirect("missing_tokens");
    }

    // The token this one replaces, read before it is overwritten: a plain
    // sign-in asks for base only, and anything it dropped is put back below.
    const scopesBefore = scopeUpgrade ? null : await getTwitchScopes(supabase);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(data.session.provider_token);
    const encryptedRefreshToken = encryptToken(
      data.session.provider_refresh_token,
    );

    const { error: err } = await updateTwitchTokens(
      supabase,
      data.session.user.id,
      {
        access_token_ciphertext: encryptedAccessToken.ciphertext,
        access_token_iv: encryptedAccessToken.iv,
        access_token_tag: encryptedAccessToken.authTag,
        refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
        refresh_token_iv: encryptedRefreshToken.iv,
        refresh_token_tag: encryptedRefreshToken.authTag,
      },
    );

    if (err) {
      console.error("[twitch callback] updateTwitchTokens failed", err);
      return errorRedirect("token_save_failed");
    }

    // Supabase hands over the token but not its scope list, and Twitch issues
    // exactly the scopes of this authorization, so ask id.twitch.tv what the
    // new token carries. The dashboard reads this to decide whether a feature
    // still has to ask for its scopes. Best-effort: the hourly sweep in
    // rest-api fills it in if this call fails.
    let grantedScopes: string[] | null = null;
    try {
      const validation = await validateTwitchToken(data.session.provider_token);
      grantedScopes = validation.scopes;
      const { error: scopeErr } = await setTwitchScopesByUserId(supabase, data.session.user.id, validation.scopes);
      if (scopeErr) throw scopeErr;
    } catch (scopeErr) {
      reportError(scopeErr, "auth/callback/twitch: scope sync failed");
    }

    /*
     * A plain sign-in asks for base only, and Twitch replaces the token with
     * exactly that, which would quietly take back a granted stream key or
     * alert permission. Go round once more for them: Twitch approves scopes
     * the user granted before without a consent screen. `scope_upgrade` on
     * the way back stops this from looping.
     */
    if (!scopeUpgrade && grantedScopes && lostTwitchFeatures(scopesBefore, grantedScopes).length > 0) {
      try {
        const url = await twitchAuthorizationUrl(supabase, {
          requested: "base",
          next,
          origin,
          granted: scopesBefore,
          reason: "restore",
        });
        if (url) return NextResponse.redirect(url);
      } catch (restoreErr) {
        // Not fatal: the user is signed in, the feature asks again when used.
        reportError(restoreErr, "auth/callback/twitch: restoring scopes failed");
      }
    }

    await checkEventSubscriptions(data.session.user.user_metadata.sub, grantedScopes);
    if (!error) {
      // The other side of `login_clicked`: without this the OAuth funnel has a
      // click and then silence, and drop-off at Twitch is invisible.
      // `is_new_user` is what makes this a signup count: the event fires on
      // every login, and the client-side onboarding events only exist for
      // visitors who accepted analytics. Supabase creates the auth user during
      // this same exchange, so a minute-old account is a first login.
      //
      // A signed-in user granting extra Twitch rights (authorizeTwitchFeature)
      // comes back through this same callback. That is not a login, and
      // counting it as one inflated the number.
      // "restore" is the second leg of a sign-in that kept earlier grants
      // (above), so it counts as the login, once.
      if (scopeUpgrade && scopeUpgrade !== "restore") {
        await track("twitch_scope_granted", { feature: scopeUpgrade }, data.session.user);
      } else {
        const createdAt = Date.parse(data.session.user.created_at);
        await track(
          "login_completed",
          {
            destination: next.includes("onboarding") ? "onboarding" : "dashboard",
            is_new_user: Number.isFinite(createdAt) && Date.now() - createdAt < 60_000,
          },
          data.session.user,
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Saying no to more rights is not a failed sign-in: the user is still signed
  // in with the token they had, so send them back to where they asked.
  if (oauthError === "access_denied" && scopeUpgrade) {
    const back = new URL(next, origin);
    back.searchParams.set("twitch_scope", "declined");
    return NextResponse.redirect(back.toString());
  }

  if (oauthError) {
    return errorRedirect(oauthError === "access_denied" ? "access_denied" : "provider_error");
  }

  console.error("[twitch callback] no code and no error param on request", {
    url: requestUrl.toString(),
  });

  // return the user to an error page with instructions
  return errorRedirect("missing_code");
}
