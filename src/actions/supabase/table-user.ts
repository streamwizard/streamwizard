"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("users").select("*").single();

  if (error || !data || data === null) {
    console.error(error);
    return null;
  }

  return data;
}
