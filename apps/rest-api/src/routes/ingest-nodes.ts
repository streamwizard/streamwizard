import { createHash, randomBytes } from "crypto";
import { Hono } from "hono";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import {
  claimIngestNodeByTokenHash,
  consumeIngestClaimToken,
  insertIngestNodeApiKey,
  updateIngestNodeTailscaleIp,
} from "@repo/supabase/queries/ingest-nodes";
import { ingestNodeAuth } from "../middleware/ingest-node-auth";
import { env } from "../lib/env";
import { mintTailscaleAuthKey } from "../lib/tailscale";

const ingestNodes = new Hono();

// ── Claim ─────────────────────────────────────────────────────────────────────

// Called by ingest-server's install script during node setup. No Supabase
// session involved -- a fresh, untrusted VM hits this with nothing but the
// one-time claim token in the body, which is why this lives in rest-api
// (brute-force protection, security headers, HTTPS enforcement already wired
// up here) instead of ingest-control, which doesn't even have its Supabase
// credentials configured yet -- that's exactly what this endpoint delivers.
//
// Duplicated from nodes.ts's slugifyHostname rather than shared, keeping the
// OBS and ingest claim domains fully independent of each other.
function slugifyHostname(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ingest-node";
}

ingestNodes.post("/claim", async (c) => {
  const body = await c.req.json();
  const { token, cpu_cores, ram_total_mb, storage_total_mb, public_ip, lan_ip, tailscale_ip } = body as {
    token?: string;
    cpu_cores?: number;
    ram_total_mb?: number;
    storage_total_mb?: number;
    public_ip?: string;
    lan_ip?: string;
    tailscale_ip?: string;
  };

  if (!token) {
    return c.json({ error: "token is required" }, 400);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the pending node first so we can derive its hostname slug from
  // the admin-chosen name before the atomic claim UPDATE below.
  const pendingNode = await claimIngestNodeByTokenHash(supabase, tokenHash);
  const hostname = slugifyHostname(pendingNode?.name ?? "ingest-node");

  // Unlike OBS's shared NODE_API_KEY-scoped access, ingest-control talks to
  // Supabase directly with a service-role key, so each box also needs its own
  // INGEST_CONTROL_SECRET (replacing today's single Doppler-shared value).
  // Minted fresh per claim and encrypted at rest so admins can retrieve/rotate it.
  const controlSecret = randomBytes(32).toString("hex");
  const { ciphertext, iv, authTag } = encryptToken(controlSecret);

  // Atomic: the UPDATE itself is scoped by hash/status/expiry, so concurrent
  // claims with the same token can't both succeed (see consumeIngestClaimToken).
  const linked = await consumeIngestClaimToken(supabase, tokenHash, {
    cpu_cores,
    ram_total_mb,
    storage_total_mb,
    public_ip,
    lan_ip,
    tailscale_ip,
    hostname,
    control_secret_ciphertext: ciphertext,
    control_secret_iv: iv,
    control_secret_tag: authTag,
  });

  if (!linked) {
    // The atomic update matched nothing -- look the row up read-only just to
    // pick the right error code; this lookup never drives the mutation.
    const node = await claimIngestNodeByTokenHash(supabase, tokenHash);
    if (!node) {
      return c.json({ error: "Invalid claim token" }, 404);
    }
    if (node.status === "linked") {
      return c.json({ error: "This node has already been claimed" }, 409);
    }
    return c.json({ error: "Claim token has expired" }, 410);
  }

  const apiKey = randomBytes(32).toString("hex");
  const encApiKey = encryptToken(apiKey);
  await insertIngestNodeApiKey(supabase, linked.id, {
    key_hash: createHash("sha256").update(apiKey).digest("hex"),
    key_ciphertext: encApiKey.ciphertext,
    key_iv: encApiKey.iv,
    key_tag: encApiKey.authTag,
  });

  // Lets install.sh join Tailscale without an admin pasting a key by hand;
  // null (Tailscale API down / OAuth client misconfigured) is tolerated on
  // the node side with a warning. See lib/tailscale.ts.
  const tailscaleAuthKey = await mintTailscaleAuthKey({
    nodeId: linked.id,
    tag: "tag:ingest-node",
    description: `ingest-node claim ${linked.id}`,
  });

  return c.json({
    node_id: linked.id,
    hostname: linked.hostname,
    node_api_key: apiKey,
    ingest_control_secret: controlSecret,
    tailscale_authkey: tailscaleAuthKey,
    supabase_url: env.SUPABASE_URL,
    supabase_secret_key: env.SUPABASE_SECRET_KEY,
    rest_api_url: env.STREAMWIZARD_API_URL,
    // Present only when rest-api itself has InfluxDB configured for this
    // environment — omitted (not null/empty-string) otherwise, so a node
    // claimed before Influx was wired up just runs without host metrics
    // instead of writing empty env vars into its .env.
    ...(env.INFLUXDB_URL && env.INFLUXDB_ORG && env.INFLUXDB_BUCKET && env.INFLUXDB_TOKEN
      ? {
          influxdb_url: env.INFLUXDB_URL,
          influxdb_org: env.INFLUXDB_ORG,
          influxdb_bucket: env.INFLUXDB_BUCKET,
          influxdb_token: env.INFLUXDB_TOKEN,
        }
      : {}),
    // Same omit-when-unset rule. ingest-control dials ws-server as a bot
    // client with SUPABASE_SECRET_KEY as its bearer, so the URL is all it
    // needs — no CONSUMER_SECRET, unlike the OBS node claim.
    ...(env.WS_SERVER_URL ? { ws_server_url: env.WS_SERVER_URL } : {}),
  });
});

// ── Self-report ──────────────────────────────────────────────────────────────

// Called by ingest-server's install script once it actually has a Tailscale
// IP -- in the deferred-join case that's only true after /claim already
// returned (the auth key needed to join comes back IN that response), so it
// can't be included in the original claim body and needs its own round trip.
ingestNodes.patch("/me", ingestNodeAuth(), async (c) => {
  const body = await c.req.json();
  const { tailscale_ip } = body as { tailscale_ip?: string };

  if (!tailscale_ip) {
    return c.json({ error: "tailscale_ip is required" }, 400);
  }

  const nodeId = c.get("ingestNodeId");
  const { data, error } = await updateIngestNodeTailscaleIp(supabase, nodeId, tailscale_ip);
  if (error) {
    return c.json({ error }, 500);
  }
  return c.json(data);
});

export default ingestNodes;
