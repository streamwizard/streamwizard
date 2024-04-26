import { z } from "zod";

export const CommandSchema = z.object({
  command: z.string().max(50),
  message: z.string().max(500),
  userlevel: z.enum(["everyone", "follower","vip", "subscriber",  "moderator", "super_moderator", "broadcaster"]),
  cooldown: z.number().int().min(0),
  status: z.boolean(),
  action: z.string().max(50),
});


export type CommandSchemaType = z.infer<typeof CommandSchema>;