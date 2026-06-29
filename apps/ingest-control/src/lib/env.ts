import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8090),

  // Supabase (service role — control plane bypasses RLS to validate keys)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Shared secret the media plane must present on every internal call.
  INGEST_CONTROL_SECRET: z.string().min(1),

  // Output mode — where the media plane sends the passthrough feed:
  //   "obs-push"     (default) provision a per-streamer OBS container and push to
  //                  it (the production multi-tenant model).
  //   "srt-listener" the media plane exposes an SRT listener the consumer pulls
  //                  from (e.g. a local OBS). Single feed per port; no OBS
  //                  provisioning. Handy for local testing.
  INGEST_OUTPUT_MODE: z.enum(["obs-push", "srt-listener"]).default("obs-push"),
  INGEST_OUTPUT_HOST: z.string().default("0.0.0.0"),
  INGEST_OUTPUT_PORT: z.coerce.number().default(8890),

  // OBS provisioning (obs-push mode). Each streamer's OBS container LISTENS for
  // SRT on this port (addressed by container name on the docker network); the
  // media plane is the SRT caller that pushes the passthrough feed in.
  INGEST_OBS_IMAGE: z.string().default(""),
  INGEST_OBS_NETWORK: z.string().default("stream-server"),
  INGEST_OBS_SRT_PORT: z.coerce.number().default(9000),
  DOCKER_SOCKET: z.string().default("/var/run/docker.sock"),

  // Realtime fan-out — push live ingest stats to ws-server as a "bot" client so
  // a logged-in dashboard user can subscribe to their own room and watch them.
  // Optional: if unset, live broadcast is skipped (durable history via Supabase
  // still works).
  WS_SERVER_URL: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
});

export const env = schema.parse(process.env);
