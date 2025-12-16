"use server";
import { createClient } from "@/lib/supabase/server";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { z } from "zod";

export async function updateUserPreferences(user_id: string, formData: z.infer<typeof userPreferencesSchema>) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user_id,
        ...formData,
      },
      {
        onConflict: "user_id",
      }
    )
    .eq("user_id", user_id)
    .single();

  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

export async function GetUserPreferences() {
  const supabase = await createClient();

  const { data, error } = await supabase.from("user_preferences").select("*").single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error(error);
    throw error;
  }
  return data;
}
