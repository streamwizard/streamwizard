import { authorizeService, serviceAuthConfigured } from "../lib/service-auth";
import type { BotBroadcastMessage } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { routeBotBroadcast } from "../bot-router";
import { revokeUser, type RevokeScope } from "../revoke";
import { ingestSessions } from "../ingest-sessions";
import { getBotSockets } from "../monitor";
import { REVOKED_CLOSE_CODE } from "../revoke";

/**
 * The plain-HTTP surface of ws-server: a liveness probe plus two injection
 * points for processes that hold no bot socket (the Next apps and rest-api),
 * each gated by a service token for that action (lib/service-auth.ts).
 * Everything else on this server is a WebSocket upgrade.
 */

// Server-to-server injection of a bot-shaped broadcast over plain HTTP —
// lets web server actions push config/override changes to the consumer feed
// (and the user's room) with a fetch instead of a WS handshake.
export async function handleInternalBroadcast(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!serviceAuthConfigured("broadcast")) {
    return new Response("Not Found", { status: 404 });
  }
  const auth = await authorizeService(req.headers.get("authorization"), "broadcast");
  if (!auth.ok) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }

  let msg: BotBroadcastMessage;
  try {
    msg = (await req.json()) as BotBroadcastMessage;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }
  if (typeof msg.userId !== "string" || msg.userId.length === 0 || typeof msg.type !== "string" || msg.type.length === 0) {
    return new Response("Bad Request: userId and type are required", { status: 400 });
  }

  const { delivered } = routeBotBroadcast(msg, `internal-http:${auth.service}`);
  return Response.json({ ok: true, delivered });
}

const REVOKE_SCOPES = new Set<RevokeScope>(["scene", "session", "all"]);

// Server-to-server credential revocation. The apps call it right after a
// change that should end live sockets: an overlay key reset or scene delete
// ("scene": re-check that user's overlay tokens), a ban or account deletion
// ("all"). See revoke.ts.
export async function handleInternalRevoke(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!serviceAuthConfigured("revoke")) {
    return new Response("Not Found", { status: 404 });
  }
  const auth = await authorizeService(req.headers.get("authorization"), "revoke");
  if (!auth.ok) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { userId?: unknown; scope?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    return new Response("Bad Request: userId is required", { status: 400 });
  }
  if (typeof body.scope !== "string" || !REVOKE_SCOPES.has(body.scope as RevokeScope)) {
    return new Response('Bad Request: scope must be "scene", "session" or "all"', { status: 400 });
  }

  const closed = await revokeUser(body.userId, body.scope as RevokeScope);
  if (closed > 0) console.log(`[revoke] user=${body.userId} scope=${body.scope} closed=${closed}`);
  return Response.json({ ok: true, closed });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_END = /^\/internal\/ingest-sessions\/([^/]+)\/end$/;

// The live ingest session registry (ingest-sessions.ts), fed by rest-api when
// it opens and ends a session for a node. Only rest-api may call these.
async function authorizeIngestSessions(req: Request): Promise<Response | null> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!serviceAuthConfigured("ingest-sessions")) return new Response("Not Found", { status: 404 });
  const auth = await authorizeService(req.headers.get("authorization"), "ingest-sessions");
  if (!auth.ok) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export async function handleRegisterIngestSession(req: Request): Promise<Response> {
  const denied = await authorizeIngestSessions(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }
  const { session_id, user_id, node_id, stream_key_id, label } = body;
  const ids = [session_id, user_id, node_id, stream_key_id];
  if (!ids.every((v) => typeof v === "string" && UUID.test(v)) || (label !== null && label !== undefined && typeof label !== "string")) {
    return new Response("Bad Request: session_id, user_id, node_id and stream_key_id must be UUIDs", { status: 400 });
  }
  ingestSessions.register({
    sessionId: session_id as string,
    userId: user_id as string,
    nodeId: node_id as string,
    streamKeyId: stream_key_id as string,
    label: (label as string | null | undefined) ?? null,
  });
  return Response.json({ ok: true });
}

export async function handleEndIngestSession(req: Request, sessionId: string): Promise<Response> {
  const denied = await authorizeIngestSessions(req);
  if (denied) return denied;
  if (!UUID.test(sessionId)) return new Response("Bad Request: session id must be a UUID", { status: 400 });
  ingestSessions.end(sessionId);
  return Response.json({ ok: true });
}

const NODE_REVOKE = /^\/internal\/ingest-nodes\/([^/]+)\/revoke$/;

/** Closes every live socket of one ingest node (it was deleted). The node
 *  can't open a new one: rest-api only signs ingest-node tokens for a node
 *  that still exists. */
export async function handleRevokeIngestNode(req: Request, nodeId: string): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!serviceAuthConfigured("revoke")) return new Response("Not Found", { status: 404 });
  const auth = await authorizeService(req.headers.get("authorization"), "revoke");
  if (!auth.ok) {
    trackWsAuthFailure("bot", "invalid_bot_key");
    return new Response("Unauthorized", { status: 401 });
  }
  if (!UUID.test(nodeId)) return new Response("Bad Request: node id must be a UUID", { status: 400 });

  let closed = 0;
  for (const ws of getBotSockets().values()) {
    if (ws.data.role === "ingest-node" && ws.data.ingestNodeId === nodeId) {
      ws.close(REVOKED_CLOSE_CODE, "node revoked");
      closed++;
    }
  }
  if (closed > 0) console.log(`[revoke] ingest node=${nodeId} closed=${closed}`);
  return Response.json({ ok: true, closed });
}

export function handleInternalRoute(req: Request, pathname: string): Promise<Response> | Response | null {
  if (pathname === "/health") return Response.json({ ok: true });
  if (pathname === "/internal/broadcast") return handleInternalBroadcast(req);
  if (pathname === "/internal/revoke") return handleInternalRevoke(req);
  if (pathname === "/internal/ingest-sessions") return handleRegisterIngestSession(req);
  const end = SESSION_END.exec(pathname);
  if (end) return handleEndIngestSession(req, end[1]!);
  const revokeNode = NODE_REVOKE.exec(pathname);
  if (revokeNode) return handleRevokeIngestNode(req, revokeNode[1]!);
  return null;
}
