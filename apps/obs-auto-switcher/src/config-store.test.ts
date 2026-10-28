import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AutoSwitcherConfig } from "@repo/schemas";

/**
 * Config pushes arrive over the consumer feed with a ws-server envelope
 * (msg.userId) and a caller-controlled body. The test-alert action let any
 * streamer broadcast this type with a body naming someone else's user_id, and
 * applyPush used to install that body as the other user's live config. Pinned
 * here: the body never becomes config, and a push only re-reads the
 * envelope user's own row.
 */

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let rows: Record<string, AutoSwitcherConfig | null>;
let reads: string[];

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("./lib/env", () => ({ env: { CONFIG_RECONCILE_INTERVAL_MS: 300_000 } }));
mock.module("@repo/supabase/queries/auto-switcher", () => ({
  selectAutoSwitcherConfig: async (_client: unknown, userId: string) => {
    reads.push(userId);
    return { data: rows[userId] ?? null, error: null };
  },
  selectEnabledAutoSwitcherConfigs: async () => ({ data: [], error: null }),
}));

const { ConfigStore } = await import("./config-store");

function row(userId: string, overrides: Partial<AutoSwitcherConfig> = {}): AutoSwitcherConfig {
  return {
    user_id: userId,
    enabled: true,
    mode: "simple",
    scene_model: "three",
    scene_live_uuid: "scene-live",
    scene_live_name: "Live",
    scene_degraded_uuid: "scene-degraded",
    scene_degraded_name: "Degraded",
    scene_offline_uuid: "scene-offline",
    scene_offline_name: "Offline",
    sensitivity_preset: "balanced",
    advanced_thresholds: null,
    pinned_stream_key_label: null,
    log_events_enabled: false,
    chat_notices_enabled: false,
    chat_template_degraded: "",
    chat_template_offline: "",
    chat_template_recovered: "",
    warning_source_enabled: false,
    warning_source_uuid: null,
    warning_source_name: null,
    auto_stop_enabled: false,
    auto_stop_minutes: 10,
    override_scene_uuid: null,
    override_scene_name: null,
    override_expires_at: null,
    ...overrides,
  };
}

describe("ConfigStore.applyPush", () => {
  beforeEach(() => {
    rows = {};
    reads = [];
  });

  test("drops a push whose body names another user than its envelope", async () => {
    rows[B] = row(B);
    const changes: string[] = [];
    const store = new ConfigStore((userId) => changes.push(userId));

    await store.applyPush(A, row(B, { enabled: false }));

    expect(reads).toEqual([]);
    expect(changes).toEqual([]);
  });

  test("never installs the pushed body: the envelope user's row is re-read", async () => {
    rows[A] = row(A, { scene_live_name: "From the database" });
    const store = new ConfigStore(() => {});

    await store.applyPush(A, row(A, { scene_live_name: "From the push", auto_stop_enabled: true }));

    expect(reads).toEqual([A]);
    expect(store.get(A)?.row.scene_live_name).toBe("From the database");
    expect(store.get(A)?.row.auto_stop_enabled).toBe(false);
  });

  test("a push for a user whose row is gone clears their monitor", async () => {
    const changes: [string, unknown][] = [];
    const store = new ConfigStore((userId, config) => changes.push([userId, config]));
    rows[A] = row(A);
    await store.applyPush(A, row(A));
    rows[A] = null;

    await store.applyPush(A, row(A));

    expect(store.get(A)).toBeUndefined();
    expect(changes.at(-1)).toEqual([A, null]);
  });
});
