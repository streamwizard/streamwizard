"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { TWITCH_SCOPES } from "@/lib/constant";

export async function login() {
  const supabase = await createClient();

  const headersList = await headers();
  const origin = headersList.get("origin");

  const { error, data } = await supabase.auth.signInWithOAuth({
    provider: "twitch",
    options: {
      redirectTo: `${origin}/auth/callback/twitch`,
      scopes: TWITCH_SCOPES.join(" "),
    },
  });

  if (error) {
    redirect("/error");
  }

  redirect(data.url);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}
