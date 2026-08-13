import { env } from "./env";

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
/**
 * Fan a message out to a user's overlay room via ws-server's HTTP injection
 * point. rest-api holds no bot socket — this is its transport for the same
 * fan-out the bot does over its persistent connection. Best-effort like
 * notifyStreamStatus below; the caller's DB write is the durable truth.
 */
export async function postInternalBroadcast(
  userId: string,
  type: string,
  payload: unknown
): Promise<void> {
  if (!env.WS_SERVER_URL || !env.CONSUMER_SECRET) return;

  const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");

  try {
    const res = await fetch(`${httpUrl}/internal/broadcast`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CONSUMER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId, type, payload }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      console.error(`[ws-server] broadcast push failed status=${res.status} type=${type}`);
    }
  } catch (error) {
    console.error("[ws-server] broadcast push failed", error);
  }
}

export async function notifyStreamStatus(broadcasterId: string, streamId: string | null): Promise<void> {
  if (!env.WS_SERVER_URL || !env.CONSUMER_SECRET) return;

  const httpUrl = env.WS_SERVER_URL.replace(/^ws:/, "http:").replace(/^wss:/, "https:");

  try {
    const res = await fetch(`${httpUrl}/internal/stream-status`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CONSUMER_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ broadcasterId, streamId }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      console.error(`[ws-server] stream-status push failed status=${res.status} broadcaster=${broadcasterId}`);
    }
  } catch (error) {
    console.error("[ws-server] stream-status push failed", error);
  }
}
