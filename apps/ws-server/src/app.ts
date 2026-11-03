import { broadcastRoutes } from "@/modules/broadcast/routes";
import { handleUpgrade } from "@/modules/connections/upgrade";
import { websocketHandlers } from "@/modules/connections/socket";
import { ingestRoutes } from "@/modules/ingest/routes";
import { revokeRoutes } from "@/modules/revoke/routes";
import type { ConnectionData } from "@/types";

type BunServer = import("bun").Server<ConnectionData>;

/**
 * The plain-HTTP surface: a liveness probe plus each module's internal routes
 * for processes that hold no bot socket (the Next apps and rest-api), each
 * gated by a service token (middleware/service-auth.ts). Everything else is a
 * WebSocket upgrade.
 */
function handleHttpRoute(req: Request, pathname: string): Promise<Response> | Response | null {
  if (pathname === "/health") return Response.json({ ok: true });
  return broadcastRoutes(req, pathname) ?? revokeRoutes(req, pathname) ?? ingestRoutes(req, pathname);
}

/** Bun.serve `fetch`: HTTP routes first, then the /ws upgrade. */
export async function fetch(req: Request, server: BunServer): Promise<Response | undefined> {
  const route = handleHttpRoute(req, new URL(req.url).pathname);
  if (route) return route;
  return handleUpgrade(req, server);
}

export const websocket = websocketHandlers;
