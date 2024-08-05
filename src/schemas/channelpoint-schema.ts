import { z } from "zod";

export const ChannelPointSchema = z.object({
  title: z.string().min(1).max(45),
  cost: z.number().min(1).max(1000000),
  prompt: z.string().min(0).max(200).optional(),
  background_color: z.string().min(1).max(200).optional(),
  is_enabled: z.boolean().default(true),

  is_user_input_required: z.boolean().default(false),

  is_max_per_stream_enabled: z.boolean().default(false),
  max_per_stream: z.number().min(1).max(1000000).optional(),

  is_max_per_user_per_stream_enabled: z.boolean().default(false),
  max_per_user_per_stream: z.number().min(1).max(1000000).optional(),

  is_global_cooldown_enabled: z.boolean().default(false),
  global_cooldown_seconds: z.number().min(60).max(86400).optional(),

  // Use the actionsTuple in the z.enum() function
});

export type ChannelPointSchema = z.infer<typeof ChannelPointSchema>;
