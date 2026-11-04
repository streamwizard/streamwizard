import { Hono } from "hono";
import type { z } from "zod";
import { parseUuid } from "@/lib/node-schemas";
import { obsNodeAuth } from "@/middleware/obs-node-auth";
import {
  countActiveInstances,
  createInstance,
  deleteInstance,
  getAllocatedVram,
  getInstance,
  listInstances,
  listUnentitledInstances,
  updateInstance,
  updateInstanceByContainer,
} from "@/modules/obs-nodes/instances/crud";
import { forwardInstanceEvent } from "@/modules/obs-nodes/instances/events";
import { readInstanceSecrets } from "@/modules/obs-nodes/instances/secrets";
import { issueInstanceStorageCredentials } from "@/modules/obs-nodes/instances/storage-credentials";
import { getStreamKeyForNode } from "@/modules/obs-nodes/instances/stream-key";
import { claimObsNode, type ClaimFailure } from "@/modules/obs-nodes/node/claim";
import { getObsNodeMe, updateObsNodeMe } from "@/modules/obs-nodes/node/me";
import { recordReconcileReport } from "@/modules/obs-nodes/node/reconcile";
import { issueSharedStorageCredentials } from "@/modules/obs-nodes/node/storage-credentials";
import { getPlanLimits } from "@/modules/obs-nodes/node/subscriptions";
import { getCloudObsAccess, getUserIsAdmin, listUserInstances } from "@/modules/obs-nodes/node/users";
import {
  claimObsNodeSchema,
  containerIdParamSchema,
  insertInstanceSchema,
  nodeInstanceEventSchema,
  patchNodeMeSchema,
  reconcileReportSchema,
  updateInstanceSchema,
} from "@/modules/obs-nodes/schemas";

// /api/obs-nodes: called by obs-instance-manager. /claim is open (one-time
// token in the body); every other route authenticates with the node API key,
// which sets c.var.nodeId. Each handler reads and parses the request, calls
// the domain code in node/ or instances/ with plain values, and shapes the
// response.

const CLAIM_FAILURES = {
  invalid_token: { status: 404, error: "Invalid claim token" },
  already_claimed: { status: 409, error: "This node has already been claimed" },
  expired: { status: 410, error: "Claim token has expired" },
} as const satisfies Record<ClaimFailure, { status: number; error: string }>;

const INSTANCE_NOT_FOUND = { error: "Instance not found" };
const INVALID_INSTANCE_PAYLOAD = { error: "Invalid instance payload" };

/** Field names (never values) of a refused payload, for the node's operator. */
function refusedFields(error: z.ZodError): string {
  return [...new Set(error.issues.map((i) => i.path.join(".") || "(body)"))].join(",");
}

/** The PATCH body, parsed; null (and one log line) when the node sent junk. */
function parseInstanceUpdate(body: unknown, nodeId: string): z.infer<typeof updateInstanceSchema> | null {
  const parsed = updateInstanceSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  console.warn(`[obs-nodes] instance update refused node=${nodeId} fields=${refusedFields(parsed.error)}`);
  return null;
}

// /api/obs-nodes/instances: the calling node's own OBS instances. Every route
// authenticates with the node API key, and every domain call is scoped to
// that node.
const instanceRoutes = new Hono();

instanceRoutes.use("*", obsNodeAuth());

// Static paths before /:id, so "vram" etc. aren't read as an instance id.
instanceRoutes.get("/", async (c) => c.json(await listInstances(c.var.nodeId)));
instanceRoutes.get("/vram", async (c) => c.json({ total_vram_mb: await getAllocatedVram(c.var.nodeId) }));
instanceRoutes.get("/active-count", async (c) => c.json({ count: await countActiveInstances(c.var.nodeId) }));
instanceRoutes.get("/unentitled", async (c) => c.json({ instance_ids: await listUnentitledInstances(c.var.nodeId) }));

instanceRoutes.post("/", async (c) => {
  const nodeId = c.var.nodeId;
  const parsed = insertInstanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    console.warn(`[obs-nodes] instance create refused node=${nodeId} fields=${refusedFields(parsed.error)}`);
    return c.json(INVALID_INSTANCE_PAYLOAD, 400);
  }
  const result = await createInstance({ nodeId, fields: parsed.data, createToken: c.req.header("X-Node-Token") });
  if (result.ok) return c.json(result.instance, 201);
  switch (result.reason) {
    case "create_token":
      return c.json({ error: result.tokenCheck.error }, result.tokenCheck.status);
    case "subscription_inactive":
      return c.json({ error: "Subscription not found or inactive" }, 403);
    case "failed":
      return c.json({ error: "Could not create the instance" }, 500);
  }
});

instanceRoutes.patch("/by-container/:containerId", async (c) => {
  const nodeId = c.var.nodeId;
  const containerId = containerIdParamSchema.safeParse(c.req.param("containerId"));
  if (!containerId.success) return c.json(INSTANCE_NOT_FOUND, 404);
  const fields = parseInstanceUpdate(await c.req.json().catch(() => null), nodeId);
  if (!fields) return c.json(INVALID_INSTANCE_PAYLOAD, 400);
  const instance = await updateInstanceByContainer(nodeId, containerId.data, fields);
  if (!instance) return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json(instance);
});

instanceRoutes.get("/:id", async (c) => {
  const id = parseUuid(c.req.param("id"));
  const rawUserId = c.req.query("user_id");
  const userId = rawUserId === undefined ? undefined : parseUuid(rawUserId);
  // A malformed id can't be an instance: same 404 as a missing one.
  if (!id || userId === null) return c.json(INSTANCE_NOT_FOUND, 404);
  const instance = await getInstance(c.var.nodeId, id, userId);
  if (!instance) return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json(instance);
});

// Plaintext OBS WebSocket + VNC passwords for one of this node's instances.
// Never log the response body.
instanceRoutes.get("/:id/secrets", async (c) => {
  c.header("Cache-Control", "no-store");
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json(INSTANCE_NOT_FOUND, 404);
  const result = await readInstanceSecrets(c.var.nodeId, id);
  if (result.ok) return c.json(result.secrets);
  if (result.reason === "not_found") return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json({ error: "Could not read instance secrets" }, 500);
});

// Temporary MinIO credentials for this instance's config and media folders.
// Never log the response body.
instanceRoutes.post("/:id/storage-credentials", async (c) => {
  c.header("Cache-Control", "no-store");
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json(INSTANCE_NOT_FOUND, 404);
  const result = await issueInstanceStorageCredentials(c.var.nodeId, id);
  if (result.ok) return c.json(result.creds);
  if (result.reason === "not_found") return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json({ error: "Could not issue storage credentials" }, 503);
});

// Lifecycle and scene events, forwarded to the instance owner's ws-server room.
// 202 means accepted, not delivered.
instanceRoutes.post("/:id/events", async (c) => {
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json(INSTANCE_NOT_FOUND, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = nodeInstanceEventSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid event" }, 400);

  if (!(await forwardInstanceEvent(c.var.nodeId, id, parsed.data))) return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json({ ok: true }, 202);
});

instanceRoutes.patch("/:id", async (c) => {
  const nodeId = c.var.nodeId;
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json(INSTANCE_NOT_FOUND, 404);
  const fields = parseInstanceUpdate(await c.req.json().catch(() => null), nodeId);
  if (!fields) return c.json(INVALID_INSTANCE_PAYLOAD, 400);
  const result = await updateInstance(nodeId, id, fields);
  if (result.ok) return c.json(result.instance);
  if (result.reason === "not_found") return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json({ error: "Could not update the instance" }, 500);
});

instanceRoutes.delete("/:id", async (c) => {
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json(INSTANCE_NOT_FOUND, 404);
  const result = await deleteInstance(c.var.nodeId, id);
  if (result.ok) return c.json({ ok: true });
  if (result.reason === "not_found") return c.json(INSTANCE_NOT_FOUND, 404);
  return c.json({ error: "Could not delete the instance" }, 500);
});

export const obsNodeRoutes = new Hono();

obsNodeRoutes.post("/claim", async (c) => {
  // Parsed before anything else: a malformed body costs no lookup.
  const parsed = claimObsNodeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid body: token and gpu_bus_id are required" }, 400);
  }
  const result = await claimObsNode(parsed.data);
  if (!result.ok) {
    const { status, error } = CLAIM_FAILURES[result.reason];
    return c.json({ error }, status);
  }
  return c.json(result.credentials);
});

obsNodeRoutes.post("/reconcile", obsNodeAuth(), async (c) => {
  const nodeId = c.var.nodeId;
  const parsed = reconcileReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid reconcile report" }, 400);
  }
  recordReconcileReport(nodeId, parsed.data);
  return c.json({ ok: true });
});

obsNodeRoutes.get("/subscriptions/:subscriptionId/limits", obsNodeAuth(), async (c) => {
  const subscriptionId = parseUuid(c.req.param("subscriptionId"));
  const limits = subscriptionId ? await getPlanLimits(subscriptionId) : null;
  if (!limits) return c.json({ error: "Subscription not found or inactive" }, 404);
  return c.json(limits);
});

obsNodeRoutes.get("/me", obsNodeAuth(), async (c) => {
  const payload = await getObsNodeMe(c.var.nodeId);
  if (!payload) return c.json({ error: "Node not found" }, 404);
  return c.json(payload);
});

obsNodeRoutes.patch("/me", obsNodeAuth(), async (c) => {
  const parsed = patchNodeMeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "tailscale_ip must be an IPv4 address" }, 400);
  }
  const result = await updateObsNodeMe(c.var.nodeId, parsed.data.tailscale_ip);
  if (!result.ok) return c.json({ error: "Could not update the node" }, 500);
  return c.json(result.node);
});

// Temporary read-only MinIO credentials for templates and plugins.
// Never log the response body.
obsNodeRoutes.post("/storage-credentials", obsNodeAuth(), async (c) => {
  c.header("Cache-Control", "no-store");
  const result = await issueSharedStorageCredentials(c.var.nodeId);
  if (!result.ok) return c.json({ error: "Could not issue storage credentials" }, 503);
  return c.json(result.creds);
});

const INVALID_USER_ID = { error: "Invalid user id" };
const FORBIDDEN = { error: "Forbidden" };

obsNodeRoutes.get("/users/:userId/instances", obsNodeAuth(), async (c) => {
  const userId = parseUuid(c.req.param("userId"));
  if (!userId) return c.json(INVALID_USER_ID, 400);
  return c.json(await listUserInstances(c.var.nodeId, userId));
});

obsNodeRoutes.get("/users/:userId/is-admin", obsNodeAuth(), async (c) => {
  const userId = parseUuid(c.req.param("userId"));
  if (!userId) return c.json(INVALID_USER_ID, 400);
  return c.json({ is_admin: await getUserIsAdmin(userId) });
});

obsNodeRoutes.get("/users/:userId/cloud-obs-access", obsNodeAuth(), async (c) => {
  const userId = parseUuid(c.req.param("userId"));
  if (!userId) return c.json(INVALID_USER_ID, 400);
  const access = await getCloudObsAccess(c.var.nodeId, userId);
  if (!access) return c.json(FORBIDDEN, 403);
  return c.json({ can_interact: access.canInteract });
});

// Instance boot data, so the domain code lives in instances/; the URL stays
// user-scoped because OIM asks by user id.
obsNodeRoutes.get("/users/:userId/stream-key", obsNodeAuth(), async (c) => {
  const userId = parseUuid(c.req.param("userId"));
  if (!userId) return c.json(INVALID_USER_ID, 400);
  const lookup = await getStreamKeyForNode(c.var.nodeId, userId);
  if (!lookup) return c.json(FORBIDDEN, 403);
  return c.json(lookup);
});

obsNodeRoutes.route("/instances", instanceRoutes);
