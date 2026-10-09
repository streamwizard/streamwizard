import { describe, expect, it } from "bun:test";
import { slideshowWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  SLIDESHOW_WIDGET_LIMITS,
  createDefaultSlideshowWidgetConfig,
  nextSlideIndex,
  normalizeSlideshowWidgetConfig,
} from "./slideshow-widget-config";

describe("normalizeSlideshowWidgetConfig", () => {
  it("gives a missing or broken config the defaults", () => {
    expect(normalizeSlideshowWidgetConfig(undefined)).toEqual(createDefaultSlideshowWidgetConfig());
    expect(
      normalizeSlideshowWidgetConfig({ images: "a.png", intervalSeconds: "soon", transition: "spin", fit: "zoom" })
    ).toEqual(createDefaultSlideshowWidgetConfig());
  });

  it("drops entries that are not a URL and keeps the order of the rest", () => {
    const cfg = normalizeSlideshowWidgetConfig({ images: ["https://cdn.test/a.png", "", 4, null, "https://cdn.test/b.png"] });
    expect(cfg.images).toEqual(["https://cdn.test/a.png", "https://cdn.test/b.png"]);
  });

  it("caps the list and clamps the timing", () => {
    const many = Array.from({ length: 50 }, (_, i) => `https://cdn.test/${i}.png`);
    const cfg = normalizeSlideshowWidgetConfig({ images: many, intervalSeconds: 0 });
    expect(cfg.images).toHaveLength(SLIDESHOW_WIDGET_LIMITS.images);
    expect(cfg.intervalSeconds).toBe(SLIDESHOW_WIDGET_LIMITS.intervalSeconds.min);
  });
});

describe("nextSlideIndex", () => {
  it("goes through the list in order and wraps around", () => {
    expect(nextSlideIndex(0, 3, false)).toBe(1);
    expect(nextSlideIndex(1, 3, false)).toBe(2);
    expect(nextSlideIndex(2, 3, false)).toBe(0);
  });

  it("stays on the only picture there is", () => {
    expect(nextSlideIndex(0, 1, false)).toBe(0);
    expect(nextSlideIndex(0, 1, true)).toBe(0);
    expect(nextSlideIndex(0, 0, true)).toBe(0);
  });

  it("never repeats the picture on screen when shuffled", () => {
    for (let current = 0; current < 4; current++) {
      for (const r of [0, 0.2, 0.5, 0.8, 0.999999, 1]) {
        const next = nextSlideIndex(current, 4, true, () => r);
        expect(next).not.toBe(current);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(4);
      }
    }
  });

  it("can reach every other picture when shuffled", () => {
    const reached = new Set([0, 0.34, 0.67].map((r) => nextSlideIndex(1, 4, true, () => r)));
    expect([...reached].sort()).toEqual([0, 2, 3]);
  });
});

describe("slideshow widget schema", () => {
  it("defaults to the same config the widget is created with", () => {
    expect(slideshowWidgetItemConfigSchema.parse({})).toEqual(createDefaultSlideshowWidgetConfig());
  });

  it("refuses more pictures than the widget shows", () => {
    const many = Array.from({ length: SLIDESHOW_WIDGET_LIMITS.images + 1 }, (_, i) => `https://cdn.test/${i}.png`);
    expect(slideshowWidgetItemConfigSchema.safeParse({ images: many }).success).toBe(false);
  });
});
