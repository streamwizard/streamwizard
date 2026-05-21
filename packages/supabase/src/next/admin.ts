import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

let _supabaseAdmin: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createAdminClient();
    }
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
