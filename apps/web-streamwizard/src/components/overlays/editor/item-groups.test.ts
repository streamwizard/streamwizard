import { describe, expect, test } from "bun:test";
import {
  clickSelection,
  cloneGroupSubtrees,
  drillSelection,
  expandToOutermostGroups,
  moveNodeToGroup,
  moveTargets,
  nextGroupLabel,
  normalizeLayerOrder,
  orderedChildren,
  pruneEmptyGroups,
  sanitizeGroups,
  selectedGroupId,
  selectionNodes,
  ungroup,
  wrapInGroup,
} from "./item-groups";
import type { OverlayItem, OverlayItemGroup } from "@/types/overlays";

function item(id: string, z: number, group_id: string | null = null, extra: Partial<OverlayItem> = {}): OverlayItem {
  return {
    id,
    scene_id: "scene-1",
    type: "text_widget",
    x: 0,
    y: 0,
    anchor_x: "left",
    anchor_y: "top",
    w: 100,
    h: 100,
    design_w: 100,
    design_h: 100,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    z_index: z,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: id,
    config: {} as OverlayItem["config"],
    group_id,
    ...extra,
  };
}

function group(id: string, parent_group_id: string | null = null, label = id): OverlayItemGroup {
  return { id, scene_id: "scene-1", parent_group_id, label };
}

/**
 * outer
 * ├─ inner
 * │  ├─ a
 * │  └─ b
 * └─ c
 * d (ungrouped)
 */
function nested() {
  const groups = [group("outer"), group("inner", "outer")];
  const items = [item("a", 5, "inner"), item("b", 4, "inner"), item("c", 3, "outer"), item("d", 2)];
  return { items, groups };
}

const ids = (list: { id: string }[]) => list.map((x) => x.id).sort();

describe("selection", () => {
  test("a click on a grouped item selects its outermost group", () => {
    const { items, groups } = nested();
    expect(clickSelection("a", [], items, groups).sort()).toEqual(["a", "b", "c"]);
  });

  test("a click on an ungrouped item selects just that item", () => {
    const { items, groups } = nested();
    expect(clickSelection("d", [], items, groups)).toEqual(["d"]);
  });

  test("double-click drills one level at a time", () => {
    const { items, groups } = nested();
    const outer = clickSelection("a", [], items, groups);
    const inner = drillSelection("a", outer, items, groups);
    expect(inner.sort()).toEqual(["a", "b"]);
    expect(drillSelection("a", inner, items, groups)).toEqual(["a"]);
  });

  test("once inside a group, clicks pick siblings at that level", () => {
    const { items, groups } = nested();
    // Working inside `inner`: a is selected on its own.
    expect(clickSelection("b", ["a"], items, groups)).toEqual(["b"]);
    // Working inside `outer`: inner is selected; c is its sibling.
    expect(clickSelection("c", ["a", "b"], items, groups)).toEqual(["c"]);
  });

  test("a marquee grows to whole outermost groups", () => {
    const { items, groups } = nested();
    expect(expandToOutermostGroups(["b", "d"], items, groups).sort()).toEqual(["a", "b", "c", "d"]);
  });

  test("selection nodes collapse to the biggest whole group", () => {
    const { items, groups } = nested();
    expect(selectionNodes(["a", "b", "c"], items, groups)).toEqual([{ kind: "group", id: "outer" }]);
    expect(selectionNodes(["a", "b", "d"], items, groups)).toEqual([
      { kind: "group", id: "inner" },
      { kind: "item", id: "d" },
    ]);
    expect(selectedGroupId(["a", "b"], items, groups)).toBe("inner");
    expect(selectedGroupId(["a"], items, groups)).toBeNull();
  });
});

describe("structure", () => {
  test("grouping wraps nodes inside the deepest group they share", () => {
    const { items, groups } = nested();
    const next = wrapInGroup(
      [{ kind: "item", id: "a" }, { kind: "item", id: "b" }],
      items,
      groups,
      { id: "new", scene_id: "scene-1", label: "Group 1" }
    );
    // Both items sit in `inner`, so the new group nests there.
    expect(ids(next.groups)).toEqual(["inner", "new", "outer"]);
    expect(next.groups.find((g) => g.id === "new")!.parent_group_id).toBe("inner");
    expect(next.items.find((i) => i.id === "a")!.group_id).toBe("new");
  });

  test("grouping a whole group wraps the group and drops nothing", () => {
    const { items, groups } = nested();
    const nodes = selectionNodes(["a", "b"], items, groups);
    const next = wrapInGroup(nodes, items, groups, { id: "new", scene_id: "scene-1", label: "Group 1" });
    expect(next.groups.find((g) => g.id === "new")!.parent_group_id).toBe("outer");
    expect(next.groups.find((g) => g.id === "inner")!.parent_group_id).toBe("new");
  });

  test("groups emptied by a move are dropped", () => {
    const groups = [group("solo")];
    const items = [item("a", 2, "solo"), item("b", 1)];
    const next = wrapInGroup(
      [{ kind: "item", id: "a" }, { kind: "item", id: "b" }],
      items,
      groups,
      { id: "new", scene_id: "scene-1", label: "Group 1" }
    );
    expect(ids(next.groups)).toEqual(["new"]);
  });

  test("grouping across branches lands at the root", () => {
    const { items, groups } = nested();
    const next = wrapInGroup(
      [{ kind: "item", id: "c" }, { kind: "item", id: "d" }],
      items,
      groups,
      { id: "new", scene_id: "scene-1", label: "Group 1" }
    );
    expect(next.groups.find((g) => g.id === "new")!.parent_group_id).toBeNull();
  });

  test("ungroup removes one level and keeps geometry", () => {
    const { items, groups } = nested();
    const next = ungroup(["outer"], items, groups);
    expect(ids(next.groups)).toEqual(["inner"]);
    expect(next.groups[0]!.parent_group_id).toBeNull();
    expect(next.items.find((i) => i.id === "c")!.group_id).toBeNull();
    expect(next.items.map((i) => [i.x, i.y, i.z_index])).toEqual(items.map((i) => [i.x, i.y, i.z_index]));
  });

  test("a group can't move into its own subtree", () => {
    const { items, groups } = nested();
    const next = moveNodeToGroup({ kind: "group", id: "outer" }, "inner", items, groups);
    expect(next.groups.find((g) => g.id === "outer")!.parent_group_id).toBeNull();
    expect(ids(moveTargets({ kind: "group", id: "outer" }, items, groups))).toEqual([]);
    expect(ids(moveTargets({ kind: "item", id: "d" }, items, groups))).toEqual(["inner", "outer"]);
  });

  test("empty groups are pruned, groups with only nested groups kept while those hold items", () => {
    const groups = [group("outer"), group("inner", "outer"), group("empty")];
    const items = [item("a", 1, "inner")];
    expect(ids(pruneEmptyGroups(items, groups))).toEqual(["inner", "outer"]);
  });

  test("cloning a subtree gives fresh ids and keeps the top group's parent", () => {
    const { groups } = nested();
    let n = 0;
    const { groups: copies, idMap } = cloneGroupSubtrees(["inner"], groups, () => `copy-${++n}`, (g) => `${g.label} (Copy)`);
    expect(copies).toEqual([{ id: "copy-1", scene_id: "scene-1", parent_group_id: "outer", label: "inner (Copy)" }]);
    expect(idMap.get("inner")).toBe("copy-1");
  });

  test("next label counts past the highest Group N", () => {
    expect(nextGroupLabel([group("x", null, "Group 2"), group("y", null, "Logo")])).toBe("Group 3");
    expect(nextGroupLabel([])).toBe("Group 1");
  });
});

describe("layer order", () => {
  test("normalising makes every group contiguous", () => {
    // `g` holds a and c, but b sits between them.
    const groups = [group("g")];
    const items = [item("a", 3, "g"), item("b", 2), item("c", 1, "g")];
    expect(normalizeLayerOrder(items, groups)).toEqual(["a", "c", "b"]);
  });

  test("children are listed where their topmost item is", () => {
    const { items, groups } = nested();
    expect(orderedChildren(null, items, groups)).toEqual([
      { kind: "group", id: "outer" },
      { kind: "item", id: "d" },
    ]);
    expect(orderedChildren("outer", items, groups)).toEqual([
      { kind: "group", id: "inner" },
      { kind: "item", id: "c" },
    ]);
  });

  test("an override reorders one container and keeps the rest", () => {
    const { items, groups } = nested();
    const order = normalizeLayerOrder(items, groups, {
      containerId: "outer",
      children: [{ kind: "item", id: "c" }, { kind: "group", id: "inner" }],
    });
    expect(order).toEqual(["c", "a", "b", "d"]);
  });

  test("clip display fields are ignored", () => {
    const items = [
      item("clips", 2, null, { type: "clips_widget" }),
      item("field", 2, null, { type: "clip_display_field" }),
    ];
    expect(normalizeLayerOrder(items, [])).toEqual(["clips"]);
  });
});

describe("sanitizeGroups", () => {
  test("cuts cycles, drops dangling refs and empty groups, parents first", () => {
    const groups = [group("child", "parent"), group("parent"), group("loop-a", "loop-b"), group("loop-b", "loop-a"), group("empty")];
    const items = [
      item("a", 3, "child"),
      item("b", 2, "loop-a"),
      item("c", 1, "missing"),
      item("field", 1, "child", { type: "clip_display_field" }),
    ];
    const next = sanitizeGroups(items, groups);
    expect(next.groups.find((g) => g.id === "empty")).toBeUndefined();
    expect(next.groups.findIndex((g) => g.id === "parent")).toBeLessThan(next.groups.findIndex((g) => g.id === "child"));
    // One edge of the loop is cut, so the pair is a plain chain now.
    const loopA = next.groups.find((g) => g.id === "loop-a")!;
    const loopB = next.groups.find((g) => g.id === "loop-b");
    expect(loopA.parent_group_id === null || loopB?.parent_group_id === null).toBe(true);
    expect(next.items.find((i) => i.id === "c")!.group_id).toBeNull();
    expect(next.items.find((i) => i.id === "field")!.group_id).toBeNull();
  });
});
