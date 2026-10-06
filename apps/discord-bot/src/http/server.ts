import type { Client } from "discord.js";
import { env } from "../lib/env";
import { createInternalApp } from "./app";

/** Starts the server and returns a stop function. Always serves /health; the
 * dashboard API only when DISCORD_BOT_INTERNAL_SECRET is set. */
export function startInternalServer(client: Client): () => void {
  if (!env.DISCORD_BOT_INTERNAL_SECRET) {
    console.log("[internal-http] DISCORD_BOT_INTERNAL_SECRET not set, serving /health only");
  }
  const app = createInternalApp(client, env.DISCORD_BOT_INTERNAL_SECRET);
  const server = Bun.serve({ port: env.DISCORD_BOT_INTERNAL_PORT, fetch: app.fetch });
  console.log(`[internal-http] Listening on :${server.port}`);
  return () => server.stop();
}
