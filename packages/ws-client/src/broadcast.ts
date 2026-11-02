/**
 * Server-to-server fan-out into a user's ws-server room.
 *
 * ws-server exposes POST /internal/broadcast as the injection point for
 * processes that hold no bot socket (the Next apps and rest-api). Every caller
 * used to hand-roll the same fetch: ws:// → http:// rewrite, bearer secret,
 * 3s timeout. They differ only in what they do with a failure, so this returns
 * a typed result instead of deciding for them.
 *
 * Each call carries a fresh 60-second service token for that one action when
 * the service has WS_SERVICE_SIGNING_JWK (@repo/service-token); otherwise the
 * legacy shared secret, for environments that haven't moved over yet.
 */

import { serviceAuthHeader, type ServiceScope } from "@repo/service-token";

export interface BroadcastConfig {
  /** ws-server base URL. `ws://`/`wss://` is rewritten to http(s) automatically. */
  wsServerUrl: string | null | undefined;
  /** Legacy shared secret, used only when this service has no
   *  WS_SERVICE_SIGNING_JWK. Neither = no push. */
  consumerSecret?: string | null;
  /** Defaults to 3s — a push must never outlive the request that triggered it. */
  timeoutMs?: number;
}

export type BroadcastResult =
  /** Delivered to ws-server (not necessarily to a connected client). */
  | { ok: true }
  /** No ws-server URL, or no signing key and no secret — pushes are off here. */
  | { ok: false; reason: "unconfigured" }
  /** ws-server answered, but not with 2xx. */
  | { ok: false; reason: "status"; status: number }
  /** Never reached ws-server (DNS, connection refused, timeout). */
  | { ok: false; reason: "network"; error: unknown }
  /** WS_SERVICE_SIGNING_JWK is set but unusable — a config bug, not an outage. */
  | { ok: false; reason: "signing"; error: unknown };

export function toHttpUrl(wsServerUrl: string): string {
  return wsServerUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

const SCOPE_BY_PATH = {
  "/internal/broadcast": "broadcast",
  "/internal/revoke": "revoke",
} as const satisfies Record<string, ServiceScope>;
export type InternalPath = keyof typeof SCOPE_BY_PATH;

/** POST to one of ws-server's service-gated `/internal/*` endpoints. */
export function postInternal(path: InternalPath, body: unknown, config: BroadcastConfig): Promise<BroadcastResult> {
  return postScoped(path, SCOPE_BY_PATH[path], body, config);
}

async function postScoped(
  path: string,
  scope: ServiceScope,
  body: unknown,
  config: BroadcastConfig,
): Promise<BroadcastResult> {
  const { wsServerUrl, consumerSecret, timeoutMs = 3_000 } = config;
  if (!wsServerUrl) return { ok: false, reason: "unconfigured" };

  let authorization: string | null;
  try {
    authorization = await serviceAuthHeader(scope, consumerSecret);
  } catch (error) {
    return { ok: false, reason: "signing", error };
  }
  if (!authorization) return { ok: false, reason: "unconfigured" };

  try {
    const res = await fetch(`${toHttpUrl(wsServerUrl)}${path}`, {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? { ok: true } : { ok: false, reason: "status", status: res.status };
  } catch (error) {
    return { ok: false, reason: "network", error };
  }
}

export function broadcastToUser(
  userId: string,
  type: string,
  payload: unknown,
  config: BroadcastConfig,
): Promise<BroadcastResult> {
  return postInternal("/internal/broadcast", { userId, type, payload }, config);
}

/**
 * Asks ws-server to end a user's live sockets after their credential changed:
 * "scene" re-checks overlay keys (after a key reset or scene delete), "session"
 * closes dashboard sockets, "all" closes everything (ban, account deletion).
 */
export function revokeUserSockets(
  userId: string,
  scope: "scene" | "session" | "all",
  config: BroadcastConfig,
): Promise<BroadcastResult> {
  return postInternal("/internal/revoke", { userId, scope }, config);
}

export interface IngestSessionRegistration {
  session_id: string;
  user_id: string;
  node_id: string;
  stream_key_id: string;
  label: string | null;
}

/**
 * Tells ws-server about a session rest-api just opened for an ingest node, so
 * the node's live samples can be routed to the right user. Service token
 * only (scope ingest-sessions): there is no legacy secret for it.
 */
export function registerIngestSession(session: IngestSessionRegistration, config: BroadcastConfig): Promise<BroadcastResult> {
  return postScoped("/internal/ingest-sessions", "ingest-sessions", session, { ...config, consumerSecret: null });
}

/** Marks an ingest session ended in ws-server's registry. */
export function endIngestSessionOnWs(sessionId: string, config: BroadcastConfig): Promise<BroadcastResult> {
  return postScoped(
    `/internal/ingest-sessions/${encodeURIComponent(sessionId)}/end`,
    "ingest-sessions",
    {},
    { ...config, consumerSecret: null },
  );
}

/** Closes every live ws-server socket of an ingest node (after it was deleted). */
export function revokeIngestNodeSockets(nodeId: string, config: BroadcastConfig): Promise<BroadcastResult> {
  return postScoped(`/internal/ingest-nodes/${encodeURIComponent(nodeId)}/revoke`, "revoke", {}, config);
}
