import { reportError } from "@repo/sentry";
import { revokeUserSockets } from "@repo/ws-client";
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
    reportError(result.reason === "network" ? result.error : new Error(`ws-server revoke failed status=${result.status}`), "ws-revoke", { scope });
  }
}
