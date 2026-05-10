import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";
import { encryptToken } from "@/server/crypto";

export async function GET(request: Request) {
  let { origin } = new URL(request.url);
  const { searchParams } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (forwardedHost && !isLocalEnv) {
    origin = `https://${forwardedHost}`;
  }

  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    if (!data.session?.provider_token || !data.session?.provider_refresh_token) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(data.session.provider_token);
    const encryptedRefreshToken = encryptToken(data.session.provider_refresh_token);


    const { error: err } = await supabase
      .from("integrations_twitch")
      .update({
        access_token_ciphertext: encryptedAccessToken.ciphertext,
        access_token_iv: encryptedAccessToken.iv,
        access_token_tag: encryptedAccessToken.authTag,
        refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
        refresh_token_iv: encryptedRefreshToken.iv,
        refresh_token_tag: encryptedRefreshToken.authTag,
      })
      .eq("user_id", data.session.user.id);

    if (err) {
      console.log(err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    await checkEventSubscriptions(data.session.user.user_metadata.sub);
    if (!error) {
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
