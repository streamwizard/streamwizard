import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import checkEventSubscriptions from "@/server/twitch/eventsub/check-event-subscriptions";

export async function GET(request: Request) {
  let { searchParams, origin } = new URL(request.url);
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

   
    
    await checkEventSubscriptions(data.session.user.user_metadata.sub);

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
