import { authorizeService, serviceAuthConfigured } from "../lib/service-auth";
import type { BotBroadcastMessage } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { routeBotBroadcast } from "../bot-router";
import { revokeUser, type RevokeScope } from "../revoke";

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

export function handleInternalRoute(req: Request, pathname: string): Promise<Response> | Response | null {
  if (pathname === "/health") return Response.json({ ok: true });
  if (pathname === "/internal/broadcast") return handleInternalBroadcast(req);
  if (pathname === "/internal/revoke") return handleInternalRevoke(req);
  return null;
}
