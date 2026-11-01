import { envSchema } from "./schemas/env";

export const env = envSchema.parse(process.env);
