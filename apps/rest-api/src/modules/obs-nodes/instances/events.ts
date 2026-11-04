import type { ObsInstanceLifecyclePayload, ObsSceneChangedPayload } from "@repo/schemas";
import { supabase } from "@repo/supabase";
import { getObsInstanceOwnerForNode } from "@repo/supabase/queries/obs-nodes";
import { TtlCache } from "@repo/ttl-cache";
import { postInternalBroadcast } from "@/lib/ws-server";
import type { NodeInstanceEvent } from "@/modules/obs-nodes/schemas";

// OBS nodes hold no ws-server credential: one would let them push events to
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
 * POST /api/obs-nodes/instances/:id/events: forwards one event to the owner of
 * instance `id`. false for a missing instance and for another node's instance
 * alike. true means accepted, not delivered: the forward to ws-server is not
 * awaited, and postInternalBroadcast reports its own failures.
 */
export async function forwardInstanceEvent(nodeId: string, id: string, event: NodeInstanceEvent): Promise<boolean> {
  const userId = await instanceOwner(nodeId, id);
  if (!userId) return false;

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
  return true;
}
