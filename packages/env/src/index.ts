import { z } from "zod";
import { resolve, dirname, join } from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

const parseEnvContent = (envContent: string) => {
  envContent.split("\n").forEach((line) => {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("#")) return;

    const normalizedLine = trimmedLine.startsWith("export ")
      ? trimmedLine.slice(7)
      : trimmedLine;

    const [key, ...valueParts] = normalizedLine.split("=");
    if (key && valueParts.length > 0) {
      const rawValue = valueParts.join("=").trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      const envKey = key.trim();

      // Only set if not already set (allows override)
      if (!process.env[envKey]) {
        process.env[envKey] = value;
      }
    }
  });
};

const findEnvPath = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const maxDepth = 8;
  const fileNames = [".env.local", ".env"];

  const searchFrom = (startDir: string) => {
    let dir = startDir;
    for (let i = 0; i <= maxDepth; i++) {
      for (const f of fileNames) {
        if (existsSync(join(dir, f))) return join(dir, f);
      }
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  };

  // /*turbopackIgnore: true*/ prevents Turbopack from tracing process.cwd() across
  // the whole project tree when building Next.js apps.
  return searchFrom(join(/*turbopackIgnore: true*/ process.cwd(), ".")) ?? searchFrom(__dirname) ?? null;
};

// Load env file by searching upward from cwd and package path.
const loadEnvFile = () => {
  const envPath = findEnvPath();

  if (envPath) {
    const envContent = readFileSync(envPath, "utf-8");
    parseEnvContent(envContent);
  }
};

// Next.js loads .env.local automatically before any module runs.
// Only use the filesystem fallback in standalone Node.js contexts (e.g. bot services).
if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  loadEnvFile();
}

// Fallbacks for Next.js NEXT_PUBLIC_* naming conventions so shared packages
// work in both Next.js apps and standalone backend services.
if (!process.env.TWITCH_CLIENT_ID && process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID) {
  process.env.TWITCH_CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
}
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}
if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
if (!process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Environment variables schema
 * These are validated at runtime and must be present for the app to start
 */
const envSchema = z.object({
  // Twitch API Configuration
  TWITCH_CLIENT_ID: z.string().min(1, "TWITCH_CLIENT_ID is required"),
  TWITCH_CLIENT_SECRET: z.string().min(1, "TWITCH_CLIENT_SECRET is required"),
  TWITCH_WEBHOOK_SECRET: z.string().min(1, "TWITCH_WEBHOOK_SECRET is required"),

  // Encryption Configuration
  TOKEN_ENCRYPTION_KEY: z.string().min(1, "TOKEN_ENCRYPTION_KEY is required"),

  // Supabase Configuration
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Minecraft WebSocket (only required by the bot service)
  MINECRAFT_WS_AUTH_TOKEN: z.string().optional(),

  // InfluxDB Configuration (optional - metrics disabled if not set)
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_TOKEN: z.string().optional(),
  INFLUXDB_ORG: z.string().optional(),
  INFLUXDB_BUCKET: z.string().optional(),

  // // Discord Bot
  // DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  // DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
});

/**
 * Validates and parses environment variables
 * Throws an error with detailed message if validation fails
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

/**
 * Validated environment variables
 * Type-safe and guaranteed to be present
 *
 * @example
 * import { env } from "@repo/env";
 *
 * const clientId = env.TWITCH_CLIENT_ID;
 * const supabaseUrl = env.SUPABASE_URL;
 */
export const env = validateEnv();

/**
 * Type of the environment variables
 * Useful for dependency injection or testing
 */
export type Env = z.infer<typeof envSchema>;
