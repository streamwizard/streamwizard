import { describe, expect, test } from "bun:test";
import {
  claimObsNodeSchema,
  insertInstanceSchema,
  patchNodeMeSchema,
  reconcileReportSchema,
  updateInstanceSchema,
} from "./schemas";

const USER = "0e0e0000-0000-4000-8000-000000000001";
const INSTANCE = "1a1a0000-0000-4000-8000-000000000001";

// What obs-instance-manager sends on create (services/instances/create-instance.ts).
const create = {
  id: INSTANCE,
  user_id: USER,
  node_id: "bbbbbbbb-0000-4000-8000-000000000001",
  container_id: null,
  container_name: `obs-instance-${INSTANCE}`,
  resolution: "1920x1080",
  status: "creating",
  vram_allocated_mb: 2048,
  memory_mb: 4096,
  cpu_quota: 1.5,
  shm_size: "2g",
  config_template: null,
  subscription_id: null,
  obs_ws_password: "pw",
};

describe("instance writes", () => {
  test("the node's create body passes; node_id and unknown keys are stripped", () => {
    const parsed = insertInstanceSchema.parse({ ...create, obs_ws_password_ciphertext: "x" });
    expect(parsed).not.toHaveProperty("node_id");
    expect(parsed).not.toHaveProperty("obs_ws_password_ciphertext");
    expect(parsed).toMatchObject({ user_id: USER, status: "creating", cpu_quota: 1.5 });
  });

  test("status is one of the table's values", () => {
    for (const status of ["creating", "running", "stopped", "error"]) {
      expect(updateInstanceSchema.safeParse({ status }).success).toBe(true);
    }
    expect(updateInstanceSchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(insertInstanceSchema.safeParse({ ...create, status: "anything" }).success).toBe(false);
  });

  test("strings, numbers and ids are bounded", () => {
    for (const bad of [
      { container_name: "c".repeat(129) },
      { resolution: "r".repeat(33) },
      { obs_ws_password: "p".repeat(257) },
      { vram_allocated_mb: 1.5 },
      { memory_mb: -1 },
      { cpu_quota: 2000 },
      { user_id: "not-a-uuid" },
      { subscription_id: "sub-1" },
    ]) {
      expect(insertInstanceSchema.safeParse({ ...create, ...bad }).success).toBe(false);
    }
    expect(updateInstanceSchema.safeParse({ used_storage_bytes: -1 }).success).toBe(false);
    expect(updateInstanceSchema.safeParse({ container_id: "a".repeat(129) }).success).toBe(false);
  });

  test("an update keeps only the fields a node may change", () => {
    expect(updateInstanceSchema.parse({ status: "running", container_id: "abc", user_id: USER, storage_quota_mb: 1 })).toEqual({
      status: "running",
      container_id: "abc",
    });
  });
});

describe("node bodies", () => {
  test("claim: what install.sh sends passes, junk is refused", () => {
    const body = {
      token: "t",
      gpu_bus_id: "PCI:1:0:0",
      vram_total_mb: 24576,
      ram_total_mb: 64000,
      cpu_cores: 16,
      gpu_model: "NVIDIA GeForce RTX 4090",
      storage_total_mb: 0,
    };
    expect(claimObsNodeSchema.parse({ ...body, extra: 1 })).toEqual(body);
    expect(claimObsNodeSchema.safeParse({ ...body, gpu_bus_id: "" }).success).toBe(false);
    expect(claimObsNodeSchema.safeParse({ ...body, token: "" }).success).toBe(false);
    expect(claimObsNodeSchema.safeParse({ ...body, ram_total_mb: "64000" }).success).toBe(false);
  });

  test("PATCH /me needs an IPv4 address", () => {
    expect(patchNodeMeSchema.parse({ tailscale_ip: "100.64.0.7" })).toEqual({ tailscale_ip: "100.64.0.7" });
    for (const ip of ["", "example.com", "100.64.0.7:3000/x", "x".repeat(70)]) {
      expect(patchNodeMeSchema.safeParse({ tailscale_ip: ip }).success).toBe(false);
    }
  });

  test("reconcile: every action the node reports passes, an unknown one doesn't", () => {
    const report = {
      reconciled_at: "2026-11-04T10:00:00.000Z",
      orphaned_containers: ["obs-instance-x"],
      instances: ["marked_error", "marked_running", "marked_stopped", "restarted", "restart_failed", "no_change"].map((action) => ({
        instance_id: INSTANCE,
        action,
      })),
    };
    expect(reconcileReportSchema.parse(report) as unknown).toEqual(report);
    expect(reconcileReportSchema.safeParse({ ...report, instances: [{ instance_id: INSTANCE, action: "exploded" }] }).success).toBe(false);
    expect(reconcileReportSchema.safeParse({ ...report, reconciled_at: "yesterday" }).success).toBe(false);
    expect(reconcileReportSchema.safeParse({ ...report, orphaned_containers: Array(501).fill("c") }).success).toBe(false);
    expect(reconcileReportSchema.safeParse({ reconciled_at: report.reconciled_at }).success).toBe(true);
  });
});
