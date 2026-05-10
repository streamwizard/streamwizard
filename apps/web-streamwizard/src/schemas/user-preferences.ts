import { z } from "zod";

export const userPreferencesSchema = z.object({
  sync_clips_on_end: z.boolean().optional(),
});
