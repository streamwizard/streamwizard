"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";

export async function login() {
  const supabase = createClient();
  const origin = headers().get("origin");


  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback`
    },
  });

  if (data.url) {
    redirect(data.url); // use the redirect API for your server framework
  }

  if (error) {
    console.error(error);
    redirect("/error");
  }
}
