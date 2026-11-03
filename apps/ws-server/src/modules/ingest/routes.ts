import { trackWsAuthFailure } from "@repo/metrics";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import { ingestSessions } from "./sessions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_END = /^\/internal\/ingest-sessions\/([^/]+)\/end$/;

// The live ingest session registry (sessions.ts), fed by rest-api when
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

/** The ingest module's HTTP routes, or null when the path isn't one of them. */
export function ingestRoutes(req: Request, pathname: string): Promise<Response> | null {
  if (pathname === "/internal/ingest-sessions") return handleRegisterIngestSession(req);
  const end = SESSION_END.exec(pathname);
  if (end) return handleEndIngestSession(req, end[1]!);
  return null;
}
