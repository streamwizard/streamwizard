import type { Context, Env } from "hono";
import type { ObsInstanceLifecyclePayload, ObsSceneChangedPayload } from "@repo/schemas";
import { supabase } from "@repo/supabase";
import { getObsInstanceOwnerForNode } from "@repo/supabase/queries/obs-nodes";
import { TtlCache } from "@repo/ttl-cache";
import { postInternalBroadcast } from "@/lib/ws-server";
import { nodeInstanceEventSchema } from "@/schemas/obs-nodes";

// OBS nodes don't hold CONSUMER_SECRET: it would let them push any event to
// any user's room. A node reports what happened to one of its own instances
// here, and rest-api forwards it to ws-server for that instance's owner. The
// node never names the user and can only send these two event types.

const LIFECYCLE_EVENT_TYPE = "streamwizard.obs_instance_lifecycle";
const SCENE_EVENT_TYPE = "streamwizard.obs_scene_changed";

/**
 * "node:instance" -> owner, so a scene change doesn't cost a Supabase read.
 * An instance's owner and node never change after create, so the only way an
 * entry goes stale is a delete. This process forgets it right away (see
 * instanceDeleted); another rest-api replica may keep it until the TTL
 * runs out, which only means a late event from that same node still reaches
 * the instance's real owner. Misses are cached briefly so a node retrying a
 * wrong id can't turn into a Supabase loop.
 */
const instanceOwners = new TtlCache<string>({
  ttlMs: 10 * 60 * 1000,
  negativeTtlMs: 5 * 1000,
});

const ownerKey = (nodeId: string, instanceId: string) => `${nodeId}:${instanceId}`;

async function instanceOwner(nodeId: string, instanceId: string): Promise<string | null> {
  const key = ownerKey(nodeId, instanceId);
  const cached = instanceOwners.get(key);
  if (cached !== undefined) return cached;
  const userId = await getObsInstanceOwnerForNode(supabase, instanceId, nodeId);
  instanceOwners.set(key, userId);
  return userId;
}

/** Called by the delete route once the row is gone: drops the cached owner
 *  and tells the owner it was deleted. Best effort and not awaited:
 *  postInternalBroadcast reports its own failures and never throws. */
export function instanceDeleted(nodeId: string, instanceId: string, userId: string): void {
  instanceOwners.delete(ownerKey(nodeId, instanceId));
  const payload: ObsInstanceLifecyclePayload = { instanceId, action: "deleted", at: new Date().toISOString() };
  void postInternalBroadcast(userId, LIFECYCLE_EVENT_TYPE, payload);
}

/**
 * POST /api/obs-nodes/instances/:id/events
 *   { type: "lifecycle", action, at? } | { type: "scene_changed", sceneName, sceneUuid, at? }
 * → 202 { ok: true }
 *
 * 404 for a missing instance and for another node's instance alike. 202 means
 * accepted, not delivered: the forward to ws-server runs after the answer, and
 * postInternalBroadcast reports its own failures.
 */
export async function postInstanceEvent(c: Context<Env, "/:id/events">) {
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = nodeInstanceEventSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid event" }, 400);

  const userId = await instanceOwner(nodeId, id);
  if (!userId) return c.json({ error: "Instance not found" }, 404);

  const event = parsed.data;
  const observedAt = event.at ?? new Date().toISOString();
  if (event.type === "lifecycle") {
    const payload: ObsInstanceLifecyclePayload = { instanceId: id, action: event.action, at: observedAt };
    void postInternalBroadcast(userId, LIFECYCLE_EVENT_TYPE, payload);
  } else {
    const payload: ObsSceneChangedPayload = {
      instanceId: id,
      sceneName: event.sceneName,
      sceneUuid: event.sceneUuid,
      at: observedAt,
    };
    void postInternalBroadcast(userId, SCENE_EVENT_TYPE, payload);
  }
  return c.json({ ok: true }, 202);
}
