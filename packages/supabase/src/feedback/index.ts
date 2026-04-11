import { supabase } from "..";
import type { Database } from "../types/supabase";

export async function createFeedback(feedback: Database["public"]["Tables"]["feedback"]["Insert"]) {
  const { data, error } = await supabase.from("feedback").insert(feedback).select().single();

  if (error) {
    throw error;
  }

  return data;
}
