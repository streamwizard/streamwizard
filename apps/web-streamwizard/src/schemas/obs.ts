import { guidSchema } from "@repo/schemas/ids";
import { z } from "zod";
import { USER_NODE_SCOPES } from "@repo/node-token";

export const mintNodeTokenSchema = z.object({
  instanceId: guidSchema,
  scope: z.enum(USER_NODE_SCOPES),
});

/** Passed through to the node's POST /instances; nothing in the app sets them today. */
export const launchInstanceOptionsSchema = z
  .object({
    resolution: z
      .string()
      .regex(/^\d{3,4}x\d{3,4}$/)
      .optional(),
    template: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional(),
  })
  .strict();
