import { NextResponse } from "next/server";

import { createClient } from "@repo/supabase/next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/auth/link/discord")}`);
  }

  const { error, data } = await supabase.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: `${origin}/auth/callback/discord`,
      // The Verified Member role is granted directly by the bot once we have
      // the user's Discord ID, so we only need enough scope to link the identity.
      scopes: "identify",
    },
  });

  if (error) {
    return NextResponse.redirect(`${origin}/error`);
  }

  return NextResponse.redirect(data.url);
}
