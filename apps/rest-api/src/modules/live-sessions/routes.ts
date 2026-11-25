import { Hono } from "hono";
import { supabaseAuth } from "@/middleware/auth";
import { clientIp } from "@/middleware/security/client-ip";
import { parseWireId } from "@/modules/live-sessions/credentials";
import { createLiveSessionSchema } from "@/modules/live-sessions/schemas";
import { createLiveSession, endLiveSession, renewLiveSession } from "@/modules/live-sessions/sessions";

// /api/live: the StreamWizard Live phone app, signed in with a Supabase
// access token (Authorization: Bearer). Mounted after the "/api/*" CORS and
// Supabase middleware in app.ts. Responses that carry a session secret are
// never cached and never logged.

const UNAUTHORIZED = { error: "Unauthorized", message: "Please sign in to access this resource" };
const SESSION_NOT_FOUND = { error: "Session not found" };

export const liveSessionRoutes = new Hono();

liveSessionRoutes.post("/sessions", supabaseAuth(), async (c) => {
  c.header("Cache-Control", "no-store");
  const user = c.var.user;
  if (!user) return c.json(UNAUTHORIZED, 401);
  const parsed = createLiveSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body" }, 400);

  const result = await createLiveSession({ userId: user.id, streamKey: parsed.data.stream_key, ip: clientIp(c) });
  if (result.ok) return c.json(result.session, 201);
  switch (result.reason) {
    case "unavailable":
      return c.json({ error: "Live streaming is not available right now" }, 503);
    case "rate_limited":
      c.header("Retry-After", String(result.retryAfterSeconds));
      return c.json({ error: "Too many attempts. Try again later." }, 429);
    case "invalid_key":
      return c.json({ error: "Invalid stream key" }, 403);
    case "failed":
      return c.json({ error: "Could not start the session" }, 500);
  }
});

liveSessionRoutes.post("/sessions/:session_id/end", supabaseAuth(), async (c) => {
  const user = c.var.user;
  if (!user) return c.json(UNAUTHORIZED, 401);
  const wireId = parseWireId(c.req.param("session_id"));
  if (!wireId) return c.json(SESSION_NOT_FOUND, 404);
  if (!(await endLiveSession(user.id, wireId))) return c.json(SESSION_NOT_FOUND, 404);
  return c.body(null, 204);
});

// Extends the session in place (same id and secret) to now plus the
// lifetime. Every session that can't be renewed gets the same 404.
liveSessionRoutes.post("/sessions/:session_id/renew", supabaseAuth(), async (c) => {
  c.header("Cache-Control", "no-store");
  const user = c.var.user;
  if (!user) return c.json(UNAUTHORIZED, 401);
  const wireId = parseWireId(c.req.param("session_id"));
  if (!wireId) return c.json(SESSION_NOT_FOUND, 404);

  const result = await renewLiveSession(user.id, wireId);
  if (result.ok) return c.json(result.session);
  switch (result.reason) {
    case "rate_limited":
      c.header("Retry-After", String(result.retryAfterSeconds));
      return c.json({ error: "Too many attempts. Try again later." }, 429);
    case "not_found":
      return c.json(SESSION_NOT_FOUND, 404);
    case "failed":
      return c.json({ error: "Could not renew the session" }, 500);
  }
});
