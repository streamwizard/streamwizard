import type { BotBroadcastMessage } from "@repo/types";
import { trackWsAuthFailure } from "@repo/metrics";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import { routeBotBroadcast } from "./route-broadcast";

// Server-to-server injection of a bot-shaped broadcast over plain HTTP —
// lets web server actions push config/override changes to the consumer feed
// (and the user's room) with a fetch instead of a WS handshake. Gated by a
// service token for the "broadcast" action (middleware/service-auth.ts).
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

/** The broadcast module's HTTP routes, or null when the path isn't one of them. */
export function broadcastRoutes(req: Request, pathname: string): Promise<Response> | null {
  if (pathname === "/internal/broadcast") return handleInternalBroadcast(req);
  return null;
}
