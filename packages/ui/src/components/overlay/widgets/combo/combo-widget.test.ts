import { describe, expect, it } from "bun:test";
import { comboWidgetItemConfigSchema } from "../../../../overlay-schemas";
import {
  EMPTY_COMBO_STATE,
  applyComboMessage,
  tickCombos,
  visibleCombos,
  type ComboRules,
  type ComboState,
} from "./combo-engine";
import {
  comboMilestoneLevel,
  createDefaultComboWidgetConfig,
  formatComboText,
  normalizeComboMilestones,
  normalizeComboWidgetConfig,
} from "./combo-widget-config";

const RULES: ComboRules = {
  mode: "time_window",
  windowSeconds: 8,
  threshold: 3,
  countMode: "unique",
  maxCombos: 1,
  lingerSeconds: 3,
};

const e = (code: string) => ({ code, url: `u/${code}` });

/** Sends `n` messages with `code` from `n` different chatters, one second apart. */
function spam(state: ComboState, code: string, n: number, start: number, rules = RULES, prefix = code) {
  let s = state;
  for (let i = 0; i < n; i++) s = applyComboMessage(s, { login: `${prefix}${i}`, emotes: [e(code)], at: start + i * 1000 }, rules);
  return s;
}

describe("combo config", () => {
  it("defaults survive a schema round trip", () => {
    const defaults = createDefaultComboWidgetConfig();
    expect(comboWidgetItemConfigSchema.parse(defaults)).toEqual(defaults);
    expect(comboWidgetItemConfigSchema.parse({})).toEqual(defaults);
  });

  it("normalizes junk", () => {
    const cfg = normalizeComboWidgetConfig({ mode: "x", maxCombos: 9, threshold: 0, milestones: [50, "10", 10, -1, 1.5] });
    expect(cfg.mode).toBe("time_window");
    expect(cfg.maxCombos).toBe(3);
    expect(cfg.threshold).toBe(2);
    expect(cfg.milestones).toEqual([10, 50]);
    expect(normalizeComboMilestones([1, 2, 3, 4, 5, 6, 7])).toHaveLength(5);
  });

  it("formats text and milestone levels", () => {
    expect(formatComboText("x{count} {emote} COMBO", 12, "Kappa")).toBe("x12 Kappa COMBO");
    expect(comboMilestoneLevel(9, [10, 25])).toBe(0);
    expect(comboMilestoneLevel(25, [10, 25])).toBe(2);
  });
});

describe("combo engine", () => {
  it("shows a combo once it passes the threshold", () => {
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 2, 0);
    expect(visibleCombos(s)).toHaveLength(0);
    s = applyComboMessage(s, { login: "c", emotes: [e("Kappa")], at: 2000 }, RULES);
    expect(visibleCombos(s).map((c) => [c.code, c.count])).toEqual([["Kappa", 3]]);
  });

  it("counts each chatter once in unique mode, every message otherwise", () => {
    let s = EMPTY_COMBO_STATE;
    for (let i = 0; i < 5; i++) s = applyComboMessage(s, { login: "spammer", emotes: [e("Kappa")], at: i * 100 }, RULES);
    expect(s.combos[0]!.count).toBe(1);
    let every = EMPTY_COMBO_STATE;
    const rules = { ...RULES, countMode: "every" as const };
    for (let i = 0; i < 5; i++) every = applyComboMessage(every, { login: "spammer", emotes: [e("Kappa")], at: i * 100 }, rules);
    expect(every.combos[0]!.count).toBe(5);
  });

  it("counts one message once, however many times the emote is in it", () => {
    const s = applyComboMessage(EMPTY_COMBO_STATE, { login: "a", emotes: [e("Kappa"), e("Kappa"), e("LUL")], at: 0 }, RULES);
    expect(s.combos.map((c) => [c.code, c.count])).toEqual([["Kappa", 1], ["LUL", 1]]);
  });

  it("time window: other messages don't break it, silence does", () => {
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 3, 0);
    s = applyComboMessage(s, { login: "x", emotes: [e("LUL")], at: 3000 }, RULES);
    s = applyComboMessage(s, { login: "d", emotes: [e("Kappa")], at: 4000 }, RULES);
    expect(visibleCombos(s)[0]!.count).toBe(4);
    s = tickCombos(s, 4000 + 8001, RULES);
    expect(visibleCombos(s)[0]!.endedAt).not.toBeNull();
    // Lingers, then goes.
    s = tickCombos(s, 4000 + 8000 + 3001, RULES);
    expect(visibleCombos(s)).toHaveLength(0);
    expect(s.combos).toHaveLength(0);
  });

  it("back to back: any other message breaks it", () => {
    const rules = { ...RULES, mode: "back_to_back" as const };
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 3, 0, rules);
    expect(visibleCombos(s)).toHaveLength(1);
    s = applyComboMessage(s, { login: "x", emotes: [], at: 3000 }, rules);
    expect(visibleCombos(s)[0]!.endedAt).toBe(3000);
    s = applyComboMessage(s, { login: "y", emotes: [e("Kappa")], at: 3500 }, rules);
    // A fresh combo starts; the old one keeps lingering on screen.
    expect(s.combos.filter((c) => c.code === "Kappa")).toHaveLength(2);
    expect(visibleCombos(s)[0]!.count).toBe(3);
  });

  it("one slot: a bigger combo takes over a live one only when it passes it", () => {
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 4, 0);
    s = spam(s, "LUL", 4, 100);
    expect(visibleCombos(s)[0]!.code).toBe("Kappa");
    s = applyComboMessage(s, { login: "extra", emotes: [e("LUL")], at: 5000 }, RULES);
    expect(visibleCombos(s)[0]!.code).toBe("LUL");
  });

  it("a lingering combo gives its slot to a new one", () => {
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 5, 0);
    s = tickCombos(s, 4000 + 8001, RULES);
    expect(visibleCombos(s)[0]!.endedAt).not.toBeNull();
    s = spam(s, "LUL", 3, 12100);
    expect(visibleCombos(s).map((c) => c.code)).toEqual(["LUL"]);
    expect(s.combos.some((c) => c.code === "Kappa")).toBe(false);
  });

  it("several slots keep their positions", () => {
    const rules = { ...RULES, maxCombos: 3 };
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 3, 0, rules);
    s = spam(s, "LUL", 5, 100, rules);
    expect(visibleCombos(s).map((c) => c.code)).toEqual(["Kappa", "LUL"]);
    s = spam(s, "Kappa", 3, 200, rules, "more");
    expect(visibleCombos(s).map((c) => c.code)).toEqual(["Kappa", "LUL"]);
  });

  it("returns the same state when nothing changes", () => {
    const s = spam(EMPTY_COMBO_STATE, "Kappa", 3, 0);
    expect(tickCombos(s, 3000, RULES)).toBe(s);
    expect(applyComboMessage(s, { login: "kappa0", emotes: [e("Kappa")], at: 3000 }, RULES)).toBe(s);
  });

  it("drops quiet candidates that never showed", () => {
    let s = spam(EMPTY_COMBO_STATE, "Kappa", 2, 0);
    s = tickCombos(s, 20000, RULES);
    expect(s.combos).toHaveLength(0);
  });
});
