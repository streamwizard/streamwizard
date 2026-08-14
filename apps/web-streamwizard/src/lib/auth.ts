import { createClient } from "@repo/supabase/next/server";

export async function getAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthenticated");
  const broadcasterId = data.user.user_metadata.sub as string;
  return { supabase, user: data.user, broadcasterId };
}

export type AuthContext = Awaited<ReturnType<typeof getAuthContext>>;

/**
 * getAuthContext without the throw. Server actions return an error shape rather
 * than raising, so they'd all wrap the call in the same try/catch otherwise.
 */
export async function tryAuthContext(): Promise<AuthContext | null> {
  try {
    return await getAuthContext();
  } catch {
    return null;
  }
}
