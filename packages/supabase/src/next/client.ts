import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export function createBrowserClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createBrowserClient();
