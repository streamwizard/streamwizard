import { createHash, randomBytes } from "crypto";
import type { Context } from "hono";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import { claimNodeByTokenHash, consumeClaimToken, insertNodeApiKey } from "@repo/supabase/queries/obs-nodes";
import { env } from "../../../env";
import { mintTailscaleAuthKey } from "../../../lib/tailscale";

// Lowercases and replaces runs of non-alphanumerics with a single hyphen, e.g.
// "GPU Box 1" -> "gpu-box-1". The panel is the single source of truth for this
// slug -- it's computed once here and handed back in the claim response so
// install.sh can apply the exact same string as the machine's hostname,
// instead of re-deriving it in bash and risking drift.
function slugifyHostname(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "obs-node"
  );
}

// Called by obs-instance-manager's install script during node setup. No
// Supabase session involved -- a fresh, untrusted VM hits this with nothing
// but the one-time claim token in the body, which is why this lives in
// rest-api (brute-force protection, security headers, audit logging already
// wired up here) instead of the session/cookie-oriented web app.
export async function claimObsNode(c: Context) {
  const body = await c.req.json();
  const { token, gpu_bus_id, vram_total_mb, ram_total_mb, cpu_cores, gpu_model, storage_total_mb } = body as {
    token?: string;
    gpu_bus_id?: string;
    vram_total_mb?: number;
    ram_total_mb?: number;
    cpu_cores?: number;
    gpu_model?: string;
    storage_total_mb?: number;
  };

  if (!token || !gpu_bus_id) {
    return c.json({ error: "token and gpu_bus_id are required" }, 400);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the pending node first so we can derive its hostname slug from
  // the admin-chosen name before the atomic claim UPDATE below.
  const pendingNode = await claimNodeByTokenHash(supabase, tokenHash);
  const hostname = slugifyHostname(pendingNode?.name ?? "obs-node");

  // Atomic: the UPDATE itself is scoped by hash/status/expiry, so concurrent
  // claims with the same token can't both succeed (see consumeClaimToken).
  const linked = await consumeClaimToken(supabase, tokenHash, {
    gpu_bus_id,
    total_vram_mb: vram_total_mb,
    ram_total_mb,
    cpu_cores,
    gpu_model,
    storage_total_mb,
    hostname,
  });

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

  const apiKey = randomBytes(32).toString("hex");
  const { ciphertext, iv, authTag } = encryptToken(apiKey);
  await insertNodeApiKey(supabase, linked.id, {
    type: "rest_api",
    key_hash: createHash("sha256").update(apiKey).digest("hex"),
    key_ciphertext: ciphertext,
    key_iv: iv,
    key_tag: authTag,
  });

  // Per-node command key for the obs-auto-switcher's /obs route. The node only
  // ever learns its SHA-256 hash (via GET /api/obs-nodes/me), never the plaintext,
  // so unlike node_api_key this is deliberately NOT returned in the response.
  const commandKey = randomBytes(32).toString("hex");
  const commandEnc = encryptToken(commandKey);
  await insertNodeApiKey(supabase, linked.id, {
    type: "obs_command",
    key_hash: createHash("sha256").update(commandKey).digest("hex"),
    key_ciphertext: commandEnc.ciphertext,
    key_iv: commandEnc.iv,
    key_tag: commandEnc.authTag,
  });

  // Single-use key so install.sh can `tailscale up` without an admin pasting
  // one in. The tailnet is how the node's OBS containers pull SRT from an
  // ingest node, and one of the two addresses its API is bound to (the other
  // is loopback, for the node's Cloudflare Tunnel). null (Tailscale API down
  // / OAuth client not scoped to tag:obs-node) is tolerated on the node side
  // with a warning. See lib/tailscale.ts.
  const tailscaleAuthKey = await mintTailscaleAuthKey({
    nodeId: linked.id,
    tag: "tag:obs-node",
    description: `obs-node claim ${linked.id}`,
  });

  return c.json({
    node_id: linked.id,
    node_api_key: apiKey,
    hostname: linked.hostname,
    tailscale_authkey: tailscaleAuthKey,
    rest_api_url: env.STREAMWIZARD_API_URL,
    supabase_url: env.SUPABASE_URL,
    S3_ENDPOINT: env.OBS_S3_ENDPOINT,
    S3_ACCESS_KEY: env.OBS_S3_ACCESS_KEY,
    S3_SECRET_KEY: env.OBS_S3_SECRET_KEY,
    S3_BUCKET: env.OBS_S3_BUCKET,
    S3_REGION: env.OBS_S3_REGION,
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
    // Present only when rest-api itself has InfluxDB configured for this
    // environment — omitted otherwise, same as the ingest-node claim route.
    // INFLUXDB_OBS_NODE_TOKEN (write-only on obs-nodes) when set, else the shared token.
    ...(env.INFLUXDB_URL && env.INFLUXDB_ORG && (env.INFLUXDB_OBS_NODE_TOKEN ?? env.INFLUXDB_TOKEN)
      ? {
          INFLUXDB_URL: env.INFLUXDB_URL,
          INFLUXDB_ORG: env.INFLUXDB_ORG,
          INFLUXDB_TOKEN: env.INFLUXDB_OBS_NODE_TOKEN ?? env.INFLUXDB_TOKEN,
        }
      : {}),
    // Present only when both are configured on rest-api — lets the node push
    // container lifecycle events to browsers via ws-server /internal/broadcast.
    ...(env.WS_SERVER_URL && env.CONSUMER_SECRET
      ? {
          WS_SERVER_URL: env.WS_SERVER_URL,
          CONSUMER_SECRET: env.CONSUMER_SECRET,
        }
      : {}),
  });
}
