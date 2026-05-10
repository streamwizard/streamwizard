import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

import type { Database } from "@/types/supabase";

export function createSupabaseClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const supabase = createSupabaseClient();
