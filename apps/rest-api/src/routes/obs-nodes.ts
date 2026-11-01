import { Hono } from "hono";
import { obsNodeAuth } from "../middleware/obs-node-auth";
import { claimObsNode } from "../modules/obs-nodes/claim";
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
} from "../modules/obs-nodes/instances";
import { getObsNodeMe, updateObsNodeMe } from "../modules/obs-nodes/me";
import { reportReconcile } from "../modules/obs-nodes/reconcile";
import { getPlanLimits } from "../modules/obs-nodes/subscriptions";
import { getCloudObsAccess, getStreamKey, getUserIsAdmin, listUserInstances } from "../modules/obs-nodes/users";

// /api/obs-nodes: called by obs-instance-manager. /claim is open (one-time
// token in the body); every other route authenticates with the node API key,
// which sets c.var.nodeId. Handlers live in modules/obs-nodes/.
const obsNodes = new Hono();

obsNodes.post("/claim", claimObsNode);
obsNodes.post("/reconcile", obsNodeAuth(), reportReconcile);
obsNodes.get("/subscriptions/:subscriptionId/limits", obsNodeAuth(), getPlanLimits);

obsNodes.get("/me", obsNodeAuth(), getObsNodeMe);
obsNodes.patch("/me", obsNodeAuth(), updateObsNodeMe);

// Static paths before /:id, so "vram" etc. aren't read as an instance id.
obsNodes.get("/instances", obsNodeAuth(), listInstances);
obsNodes.get("/instances/vram", obsNodeAuth(), getAllocatedVram);
obsNodes.get("/instances/active-count", obsNodeAuth(), countActiveInstances);
obsNodes.get("/instances/unentitled", obsNodeAuth(), listUnentitledInstances);
obsNodes.get("/instances/:id", obsNodeAuth(), getInstance);
obsNodes.post("/instances", obsNodeAuth(), createInstance);
obsNodes.patch("/instances/:id", obsNodeAuth(), updateInstance);
obsNodes.patch("/instances/by-container/:containerId", obsNodeAuth(), updateInstanceByContainer);
obsNodes.delete("/instances/:id", obsNodeAuth(), deleteInstance);

obsNodes.get("/users/:userId/instances", obsNodeAuth(), listUserInstances);
obsNodes.get("/users/:userId/is-admin", obsNodeAuth(), getUserIsAdmin);
obsNodes.get("/users/:userId/cloud-obs-access", obsNodeAuth(), getCloudObsAccess);
obsNodes.get("/users/:userId/stream-key", obsNodeAuth(), getStreamKey);

export default obsNodes;
