import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/supabase";

export type { Database, Json } from "./types/supabase";

let _supabase: ReturnType<typeof createClient<Database>> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop, receiver) {
    if (!_supabase) {
      // NEXT_PUBLIC_SUPABASE_URL is the fallback for callers running inside a
      // Next app (route handlers, server actions) where only the public var is
      // set; the key is the service key either way.
      _supabase = createClient<Database>(
        (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
        process.env.SUPABASE_SECRET_KEY!,
      );
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
