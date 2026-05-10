"use server";
import { createClient } from "@repo/supabase/next/server";
import { getUserPreferences as _getUserPreferences, updateUserPreferences as _updateUserPreferences } from "@repo/supabase/queries/user";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { z } from "zod";

export async function updateUserPreferences(user_id: string, formData: z.infer<typeof userPreferencesSchema>) {
  const supabase = await createClient();
  try {
    await _updateUserPreferences(supabase, user_id, formData);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function GetUserPreferences() {
  const supabase = await createClient();
  return _getUserPreferences(supabase);
}
