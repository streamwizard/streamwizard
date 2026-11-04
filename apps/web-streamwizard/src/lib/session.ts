import { createClient } from "@repo/supabase/next/server";
import { getUserPreferences } from "@repo/supabase/queries/user";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

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

/**
 * The signed-in user, or a redirect to /login. Wrapped in React's cache() so the
 * (protected) layout and the dashboard layout share one auth call per request.
 */
export const getSessionUser = cache(async (): Promise<User> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return data.user;
});

/** The user's preferences row (RLS-scoped), read once per request. */
export const getSessionPreferencesRow = cache(async () => getUserPreferences(await createClient()));

export const getSession = cache(async (): Promise<Session> => {
  // The preferences read is RLS-scoped, so it needs no user id and can go out
  // alongside the auth check; without a session it simply finds nothing.
  const [user, prefs] = await Promise.all([getSessionUser(), getSessionPreferencesRow()]);

  return {
    user,
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
});
