import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@repo/supabase/next/server";
import { getTwitchUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { cookies } from "next/headers";

/**
 * The caller's Twitch user id, taken only from places the user cannot edit.
 *
 * Never read user_metadata.sub for this: user_metadata is writable by the
 * signed-in user (supabase.auth.updateUser / PUT /auth/v1/user), so anyone
 * could point it at another streamer's id, and service-role callers such as
 * deleteAccount would then act on that streamer. GoTrue writes identity_data
 * from the Twitch provider itself. Password accounts (the local smoke user)
 * have no Twitch identity, so they fall back to their own integration row.
 */
export async function resolveBroadcasterId(supabase: SupabaseClient, user: User): Promise<string | null> {
  const twitch = user.identities?.find((identity) => identity.provider === "twitch");
  const fromIdentity = twitch?.identity_data?.provider_id ?? twitch?.identity_data?.sub;
  if (typeof fromIdentity === "string" && fromIdentity) return fromIdentity;
  return getTwitchUserIdByUserIdMaybe(supabase, user.id);
}

export async function getAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthenticated");
  const broadcasterId = await resolveBroadcasterId(supabase, data.user);
  if (!broadcasterId) throw new Error("No Twitch account linked");
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

/**
 * Whether the visitor *looks* signed in, judged only by the presence of the
 * Supabase session cookie.
 *
 * This is a label hint for public chrome, not an authorization check. It never
 * touches the network: `supabase.auth.getUser()` would fire GET /auth/v1/user
 * on every signed-in page view, and it would be answering a question the proxy
 * (packages/supabase/src/next/proxy.ts) already answers with getClaims() on the
 * same request. The gates that actually matter are that proxy's
 * PROTECTED_PREFIXES redirect and the (protected) layout.
 *
 * Worst case a cookie outlives its session and someone is offered "Dashboard"
 * when they are really signed out. They click, the proxy sends them to /login,
 * and the cookie is gone by the next render.
 */
export async function hasSessionCookie(): Promise<boolean> {
  // @supabase/ssr writes sb-<project-ref>-auth-token, splitting it into
  // .0/.1 chunks when the session outgrows the 4KB cookie limit.
  const cookieStore = await cookies();
  return cookieStore.getAll().some((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
}
