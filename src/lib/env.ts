import { z } from "zod";

const envSchema = z.object({
  AUTH_SECRET: z.string(),

  // supabase
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),

  // spotify
  NEXT_PUBLIC_SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),

  // twitch
  NEXT_PUBLIC_TWITCH_CLIENT_ID: z.string(),
  TWITCH_CLIENT_SECRET: z.string(),
  TWITCH_APP_TOKEN: z.string(),
});


export const env = envSchema.parse(process.env);