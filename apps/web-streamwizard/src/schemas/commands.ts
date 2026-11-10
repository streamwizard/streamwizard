import { guidSchema } from "@repo/schemas/ids";
import { z } from "zod";

export const toggleDefaultCommandSchema = z.object({ defaultCommandId: guidSchema, enabled: z.boolean() });
