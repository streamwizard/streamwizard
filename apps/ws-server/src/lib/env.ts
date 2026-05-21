import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
})

export const env = schema.parse(process.env)
