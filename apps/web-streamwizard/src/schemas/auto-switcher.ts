import { z } from "zod";

export const sceneOverrideSchema = z.object({
  sceneUuid: z.string().min(1, "Invalid scene").max(200, "Invalid scene"),
  sceneName: z.string().max(200).nullable(),
  durationMinutes: z
    .number()
    .min(1, "Invalid duration")
    .max(24 * 60, "Invalid duration")
    .nullable(),
});
