import { z } from "zod";
import { idSchema } from "./ids";

export const toggleDefaultCommandSchema = z.object({ defaultCommandId: idSchema, enabled: z.boolean() });
