import { z } from "zod";

export const commandSchema = z.object({
  trigger: z
    .string()
    .min(1, "Trigger is required")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscore"),
  response: z.string().min(1, "Response is required").max(500),
  permission: z.enum(["everyone", "moderator", "broadcaster"]).default("everyone"),
  cooldown_seconds: z.number().int().min(0).default(0),
  shared: z.boolean().default(false),
});

export type CommandFormValues = z.infer<typeof commandSchema>;


