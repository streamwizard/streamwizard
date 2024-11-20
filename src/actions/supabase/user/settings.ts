import { createClient } from "@/lib/supabase/server";

export default async function updateUserPreferences(user_id: string, formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .update({
      user_id,
      sync_clips_on_end: false,
    })
    .eq("id", formData.get("user_id") as string)
    .single();

  if (error) {
    console.error(error);
    return false;
  }
  return true;
}
