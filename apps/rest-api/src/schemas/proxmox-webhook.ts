import { z } from "zod";

/** Body Proxmox VE / PBS posts to the notification webhook. */
export const proxmoxWebhookPayloadSchema = z.object({
  source: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().max(1000),
  message: z.string(),
  severity: z.enum(["info", "notice", "warning", "error", "unknown"]),
  timestamp: z.number().int().positive(),
  // Proxmox metadata fields are strings; accept scalars and stringify.
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
