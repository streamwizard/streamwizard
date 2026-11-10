import { z } from "zod";
import { revokeRequestSchema } from "@repo/schemas/ws-server";
import { trackWsAuthFailure } from "@repo/metrics";
import { badRequest, parseJsonBody } from "@/lib/parse-body";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import { getBotSockets } from "@/modules/monitor/broadcast";
import { REVOKED_CLOSE_CODE, revokeUser } from "./revoke";

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

  const body = await parseJsonBody(req, revokeRequestSchema);
  if (!body) return badRequest();

  const closed = await revokeUser(body.userId, body.scope);
  if (closed > 0) console.log(`[revoke] user=${body.userId} scope=${body.scope} closed=${closed}`);
  return Response.json({ ok: true, closed });
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
  const id = z.uuid().safeParse(nodeId);
  if (!id.success) return badRequest();

  let closed = 0;
  for (const ws of getBotSockets().values()) {
    if (ws.data.role === "ingest-node" && ws.data.ingestNodeId === id.data) {
      ws.close(REVOKED_CLOSE_CODE, "node revoked");
      closed++;
    }
  }
  if (closed > 0) console.log(`[revoke] ingest node=${id.data} closed=${closed}`);
  return Response.json({ ok: true, closed });
}

/** The revoke module's HTTP routes, or null when the path isn't one of them. */
export function revokeRoutes(req: Request, pathname: string): Promise<Response> | null {
  if (pathname === "/internal/revoke") return handleInternalRevoke(req);
  const revokeNode = NODE_REVOKE.exec(pathname);
  if (revokeNode) return handleRevokeIngestNode(req, revokeNode[1]!);
  return null;
}
