import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { Hono } from "hono";
import { z } from "zod";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import {
  claimNodeByTokenHash,
  consumeClaimToken,
  countActiveObsInstancesForNode,
  deleteObsInstanceForNode,
  getNodeById,
  getNodeCommandKeyHash,
  getObsInstanceByIdForNode,
  getTwitchIntegration,
  insertNodeApiKey,
  insertObsInstance,
  isUserAdmin,
  listObsInstancesByNode,
  listObsInstancesByUserOnNode,
  sumAllocatedVramForNode,
  updateObsInstanceForNode,
  updateObsInstanceByContainerIdForNode,
  updateTwitchTokens,
  userHasInstanceOnNode,
} from "@repo/supabase/queries/obs-nodes";
import { getSubscriptionLimits } from "@repo/supabase/queries/subscriptions";
import { env } from "../lib/env";
import { nodeAuth } from "../middleware/node-auth";

const nodes = new Hono();

// Field allowlists for the instance-write routes. node_id is never accepted
// from the body — it's always forced to the authenticated node — and id/
// user_id are immutable after creation, so neither can be used to move a row
// to another node or reassign ownership. Unlisted keys are stripped by zod.
const insertInstanceSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  container_id: z.string().nullable().optional(),
  container_name: z.string().min(1),
  resolution: z.string().min(1),
  status: z.string().min(1).optional(),
  vram_allocated_mb: z.number(),
  memory_mb: z.number(),
  cpu_quota: z.number(),
  shm_size: z.string().min(1),
  subscription_id: z.string().uuid().nullable().optional(),
  obs_ws_password_ciphertext: z.string().nullable().optional(),
  obs_ws_password_iv: z.string().nullable().optional(),
  obs_ws_password_tag: z.string().nullable().optional(),
  vnc_password_ciphertext: z.string().nullable().optional(),
  vnc_password_iv: z.string().nullable().optional(),
  vnc_password_tag: z.string().nullable().optional(),
});

const updateInstanceSchema = z.object({
  container_id: z.string().nullable().optional(),
  container_name: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  vram_allocated_mb: z.number().optional(),
  memory_mb: z.number().optional(),
  cpu_quota: z.number().optional(),
  shm_size: z.string().min(1).optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  obs_ws_password_ciphertext: z.string().nullable().optional(),
  obs_ws_password_iv: z.string().nullable().optional(),
  obs_ws_password_tag: z.string().nullable().optional(),
  vnc_password_ciphertext: z.string().nullable().optional(),
  vnc_password_iv: z.string().nullable().optional(),
  vnc_password_tag: z.string().nullable().optional(),
});

// ── Claim ─────────────────────────────────────────────────────────────────────

// Called by obs-instance-manager's install script during node setup. No
// Supabase session involved -- a fresh, untrusted VM hits this with nothing
// but the one-time claim token in the body, which is why this lives in
// rest-api (brute-force protection, security headers, audit logging already
// wired up here) instead of the session/cookie-oriented web app.
// Lowercases and replaces runs of non-alphanumerics with a single hyphen, e.g.
// "GPU Box 1" -> "gpu-box-1". The panel is the single source of truth for this
// slug -- it's computed once here and handed back in the claim response so
// install.sh can apply the exact same string as the machine's hostname,
// instead of re-deriving it in bash and risking drift.
function slugifyHostname(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "obs-node";
}

nodes.post("/claim", async (c) => {
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
  // ever learns its SHA-256 hash (via GET /api/nodes/me), never the plaintext,
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

  return c.json({
    node_id: linked.id,
    node_api_key: apiKey,
    hostname: linked.hostname,
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
    ...(env.INFLUXDB_URL && env.INFLUXDB_ORG && env.INFLUXDB_BUCKET && env.INFLUXDB_TOKEN
      ? {
          INFLUXDB_URL: env.INFLUXDB_URL,
          INFLUXDB_ORG: env.INFLUXDB_ORG,
          INFLUXDB_BUCKET: env.INFLUXDB_BUCKET,
          INFLUXDB_TOKEN: env.INFLUXDB_TOKEN,
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
});

// ── Reconcile ─────────────────────────────────────────────────────────────────

export interface ReconcileInstance {
  instance_id: string;
  action: "marked_error" | "marked_running" | "marked_stopped" | "no_change";
}

export interface ReconcilePayload {
  reconciled_at: string;
  orphaned_containers: string[];
  instances: ReconcileInstance[];
}

// Called by obs-instance-manager after boot-time container reconciliation.
// node_id comes from the authenticated API key (nodeAuth), not the body.
nodes.post("/reconcile", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const body = (await c.req.json()) as ReconcilePayload;
  const { reconciled_at, orphaned_containers, instances } = body;

  if (!reconciled_at) {
    return c.json({ error: "reconciled_at is required" }, 400);
  }

  const corrected = instances?.filter((i) => i.action !== "no_change") ?? [];

  console.log(`[nodes] reconcile report from node ${nodeId}`, {
    reconciled_at,
    orphaned: orphaned_containers?.length ?? 0,
    corrected: corrected.length,
    total: instances?.length ?? 0,
  });

  return c.json({ ok: true });
});

// ── Plan limits ───────────────────────────────────────────────────────────────

// Returns the plan limits for an active subscription. Called by obs-instance-manager
// when provisioning a container so it can enforce subscription-defined resource
// allocations without needing direct Supabase access. Returns 404 if the
// subscription doesn't exist or is not in an active/trialing/past_due state.
nodes.get("/subscriptions/:subscriptionId/limits", nodeAuth(), async (c) => {
  const subscriptionId = c.req.param("subscriptionId");
  const limits = await getSubscriptionLimits(supabase, subscriptionId);
  if (!limits) return c.json({ error: "Subscription not found or inactive" }, 404);
  return c.json(limits);
});

// ── Node info ─────────────────────────────────────────────────────────────────

nodes.get("/me", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const node = await getNodeById(supabase, nodeId);
  if (!node) return c.json({ error: "Node not found" }, 404);
  // command_key_hash lets the node validate the obs-auto-switcher's Bearer on
  // its /obs route without ever holding the plaintext command key.
  const command_key_hash = await getNodeCommandKeyHash(supabase, nodeId);
  return c.json({ ...node, command_key_hash });
});

// ── Instance queries ──────────────────────────────────────────────────────────

nodes.get("/instances", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const instances = await listObsInstancesByNode(supabase, nodeId);
  return c.json(instances);
});

nodes.get("/instances/vram", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const total = await sumAllocatedVramForNode(supabase, nodeId);
  return c.json({ total_vram_mb: total });
});

nodes.get("/instances/active-count", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const count = await countActiveObsInstancesForNode(supabase, nodeId);
  return c.json({ count });
});

nodes.get("/instances/:id", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  const userId = c.req.query("user_id");
  // Always scoped to the calling node; the optional user_id further narrows it.
  const instance = await getObsInstanceByIdForNode(supabase, id, nodeId);
  if (!instance || (userId && instance.user_id !== userId)) {
    return c.json({ error: "Instance not found" }, 404);
  }
  return c.json(instance);
});

nodes.post("/instances", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const parsed = insertInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  try {
    // node_id is forced to the authenticated node, never taken from the body.
    const instance = await insertObsInstance(supabase, { ...parsed.data, node_id: nodeId });
    return c.json(instance, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

nodes.patch("/instances/:id", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  const parsed = updateInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  try {
    const instance = await updateObsInstanceForNode(supabase, id, nodeId, parsed.data);
    if (!instance) return c.json({ error: "Instance not found" }, 404);
    return c.json(instance);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

nodes.patch("/instances/by-container/:containerId", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const containerId = c.req.param("containerId");
  const parsed = updateInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid instance payload", details: parsed.error.flatten() }, 400);
  }
  const instance = await updateObsInstanceByContainerIdForNode(
    supabase,
    containerId,
    nodeId,
    parsed.data,
  );
  if (!instance) return c.json({ error: "Instance not found" }, 404);
  return c.json(instance);
});

nodes.delete("/instances/:id", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");
  try {
    const deleted = await deleteObsInstanceForNode(supabase, id, nodeId);
    if (!deleted) return c.json({ error: "Instance not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── User-scoped queries ───────────────────────────────────────────────────────

nodes.get("/users/:userId/instances", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const userId = c.req.param("userId");
  // Only this node's instances for the user — a node has no business
  // enumerating a user's instances on other nodes.
  const instances = await listObsInstancesByUserOnNode(supabase, userId, nodeId);
  return c.json(instances);
});

// Not instance-scoped by design: the node manager's admin panel calls this to
// check whether an arbitrary logged-in user holds the platform admin role, so
// the caller may legitimately have no instance on this node. Only a boolean is
// disclosed, and the route is already behind node auth.
nodes.get("/users/:userId/is-admin", nodeAuth(), async (c) => {
  const userId = c.req.param("userId");
  const admin = await isUserAdmin(supabase, userId);
  return c.json({ is_admin: admin });
});

// ── Stream key ────────────────────────────────────────────────────────────────

function decryptTwitchToken(
  ciphertext: string,
  iv: string,
  authTag: string,
): string {
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return decipher.update(ciphertext, "base64", "utf8") + decipher.final("utf8");
}

function encryptTwitchToken(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext =
    cipher.update(plaintext, "utf8", "base64") + cipher.final("base64");
  return {
    ciphertext,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

async function fetchTwitchStreamKey(
  twitchUserId: string,
  accessToken: string,
): Promise<string> {
  const res = await fetch(
    `https://api.twitch.tv/helix/streams/key?broadcaster_id=${twitchUserId}`,
    {
      headers: {
        "Client-Id": env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Twitch API error ${res.status}: ${body}`), {
      status: res.status,
    });
  }

  const json = (await res.json()) as { data: { stream_key: string }[] };
  const key = json.data[0]?.stream_key;
  if (!key) throw new Error("No stream key returned by Twitch API");
  return key;
}

async function refreshTwitchToken(
  userId: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token refresh failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
  };

  const encAccess = encryptTwitchToken(data.access_token);
  const encRefresh = encryptTwitchToken(data.refresh_token);

  await updateTwitchTokens(supabase, userId, {
    access_token_ciphertext: encAccess.ciphertext,
    access_token_iv: encAccess.iv,
    access_token_tag: encAccess.authTag,
    refresh_token_ciphertext: encRefresh.ciphertext,
    refresh_token_iv: encRefresh.iv,
    refresh_token_tag: encRefresh.authTag,
  });

  return data.access_token;
}

// Returns { key: string | null } — null means no Twitch integration or fetch
// failed, which is non-fatal (OBS will show the "Enter Stream Key" screen).
nodes.get("/users/:userId/stream-key", nodeAuth(), async (c) => {
  const nodeId = c.get("nodeId");
  const userId = c.req.param("userId");

  // The stream key is a live broadcast credential. Only hand it to a node that
  // actually hosts an instance for this user — otherwise a single compromised
  // node key could enumerate every user's Twitch stream key.
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const integration = await getTwitchIntegration(supabase, userId);
    if (!integration) {
      return c.json({ key: null });
    }

    const {
      twitch_user_id,
      access_token_ciphertext,
      access_token_iv,
      access_token_tag,
      refresh_token_ciphertext,
      refresh_token_iv,
      refresh_token_tag,
    } = integration;

    if (
      !access_token_ciphertext ||
      !access_token_iv ||
      !access_token_tag ||
      !refresh_token_ciphertext ||
      !refresh_token_iv ||
      !refresh_token_tag
    ) {
      return c.json({ key: null });
    }

    let accessToken = decryptTwitchToken(
      access_token_ciphertext,
      access_token_iv,
      access_token_tag,
    );

    try {
      const key = await fetchTwitchStreamKey(twitch_user_id, accessToken);
      return c.json({ key });
    } catch (err: any) {
      if (err?.status !== 401) throw err;

      console.log("[nodes] Twitch access token expired, refreshing", {
        userId,
      });
      const refreshToken = decryptTwitchToken(
        refresh_token_ciphertext,
        refresh_token_iv,
        refresh_token_tag,
      );
      accessToken = await refreshTwitchToken(userId, refreshToken);
      const key = await fetchTwitchStreamKey(twitch_user_id, accessToken);
      return c.json({ key });
    }
  } catch (err) {
    console.warn("[nodes] failed to fetch Twitch stream key", {
      userId,
      error: (err as Error).message,
    });
    return c.json({ key: null });
  }
});

export default nodes;
