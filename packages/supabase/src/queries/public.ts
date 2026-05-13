import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export async function getActiveTestimonials(client: DBClient) {
  return client.from("testimonials").select("*").eq("active", true);
}
