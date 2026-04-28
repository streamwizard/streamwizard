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
  const startDirectories = [process.cwd(), __dirname];
  const fileNames = [".env.local", ".env"];

  for (const startDirectory of startDirectories) {
    let currentDirectory = startDirectory;

    for (let depth = 0; depth <= maxDepth; depth++) {
      for (const fileName of fileNames) {
        const candidatePath = join(currentDirectory, fileName);
        if (existsSync(candidatePath)) {
          return candidatePath;
        }
      }

      const parentDirectory = resolve(currentDirectory, "..");
      if (parentDirectory === currentDirectory) {
        break;
      }
      currentDirectory = parentDirectory;
    }
  }

  return null;
};

// Load env file by searching upward from cwd and package path.
const loadEnvFile = () => {
  const envPath = findEnvPath();

  if (envPath) {
    const envContent = readFileSync(envPath, "utf-8");
    parseEnvContent(envContent);
  }
};

// Load environment variables before validation
loadEnvFile();

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

  // Minecraft WebSocket
  // MINECRAFT_WS_AUTH_TOKEN: z.string().min(1, "MINECRAFT_WS_AUTH_TOKEN is required"),

  // // InfluxDB Configuration (optional - metrics disabled if not set)
  // INFLUXDB_URL: z.string().url().optional(),
  // INFLUXDB_TOKEN: z.string().optional(),
  // INFLUXDB_ORG: z.string().optional(),
  // INFLUXDB_BUCKET: z.string().optional(),

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
