import { createHash } from "crypto";
import { Hono } from "hono";
import { supabase } from "@repo/supabase";
import { claimNodeByTokenHash, consumeClaimToken } from "@repo/supabase/queries/obs-nodes";
import { env } from "../lib/env";

const nodes = new Hono();

// Called by obs-instance-manager's install script during node setup. No
// Supabase session involved -- a fresh, untrusted VM hits this with nothing
// but the one-time claim token in the body, which is why this lives in
// rest-api (brute-force protection, security headers, audit logging already
// wired up here) instead of the session/cookie-oriented web app.
nodes.post("/claim", async (c) => {
  const body = await c.req.json();
  const { token, gpu_bus_id } = body as { token?: string; gpu_bus_id?: string };

  if (!token || !gpu_bus_id) {
    return c.json({ error: "token and gpu_bus_id are required" }, 400);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Atomic: the UPDATE itself is scoped by hash/status/expiry, so concurrent
  // claims with the same token can't both succeed (see consumeClaimToken).
  const linked = await consumeClaimToken(supabase, tokenHash, gpu_bus_id);

  if (!linked) {
    // The atomic update matched nothing -- look the row up read-only just to
    // pick the right error code; this lookup never drives the mutation.
    const node = await claimNodeByTokenHash(supabase, tokenHash);
    if (!node) {
      return c.json({ error: "Invalid claim token" }, 404);
    }
    if (node.status === "linked") {
      return c.json({ error: "This node has already been claimed" }, 409);
    }
    return c.json({ error: "Claim token has expired" }, 410);
  }

  return c.json({
    node_id: linked.id,
    supabase_url: env.SUPABASE_URL,
    supabase_service_role_key: env.SUPABASE_SECRET_KEY,
    supabase_jwt_secret: env.SUPABASE_JWT_SECRET,
  });
});

export default nodes;
