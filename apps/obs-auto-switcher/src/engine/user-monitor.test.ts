import { test, expect, beforeEach } from "bun:test";
import type { IngestStatsPayload } from "@repo/types";
import { AUTO_SWITCHER_PRESET_THRESHOLDS, type AutoSwitcherConfig } from "@repo/schemas";
import { UserMonitor, type MonitorDeps } from "./user-monitor";
import { clearSwitchLog } from "./switch-log";
import type { EffectiveConfig } from "../config-store";

const USER = "user-1";

function baseRow(overrides: Partial<AutoSwitcherConfig> = {}): AutoSwitcherConfig {
  return {
    user_id: USER,
    enabled: true,
    mode: "simple",
    scene_model: "three",
    scene_live_uuid: "uuid-live",
    scene_live_name: "LIVE",
    scene_degraded_uuid: "uuid-low",
    scene_degraded_name: "LOW",
    scene_offline_uuid: "uuid-brb",
    scene_offline_name: "BRB",
    sensitivity_preset: "balanced",
    advanced_thresholds: null,
    pinned_stream_key_label: null,
    log_events_enabled: true,
    chat_notices_enabled: false,
    chat_template_degraded: "degraded {bitrate}",
    chat_template_offline: "offline",
    chat_template_recovered: "recovered",
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

function effective(rowOverrides: Partial<AutoSwitcherConfig> = {}): EffectiveConfig {
  const row = baseRow(rowOverrides);
  return { row, thresholds: AUTO_SWITCHER_PRESET_THRESHOLDS[row.sensitivity_preset] };
}

interface FakeDeps extends MonitorDeps {
  switches: { sceneUuid: string }[];
  chats: string[];
  events: string[];
  stops: number;
  overrideClears: number;
  failNextSwitch: boolean;
}

function fakeDeps(): FakeDeps {
  const deps: FakeDeps = {
    switches: [],
    chats: [],
    events: [],
    stops: 0,
    overrideClears: 0,
    failNextSwitch: false,
    async setScene(_userId, sceneUuid) {
      if (deps.failNextSwitch) {
        deps.failNextSwitch = false;
        return { ok: false, error: "node unreachable" };
      }
      deps.switches.push({ sceneUuid });
      return { ok: true };
    },
    async stopStream() {
      deps.stops++;
      return { ok: true };
    },
    async resolveSceneItemId() {
      return 7;
    },
    async setSceneItemEnabled() {
      return { ok: true };
    },
    async sendChat(_userId, template) {
      deps.chats.push(template);
    },
    async logEvent(_userId, entry) {
      deps.events.push(entry.reason);
    },
    async clearOverride() {
      deps.overrideClears++;
    },
    publishStatus() {},
  };
  return deps;
}

function stats(overrides: Partial<IngestStatsPayload> = {}): IngestStatsPayload {
  return { session_id: "sess-1", protocol: "srt", label: "Camera 1", kbps: 5000, rtt_ms: 50, loss_pct: 0.2, ...overrides };
}

// Drives the monitor like the real feed: one stats sample + one tick per second.
function feed(monitor: UserMonitor, payload: IngestStatsPayload, seconds: number, startMs: number): number {
  let now = startMs;
  for (let i = 0; i < seconds; i++) {
    now += 1000;
    monitor.onStats(payload, now);
    monitor.onTick(now);
  }
  return now;
}

// Ticks without stats (silence).
function silence(monitor: UserMonitor, seconds: number, startMs: number): number {
  let now = startMs;
  for (let i = 0; i < seconds; i++) {
    now += 1000;
    monitor.onTick(now);
  }
  return now;
}

async function settle() {
  // switch execution is a promise chain; let microtasks drain
  await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => clearSwitchLog(USER));

test("startup gate: goes live after startup_polls good samples", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps); // balanced: startup 5
  feed(monitor, stats(), 5, 0);
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }]);
  expect(monitor.buildStatus(6000).state).toBe("live");
});

test("bad link during startup goes straight to fallback", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps); // balanced startup gate 5
  feed(monitor, stats({ kbps: 200 }), 5, 0);
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-low" }]);
  expect(monitor.buildStatus(9000).state).toBe("degraded");
});

test("live -> degraded after trigger_polls bad, recover after recover_polls good", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  let now = feed(monitor, stats(), 5, 0); // go live
  now = feed(monitor, stats({ kbps: 300 }), 3, now); // balanced trigger 3
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }, { sceneUuid: "uuid-low" }]);

  now = feed(monitor, stats(), 19, now); // balanced recover 20 — not yet
  await settle();
  expect(deps.switches).toHaveLength(2);
  feed(monitor, stats(), 1, now);
  await settle();
  expect(deps.switches).toHaveLength(3);
  expect(deps.switches[2]).toEqual({ sceneUuid: "uuid-live" });
  expect(deps.events).toEqual(["auto_recover", "auto_fallback", "auto_recover"]);
});

test("two-scene model sends degraded quality to the offline scene", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective({ scene_model: "two", scene_degraded_uuid: null, scene_degraded_name: null }), deps);
  let now = feed(monitor, stats(), 5, 0);
  feed(monitor, stats({ loss_pct: 20 }), 3, now);
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }, { sceneUuid: "uuid-brb" }]);
});

test("silence past offline_timeout switches to the offline scene; resumed stats re-run the startup gate", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  let now = feed(monitor, stats(), 5, 0); // live
  now = silence(monitor, 6, now); // balanced offline timeout 5s
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }, { sceneUuid: "uuid-brb" }]);
  expect(monitor.buildStatus(now).state).toBe("offline");

  now = feed(monitor, stats(), 4, now); // startup gate 5 — not yet live
  await settle();
  expect(deps.switches).toHaveLength(2);
  feed(monitor, stats(), 1, now);
  await settle();
  expect(deps.switches).toHaveLength(3);
  expect(deps.switches[2]).toEqual({ sceneUuid: "uuid-live" });
});

test("rtt above threshold triggers fallback with rtt detail", async () => {
  const deps = fakeDeps();
  const events: string[] = [];
  const monitor = new UserMonitor(USER, effective(), {
    ...deps,
    async logEvent(_u, entry) {
      events.push(entry.detail);
    },
  });
  let now = feed(monitor, stats(), 5, 0);
  feed(monitor, stats({ rtt_ms: 900 }), 3, now);
  await settle();
  expect(events.some((d) => d.includes("RTT 900 ms > 300 ms"))).toBe(true);
});

test("chat notices fire per transition when enabled, but not on initial go-live", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective({ chat_notices_enabled: true }), deps);
  let now = feed(monitor, stats(), 5, 0); // startup complete — no chat
  await settle();
  expect(deps.chats).toEqual([]);
  now = feed(monitor, stats({ kbps: 100 }), 3, now);
  await settle();
  expect(deps.chats).toEqual(["degraded {bitrate}"]);
  now = feed(monitor, stats(), 20, now);
  await settle();
  expect(deps.chats).toEqual(["degraded {bitrate}", "recovered"]);
});

test("manual override switches immediately and suppresses auto logic; clearing re-runs recovery", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  let now = feed(monitor, stats(), 5, 0); // live
  await settle();

  monitor.applyConfig(effective({ override_scene_uuid: "uuid-held", override_scene_name: "HELD" }), now);
  await settle();
  expect(deps.switches[1]).toEqual({ sceneUuid: "uuid-held" });
  expect(monitor.buildStatus(now).state).toBe("override");

  // Bad stats while overridden: no auto switch.
  now = feed(monitor, stats({ kbps: 100 }), 10, now);
  await settle();
  expect(deps.switches).toHaveLength(2);

  // Clear override with a healthy link: full recover gate, then back live.
  monitor.applyConfig(effective(), now);
  now = feed(monitor, stats(), 20, now);
  await settle();
  expect(deps.switches[2]).toEqual({ sceneUuid: "uuid-live" });
});

test("expired override is cleared in the DB and recovery resumes", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  let now = feed(monitor, stats(), 5, 0);
  const expiresAt = new Date(now + 3_000).toISOString();
  monitor.applyConfig(effective({ override_scene_uuid: "uuid-held", override_scene_name: "HELD", override_expires_at: expiresAt }), now);
  await settle();
  expect(deps.switches[1]).toEqual({ sceneUuid: "uuid-held" });

  now = feed(monitor, stats(), 25, now); // expiry passes, then recover gate (20)
  await settle();
  expect(deps.overrideClears).toBe(1);
  expect(deps.switches[2]).toEqual({ sceneUuid: "uuid-live" });
});

test("auto stop fires after the configured offline minutes and only once", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective({ auto_stop_enabled: true, auto_stop_minutes: 1 }), deps);
  let now = feed(monitor, stats(), 5, 0);
  now = silence(monitor, 66, now);
  await settle();
  expect(deps.stops).toBe(1);
  now = silence(monitor, 60, now);
  await settle();
  expect(deps.stops).toBe(1);
});

test("failed switch is retried on a later tick", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  deps.failNextSwitch = true;
  let now = feed(monitor, stats(), 5, 0);
  await settle();
  expect(deps.switches).toHaveLength(0);
  expect(monitor.buildStatus(now).last_error).toBe("node unreachable");

  now = feed(monitor, stats(), 6, now); // retry window is 5s
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }]);
  expect(monitor.buildStatus(now).last_error).toBeNull();
});

test("pinned label ignores other sessions", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective({ pinned_stream_key_label: "Camera 1" }), deps);
  let now = 0;
  for (let i = 0; i < 5; i++) {
    now += 1000;
    monitor.onStats(stats({ session_id: "other", label: "Backup", kbps: 100 }), now);
    monitor.onStats(stats(), now);
    monitor.onTick(now);
  }
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }]);
  expect(monitor.buildStatus(now).selected_session?.session_id).toBe("sess-1");
});

test("session_ended for the watched session goes offline immediately", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  let now = feed(monitor, stats(), 5, 0);
  await settle();
  monitor.onSessionEnded("sess-1", now + 500);
  await settle();
  expect(deps.switches[1]).toEqual({ sceneUuid: "uuid-brb" });
  expect(monitor.buildStatus(now + 600).state).toBe("offline");
});

test("missing rtt/loss (RTMP) count as OK — only bitrate can trigger", async () => {
  const deps = fakeDeps();
  const monitor = new UserMonitor(USER, effective(), deps);
  const rtmp: IngestStatsPayload = { session_id: "sess-1", protocol: "rtmp", kbps: 4000 };
  let now = feed(monitor, rtmp, 5, 0);
  await settle();
  expect(deps.switches).toEqual([{ sceneUuid: "uuid-live" }]);
  feed(monitor, { ...rtmp, kbps: 100 }, 3, now);
  await settle();
  expect(deps.switches[1]).toEqual({ sceneUuid: "uuid-low" });
});
