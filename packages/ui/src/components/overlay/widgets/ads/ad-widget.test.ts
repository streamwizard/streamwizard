import { describe, expect, test } from "bun:test";
import { createDefaultAdWidgetConfig, normalizeAdWidgetConfig } from "./ad-widget-config";
import {
  AD_BACK_MS,
  EMPTY_AD_STATE,
  adPhase,
  applyAdFrame,
  formatAdTime,
  isDemoAdFrame,
  scheduleFrom,
} from "./ad-widget-state";

const T = Date.parse("2026-09-24T12:00:00Z");
const cfg = createDefaultAdWidgetConfig();
const scheduled = (inMs: number) => ({ schedule: { nextAdAt: T + inMs, duration: 90, snoozeCount: 1 }, adBreak: null });
const begin = (seconds: number, startedAt = new Date(T).toISOString(), demo = false) => ({
  type: "channel.ad_break.begin",
  payload: { duration_seconds: seconds, started_at: startedAt, is_automatic: true, ...(demo ? { demo: true } : {}) },
});

describe("adPhase", () => {
  test("idle far from the ad, warning inside the window", () => {
    expect(adPhase(scheduled(10 * 60_000), cfg, T).phase).toBe("idle");
    const v = adPhase(scheduled(90_000), cfg, T);
    expect(v.phase).toBe("warning");
    expect(v.text).toBe("Ads in 1:30");
    expect(v.remaining).toBeCloseTo(0.75);
  });

  test("the window edge and a passed ad", () => {
    expect(adPhase(scheduled(2 * 60_000), cfg, T).phase).toBe("warning");
    expect(adPhase(scheduled(2 * 60_000 + 1), cfg, T).phase).toBe("idle");
    expect(adPhase(scheduled(-1000), cfg, T).phase).toBe("idle");
  });

  test("a running break counts down, then welcomes back, then goes idle", () => {
    const s = applyAdFrame(scheduled(1000), begin(60), T);
    expect(s.schedule?.nextAdAt).toBeNull();
    const running = adPhase(s, cfg, T + 18_000);
    expect(running.phase).toBe("running");
    expect(running.text).toBe("Back in 0:42");
    expect(adPhase(s, cfg, T + 61_000).phase).toBe("back");
    expect(adPhase(s, cfg, T + 60_000 + AD_BACK_MS + 1).phase).toBe("idle");
  });

  test("switched-off phases fall through", () => {
    const s = applyAdFrame(EMPTY_AD_STATE, begin(30), T);
    expect(adPhase(s, { ...cfg, showRunning: false }, T + 1000).phase).toBe("idle");
    expect(adPhase(s, { ...cfg, showBackMessage: false }, T + 31_000).phase).toBe("idle");
    expect(adPhase(scheduled(60_000), { ...cfg, showWarning: false }, T).phase).toBe("idle");
  });

  test("a start time far off our clock falls back to arrival", () => {
    const s = applyAdFrame(EMPTY_AD_STATE, begin(60, "2020-01-01T00:00:00Z"), T);
    expect(s.adBreak).toEqual({ startedAt: T, endsAt: T + 60_000 });
  });
});

test("test breaks are marked, real ones aren't", () => {
  expect(isDemoAdFrame(begin(60, undefined, true))).toBe(true);
  expect(isDemoAdFrame(begin(60))).toBe(false);
});

test("scheduleFrom and the timer format", () => {
  expect(scheduleFrom({ next_ad_at: null, duration: 0, snooze_count: 0 })?.nextAdAt).toBeNull();
  expect(scheduleFrom({ next_ad_at: new Date(T).toISOString(), duration: 90, snooze_count: 2 })).toEqual({
    nextAdAt: T,
    duration: 90,
    snoozeCount: 2,
  });
  expect(formatAdTime(0)).toBe("0:00");
  expect(formatAdTime(125)).toBe("2:05");
});

test("normalize keeps half-minute warnings inside the range", () => {
  expect(normalizeAdWidgetConfig({ warnMinutes: 1.3 }).warnMinutes).toBe(1.5);
  expect(normalizeAdWidgetConfig({ warnMinutes: 99 }).warnMinutes).toBe(10);
  expect(normalizeAdWidgetConfig({ preset: "ring" }).preset).toBe("ring");
});
