import { z } from "zod";
import { claimToken, ipv4, mbCount } from "@/lib/node-schemas";

// Bodies an OBS node (obs-instance-manager) sends to /api/obs-nodes/*.
//
// Unlisted keys are stripped, not refused, on purpose: deployed nodes send
// fields we don't take (node_id on instance writes, for one), and a refusal
// would break every live node until it updates. See validation.md.

/** obs_instances.status (the table's CHECK constraint). */
export const OBS_INSTANCE_STATUSES = ["creating", "running", "stopped", "error"] as const;

const containerId = z.string().min(1).max(128);
/** "obs-instance-<uuid>". */
const containerName = z.string().min(1).max(128);
/** "1920x1080", from the plan. */
const resolution = z.string().min(1).max(32);
/** Docker --shm-size ("2g"), from the plan. */
const shmSize = z.string().min(1).max(32);
/** The plan's OBS template folder name. */
const configTemplate = z.string().max(128);
const vramMb = z.number().int().min(0).max(1_048_576);
const memoryMb = z.number().int().min(0).max(16_777_216);
/** CPUs; the plan may give a fraction. */
const cpuQuota = z.number().min(0).max(1024);

// Field allowlists for the instance-write routes. node_id is never accepted
// from the body — it's always forced to the authenticated node — and id/
// user_id are immutable after creation, so neither can be used to move a row
// to another node or reassign ownership. Unlisted keys are stripped by zod,
// including the encrypted *_password_* columns: rest-api writes those itself.
export const insertInstanceSchema = z.object({
  id: z.uuid().optional(),
  user_id: z.uuid(),
  container_id: containerId.nullable().optional(),
  container_name: containerName,
  resolution,
  status: z.enum(OBS_INSTANCE_STATUSES).optional(),
  vram_allocated_mb: vramMb,
  memory_mb: memoryMb,
  cpu_quota: cpuQuota,
  shm_size: shmSize,
  config_template: configTemplate.nullable().optional(),
  subscription_id: z.uuid().nullable().optional(),
  // Plaintext. rest-api encrypts it; the node never sends or sees ciphertext.
  // Taking ciphertext from a node would let it store any ciphertext it has
  // and read the plaintext back from GET /instances/:id/secrets.
  obs_ws_password: z.string().min(1).max(256),
});

export const updateInstanceSchema = z.object({
  container_id: containerId.nullable().optional(),
  container_name: containerName.optional(),
  resolution: resolution.optional(),
  status: z.enum(OBS_INSTANCE_STATUSES).optional(),
  vram_allocated_mb: vramMb.optional(),
  memory_mb: memoryMb.optional(),
  cpu_quota: cpuQuota.optional(),
  shm_size: shmSize.optional(),
  config_template: configTemplate.nullable().optional(),
  subscription_id: z.uuid().nullable().optional(),
  // No password columns: a node can't change its instances' passwords (see
  // obs_ws_password on insertInstanceSchema for why it can't send ciphertext).
  // Reported by the node after media uploads/deletes so the dashboard's storage
  // bar stays accurate. storage_quota_mb is intentionally NOT accepted here --
  // quota is admin/plan-owned, not something a node can raise for itself.
  used_storage_bytes: z.number().int().nonnegative().max(1e15).optional(),
});
export type InsertInstanceInput = z.infer<typeof insertInstanceSchema>;
export type UpdateInstanceInput = z.infer<typeof updateInstanceSchema>;

/** PATCH /instances/by-container/:containerId */
export const containerIdParamSchema = containerId;

/** POST /api/obs-nodes/claim: install.sh on a fresh VM, with only the claim
 *  token. The hardware fields are what nvidia-smi, /proc and df report. */
export const claimObsNodeSchema = z.object({
  token: claimToken,
  /** Xorg BusID ("PCI:1:0:0"). */
  gpu_bus_id: z.string().min(1).max(64),
  vram_total_mb: vramMb.optional(),
  ram_total_mb: memoryMb.optional(),
  cpu_cores: z.number().int().min(0).max(4096).optional(),
  gpu_model: z.string().max(256).optional(),
  storage_total_mb: mbCount.optional(),
});
export type ClaimObsNodeInput = z.infer<typeof claimObsNodeSchema>;

/** PATCH /api/obs-nodes/me: the node reports its Tailscale IP once it has
 *  joined. rest-api builds the node's default api_url from it, so it must be
 *  an address (`tailscale ip -4`). */
export const patchNodeMeSchema = z.object({ tailscale_ip: ipv4 });

/** What obs-instance-manager did to each instance at boot. */
const RECONCILE_ACTIONS = [
  "marked_error",
  "marked_running",
  "marked_stopped",
  "restarted",
  "restart_failed",
  "no_change",
] as const;

/** POST /api/obs-nodes/reconcile: the node's boot-time container report. */
export const reconcileReportSchema = z.object({
  reconciled_at: z.iso.datetime({ offset: true }),
  orphaned_containers: z.array(z.string().max(256)).max(500).optional(),
  instances: z
    .array(z.object({ instance_id: z.string().max(64), action: z.enum(RECONCILE_ACTIONS) }))
    .max(500)
    .optional(),
});
export type ReconcileReport = z.infer<typeof reconcileReportSchema>;

const eventAt = z.iso.datetime().optional();

/** POST /api/obs-nodes/instances/:id/events: what a node may report about one
 *  of its instances. No user id: rest-api takes the owner from the row. No
 *  "deleted": the row is gone by the time the node could report it, so the
 *  delete route sends that one itself. */
export const nodeInstanceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lifecycle"),
    action: z.enum(["starting", "started", "stopping", "stopped", "error"]),
    at: eventAt,
  }),
  z.object({
    type: z.literal("scene_changed"),
    sceneName: z.string().min(1).max(256),
    sceneUuid: z.string().min(1).max(64),
    at: eventAt,
  }),
]);
export type NodeInstanceEvent = z.infer<typeof nodeInstanceEventSchema>;
