import { createClient } from "@repo/supabase/next/server";
import { getUserPreferences } from "@repo/supabase/queries/user";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export interface SessionPreferences {
  memes_enabled: boolean;
  sync_clips_on_end: boolean;
  onboarding_completed: boolean;
  show_stream_stats: boolean;
  discord_live_notifications: boolean;
  discord_live_role: boolean;
}

export interface Session {
  user: User;
  preferences: SessionPreferences;
}

const defaultPreferences: SessionPreferences = {
  memes_enabled: true,
  sync_clips_on_end: true,
  onboarding_completed: false,
  show_stream_stats: true,
  discord_live_notifications: true,
  discord_live_role: true,
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
      onboarding_completed: prefs?.onboarding_completed ?? defaultPreferences.onboarding_completed,
      show_stream_stats: prefs?.show_stream_stats ?? defaultPreferences.show_stream_stats,
      discord_live_notifications:
        prefs?.discord_live_notifications ?? defaultPreferences.discord_live_notifications,
      discord_live_role: prefs?.discord_live_role ?? defaultPreferences.discord_live_role,
    },
  };
}
