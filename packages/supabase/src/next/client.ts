import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export function createBrowserClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
