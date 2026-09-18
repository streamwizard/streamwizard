import type { Client } from "discord.js";
import { env } from "../lib/env";
import { createInternalApp } from "./app";

/** Starts the server when DISCORD_BOT_INTERNAL_SECRET is set; returns a stop function. */
export function startInternalServer(client: Client): (() => void) | null {
  if (!env.DISCORD_BOT_INTERNAL_SECRET) {
    console.log("[internal-http] DISCORD_BOT_INTERNAL_SECRET not set, internal server disabled");
    return null;
  }
  const app = createInternalApp(client, env.DISCORD_BOT_INTERNAL_SECRET);
  const server = Bun.serve({ port: env.DISCORD_BOT_INTERNAL_PORT, fetch: app.fetch });
  console.log(`[internal-http] Listening on :${server.port}`);
  return () => server.stop();
}
