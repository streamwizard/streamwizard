import { expect, test } from "bun:test";
import {
  EMPTY_EDITOR_STATE,
  applyEditorStateWrite,
  isEditorStateEmpty,
  parseEditorStateData,
  USER_STATE_KEY_PATTERN,
} from "./editor-state-data";
import { demoRelevance, usesWidgetState } from "./demo-relevance";

test("saved editor data survives a round trip and junk loads as empty", () => {
  const data = {
    userState: { count: 3, gone: null },
    widgetState: { "item-1": { best: 9 } },
    labels: { latest_follower: { name: "xQc" }, follower_count: { amount: 9001 } },
    goals: { sub_goal_widget: { current: 45, target: 50 } },
  };
  expect(parseEditorStateData(JSON.stringify(data))).toEqual(data);
  expect(parseEditorStateData(null)).toEqual(EMPTY_EDITOR_STATE);
  expect(parseEditorStateData("{not json")).toEqual(EMPTY_EDITOR_STATE);
  expect(
    parseEditorStateData(
      JSON.stringify({
        userState: [1],
        widgetState: { a: 5, b: { ok: 1 } },
        labels: { a: { name: 5 }, b: { amount: "x" }, c: { name: "ok" } },
        goals: { a: { current: "1" }, b: { target: 10 } },
      })
    )
  ).toEqual({
    userState: {},
    widgetState: { b: { ok: 1 } },
    labels: { c: { name: "ok" } },
    goals: { b: { target: 10 } },
  });
});

test("a widget's writes land under its own item id", () => {
  let data = parseEditorStateData(null);
  expect(isEditorStateEmpty(data)).toBe(true);
  data = applyEditorStateWrite(data, "item-1", { scope: "widget", value: { best: 1 } });
  data = applyEditorStateWrite(data, "item-2", { scope: "user", key: "count", value: 4 });
  data = applyEditorStateWrite(data, "item-2", { scope: "user", key: "title", value: null });
  expect(data).toEqual({
    ...EMPTY_EDITOR_STATE,
    userState: { count: 4, title: null },
    widgetState: { "item-1": { best: 1 } },
  });
  expect(isEditorStateEmpty(data)).toBe(false);
});

test("keys follow the live route's rule", () => {
  expect(USER_STATE_KEY_PATTERN.test("death_count")).toBe(true);
  expect(USER_STATE_KEY_PATTERN.test("sys.is_live")).toBe(false);
  expect(USER_STATE_KEY_PATTERN.test("Deaths")).toBe(false);
});

test("the Saved data tab shows up for widgets that save data or take typed values", () => {
  expect(usesWidgetState("const s = await StreamWizard.state.get();")).toBe(true);
  expect(usesWidgetState("StreamWizard . userState.increment('deaths')")).toBe(true);
  expect(usesWidgetState("StreamWizard.stateUrl")).toBe(false);
  expect(usesWidgetState("StreamWizard.twitch.user(id)")).toBe(false);
  expect(demoRelevance(["custom_widget"], [], true).sections).toContain("state");
  expect(demoRelevance(["custom_widget"], [], false).sections).not.toContain("state");
  // Stream labels and goals take typed values there too.
  expect(demoRelevance(["label_widget"], []).sections).toContain("state");
  expect(demoRelevance(["bits_goal_widget"], []).sections).toContain("state");
  expect(demoRelevance(["alert_widget"], []).sections).not.toContain("state");
});
