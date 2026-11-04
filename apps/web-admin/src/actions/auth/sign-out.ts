"use server";

import { redirect } from "next/navigation";
import { reportError } from "@repo/sentry";
import { createClient } from "@repo/supabase/next/server";

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    // The login page is still the right place to land: the proxy refuses a
    // session it can't verify.
    reportError(error, "auth.sign-out");
  }
  redirect("/login");
}
