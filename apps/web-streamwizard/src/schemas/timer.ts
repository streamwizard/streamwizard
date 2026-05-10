import { z } from "zod";

export const timerSchema = z.object({
  message: z.string().min(1, "Message is required").max(500),
  interval_minutes: z.number().int().min(1).max(180).default(15),
  enabled: z.boolean().default(true),
});

export type TimerFormValues = z.infer<typeof timerSchema>;


