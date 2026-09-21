import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@repo/supabase/next/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";
import { encryptToken } from "@repo/supabase/crypto";
import { updateTwitchTokens } from "@repo/supabase/queries/user";
import { setTwitchScopesByUserId } from "@repo/supabase/queries/twitch-scopes";
import { validateTwitchToken } from "@repo/twitch-api";
import { captureServerEvent } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";

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
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard";

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
    try {
      const validation = await validateTwitchToken(data.session.provider_token);
      const { error: scopeErr } = await setTwitchScopesByUserId(supabase, data.session.user.id, validation.scopes);
      if (scopeErr) throw scopeErr;
    } catch (scopeErr) {
      reportError(scopeErr, "auth/callback/twitch: scope sync failed");
    }

    await checkEventSubscriptions(data.session.user.user_metadata.sub);
    if (!error) {
      // The other side of `login_clicked`: without this the OAuth funnel has a
      // click and then silence, and drop-off at Twitch is invisible.
      // `is_new_user` is what makes this a signup count: the event fires on
      // every login, and the client-side onboarding events only exist for
      // visitors who accepted analytics. Supabase creates the auth user during
      // this same exchange, so a minute-old account is a first login.
      try {
        const createdAt = Date.parse(data.session.user.created_at);
        captureServerEvent(
          data.session.user.id,
          "login_completed",
          {
            destination: next.includes("onboarding") ? "onboarding" : "dashboard",
            is_new_user: Number.isFinite(createdAt) && Date.now() - createdAt < 60_000,
          },
          request,
        );
      } catch (phErr) {
        reportError(phErr, "auth/callback/twitch: posthog capture failed");
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
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
