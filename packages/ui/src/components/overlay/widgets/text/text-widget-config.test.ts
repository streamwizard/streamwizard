import { describe, expect, it } from "bun:test";
import { formatCountdownMs, formatElapsedMs } from "../../lib/format-countdown";
import { textWidgetItemConfigSchema, timerWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  DEFAULT_TEXT_WIDGET_ITEM_CONFIG,
  TEXT_WIDGET_LIMITS,
  normalizeTextWidgetConfig,
  normalizeTimerWidgetConfig,
} from "../../types";

/** A text row as it was saved before outline, background and ticker existed. */
const LEGACY_TEXT = {
  text: "Hello chat",
  fontSize: 40,
  color: "#ff00aa",
  align: "center",
  fontWeight: 700,
  fontFamily: "Inter",
} as const;

describe("normalizeTextWidgetConfig", () => {
  it("reads an old row with every new effect off, so it looks the way it did", () => {
    expect(normalizeTextWidgetConfig(LEGACY_TEXT)).toEqual({
      ...LEGACY_TEXT,
      textShadow: false,
      outlineWidth: 0,
      outlineColor: "#000000",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      backgroundRounding: 0,
      scroll: false,
      scrollSpeed: 80,
    });
  });

  it("gives an empty config the defaults", () => {
    expect(normalizeTextWidgetConfig({})).toEqual(DEFAULT_TEXT_WIDGET_ITEM_CONFIG);
  });

  it("clamps the numbers and refuses a color that is not hex", () => {
    const cfg = normalizeTextWidgetConfig({
      ...LEGACY_TEXT,
      outlineWidth: 500,
      outlineColor: "red",
      backgroundOpacity: 3,
      backgroundRounding: -1,
      scrollSpeed: 1,
    });
    expect(cfg.outlineWidth).toBe(TEXT_WIDGET_LIMITS.outlineWidth.max);
    expect(cfg.outlineColor).toBe("#000000");
    expect(cfg.backgroundOpacity).toBe(1);
    expect(cfg.backgroundRounding).toBe(0);
    expect(cfg.scrollSpeed).toBe(TEXT_WIDGET_LIMITS.scrollSpeed.min);
  });
});

describe("text widget schema", () => {
  it("accepts an old row and fills in the same defaults as the normalizer", () => {
    expect(textWidgetItemConfigSchema.parse(LEGACY_TEXT)).toEqual(normalizeTextWidgetConfig(LEGACY_TEXT));
  });
});

describe("stopwatch mode", () => {
  it("survives the normalizer and the schema", () => {
    expect(normalizeTimerWidgetConfig({ countdownMode: "stopwatch" }).countdownMode).toBe("stopwatch");
    const parsed = timerWidgetItemConfigSchema.parse({
      ...normalizeTimerWidgetConfig({ countdownMode: "stopwatch" }),
    }) as { countdownMode: string };
    expect(parsed.countdownMode).toBe("stopwatch");
  });

  it("still falls back to a countdown for a mode it does not know", () => {
    expect(normalizeTimerWidgetConfig({ countdownMode: "sideways" }).countdownMode).toBe("duration");
  });
});

describe("formatElapsedMs", () => {
  it("shows zero as a time, where a countdown shows nothing", () => {
    expect(formatElapsedMs(0)).toBe("00:00:00");
    expect(formatCountdownMs(0)).toBe("");
  });

  it("counts minutes, hours and days", () => {
    expect(formatElapsedMs(65_000)).toBe("00:01:05");
    expect(formatElapsedMs(3_600_000 + 5_000)).toBe("01:00:05");
    expect(formatElapsedMs(86_400_000 + 60_000)).toBe("1d 00:01:00");
  });

  it("treats a negative clock skew as zero", () => {
    expect(formatElapsedMs(-500)).toBe("00:00:00");
  });
});
