import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "../types/supabase";
import { PASSKEY_AUTH_OPTIONS } from "../auth/passkey-options";

export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: PASSKEY_AUTH_OPTIONS }
  );
}

let _supabase: ReturnType<typeof createBrowserClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      _supabase = createBrowserClient();
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
