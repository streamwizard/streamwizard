"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function DeleteIntegrations(integration: string): Promise<{
  message?: string;
  error?: string;
}> {
  let message: string = "";
  let error: string = "";

  const supabase = createClient();
  const user_id = (await supabase.auth.getUser()).data.user?.id;

  if (!user_id) {
    throw new Error("User not found");
  }

  switch (integration) {
    case "twitch":
      error = "Cannot delete Twitch integration";
      break;

    case "spotify":
      const spotify_res = await supabase.from("spotify_integrations").delete().eq("user_id", user_id).single();
      if (spotify_res.error) {
        error = spotify_res.error.message;
      }
      message = "Spotify integration deleted";

      break;

    default:
      throw new Error("Invalid integration");
  }

  revalidatePath("/dashboard/settings");

  return { message, error };
}
