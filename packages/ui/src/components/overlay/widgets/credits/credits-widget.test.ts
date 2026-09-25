import { describe, expect, it } from "bun:test";
import { buildDemoCreditsData, emptyCredits } from "@repo/schemas";
import {
  CREDITS_SECTION_IDS,
  CREDITS_WIDGET_ARCADE_FONT,
  createDefaultCreditsWidgetConfig,
  creditsPresetChange,
  normalizeCreditsSections,
  normalizeCreditsWidgetConfig,
} from "./credits-widget-config";
import { applyNameLimit, buildCreditsView, formatCreditsDuration, overflowLine } from "./credits-view";
import { creditsTimeline, progressAt, scrollOffsetAt, stepIndexAt } from "./credits-playback";
import { streamChangedFromFrame } from "./credits-widget-state";

const NOW = Date.parse("2026-09-24T21:30:00.000Z");

describe("credits widget config", () => {
  it("fills a missing or broken config with defaults", () => {
    expect(normalizeCreditsWidgetConfig(undefined)).toEqual(createDefaultCreditsWidgetConfig());
    const cfg = normalizeCreditsWidgetConfig({
      preset: "nope",
      fontSize: 500,
      accentColor: "purple",
      titleText: "x".repeat(200),
      maxNamesPerSection: -4,
      scrollSpeed: 9999,
    });
    expect(cfg.preset).toBe("classic");
    expect(cfg.fontSize).toBe(72);
    expect(cfg.accentColor).toBe("#9e7aff");
    expect(cfg.titleText).toHaveLength(80);
    expect(cfg.maxNamesPerSection).toBe(0);
    expect(cfg.scrollSpeed).toBe(240);
  });

  it("repairs a stored section list", () => {
    const sections = normalizeCreditsSections([
      { id: "raids", enabled: false, label: "Raiders!" },
      { id: "followers", enabled: true, label: "x".repeat(60) },
      { id: "raids", enabled: true, label: "dupe" },
      { id: "bogus", enabled: true, label: "?" },
      { id: "title", enabled: true, label: "should be blank" },
    ]);
    expect(sections.slice(0, 3).map((s) => s.id)).toEqual(["raids", "followers", "title"]);
    expect(sections[0]).toEqual({ id: "raids", enabled: false, label: "Raiders!" });
    expect(sections[1]!.label).toHaveLength(40);
    expect(sections[2]!.label).toBe("");
    expect(sections.map((s) => s.id).sort()).toEqual([...CREDITS_SECTION_IDS].sort());
    expect(new Set(sections.map((s) => s.id)).size).toBe(CREDITS_SECTION_IDS.length);
  });

  it("swaps the font for Arcade and puts it back afterwards", () => {
    const cfg = { ...createDefaultCreditsWidgetConfig(), fontFamily: "Inter" };
    const toArcade = { ...cfg, ...creditsPresetChange(cfg, "arcade") };
    expect(toArcade.fontFamily).toBe(CREDITS_WIDGET_ARCADE_FONT);
    expect(toArcade.arcadeRestoreFont).toBe("Inter");
    const back = { ...toArcade, ...creditsPresetChange(toArcade, "cards") };
    expect(back.fontFamily).toBe("Inter");
    expect(back.arcadeRestoreFont).toBe("");
    // A font picked by hand while on Arcade stays.
    const handPicked = { ...toArcade, fontFamily: "Lato", arcadeRestoreFont: "" };
    expect({ ...handPicked, ...creditsPresetChange(handPicked, "classic") }.fontFamily).toBe("Lato");
    expect(creditsPresetChange(cfg, "classic")).toEqual({});
  });
});

describe("credits view", () => {
  const data = buildDemoCreditsData(NOW);

  it("drops empty sections and keeps the streamer's order", () => {
    const cfg = createDefaultCreditsWidgetConfig();
    cfg.sections = [...cfg.sections].reverse();
    const view = buildCreditsView(data, cfg);
    expect(view[0]!.id).toBe("outro");
    expect(view.at(-1)!.id).toBe("title");
    // Blank thank-you note: no section.
    expect(view.find((s) => s.id === "thanks")).toBeUndefined();
    // Disabled: gone.
    cfg.sections = cfg.sections.map((s) => (s.id === "raids" ? { ...s, enabled: false } : s));
    expect(buildCreditsView(data, cfg).find((s) => s.id === "raids")).toBeUndefined();
  });

  it("cuts long lists and says how many were left out", () => {
    const cfg = { ...createDefaultCreditsWidgetConfig(), maxNamesPerSection: 5, moreText: "+{n} others" };
    const followers = buildCreditsView(data, cfg).find((s) => s.id === "followers")!;
    expect(followers.names).toHaveLength(5);
    expect(followers.overflow).toBe(data.followers.length - 5);
    expect(followers.overflowText).toBe(`+${data.followers.length - 5} others`);
    expect(followers.count).toBe(data.followers.length);
    expect(applyNameLimit([1, 2, 3], 0)).toEqual({ kept: [1, 2, 3], overflow: 0 });
    expect(overflowLine("and more", 3)).toBe("and more 3");
  });

  it("prints values per section and hides them when off", () => {
    const on = buildCreditsView(data, createDefaultCreditsWidgetConfig());
    expect(on.find((s) => s.id === "cheerers")!.names[0]!.valueText).toBe("1,750 Bits");
    expect(on.find((s) => s.id === "gifters")!.names[0]!.valueText).toBe("5 subs");
    expect(on.find((s) => s.id === "raids")!.names[0]!.valueText).toBe("42 viewers");
    expect(on.find((s) => s.id === "redemptions")!.names[0]!.valueText).toBe("×3");
    expect(on.find((s) => s.id === "duration")!.stat).toBe("3h 12m");
    expect(on.find((s) => s.id === "hype_train")!.stat).toBe("Level 4");
    const off = buildCreditsView(data, { ...createDefaultCreditsWidgetConfig(), showValues: false, showCounts: false });
    expect(off.find((s) => s.id === "cheerers")!.names[0]!.valueText).toBe("");
    expect(off.find((s) => s.id === "followers")!.count).toBeNull();
  });

  it("shows only the words when there's no stream", () => {
    const view = buildCreditsView(emptyCredits("stream"), createDefaultCreditsWidgetConfig());
    expect(view.map((s) => s.id)).toEqual(["title", "outro"]);
  });

  it("formats durations", () => {
    expect(formatCreditsDuration(30)).toBe("1m");
    expect(formatCreditsDuration(48 * 60)).toBe("48m");
    expect(formatCreditsDuration(3 * 3600)).toBe("3h");
    expect(formatCreditsDuration(2 * 3600 + 14 * 60 + 9)).toBe("2h 14m");
  });
});

describe("credits timeline", () => {
  const data = buildDemoCreditsData(NOW);

  it("scrolls in from off the far edge and out past the near one at the set speed", () => {
    const cfg = { ...createDefaultCreditsWidgetConfig(), preset: "classic" as const, scrollSpeed: 100 };
    const sections = buildCreditsView(data, cfg);
    const tall = creditsTimeline(sections, cfg, { contentPx: 2000, viewportPx: 900 }, false);
    expect(tall.mode).toBe("scroll");
    expect(tall.fromPx).toBe(900);
    expect(tall.toPx).toBe(-2000);
    expect(tall.totalMs).toBe(29_000);
    expect(scrollOffsetAt(tall, 0)).toBe(900);
    expect(scrollOffsetAt(tall, 1)).toBe(-2000);
    // Shorter than the box: still runs all the way through and out.
    const short = creditsTimeline(sections, cfg, { contentPx: 300, viewportPx: 900 }, false);
    expect(short.toPx).toBe(-300);
    expect(short.totalMs).toBe(12_000);
  });

  it("steps through sections, lingering on long lists", () => {
    const cfg = { ...createDefaultCreditsWidgetConfig(), preset: "cards" as const, secondsPerSection: 4 };
    const sections = buildCreditsView(data, cfg);
    const t = creditsTimeline(sections, cfg, { contentPx: 0, viewportPx: 0 }, false);
    expect(t.mode).toBe("step");
    expect(t.steps).toHaveLength(sections.length);
    const followers = sections.findIndex((s) => s.id === "followers");
    expect(t.steps[followers]!.durationMs).toBe(4000 + 350 * 12);
    expect(t.steps[0]!.durationMs).toBe(4000);
    expect(t.totalMs).toBe(t.steps.reduce((sum, s) => sum + s.durationMs, 0));
    expect(stepIndexAt(t, 0)).toBe(0);
    expect(stepIndexAt(t, t.steps[1]!.startMs)).toBe(1);
    expect(stepIndexAt(t, t.totalMs + 5000)).toBe(sections.length - 1);
    expect(progressAt(t, t.totalMs / 2)).toBeCloseTo(0.5);
  });

  it("steps instead of scrolling when motion is reduced", () => {
    const cfg = { ...createDefaultCreditsWidgetConfig(), preset: "ticker" as const };
    const sections = buildCreditsView(data, cfg);
    expect(creditsTimeline(sections, cfg, { contentPx: 4000, viewportPx: 1280 }, true).mode).toBe("step");
    expect(creditsTimeline(sections, cfg, { contentPx: 4000, viewportPx: 1280 }, false).mode).toBe("scroll");
  });
});

describe("streamChangedFromFrame", () => {
  it("picks out the stream lifecycle keys only", () => {
    expect(streamChangedFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.stream_id", value: "1" } })).toBe(true);
    expect(streamChangedFromFrame({ type: "streamwizard.user_state", payload: { key: "sys.is_live", value: false } })).toBe(true);
    expect(streamChangedFromFrame({ type: "streamwizard.user_state", payload: { key: "my.counter", value: 3 } })).toBe(false);
    expect(streamChangedFromFrame({ type: "channel.follow", payload: {} })).toBe(false);
  });
});
