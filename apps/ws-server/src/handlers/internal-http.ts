import { timingSafeEqual } from "crypto";
import { env } from "../lib/env";
import type { BotBroadcastMessage } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { routeBotBroadcast } from "../bot-router";
import { revokeUser, type RevokeScope } from "../revoke";

/**
 * The plain-HTTP surface of ws-server: a liveness probe plus two secret-gated
 * injection points for processes that hold no bot socket (the Next apps and
 * rest-api). Everything else on this server is a WebSocket upgrade.
 */

export function isValidSecret(candidate: string | null | undefined, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate ?? "");
  const secretBuf = Buffer.from(secret);
  return candidateBuf.length === secretBuf.length && timingSafeEqual(candidateBuf, secretBuf);
}

// Server-to-server injection of a bot-shaped broadcast over plain HTTP —
// lets web server actions push config/override changes to the consumer feed
// (and the user's room) with a fetch instead of a WS handshake.
export async function handleInternalBroadcast(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!env.CONSUMER_SECRET) {
    return new Response("Not Found", { status: 404 });
  }
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!isValidSecret(key, env.CONSUMER_SECRET)) {
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

  const { delivered } = routeBotBroadcast(msg, "internal-http");
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
  if (!env.CONSUMER_SECRET) {
    return new Response("Not Found", { status: 404 });
  }
  const key = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!isValidSecret(key, env.CONSUMER_SECRET)) {
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
