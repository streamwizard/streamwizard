import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";

export type AnonClient = SupabaseClient<Database>;

/**
 * Cookie-less anon client for server code that runs outside a request, such
 * as Next's unstable_cache callbacks, where the cookie-bound server client
 * cannot be used. Gets exactly what anon RLS allows and nothing more.
 *
 * Falls back to the NEXT_PUBLIC_ names for callers inside a Next app where
 * only the public vars are set; see next/server.ts for the same dance.
 */
export function createAnonClient(): AnonClient {
  return createClient<Database>(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    (process.env.SUPABASE_PUBLIC_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
