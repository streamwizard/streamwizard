import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { Hono } from "hono";
import { supabase } from "@repo/supabase";
import { encryptToken } from "@repo/supabase/crypto";
import {
  claimNodeByTokenHash,
  consumeClaimToken,
  countActiveObsInstancesForNode,
  deleteObsInstance,
  getNodeById,
  getObsInstanceById,
  getObsInstanceByIdForNode,
  getTwitchIntegration,
  insertNodeApiKey,
  insertObsInstance,
  isUserAdmin,
  listObsInstancesByNode,
  listObsInstancesByUser,
  sumAllocatedVramForNode,
  updateObsInstance,
  updateObsInstanceByContainerId,
  updateTwitchTokens,
} from "@repo/supabase/queries/obs-nodes";
import { getSubscriptionLimits } from "@repo/supabase/queries/subscriptions";
import { env } from "../lib/env";
import { nodeAuth } from "../middleware/node-auth";

const nodes = new Hono();

// ── Claim ─────────────────────────────────────────────────────────────────────

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

  const apiKey = randomBytes(32).toString("hex");
  const { ciphertext, iv, authTag } = encryptToken(apiKey);
  await insertNodeApiKey(supabase, linked.id, {
    key_hash: createHash("sha256").update(apiKey).digest("hex"),
    key_ciphertext: ciphertext,
    key_iv: iv,
    key_tag: authTag,
  });

  const obj = {
    node_id: linked.id,
    node_api_key: apiKey,
    rest_api_url: env.STREAMWIZARD_API_URL,
    supabase_url: env.SUPABASE_URL,
    S3_ENDPOINT: env.OBS_S3_ENDPOINT,
    S3_ACCESS_KEY: env.OBS_S3_ACCESS_KEY,
    S3_SECRET_KEY: env.OBS_S3_SECRET_KEY,
    S3_BUCKET: env.OBS_S3_BUCKET,
    S3_REGION: env.OBS_S3_REGION,
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY
  };

  console.log(obj);

  return c.json({
    node_id: linked.id,
    node_api_key: apiKey,
    rest_api_url: env.STREAMWIZARD_API_URL,
    supabase_url: env.SUPABASE_URL,
    S3_ENDPOINT: env.OBS_S3_ENDPOINT,
    S3_ACCESS_KEY: env.OBS_S3_ACCESS_KEY,
    S3_SECRET_KEY: env.OBS_S3_SECRET_KEY,
    S3_BUCKET: env.OBS_S3_BUCKET,
    S3_REGION: env.OBS_S3_REGION,
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY
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
  return c.json(node);
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
  const id = c.req.param("id");
  const userId = c.req.query("user_id");
  const instance = userId
    ? await getObsInstanceById(supabase, id, userId)
    : await getObsInstanceByIdForNode(supabase, id);
  if (!instance) return c.json({ error: "Instance not found" }, 404);
  return c.json(instance);
});

nodes.post("/instances", nodeAuth(), async (c) => {
  const body = await c.req.json();
  try {
    const instance = await insertObsInstance(supabase, body);
    return c.json(instance, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

nodes.patch("/instances/:id", nodeAuth(), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  try {
    const instance = await updateObsInstance(supabase, id, body);
    return c.json(instance);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

nodes.patch("/instances/by-container/:containerId", nodeAuth(), async (c) => {
  const containerId = c.req.param("containerId");
  const body = await c.req.json();
  const instance = await updateObsInstanceByContainerId(
    supabase,
    containerId,
    body,
  );
  if (!instance) return c.json({ error: "Instance not found" }, 404);
  return c.json(instance);
});

nodes.delete("/instances/:id", nodeAuth(), async (c) => {
  const id = c.req.param("id");
  try {
    await deleteObsInstance(supabase, id);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── User-scoped queries ───────────────────────────────────────────────────────

nodes.get("/users/:userId/instances", nodeAuth(), async (c) => {
  const userId = c.req.param("userId");
  const instances = await listObsInstancesByUser(supabase, userId);
  return c.json(instances);
});

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
  const userId = c.req.param("userId");

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
