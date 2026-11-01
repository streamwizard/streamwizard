import { Hono } from "hono";
import { obsNodeAuth } from "../middleware/obs-node-auth";
import { claimObsNode } from "../modules/obs-nodes/node/claim";
import { getObsNodeMe, updateObsNodeMe } from "../modules/obs-nodes/node/me";
import { reportReconcile } from "../modules/obs-nodes/node/reconcile";
import { getPlanLimits } from "../modules/obs-nodes/node/subscriptions";
import { getCloudObsAccess, getUserIsAdmin, listUserInstances } from "../modules/obs-nodes/node/users";
import { getStreamKey } from "../modules/obs-nodes/instances/stream-key";
import obsNodeInstances from "./obs-node-instances";

// /api/obs-nodes: called by obs-instance-manager. /claim is open (one-time
// token in the body); every other route authenticates with the node API key,
// which sets c.var.nodeId.
//
// Node-level routes are here, with handlers in modules/obs-nodes/node/.
// Routes for one of the node's instances live under /instances, in
// ./obs-node-instances.ts, with handlers in modules/obs-nodes/instances/.
const obsNodes = new Hono();

obsNodes.post("/claim", claimObsNode);
obsNodes.post("/reconcile", obsNodeAuth(), reportReconcile);
obsNodes.get("/subscriptions/:subscriptionId/limits", obsNodeAuth(), getPlanLimits);

obsNodes.get("/me", obsNodeAuth(), getObsNodeMe);
obsNodes.patch("/me", obsNodeAuth(), updateObsNodeMe);

obsNodes.get("/users/:userId/instances", obsNodeAuth(), listUserInstances);
obsNodes.get("/users/:userId/is-admin", obsNodeAuth(), getUserIsAdmin);
obsNodes.get("/users/:userId/cloud-obs-access", obsNodeAuth(), getCloudObsAccess);
// Instance boot data, so the handler lives in modules/obs-nodes/instances/;
// the URL stays user-scoped because OIM asks by user id.
obsNodes.get("/users/:userId/stream-key", obsNodeAuth(), getStreamKey);

obsNodes.route("/instances", obsNodeInstances);

export default obsNodes;
