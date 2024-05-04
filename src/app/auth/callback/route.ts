import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { add_twitch_integration, get_twitch_integration, update_twitch_integration } from "@/actions/admin/supabase";
import { Twitch_integration } from "@/types/database/user";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    });

    // get the access token and refresh token
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    // add the twitch integration to the database
    const { user, session } = data;

    const twitch_user: Twitch_integration = {
      user_id: user.id,
      username: user.user_metadata.full_name,
      broadcaster_id: +user.identities![0].id,
      access_token: session.provider_token!,
      refresh_token: session.provider_refresh_token!,
      email: user.user_metadata.email,
      beta_access: false,
      is_live: false,
    };

    // check if the user already has a twitch integration
    const existing_integration = await get_twitch_integration(user.id, user.identities![0].id);

    if (existing_integration === null) {
      await add_twitch_integration(twitch_user);
    } else {
      await update_twitch_integration(user.id, user.identities![0].id, twitch_user);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);

  // return the user to an error page with instructions
}
