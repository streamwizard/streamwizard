import { z } from "zod";

// ─── conduit.shard.disabled ──────────────────────────────────────────────────

export const ConduitShardDisabledEventSchema = z.object({
  conduit_id: z.string(),
  shard_id: z.string(),
  status: z.enum([
    "webhook_callback_verification_failed",
    "webhook_callback_verification_pending",
    "notification_failures_exceeded",
    "websocket_disconnected",
    "websocket_failed_ping_pong",
    "websocket_received_inbound_traffic",
    "websocket_internal_error",
    "websocket_network_timeout",
    "websocket_network_error",
    "websocket_failed_to_reconnect",
  ]),
  transport: z.object({
    method: z.enum(["websocket", "webhook"]),
    session_id: z.string().optional(),
    connected_at: z.string().optional(),
    disconnected_at: z.string().optional(),
    callback: z.string().optional(),
  }),
});

export type ConduitShardDisabledEvent = z.infer<typeof ConduitShardDisabledEventSchema>;