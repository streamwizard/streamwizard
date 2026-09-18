import { createServerClient, parseCookieHeader, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";

export type RequestClient = SupabaseClient<Database>;

export interface RequestClientInput {
  /** Raw `Cookie` request header, if any. */
  cookieHeader?: string | null;
  /** Raw `Authorization` request header, forwarded so bearer tokens work too. */
  authorizationHeader?: string | null;
  /** Writes one refreshed session cookie onto the response. */
  setCookie: (name: string, value: string, options?: CookieOptions) => void;
}

/**
 * Per-request SSR client for non-Next servers (Hono and friends): reads the
 * session from cookies or a bearer header and writes refreshed cookies back
 * through the adapter the caller provides. Next apps use next/server.ts.
 */
export function createRequestClient(input: RequestClientInput): RequestClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLIC_KEY;
  if (!url) throw new Error("SUPABASE_URL missing!");
  if (!key) throw new Error("SUPABASE_PUBLIC_KEY missing!");

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(input.cookieHeader ?? "").filter(
          (cookie): cookie is { name: string; value: string } => cookie.value !== undefined,
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => input.setCookie(name, value, options));
      },
    },
    global: {
      headers: { Authorization: input.authorizationHeader ?? "" },
    },
  });
}
