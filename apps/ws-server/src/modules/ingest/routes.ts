import { z } from "zod";
import { ingestSessionRegistrationSchema } from "@repo/schemas/ws-server";
import { trackWsAuthFailure } from "@repo/metrics";
import { badRequest, parseJsonBody } from "@/lib/parse-body";
import { authorizeService, serviceAuthConfigured } from "@/middleware/service-auth";
import { ingestSessions } from "./sessions";

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

  const body = await parseJsonBody(req, ingestSessionRegistrationSchema);
  if (!body) return badRequest();
  ingestSessions.register({
    sessionId: body.session_id,
    userId: body.user_id,
    nodeId: body.node_id,
    streamKeyId: body.stream_key_id,
    label: body.label ?? null,
  });
  return Response.json({ ok: true });
}

export async function handleEndIngestSession(req: Request, sessionId: string): Promise<Response> {
  const denied = await authorizeIngestSessions(req);
  if (denied) return denied;
  const id = z.uuid().safeParse(sessionId);
  if (!id.success) return badRequest();
  ingestSessions.end(id.data);
  return Response.json({ ok: true });
}

/** The ingest module's HTTP routes, or null when the path isn't one of them. */
export function ingestRoutes(req: Request, pathname: string): Promise<Response> | null {
  if (pathname === "/internal/ingest-sessions") return handleRegisterIngestSession(req);
  const end = SESSION_END.exec(pathname);
  if (end) return handleEndIngestSession(req, end[1]!);
  return null;
}
