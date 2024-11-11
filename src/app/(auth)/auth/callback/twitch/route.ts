import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  console.log("twitch callback called");

  const { searchParams, origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer

  console.log(`forwardedHost: ${forwardedHost}`);

  console.log(`origin in callback: ${origin}`);

  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    // check if the user is in the whitelist
    const { data: whitelistData, error: whitelistError } = await supabaseAdmin
      .from("whitelist")
      .select("email")
      .eq("email", data.session?.user.email!)
      .eq("whitelisted", true);

    if (whitelistError) {
      console.log(whitelistError);
      return NextResponse.redirect(`${origin}/unauthorized`);
    }

    if (!whitelistData || whitelistData.length === 0) {
      return NextResponse.redirect(`${origin}/unauthorized`);
    }

    const { error: err } = await supabase
      .from("integrations_twitch")
      .update({
        access_token: data.session?.provider_token,
        refresh_token: data.session?.provider_refresh_token,
      })
      .eq("user_id", data.session.user.id);

    if (err) {
      console.log(err);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer

      console.log(`forwardedHost: ${forwardedHost}`);

      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
