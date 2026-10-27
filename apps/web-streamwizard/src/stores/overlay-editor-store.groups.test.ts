import { beforeEach, describe, expect, test } from "bun:test";
import { useOverlayStore } from "./overlay-editor-store";
import { orderedChildren, topFirstRootIds } from "@/components/overlays/editor/item-groups";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";

/** The acceptance list on SW-236, plus nesting and naming. */

function makeItem(id: string, z: number, extra: Partial<OverlayItem> = {}): OverlayItem {
  return {
    id,
    scene_id: "scene-1",
    type: "text_widget",
    x: z * 100,
    y: z * 50,
    w: 100,
    h: 100,
    design_w: 100,
    design_h: 100,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    anchor_x: "left",
    anchor_y: "top",
    z_index: z,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: id,
    config: {} as OverlayItem["config"],
    ...extra,
  };
}

function makeScene(items: OverlayItem[], groups: OverlaySceneWithItems["groups"] = []): OverlaySceneWithItems {
  return {
    id: "scene-1",
    user_id: "user-1",
    name: "Scene",
    slug: "scene",
    subscriber_token: "token",
    width: 1920,
    height: 1080,
    is_active: true,
    created_at: "2026-10-26T00:00:00.000Z",
    updated_at: "2026-10-26T00:00:00.000Z",
    items,
    groups,
  };
}

const state = () => useOverlayStore.getState();
const scene = () => state().scene!;
const item = (id: string) => scene().items.find((i) => i.id === id)!;
const sorted = (ids: string[]) => [...ids].sort();

/** Selects a, b, c and groups them. d stays loose. */
function groupThree() {
  state().setSelectedItems(["a", "b", "c"]);
  state().groupSelected();
  return scene().groups![0]!;
}

beforeEach(() => {
  useOverlayStore.setState({ selectedItemIds: [], isDirty: false });
  state().setScene(
    makeScene([makeItem("a", 4), makeItem("b", 3), makeItem("c", 2), makeItem("d", 1)])
  );
});

describe("group and ungroup", () => {
  test("select three, group, click elsewhere, click one: all three are selected", () => {
    const group = groupThree();
    expect(group.label).toBe("Group 1");
    expect(["a", "b", "c"].every((id) => item(id).group_id === group.id)).toBe(true);

    state().selectFromCanvas("d", "click");
    expect(state().selectedItemIds).toEqual(["d"]);
    state().selectFromCanvas("b", "click");
    expect(sorted(state().selectedItemIds)).toEqual(["a", "b", "c"]);
  });

  test("moving a group moves every member and is one undo step", async () => {
    groupThree();
    // Arrow presses within 400 ms share a step; start clear of any earlier test's.
    await new Promise((resolve) => setTimeout(resolve, 450));
    state().selectFromCanvas("a", "click");
    const before = scene().items.map((i) => [i.id, i.x, i.y]);
    const steps = state().history.past.length;

    state().nudgeSelected(10, 0);
    for (const id of ["a", "b", "c"]) {
      expect(item(id).x).toBe(before.find(([bid]) => bid === id)![1] as number + 10);
    }
    expect(item("d").x).toBe(100);
    expect(state().history.past.length).toBe(steps + 1);

    state().undo();
    expect(scene().items.map((i) => [i.id, i.x, i.y])).toEqual(before);
  });

  test("ungroup leaves every item exactly where it was", () => {
    groupThree();
    const before = scene().items.map((i) => [i.id, i.x, i.y, i.z_index]);
    state().ungroupSelected();
    expect(scene().groups).toEqual([]);
    expect(scene().items.map((i) => [i.id, i.x, i.y, i.z_index])).toEqual(before);
    expect(scene().items.every((i) => !i.group_id)).toBe(true);
  });

  test("ungroup undoes in one step", () => {
    const group = groupThree();
    state().ungroupSelected();
    state().undo();
    expect(scene().groups).toEqual([group]);
    expect(item("a").group_id).toBe(group.id);
  });
});

describe("duplicate and delete", () => {
  test("duplicating a group gives an independent copy", () => {
    const group = groupThree();
    state().duplicateSelectedItems();

    const groups = scene().groups!;
    expect(groups).toHaveLength(2);
    const copy = groups.find((g) => g.id !== group.id)!;
    expect(copy.label).toBe("Group 1 (Copy)");

    const copies = scene().items.filter((i) => i.group_id === copy.id);
    expect(copies).toHaveLength(3);
    expect(sorted(state().selectedItemIds)).toEqual(sorted(copies.map((i) => i.id)));

    // Each group is still one block in the layers.
    const order = topFirstRootIds(scene().items);
    const blocks = order.map((id) => item(id).group_id ?? id);
    expect(blocks.filter((b, i) => b !== blocks[i - 1])).toHaveLength(3);

    // Changing the copy leaves the original alone.
    state().renameGroup(copy.id, "Copy");
    expect(scene().groups!.find((g) => g.id === group.id)!.label).toBe("Group 1");
  });

  test("duplicating an item inside a group keeps it in the group, right above the original", () => {
    const group = groupThree();
    state().duplicateItem("b");
    const copy = scene().items.find((i) => i.label === "b (Copy)")!;
    expect(copy.group_id).toBe(group.id);
    const order = topFirstRootIds(scene().items);
    expect(order.indexOf(copy.id)).toBe(order.indexOf("b") - 1);
    // The group didn't jump to the top or pull d inside it.
    expect(order.at(-1)).toBe("d");
  });

  test("deleting a group deletes its members, undo restores all of them", () => {
    const group = groupThree();
    state().removeSelectedItems();
    expect(scene().items.map((i) => i.id)).toEqual(["d"]);
    expect(scene().groups).toEqual([]);

    state().undo();
    expect(sorted(scene().items.map((i) => i.id))).toEqual(["a", "b", "c", "d"]);
    expect(scene().groups).toEqual([group]);
  });
});

describe("nesting and names", () => {
  test("groups nest and a double-click drills in one level", () => {
    state().setSelectedItems(["a", "b"]);
    state().groupSelected();
    const inner = scene().groups![0]!;
    state().setSelectedItems(["a", "b", "c"]);
    state().groupSelected();
    const outer = scene().groups!.find((g) => g.id !== inner.id)!;
    expect(outer.label).toBe("Group 2");
    expect(scene().groups!.find((g) => g.id === inner.id)!.parent_group_id).toBe(outer.id);

    state().clearSelection();
    state().selectFromCanvas("a", "click");
    expect(sorted(state().selectedItemIds)).toEqual(["a", "b", "c"]);
    state().selectFromCanvas("a", "drill");
    expect(sorted(state().selectedItemIds)).toEqual(["a", "b"]);
    state().selectFromCanvas("a", "drill");
    expect(state().selectedItemIds).toEqual(["a"]);
  });

  test("renaming a group is one undo step", () => {
    const group = groupThree();
    state().renameGroup(group.id, "  Logo block  ");
    expect(scene().groups![0]!.label).toBe("Logo block");
    state().undo();
    expect(scene().groups![0]!.label).toBe("Group 1");
  });

  test("a blank name is ignored", () => {
    const group = groupThree();
    const steps = state().history.past.length;
    state().renameGroup(group.id, "   ");
    expect(scene().groups![0]!.label).toBe("Group 1");
    expect(state().history.past.length).toBe(steps);
  });

  test("moving an item out of its group, then back in", () => {
    const group = groupThree();
    state().moveNodeToGroup({ kind: "item", id: "b" }, null);
    expect(item("b").group_id).toBeNull();
    state().moveNodeToGroup({ kind: "item", id: "d" }, group.id);
    expect(item("d").group_id).toBe(group.id);
    const children = orderedChildren(null, scene().items, scene().groups!);
    expect(children.filter((c) => c.kind === "group")).toHaveLength(1);
  });

  test("bring to front stays inside the item's group", () => {
    groupThree();
    state().bringToFront("c");
    const order = topFirstRootIds(scene().items);
    expect(order).toEqual(["c", "a", "b", "d"]);
  });

  test("a group row's eye hides every member, and shows them again", () => {
    const group = groupThree();
    state().toggleGroupVisibility(group.id);
    expect(["a", "b", "c"].every((id) => !item(id).is_visible)).toBe(true);
    expect(item("d").is_visible).toBe(true);
    state().toggleGroupVisibility(group.id);
    expect(["a", "b", "c"].every((id) => item(id).is_visible)).toBe(true);
  });

  test("a locked member stays put when the group moves", () => {
    groupThree();
    state().toggleItemLock("b");
    state().selectFromCanvas("a", "click");
    const bx = item("b").x;
    state().nudgeSelected(10, 0);
    expect(item("b").x).toBe(bx);
    expect(item("a").x).toBe(410);
  });
});

describe("clips widgets", () => {
  test("a grouped clips widget keeps its display fields out of the group", () => {
    state().addItem("clips_widget");
    const clipsId = state().selectedItemIds[0]!;
    const fields = () => scene().items.filter((i) => i.type === "clip_display_field");
    expect(fields().length).toBeGreaterThan(0);

    state().setSelectedItems([clipsId, "a"]);
    state().groupSelected();
    const group = scene().groups![0]!;
    expect(item(clipsId).group_id).toBe(group.id);
    expect(fields().every((f) => !f.group_id)).toBe(true);
    // Display fields still mirror their widget's stacking.
    expect(fields().every((f) => f.z_index === item(clipsId).z_index)).toBe(true);

    const fieldCount = fields().length;
    state().duplicateSelectedItems();
    expect(fields().length).toBe(fieldCount * 2);

    state().selectFromCanvas(clipsId, "click");
    state().removeSelectedItems();
    expect(fields().length).toBe(fieldCount);
  });
});

describe("history across a save", () => {
  test("groups survive setScene and a reload keeps them", () => {
    const group = groupThree();
    const saved = scene();
    state().setScene(makeScene(saved.items, saved.groups));
    expect(scene().groups).toEqual([group]);
  });

  test("a scene that loads with an empty group drops it", () => {
    state().setScene(
      makeScene([makeItem("a", 1)], [{ id: "00000000-0000-4000-8000-000000000001", scene_id: "scene-1", parent_group_id: null, label: "Empty" }])
    );
    expect(scene().groups).toEqual([]);
  });
});
