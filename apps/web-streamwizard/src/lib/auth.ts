import { createClient } from "@repo/supabase/next/server";

export async function getAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthenticated");
  const broadcasterId = data.user.user_metadata.sub as string;
  return { supabase, user: data.user, broadcasterId };
}
