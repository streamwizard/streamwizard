import { reportError } from "@repo/sentry";
import { revokeIngestNodeSockets, revokeUserSockets } from "@repo/ws-client";
import { env } from "@/lib/env";

/**
 * Ends a user's live ws-server sockets after their credential changed (see
 * ws-server revoke.ts). Best-effort: ws-server's minute sweep catches overlay
 * keys this misses, so a failure is reported and never fails the action.
 */
export async function revokeWsSockets(userId: string, scope: "scene" | "session" | "all"): Promise<void> {
  const result = await revokeUserSockets(userId, scope, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (!result.ok && result.reason !== "unconfigured") {
    reportError(result.reason === "status" ? new Error(`ws-server revoke failed status=${result.status}`) : result.error, "ws-revoke", { scope });
  }
}

/** Closes a deleted ingest node's live socket to ws-server. Best effort: the
 *  node can't open a new one, since rest-api won't sign a token for it. */
export async function revokeIngestNodeWsSockets(nodeId: string): Promise<void> {
  const result = await revokeIngestNodeSockets(nodeId, {
    wsServerUrl: env.WS_SERVER_URL,
    consumerSecret: env.CONSUMER_SECRET,
  });
  if (!result.ok && result.reason !== "unconfigured") {
    reportError(result.reason === "status" ? new Error(`ws-server node revoke failed status=${result.status}`) : result.error, "ws-revoke", { nodeId });
  }
}
