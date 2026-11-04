import { createHash, randomBytes } from "crypto";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import { claimNodeByTokenHash, consumeClaimToken, insertNodeApiKey } from "@repo/supabase/queries/obs-nodes";
import { env } from "@/env";
import { mintTailscaleAuthKey } from "@/lib/tailscale";
import type { ClaimObsNodeInput } from "@/modules/obs-nodes/schemas";

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

/** Why a claim failed: unknown token, a node that was already claimed, or an expired token. */
export type ClaimFailure = "invalid_token" | "already_claimed" | "expired";

// Called by obs-instance-manager's install script during node setup. No
// Supabase session involved -- a fresh, untrusted VM hits this with nothing
// but the one-time claim token in the body, which is why this lives in
// rest-api (security headers, audit logging already wired up here) instead of
// the session/cookie-oriented web app.
export async function claimObsNode(input: ClaimObsNodeInput) {
  const { token, gpu_bus_id, vram_total_mb, ram_total_mb, cpu_cores, gpu_model, storage_total_mb } = input;
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
    const reason: ClaimFailure = !node ? "invalid_token" : node.status === "linked" ? "already_claimed" : "expired";
    return { ok: false as const, reason };
  }

  // Only the hash is stored: obsNodeAuth needs nothing else, and the key is
  // returned once below. No encrypted copy, so TOKEN_ENCRYPTION_KEY can't
  // rebuild it.
  const apiKey = randomBytes(32).toString("hex");
  await insertNodeApiKey(supabase, linked.id, {
    type: "rest_api",
    key_hash: createHash("sha256").update(apiKey).digest("hex"),
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

  const credentials = {
    node_id: linked.id,
    node_api_key: apiKey,
    hostname: linked.hostname,
    tailscale_authkey: tailscaleAuthKey,
    rest_api_url: env.STREAMWIZARD_API_URL,
    supabase_url: env.SUPABASE_URL,
    S3_ENDPOINT: env.OBS_S3_ENDPOINT,
    // No storage key: nodes get temporary per-instance credentials from
    // POST /api/obs-nodes/instances/:id/storage-credentials, and read-only
    // shared credentials from POST /api/obs-nodes/storage-credentials.
    S3_BUCKET: env.OBS_S3_BUCKET,
    S3_REGION: env.OBS_S3_REGION,
    // No TOKEN_ENCRYPTION_KEY: nodes get their instances' passwords in
    // plaintext from GET /api/obs-nodes/instances/:id/secrets instead, so a
    // compromised node can't decrypt anything else.
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
    // No ws-server URL or credential: the node sends lifecycle and scene
    // events to POST /api/obs-nodes/instances/:id/events, and rest-api
    // forwards them to ws-server for the instance's owner.
  };
  return { ok: true as const, credentials };
}
