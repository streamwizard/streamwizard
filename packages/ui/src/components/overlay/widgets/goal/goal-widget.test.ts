import { describe, expect, it } from "bun:test";
import { buildWidgetTestEvent } from "@repo/schemas";
import {
  createDefaultGoalWidgetConfig,
  normalizeGoalWidgetConfig,
  twitchGoalTypesFor,
} from "./goal-widget-config";
import {
  applyGoalFrame,
  goalProgress,
  isDemoGoalFrame,
  pickGoal,
  seedGoals,
  type GoalWidgetState,
} from "./goal-widget-state";

describe("goal widget config", () => {
  it("fills a missing or broken config with defaults", () => {
    expect(normalizeGoalWidgetConfig(undefined)).toEqual(createDefaultGoalWidgetConfig());
    const cfg = normalizeGoalWidgetConfig({ onEnd: "nope", fontSize: 500, fillColor: "red", title: "x".repeat(200) });
    expect(cfg.onEnd).toBe("keep");
    expect(cfg.fontSize).toBe(72);
    expect(cfg.fillColor).toBe("#9e7aff");
    expect(cfg.title).toHaveLength(80);
  });

  it("maps each widget to its Twitch goal types", () => {
    expect(twitchGoalTypesFor("follower_goal_widget")).toEqual(["follow"]);
    expect(twitchGoalTypesFor("bits_goal_widget")).toEqual(["new_bit", "new_cheerer"]);
    // Twitch runs one sub goal at a time, so the sub widget covers all four kinds.
    expect([...twitchGoalTypesFor("sub_goal_widget")].sort()).toEqual(
      ["new_subscription", "new_subscription_count", "subscription", "subscription_count"],
    );
  });
});

describe("goal widget state", () => {
  const frame = (type: "channel.goal.begin" | "channel.goal.progress" | "channel.goal.end", variant = "follow") =>
    buildWidgetTestEvent(type, undefined, variant);

  it("ignores frames that aren't goal events", () => {
    const state: GoalWidgetState = {};
    expect(applyGoalFrame(state, { type: "channel.follow", payload: {} }, 0)).toBe(state);
    expect(applyGoalFrame(state, { type: "channel.goal.progress", payload: { type: "bits" } }, 0)).toBe(state);
  });

  it("tracks begin, progress and end per goal type", () => {
    let state: GoalWidgetState = {};
    state = applyGoalFrame(state, frame("channel.goal.begin"), 1);
    expect(state.follow?.current).toBe(0);
    state = applyGoalFrame(state, frame("channel.goal.progress", "subscription"), 2);
    expect(state.subscription?.ended).toBeNull();
    state = applyGoalFrame(state, frame("channel.goal.end"), 3);
    expect(state.follow?.ended).toEqual({ achieved: true, at: 3 });
    expect(state.follow?.current).toBe(state.follow?.target);
  });

  it("lets a live event win over the page-load fetch", () => {
    let state = applyGoalFrame({}, frame("channel.goal.end"), 1);
    state = seedGoals(state, [
      { id: "g1", type: "follow", description: "old", current_amount: 1, target_amount: 10 },
      { id: "g2", type: "subscription_count", description: "subs", current_amount: 3, target_amount: 10 },
    ]);
    expect(state.follow?.description).not.toBe("old");
    expect(state.subscription_count?.current).toBe(3);
  });

  it("reads Helix's \"follower\" as the follow goal", () => {
    const state = seedGoals({}, [
      { id: "f", type: "follower", description: "", current_amount: 574, target_amount: 610 },
    ]);
    expect(pickGoal(state, ["follow"])?.current).toBe(574);
    const next = applyGoalFrame(state, { type: "channel.goal.progress", payload: { id: "f", type: "follower", current_amount: 575, target_amount: 610 } }, 1);
    expect(next.follow?.current).toBe(575);
  });

  it("returns the same state when the fetch adds nothing", () => {
    const state: GoalWidgetState = {};
    expect(seedGoals(state, [])).toBe(state);
  });

  it("the sub widget picks up whichever sub goal kind is running", () => {
    const types = twitchGoalTypesFor("sub_goal_widget");
    for (const type of ["subscription", "new_subscription_count"]) {
      const state = seedGoals({}, [{ id: type, type, description: "", current_amount: 1, target_amount: 2 }]);
      expect(pickGoal(state, types)?.id).toBe(type);
    }
    expect(pickGoal({}, types)).toBeNull();
  });

  it("tells test goals apart from real ones", () => {
    expect(isDemoGoalFrame(frame("channel.goal.progress", "subscription"))).toBe(true);
    expect(isDemoGoalFrame({ type: "channel.goal.progress", payload: { id: "2nc1wTNeJHkQLjaVFqLETtCm3D9" } })).toBe(false);
  });

  it("clamps progress", () => {
    expect(goalProgress({ current: 5, target: 10 })).toBe(0.5);
    expect(goalProgress({ current: 15, target: 10 })).toBe(1);
    expect(goalProgress({ current: 0, target: 0 })).toBe(0);
  });
});
