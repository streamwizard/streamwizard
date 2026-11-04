"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@repo/supabase/next/server";
import { twitchScopesFor } from "@repo/schemas";
import { reportAndRedirect } from "@/lib/report-redirect";
import { safeNextPath } from "@/lib/safe-next-path";
import { nextPathSchema } from "@/schemas/auth";

/** Starts Twitch sign-in, so it runs before there is a session to check. */
export async function login(next?: string | null) {
  const parsedNext = nextPathSchema.safeParse(next);
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");

  const safeNext = (parsedNext.success && safeNextPath(parsedNext.data)) || "/dashboard";

  // Already signed in: skip the round trip to Supabase and Twitch entirely.
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) redirect(safeNext);

  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback/twitch?next=${encodeURIComponent(safeNext)}`,
      // Base scopes only. Feature scopes (the stream key for cloud OBS) are
      // asked for on the page that needs them, see actions/auth/authorize-twitch.ts.
      scopes: twitchScopesFor([]).join(" "),
    },
  });

  if (error) {
    reportAndRedirect(error, "/error?code=auth");
  }

  redirect(data.url);
}
