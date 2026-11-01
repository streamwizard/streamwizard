import { z } from "zod";

// Field allowlists for the instance-write routes. node_id is never accepted
// from the body — it's always forced to the authenticated node — and id/
// user_id are immutable after creation, so neither can be used to move a row
// to another node or reassign ownership. Unlisted keys are stripped by zod.
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
  obs_ws_password_ciphertext: z.string().nullable().optional(),
  obs_ws_password_iv: z.string().nullable().optional(),
  obs_ws_password_tag: z.string().nullable().optional(),
  vnc_password_ciphertext: z.string().nullable().optional(),
  vnc_password_iv: z.string().nullable().optional(),
  vnc_password_tag: z.string().nullable().optional(),
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
  obs_ws_password_ciphertext: z.string().nullable().optional(),
  obs_ws_password_iv: z.string().nullable().optional(),
  obs_ws_password_tag: z.string().nullable().optional(),
  vnc_password_ciphertext: z.string().nullable().optional(),
  vnc_password_iv: z.string().nullable().optional(),
  vnc_password_tag: z.string().nullable().optional(),
  // Reported by the node after media uploads/deletes so the dashboard's storage
  // bar stays accurate. storage_quota_mb is intentionally NOT accepted here --
  // quota is admin/plan-owned, not something a node can raise for itself.
  used_storage_bytes: z.number().int().nonnegative().optional(),
});

/** PATCH /api/obs-nodes/me: the node reports its Tailscale IP once it has joined. */
export const patchNodeMeSchema = z.object({ tailscale_ip: z.string().min(1) });
