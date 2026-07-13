import type { Database } from "../types/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // Fall back to the non-prefixed Doppler vars: NEXT_PUBLIC_ values are only
  // populated by an app's env.ts side-effect, which doesn't run in a
  // standalone server unless something imports it first. Reading the plain
  // names here keeps the server client working regardless of import order.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLIC_KEY!;

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
