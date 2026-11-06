import { z } from "zod";

// The window messages between our viewer page and the relay that
// obs-instance-manager serves next to the Selkies client on the node (OIM
// services/proxy/viewer-relay/relay.ts and docs/PANEL_INTEGRATION.md). The
// relay pairs on `sw-hello`, passes a short allowlist on to Selkies, and
// reports status and expiry back. Clipboard sync is Selkies' own (Ctrl+C and
// Ctrl+V inside the frame), so no clipboard text crosses here.

const relayMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sw-ready"), version: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal("viewer-expired") }),
  // true while the browser's autoplay rule holds the sound back. Only a click
  // inside the frame lifts it; a click on our page doesn't reach the frame.
  z.object({ type: z.literal("audio-state"), blocked: z.boolean() }),
  z.object({
    type: z.literal("pipelineStatusUpdate"),
    video: z.boolean().optional(),
    audio: z.boolean().optional(),
  }),
  z.object({ type: z.literal("clientRoleUpdate"), role: z.string().min(1).max(32) }),
]);

export type RelayMessage = z.infer<typeof relayMessageSchema>;

/** What we send the relay. It drops anything else. */
export type ViewerCommand =
  | { type: "sw-hello" }
  | { type: "setMute"; value: boolean }
  | { type: "setVolume"; value: number };

interface MessageEventLike {
  data: unknown;
  origin: string;
  source: unknown;
}

/**
 * A message from the relay in our frame, or null. Only the node's origin
 * (from the trusted viewer URL, never the query string) and the frame's own
 * window count; everything is parsed before use.
 */
export function parseRelayMessage(
  event: MessageEventLike,
  expected: { origin: string; source: unknown },
): RelayMessage | null {
  if (expected.source == null || event.source !== expected.source || event.origin !== expected.origin) return null;
  const parsed = relayMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : null;
}
