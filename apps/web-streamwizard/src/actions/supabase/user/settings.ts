"use server";
import { updateUserPreferences as _updateUserPreferences } from "@repo/supabase/queries/user";
import { userPreferencesSchema } from "@/schemas/user-preferences";
import { z } from "zod";
import { reportError } from "@repo/sentry";
import { tryAuthContext } from "@/lib/auth";
import { track } from "@/lib/track";

type UserPreferences = z.infer<typeof userPreferencesSchema>;

export async function updateUserPreferences(formData: UserPreferences) {
  const ctx = await tryAuthContext();
  if (!ctx) return false;
  const parsed = userPreferencesSchema.safeParse(formData);
  if (!parsed.success) return false;

  try {
    await _updateUserPreferences(ctx.supabase, ctx.user.id, parsed.data);
    await track("preferences_saved", parsed.data, ctx.user);
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}

// Persists in-progress onboarding values without marking onboarding as
// complete — used before navigating away for the Discord OAuth round trip,
// since the wizard's step/values otherwise only live in client state and
// would be lost when the browser leaves the page.
export async function saveOnboardingProgress(preferences: Partial<UserPreferences>) {
  const ctx = await tryAuthContext();
  if (!ctx) return false;
  const parsed = userPreferencesSchema.safeParse(preferences);
  if (!parsed.success) return false;

  try {
    await _updateUserPreferences(ctx.supabase, ctx.user.id, parsed.data);
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}

export async function completeOnboarding(preferences: UserPreferences) {
  const ctx = await tryAuthContext();
  if (!ctx) return false;
  const parsed = userPreferencesSchema.safeParse(preferences);
  if (!parsed.success) return false;

  try {
    await _updateUserPreferences(ctx.supabase, ctx.user.id, { ...parsed.data, onboarding_completed: true });
    await track(
      "onboarding_completed",
      {
        memes_enabled: parsed.data.memes_enabled,
        sync_clips_on_end: parsed.data.sync_clips_on_end,
        show_stream_stats: parsed.data.show_stream_stats,
      },
      ctx.user,
    );
    return true;
  } catch (error) {
    reportError(error, "actions/user/settings");
    return false;
  }
}
