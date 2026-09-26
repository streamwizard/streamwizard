import { describe, expect, test } from "bun:test";
import {
  createDefaultUptimeWidgetConfig,
  formatUptime,
  normalizeUptimeWidgetConfig,
  startedAtFrom,
  startedAtFromFrame,
} from "./uptime-widget-config";

describe("formatUptime", () => {
  test("H:MM:SS with hours running past a day", () => {
    expect(formatUptime(0, true)).toBe("0:00:00");
    expect(formatUptime(5 * 1000, true)).toBe("0:00:05");
    expect(formatUptime((2 * 3600 + 14 * 60 + 9) * 1000, true)).toBe("2:14:09");
    expect(formatUptime(30 * 3600 * 1000, true)).toBe("30:00:00");
  });

  test("H:MM without seconds, never negative", () => {
    expect(formatUptime((2 * 3600 + 14 * 60 + 59) * 1000, false)).toBe("2:14");
    expect(formatUptime(-5000, true)).toBe("0:00:00");
  });
});

describe("startedAtFrom", () => {
  test("reads a live stream's start, null otherwise", () => {
    expect(startedAtFrom({ is_live: true, started_at: "2026-09-24T12:00:00Z" })).toBe(Date.parse("2026-09-24T12:00:00Z"));
    expect(startedAtFrom({ is_live: false, started_at: null })).toBeNull();
    expect(startedAtFrom({ is_live: true, started_at: "nope" })).toBeNull();
    expect(startedAtFrom(null)).toBeNull();
  });
});

describe("startedAtFromFrame", () => {
  test("follows the sys.stream_started_at and sys.is_live pushes only", () => {
    const at = "2026-09-24T12:00:00Z";
    expect(startedAtFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.stream_started_at", value: at } })).toBe(Date.parse(at));
    expect(startedAtFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.stream_started_at", value: null } })).toBeNull();
    expect(startedAtFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.is_live", value: false } })).toBeNull();
    expect(startedAtFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.is_live", value: true } })).toBeUndefined();
    expect(startedAtFromFrame({ type: "streamwizard.user_state", payload: { key: "counter", value: 3 } })).toBeUndefined();
    expect(startedAtFromFrame({ type: "channel.follow", payload: {} })).toBeUndefined();
  });
});

describe("normalizeUptimeWidgetConfig", () => {
  test("returns the defaults for empty input", () => {
    expect(normalizeUptimeWidgetConfig({})).toEqual(createDefaultUptimeWidgetConfig());
    expect(normalizeUptimeWidgetConfig(null)).toEqual(createDefaultUptimeWidgetConfig());
  });

  test("clamps and rejects bad values", () => {
    const cfg = normalizeUptimeWidgetConfig({ fontSize: 900, layout: "diagonal", color: "red", label: "x".repeat(80), fontWeight: 650 });
    expect(cfg.fontSize).toBe(120);
    expect(cfg.layout).toBe("inline");
    expect(cfg.color).toBe("#ffffff");
    expect(cfg.label).toHaveLength(40);
    expect(cfg.fontWeight).toBe(600);
  });
});
