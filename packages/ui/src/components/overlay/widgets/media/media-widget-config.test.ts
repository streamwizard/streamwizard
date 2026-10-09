import { describe, expect, it } from "bun:test";
import { imageWidgetItemConfigSchema, videoWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  createDefaultImageWidgetConfig,
  createDefaultVideoWidgetConfig,
  normalizeImageWidgetConfig,
  normalizeVideoWidgetConfig,
  roundingRadiusPx,
} from "./media-widget-config";

describe("normalizeImageWidgetConfig", () => {
  it("gives a missing or broken config the defaults", () => {
    expect(normalizeImageWidgetConfig(undefined)).toEqual(createDefaultImageWidgetConfig());
    expect(normalizeImageWidgetConfig({ url: 5, fit: "zoom", rounding: "lots" })).toEqual(
      createDefaultImageWidgetConfig()
    );
  });

  it("keeps valid values and clamps the rounding", () => {
    expect(normalizeImageWidgetConfig({ url: "https://cdn.test/a.png", fit: "cover", rounding: 250 })).toEqual({
      url: "https://cdn.test/a.png",
      fit: "cover",
      rounding: 100,
    });
  });

  it("drops the video-only keys an image has no use for", () => {
    expect(normalizeImageWidgetConfig({ ...createDefaultVideoWidgetConfig() })).toEqual(
      createDefaultImageWidgetConfig()
    );
  });
});

describe("normalizeVideoWidgetConfig", () => {
  it("starts looping and muted", () => {
    expect(normalizeVideoWidgetConfig({})).toEqual(createDefaultVideoWidgetConfig());
    expect(createDefaultVideoWidgetConfig()).toMatchObject({ loop: true, volume: 0 });
  });

  it("clamps the volume to 0–1", () => {
    expect(normalizeVideoWidgetConfig({ volume: 4 }).volume).toBe(1);
    expect(normalizeVideoWidgetConfig({ volume: -1 }).volume).toBe(0);
  });
});

describe("roundingRadiusPx", () => {
  it("is half the short side at 100, which is a circle on a square", () => {
    expect(roundingRadiusPx(100, { w: 300, h: 300 })).toBe(150);
    expect(roundingRadiusPx(100, { w: 400, h: 100 })).toBe(50);
  });

  it("scales with the percentage and stays within 0–100", () => {
    expect(roundingRadiusPx(0, { w: 300, h: 300 })).toBe(0);
    expect(roundingRadiusPx(50, { w: 200, h: 400 })).toBe(50);
    expect(roundingRadiusPx(500, { w: 200, h: 200 })).toBe(100);
  });
});

describe("media widget schemas", () => {
  it("default to the same config the widget is created with", () => {
    expect(imageWidgetItemConfigSchema.parse({})).toEqual(createDefaultImageWidgetConfig());
    expect(videoWidgetItemConfigSchema.parse({})).toEqual(createDefaultVideoWidgetConfig());
  });
});
