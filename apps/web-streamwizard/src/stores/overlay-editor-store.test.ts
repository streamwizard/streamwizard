import { beforeEach, expect, test } from "bun:test";
import { useOverlayStore } from "./overlay-editor-store";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";

function makeItem(id: string, config: Record<string, unknown>): OverlayItem {
  return {
    id,
    scene_id: "scene-1",
    type: "text_widget",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    design_w: 100,
    design_h: 100,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    z_index: 1,
    rotation: 0,
    opacity: 1,
    is_visible: true,
    is_locked: false,
    label: "Text",
    config: config as unknown as OverlayItem["config"],
  };
}

function makeScene(items: OverlayItem[]): OverlaySceneWithItems {
  return {
    id: "scene-1",
    user_id: "user-1",
    name: "Scene",
    slug: "scene",
    subscriber_token: "token",
    width: 1920,
    height: 1080,
    is_active: true,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    items,
  };
}

/** Lets a burst's same-tick guard clear without waiting out the time window. */
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // setScene is the real entry point: it clears history and ends any edit
  // burst, so each test starts from the same place.
  useOverlayStore.setState({ selectedItemIds: [], isDirty: false });
  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("a", { title: "one", color: "#fff" })]));
});

test("a config edit records an undo step", async () => {
  const { updateItem } = useOverlayStore.getState();
  updateItem("a", { config: { title: "two", color: "#fff" } as never });

  expect(useOverlayStore.getState().history.past).toHaveLength(1);

  useOverlayStore.getState().undo();
  const item = useOverlayStore.getState().scene!.items[0]!;
  expect((item.config as unknown as { title: string }).title).toBe("one");
  await nextTick();
});

test("typing in one field collapses into a single step", async () => {
  const values = ["o", "on", "one!"];
  for (const title of values) {
    useOverlayStore.getState().updateItem("a", { config: { title, color: "#fff" } as never });
    await nextTick();
  }
  expect(useOverlayStore.getState().history.past).toHaveLength(1);
});

test("a different field starts its own step", async () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#fff" } as never });
  await nextTick();
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#000" } as never });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(2);
});

test("a write that changes nothing records no step", async () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "one", color: "#fff" } as never });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("history:false keeps a load-time patch out of the stack", async () => {
  useOverlayStore
    .getState()
    .updateItem("a", { config: { title: "adopted", color: "#fff" } as never }, { history: false });
  await nextTick();
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("two items written in one tick stay one step", async () => {
  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("a", { stackOrder: 0 }), makeItem("b", { stackOrder: 1 })]));

  const { updateItem } = useOverlayStore.getState();
  updateItem("a", { config: { stackOrder: 1 } as never });
  updateItem("b", { config: { stackOrder: 0 } as never });
  await nextTick();

  expect(useOverlayStore.getState().history.past).toHaveLength(1);
});

test("setScene without an id map starts a fresh history", () => {
  useOverlayStore.getState().updateItem("a", { config: { title: "two", color: "#fff" } as never });
  expect(useOverlayStore.getState().history.past).toHaveLength(1);

  useOverlayStore.getState().setScene(makeScene([makeItem("a", { title: "two" })]));
  expect(useOverlayStore.getState().history.past).toHaveLength(0);
});

test("setScene with an id map keeps history and rewrites temp ids", () => {
  useOverlayStore.getState().setScene(makeScene([makeItem("temp-1", { title: "one" })]));
  useOverlayStore.setState({
    history: { past: [[makeItem("temp-1", { title: "before" })]], future: [] },
  });

  useOverlayStore
    .getState()
    .setScene(makeScene([makeItem("db-1", { title: "one" })]), { idMap: { "temp-1": "db-1" } });

  const past = useOverlayStore.getState().history.past;
  expect(past).toHaveLength(1);
  expect(past[0]![0]!.id).toBe("db-1");
});

test("a clip child's parent ref follows the remap", () => {
  const child = makeItem("temp-c", { parentClipItemId: "temp-p", fieldKey: "title" });
  useOverlayStore.getState().setScene(makeScene([]));
  useOverlayStore.setState({
    history: { past: [[makeItem("temp-p", {}), child]], future: [] },
  });

  useOverlayStore.getState().setScene(makeScene([]), {
    idMap: { "temp-p": "db-p", "temp-c": "db-c" },
  });

  const restored = useOverlayStore.getState().history.past[0]!;
  expect(restored[0]!.id).toBe("db-p");
  expect(
    (restored[1]!.config as unknown as { parentClipItemId: string }).parentClipItemId
  ).toBe("db-p");
});
