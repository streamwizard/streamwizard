import { supabaseAdmin } from "@repo/supabase/next/admin";
import { createUserStateService } from "@repo/user-state";
import type { UserStateUpdatePayload } from "@repo/types";
import { env } from "./env";

/**
 * The widget route's user-state service. Web-overlay holds no bot socket, so
 * pushes go over ws-server's /internal/broadcast HTTP endpoint — the same
 * server-to-server path rest-api uses for stream-status. Best-effort by
 * design (the service already treats broadcast failures as log-and-continue);
 * unconfigured CONSUMER_SECRET simply means no live push.
 */
async function broadcastUserState(userId: string, payload: UserStateUpdatePayload): Promise<void> {
  if (!env.WS_SERVER_URL || !env.CONSUMER_SECRET) return;

  const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
  const res = await fetch(`${httpUrl}/internal/broadcast`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CONSUMER_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ userId, type: "streamwizard.user_state", payload }),
    signal: AbortSignal.timeout(3_000),
  });
  if (!res.ok) {
    throw new Error(`internal/broadcast responded ${res.status}`);
  }
}

export const userStateService = createUserStateService({
  client: supabaseAdmin,
  broadcast: broadcastUserState,
});
