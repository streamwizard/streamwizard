"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { reportError } from "@repo/sentry";
import { createClient } from "@repo/supabase/next/server";

// No arguments. redirect() is how this action answers: Next turns its
// NEXT_REDIRECT throw into a navigation, so it is the one throw allowed here.

export async function signInWithTwitch() {
  let url: string | null = null;
  try {
    const supabase = await createClient();
    const headerStore = await headers();
    const origin = headerStore.get("origin") ?? "http://localhost:3003";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "twitch",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (!error) url = data.url;
  } catch (error) {
    reportError(error, "auth.sign-in");
  }

  redirect(url ?? "/login?error=oauth_failed");
}
