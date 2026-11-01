import { reportError } from "@repo/sentry";
import { broadcastToUser, revokeUserSockets, type BroadcastConfig, type BroadcastResult } from "@repo/ws-client";
import { env } from "../env";

const wsConfig: BroadcastConfig = {
  wsServerUrl: env.WS_SERVER_URL,
  consumerSecret: env.CONSUMER_SECRET,
};

function logFailure(label: string, context: string, result: BroadcastResult): void {
  if (result.ok || result.reason === "unconfigured") return;
  // A push that fails is a broadcast a viewer never saw, and the reason is a
  // returned value rather than a throw — nothing above this frame would ever
  // see it, so report it here or it stays invisible.
  if (result.reason === "status") {
    reportError(new Error(`ws-server ${label} push failed status=${result.status}`), "ws-server.push", {
      label,
      status: result.status,
      context,
    });
  } else {
    reportError(result.error, "ws-server.push", { label, context });
  }
}

/**
 * Fan a message out to a user's overlay room via ws-server's HTTP injection
 * point. rest-api holds no bot socket — this is its transport for the same
 * fan-out the bot does over its persistent connection. Best-effort; the
 * caller's DB write is the durable truth.
 */
export async function postInternalBroadcast(userId: string, type: string, payload: unknown): Promise<void> {
  logFailure("broadcast", `type=${type}`, await broadcastToUser(userId, type, payload, wsConfig));
}

/** Ends every live ws-server socket of a deleted user. Best-effort, like the broadcast above. */
export async function revokeAllUserSockets(userId: string): Promise<void> {
  logFailure("revoke", "scope=all", await revokeUserSockets(userId, "all", wsConfig));
}
