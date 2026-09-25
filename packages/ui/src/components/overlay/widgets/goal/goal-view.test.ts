import { describe, expect, it } from "bun:test";
import { buildGoalView, goalBlockCount, goalBlocksLit, goalIconFor } from "./goal-view";
import { createDefaultGoalWidgetConfig, goalPresetChange, normalizeGoalWidgetConfig } from "./goal-widget-config";
import type { GoalSnapshot } from "./goal-widget-state";

const goal = (patch: Partial<GoalSnapshot> = {}): GoalSnapshot => ({
  id: "g",
  type: "subscription_count",
  description: "",
  current: 1,
  target: 10,
  ended: null,
  ...patch,
});

describe("buildGoalView", () => {
  it("words numbers, percent and what's left", () => {
    const view = buildGoalView(goal({ current: 1200, target: 5000, type: "new_bit" }), { title: "" }, "bits_goal_widget");
    expect(view.numbersText).toBe("1,200 / 5,000 Bits");
    expect(view.percentText).toBe("24%");
    expect(view.remainingText).toBe("3,800 Bits to go");
    expect(view.icon).toBe("gem");
  });

  it("uses the singular for one left", () => {
    expect(buildGoalView(goal({ current: 9 }), { title: "" }, "sub_goal_widget").remainingText).toBe("1 sub to go");
  });

  it("never shows 100% before the goal is met", () => {
    expect(buildGoalView(goal({ current: 999, target: 1000 }), { title: "" }, "sub_goal_widget").percentText).toBe("99%");
  });

  it("calls a met or achieved goal reached", () => {
    expect(buildGoalView(goal({ current: 10 }), { title: "" }, "sub_goal_widget").remainingText).toBe("Goal reached");
    const ended = buildGoalView(goal({ current: 3, ended: { achieved: true, at: 1 } }), { title: "" }, "sub_goal_widget");
    expect(ended.reached).toBe(true);
    expect(ended.percentText).toBe("100%");
  });

  it("titles: own title, then Twitch's, else none", () => {
    expect(buildGoalView(goal({ description: "Emote" }), { title: " Mine " }, "sub_goal_widget").title).toBe("Mine");
    expect(buildGoalView(goal({ description: "Emote" }), { title: "" }, "sub_goal_widget").title).toBe("Emote");
    const untitled = buildGoalView(goal(), { title: "" }, "follower_goal_widget");
    expect(untitled.title).toBe("");
    // Screen readers still get a name.
    expect(untitled.label).toBe("Follower goal");
  });

  it("handles a zero target", () => {
    const view = buildGoalView(goal({ current: 0, target: 0 }), { title: "" }, "sub_goal_widget");
    expect(view.progress).toBe(0);
    expect(view.reached).toBe(false);
  });
});

describe("blocks", () => {
  it("gives small targets one block each, else 10, unless set", () => {
    expect(goalBlockCount(7, 0)).toBe(7);
    expect(goalBlockCount(500, 0)).toBe(10);
    expect(goalBlockCount(0, 0)).toBe(10);
    expect(goalBlockCount(500, 25)).toBe(25);
  });

  it("splits progress into full and partial blocks", () => {
    expect(goalBlocksLit(0.35, 10)).toEqual({ full: 3, partial: expect.closeTo(0.5, 5) });
    expect(goalBlocksLit(1, 10)).toEqual({ full: 10, partial: 0 });
    expect(goalBlocksLit(0, 10)).toEqual({ full: 0, partial: 0 });
  });
});

describe("icons and config", () => {
  it("picks an icon per goal kind", () => {
    expect(goalIconFor("follow")).toBe("heart");
    expect(goalIconFor("new_subscription")).toBe("star");
    expect(goalIconFor("new_cheerer")).toBe("gem");
  });

  it("reads a phase 1 row as the Text preset with the new defaults", () => {
    const cfg = normalizeGoalWidgetConfig({ title: "Old", fillColor: "#ff0000", countBy: "auto" });
    expect(cfg.preset).toBe("text");
    expect(cfg.fillColor).toBe("#ff0000");
    expect(cfg.celebration).toBe("shine");
    expect(cfg.iconUrl).toBe("");
  });

  it("drops an icon URL that isn't http(s)", () => {
    expect(normalizeGoalWidgetConfig({ iconUrl: "javascript:alert(1)" }).iconUrl).toBe("");
  });
});

describe("switching designs", () => {
  const base = { ...createDefaultGoalWidgetConfig(), fontFamily: "Bebas Neue", radius: 12 };

  it("Arcade brings its font and gives the old one back on the way out", () => {
    const arcade = { ...base, ...goalPresetChange(base, "arcade") };
    expect(arcade.fontFamily).toBe("Press Start 2P");
    expect(arcade.radius).toBe(0);
    const back = { ...arcade, ...goalPresetChange(arcade, "ring") };
    expect(back.fontFamily).toBe("Bebas Neue");
    expect(back.radius).toBe(12);
    expect(back.arcadeRestoreFont).toBe("");
  });

  it("keeps a font picked by hand while on Arcade", () => {
    const arcade = { ...base, ...goalPresetChange(base, "arcade") };
    const picked = { ...arcade, fontFamily: "VT323", arcadeRestoreFont: "" };
    const back = { ...picked, ...goalPresetChange(picked, "bar") };
    expect(back.fontFamily).toBe("VT323");
    expect(back.radius).toBe(12);
  });

  it("leaves the font alone between other designs", () => {
    expect(goalPresetChange(base, "tube")).toEqual({ preset: "tube" });
  });

  it("survives a save: the restore fields normalise", () => {
    const arcade = normalizeGoalWidgetConfig({ ...base, ...goalPresetChange(base, "arcade") });
    expect(arcade.arcadeRestoreFont).toBe("Bebas Neue");
    expect(arcade.arcadeRestoreRadius).toBe(12);
  });
});
