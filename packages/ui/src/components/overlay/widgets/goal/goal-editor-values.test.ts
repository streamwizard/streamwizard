import { describe, expect, test } from "bun:test";
import { applyEditorGoalValue, EDITOR_GOAL_DEFAULT_TARGET } from "./goal-editor-values";
import type { GoalSnapshot } from "./goal-widget-state";

const real: GoalSnapshot = { id: "g1", type: "follow", description: "Road to 500", current: 410, target: 500, ended: null };

describe("editor goal values", () => {
  test("typed numbers replace the real ones, the rest stays", () => {
    expect(applyEditorGoalValue(real, { current: 495 }, "follow")).toEqual({ ...real, current: 495 });
  });

  test("with no goal running it makes one up", () => {
    expect(applyEditorGoalValue(null, { current: 30 }, "new_bit")).toEqual({
      id: "editor-goal",
      type: "new_bit",
      description: "",
      current: 30,
      target: EDITOR_GOAL_DEFAULT_TARGET,
      ended: null,
    });
  });

  test("nothing typed leaves the goal alone", () => {
    expect(applyEditorGoalValue(real, {}, "follow")).toBe(real);
    expect(applyEditorGoalValue(null, undefined, "follow")).toBeNull();
  });
});
