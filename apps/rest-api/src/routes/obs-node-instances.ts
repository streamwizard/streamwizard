import { Hono } from "hono";
import { obsNodeAuth } from "../middleware/obs-node-auth";
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
} from "../modules/obs-nodes/instances/crud";
import { getInstanceSecrets } from "../modules/obs-nodes/instances/secrets";

// /api/obs-nodes/instances: the calling node's own OBS instances. Every route
// authenticates with the node API key (sets c.var.nodeId), and every handler
// scopes its query to that node. Handlers live in modules/obs-nodes/instances/.
const obsNodeInstances = new Hono();

obsNodeInstances.use("*", obsNodeAuth());

// Static paths before /:id, so "vram" etc. aren't read as an instance id.
obsNodeInstances.get("/", listInstances);
obsNodeInstances.get("/vram", getAllocatedVram);
obsNodeInstances.get("/active-count", countActiveInstances);
obsNodeInstances.get("/unentitled", listUnentitledInstances);
obsNodeInstances.post("/", createInstance);
obsNodeInstances.patch("/by-container/:containerId", updateInstanceByContainer);

obsNodeInstances.get("/:id", getInstance);
// Plaintext OBS WebSocket + VNC passwords for one of this node's instances.
obsNodeInstances.get("/:id/secrets", getInstanceSecrets);
obsNodeInstances.patch("/:id", updateInstance);
obsNodeInstances.delete("/:id", deleteInstance);

export default obsNodeInstances;
