import { describe, expect, test } from "bun:test";
import { buildDemoLabelSnapshot, emptyLabelSnapshot, getLabelDefinition, resolveLabel } from "@repo/schemas";
import { applyEditorLabelValue, editableLabelParts } from "./label-editor-values";

const NOW = Date.parse("2026-10-27T12:00:00Z");

describe("editor label values", () => {
  test("a name fills an empty latest label", () => {
    const def = getLabelDefinition("latest_follower");
    const resolved = applyEditorLabelValue(resolveLabel(emptyLabelSnapshot(), def), def, { name: "xQc" }, NOW);
    expect(resolved).toMatchObject({ shape: "entry", entry: { kind: "follow", name: "xQc" } });
  });

  test("only the parts typed in replace the real ones", () => {
    const def = getLabelDefinition("latest_cheer");
    const real = resolveLabel(buildDemoLabelSnapshot(NOW), def, "all", NOW);
    const resolved = applyEditorLabelValue(real, def, { amount: 10000 }, NOW);
    expect(resolved.shape === "entry" && resolved.entry).toMatchObject({ name: "MoonPie", amount: 10000 });
  });

  test("counts and leaderboards take the typed numbers", () => {
    const count = getLabelDefinition("follower_count");
    expect(applyEditorLabelValue(resolveLabel(emptyLabelSnapshot(), count), count, { amount: 9001 })).toEqual({
      shape: "number",
      value: 9001,
    });
    const top = getLabelDefinition("top_cheerer");
    const resolved = applyEditorLabelValue(resolveLabel(emptyLabelSnapshot(), top), top, { name: "Big", amount: 5 });
    expect(resolved.shape === "leaders" && resolved.items[0]).toMatchObject({ name: "Big", amount: 5 });
  });

  test("nothing typed leaves the label alone, and lists can't be typed in", () => {
    const def = getLabelDefinition("latest_raid");
    const real = resolveLabel(emptyLabelSnapshot(), def);
    expect(applyEditorLabelValue(real, def, {})).toBe(real);
    expect(editableLabelParts(getLabelDefinition("event_list"))).toBeNull();
    expect(editableLabelParts(getLabelDefinition("latest_follower"))).toEqual({ name: true, amount: false });
    expect(editableLabelParts(getLabelDefinition("latest_raid"))).toEqual({ name: true, amount: true });
  });
});
