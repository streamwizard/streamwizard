import { trackWsAuthFailure } from "@repo/metrics";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import { getBotSockets } from "@/modules/monitor";
import { REVOKED_CLOSE_CODE, revokeUser, type RevokeScope } from "./revoke";

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

/** The revoke module's HTTP routes, or null when the path isn't one of them. */
export function revokeRoutes(req: Request, pathname: string): Promise<Response> | null {
  if (pathname === "/internal/revoke") return handleInternalRevoke(req);
  const revokeNode = NODE_REVOKE.exec(pathname);
  if (revokeNode) return handleRevokeIngestNode(req, revokeNode[1]!);
  return null;
}
