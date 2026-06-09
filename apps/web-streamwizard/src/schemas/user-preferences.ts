import { z } from "zod";

export const userPreferencesSchema = z.object({
  sync_clips_on_end: z.boolean().optional(),
  memes_enabled: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
});
