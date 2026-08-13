import { broadcastToUser, postInternal, type BroadcastConfig, type BroadcastResult } from "@repo/ws-client";
import { env } from "./env";

const wsConfig: BroadcastConfig = {
  wsServerUrl: env.WS_SERVER_URL,
  consumerSecret: env.CONSUMER_SECRET,
};

function logFailure(label: string, context: string, result: BroadcastResult): void {
  if (result.ok || result.reason === "unconfigured") return;
  if (result.reason === "status") {
    console.error(`[ws-server] ${label} push failed status=${result.status} ${context}`);
  } else {
    console.error(`[ws-server] ${label} push failed`, result.error);
  }
}

/**
 * Fan a message out to a user's overlay room via ws-server's HTTP injection
 * point. rest-api holds no bot socket — this is its transport for the same
 * fan-out the bot does over its persistent connection. Best-effort like
 * notifyStreamStatus below; the caller's DB write is the durable truth.
 */
export async function postInternalBroadcast(userId: string, type: string, payload: unknown): Promise<void> {
  logFailure("broadcast", `type=${type}`, await broadcastToUser(userId, type, payload, wsConfig));
}

/**
 * Tells ws-server which Twitch stream a broadcaster's room belongs to.
 *
 * ws-server resolves stream_id once, when a GPS publisher connects. A phone
 * that opens the overlay before the stream starts would otherwise log the
 * whole walk with stream_id=null. stream.online pushes the new id here and
 * stream.offline pushes null, so a long-lived room stays correct without a
 * reconnect.
 *
 * Best-effort: unconfigured or unreachable ws-server must never fail the
 * EventSub handler — the upgrade-time lookup still covers rooms opened after
 * the stream went live.
 */
export async function notifyStreamStatus(broadcasterId: string, streamId: string | null): Promise<void> {
  const result = await postInternal("/internal/stream-status", { broadcasterId, streamId }, wsConfig);
  logFailure("stream-status", `broadcaster=${broadcasterId}`, result);
}
