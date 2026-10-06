import { describe, expect, test } from "bun:test";
import { activeAlerts, buildAttentionList, buildSubsystemStatus, formatLiveFor, type AlertStateLike, type RuleInfo } from "./overview";

const NOW = new Date("2026-10-04T12:00:00Z").getTime();
const later = new Date(NOW + 3_600_000).toISOString();
const earlier = new Date(NOW - 3_600_000).toISOString();

const state = (over: Partial<AlertStateLike>): AlertStateLike => ({
  id: over.rule_id ?? "id",
  rule_id: "ws.auth_failures",
  entity_id: "ws-1",
  status: "firing",
  severity: "warn",
  message: "too many",
  silenced_until: null,
  ...over,
});

const rule = (id: string, over: Partial<RuleInfo> = {}): RuleInfo => ({
  id,
  title: id,
  defaultEnabled: true,
  defaultEnvs: ["prod", "staging", "dev"],
  ...over,
});

const RULES = [rule("ws.auth_failures"), rule("api.latency"), rule("gpu.vram"), rule("backup.age"), rule("db.size")];

const health = (states: AlertStateLike[], rules = RULES, overrides: Parameters<typeof buildSubsystemStatus>[2] = [], env = "prod") =>
  Object.fromEntries(buildSubsystemStatus(states, rules, overrides, env, NOW).map((s) => [s.key, s.health]));

describe("buildSubsystemStatus", () => {
  test("a watched subsystem with nothing firing is ok", () => {
    expect(health([]).ws).toBe("ok");
    expect(health([state({ status: "ok" })]).ws).toBe("ok");
  });

  test("an unwatched subsystem says so instead of looking healthy", () => {
    const result = health([]);
    expect(result.eventsub).toBe("none");
    expect(result.vms).toBe("none");
  });

  test("the worst firing severity wins", () => {
    expect(health([state({})]).ws).toBe("warn");
    expect(health([state({}), state({ id: "b", severity: "crit" })]).ws).toBe("crit");
  });

  test("silenced alerts don't shout, but don't read as ok either", () => {
    expect(health([state({ silenced_until: later })]).ws).toBe("silenced");
    expect(health([state({ silenced_until: earlier })]).ws).toBe("warn");
  });

  test("several rule prefixes feed one subsystem", () => {
    expect(health([state({ rule_id: "gpu.vram" })]).obs).toBe("warn");
    expect(health([state({ rule_id: "db.size", severity: "crit" })]).database).toBe("crit");
  });

  test("an override that turns every rule off leaves the subsystem unwatched", () => {
    expect(health([], RULES, [{ rule_id: "ws.auth_failures", enabled: false, envs: null }]).ws).toBe("none");
    expect(health([], RULES, [{ rule_id: "ws.auth_failures", enabled: true, envs: ["staging"] }]).ws).toBe("none");
    expect(health([], RULES, [{ rule_id: "ws.auth_failures", enabled: true, envs: ["staging"] }], "staging").ws).toBe("ok");
  });

  test("rules outside every subsystem only show up when they exist", () => {
    expect(health([]).other).toBeUndefined();
    expect(health([], [...RULES, rule("probe.overlay")]).other).toBe("ok");
    expect(health([state({ rule_id: "probe.overlay", severity: "crit" })]).other).toBe("crit");
  });
});

describe("activeAlerts", () => {
  test("drops silenced and resolved states and puts crit first", () => {
    const result = activeAlerts(
      [state({ id: "warn" }), state({ id: "quiet", silenced_until: later }), state({ id: "done", status: "ok" }), state({ id: "crit", severity: "crit" })],
      NOW,
    );
    expect(result.map((s) => s.id)).toEqual(["crit", "warn"]);
  });
});

describe("buildAttentionList", () => {
  const base = { alerts: [], ruleTitles: new Map<string, string>(), ticketsAwaitingStaff: 0, pendingWidgets: 0, failedClipSyncs: 0, setupGaps: [] };

  test("nothing to do is an empty list", () => {
    expect(buildAttentionList(base)).toEqual([]);
  });

  test("alerts come first, then the queues, then setup gaps", () => {
    const items = buildAttentionList({
      ...base,
      alerts: [state({ id: "a", severity: "crit" })],
      ruleTitles: new Map([["ws.auth_failures", "WebSocket auth failures"]]),
      ticketsAwaitingStaff: 2,
      pendingWidgets: 1,
      failedClipSyncs: 3,
      setupGaps: ["/discord/live"],
    });
    expect(items.map((item) => item.key)).toEqual(["alert-a", "tickets", "clip-syncs", "widgets", "setup-/discord/live"]);
    expect(items[0]).toMatchObject({ tone: "crit", title: "WebSocket auth failures", detail: "ws-1 · too many", href: "/alerts" });
    expect(items[1]?.title).toBe("2 tickets are waiting for a reply");
    expect(items[3]?.title).toBe("1 widget is waiting for review");
  });

  test("a long alert list is cut to five rows plus a count", () => {
    const alerts = Array.from({ length: 8 }, (_, i) => state({ id: `a${i}` }));
    const items = buildAttentionList({ ...base, alerts });
    expect(items).toHaveLength(6);
    expect(items[5]).toMatchObject({ key: "alerts-more", title: "3 more alerts firing" });
  });
});

test("formatLiveFor", () => {
  expect(formatLiveFor(null, NOW)).toBe("—");
  expect(formatLiveFor(new Date(NOW - 42 * 60_000).toISOString(), NOW)).toBe("42m");
  expect(formatLiveFor(new Date(NOW - 185 * 60_000).toISOString(), NOW)).toBe("3h 5m");
});
