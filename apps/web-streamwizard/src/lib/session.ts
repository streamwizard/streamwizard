import { createClient } from "@repo/supabase/next/server";
import { getUserPreferences } from "@repo/supabase/queries/user";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export interface SessionPreferences {
  memes_enabled: boolean;
  sync_clips_on_end: boolean;
}

export interface Session {
  user: User;
  preferences: SessionPreferences;
}

const defaultPreferences: SessionPreferences = {
  memes_enabled: true,
  sync_clips_on_end: false,
};

export async function getSession(): Promise<Session> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  const prefs = await getUserPreferences(supabase);

  return {
    user: data.user,
    preferences: {
      memes_enabled: prefs?.memes_enabled ?? defaultPreferences.memes_enabled,
      sync_clips_on_end: prefs?.sync_clips_on_end ?? defaultPreferences.sync_clips_on_end,
    },
  };
}
