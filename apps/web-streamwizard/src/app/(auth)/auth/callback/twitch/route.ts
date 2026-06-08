import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@repo/supabase/next/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";
import { encryptToken } from "@repo/supabase/crypto";
import { updateTwitchTokens } from "@repo/supabase/queries/user";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const isLocalEnv = process.env.NODE_ENV === "development";

  // Use the configured site URL in production to prevent x-forwarded-host spoofing
  const origin = isLocalEnv
    ? requestUrl.origin
    : (process.env.NEXT_PUBLIC_SITE_URL ?? requestUrl.origin);

  const code = searchParams.get("code");
  // Sanitize next to a relative path only to prevent open redirect
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("://")
      ? rawNext
      : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    if (
      !data.session?.provider_token ||
      !data.session?.provider_refresh_token
    ) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
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
      console.log(err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    await checkEventSubscriptions(data.session.user.user_metadata.sub);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
