import {z} from 'zod';

export const SpotifySongRequestSettingsSchema = z.object({
  global_queue_limit: z.number().int().min(1).max(100).optional(),
  chatter_queue_limit: z.number().int().min(1).max(100).optional(),
  live_only: z.boolean().optional(),
});