import { z } from "zod";

// Field allowlists for the instance-write routes. node_id is never accepted
// from the body — it's always forced to the authenticated node — and id/
// user_id are immutable after creation, so neither can be used to move a row
// to another node or reassign ownership. Unlisted keys are stripped by zod,
// including the encrypted *_password_* columns: rest-api writes those itself.
export const insertInstanceSchema = z.object({
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
  config_template: z.string().nullable().optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  // Plaintext. rest-api encrypts it; the node never sends or sees ciphertext.
  // Taking ciphertext from a node would let it store any ciphertext it has
  // and read the plaintext back from GET /instances/:id/secrets.
  obs_ws_password: z.string().min(1),
});

export const updateInstanceSchema = z.object({
  container_id: z.string().nullable().optional(),
  container_name: z.string().min(1).optional(),
  resolution: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  vram_allocated_mb: z.number().optional(),
  memory_mb: z.number().optional(),
  cpu_quota: z.number().optional(),
  shm_size: z.string().min(1).optional(),
  config_template: z.string().nullable().optional(),
  subscription_id: z.string().uuid().nullable().optional(),
  // No password columns: a node can't change its instances' passwords (see
  // obs_ws_password on insertInstanceSchema for why it can't send ciphertext).
  // Reported by the node after media uploads/deletes so the dashboard's storage
  // bar stays accurate. storage_quota_mb is intentionally NOT accepted here --
  // quota is admin/plan-owned, not something a node can raise for itself.
  used_storage_bytes: z.number().int().nonnegative().optional(),
});

/** PATCH /api/obs-nodes/me: the node reports its Tailscale IP once it has joined. */
export const patchNodeMeSchema = z.object({ tailscale_ip: z.string().min(1) });

const eventAt = z.string().datetime().optional();

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
