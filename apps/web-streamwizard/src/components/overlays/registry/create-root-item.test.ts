import { describe, expect, test } from "bun:test";
import type { OverlayItem, OverlaySceneWithItems } from "@/types/overlays";
import { createCenteredRootItem } from "./create-root-item";
import type { CreateRootItemContext } from "./overlay-widget-registry.types";

function ctx(items: Array<Pick<OverlayItem, "type">> = [], size = { width: 1920, height: 1080 }): CreateRootItemContext {
  let next = 0;
  return {
    scene: { id: "scene-1", ...size, items } as unknown as OverlaySceneWithItems,
    nextId: () => `temp-${++next}`,
    maxZ: 7,
  };
}

const config = { text: "hi" } as unknown as OverlayItem["config"];

describe("createCenteredRootItem", () => {
  test("builds a full item, centred, on top, at scale 1", () => {
    expect(createCenteredRootItem(ctx(), { type: "poll_widget", size: { w: 400, h: 200 }, label: "Poll", config })).toEqual({
      id: "temp-1",
      scene_id: "scene-1",
      type: "poll_widget",
      x: 760,
      y: 440,
      w: 400,
      h: 200,
      design_w: 400,
      design_h: 200,
      crop_top: 0,
      crop_right: 0,
      crop_bottom: 0,
      crop_left: 0,
      anchor_x: "left",
      anchor_y: "top",
      z_index: 8,
      rotation: 0,
      flip_h: false,
      flip_v: false,
      opacity: 1,
      is_visible: true,
      is_locked: false,
      label: "Poll 1",
      config,
    });
  });

  test("rounds the centring maths", () => {
    const item = createCenteredRootItem(ctx([], { width: 1001, height: 501 }), {
      type: "text_widget",
      size: { w: 100, h: 50 },
      label: "Text",
      config,
    });
    expect([item.x, item.y]).toEqual([Math.round(450.5), Math.round(225.5)]);
  });

  test("counts only items of the same type for the label", () => {
    const scene = ctx([{ type: "poll_widget" }, { type: "text_widget" }, { type: "poll_widget" }]);
    expect(createCenteredRootItem(scene, { type: "poll_widget", size: { w: 10, h: 10 }, label: "Poll", config }).label).toBe("Poll 3");
    expect(createCenteredRootItem(scene, { type: "chat_widget", size: { w: 10, h: 10 }, label: "Chat", config }).label).toBe("Chat 1");
  });

  test("a label function gets the 1-based count", () => {
    const label = (n: number) => (n === 1 ? "Alert box" : `Alert box ${n}`);
    expect(createCenteredRootItem(ctx(), { type: "alert_widget", size: { w: 10, h: 10 }, label, config }).label).toBe("Alert box");
    expect(
      createCenteredRootItem(ctx([{ type: "alert_widget" }]), { type: "alert_widget", size: { w: 10, h: 10 }, label, config }).label,
    ).toBe("Alert box 2");
  });

  test("x and y override the centred position", () => {
    const item = createCenteredRootItem(ctx(), { type: "emote_widget", size: { w: 1920, h: 1080 }, label: "Emote wall", config, x: 0, y: 0 });
    expect([item.x, item.y]).toEqual([0, 0]);
    const alert = createCenteredRootItem(ctx(), { type: "alert_widget", size: { w: 600, h: 300 }, label: "Alert box", config, y: 130 });
    expect([alert.x, alert.y]).toEqual([660, 130]);
  });

  test("takes one id per item", () => {
    const c = ctx();
    expect(createCenteredRootItem(c, { type: "text_widget", size: { w: 1, h: 1 }, label: "Text", config }).id).toBe("temp-1");
    expect(c.nextId()).toBe("temp-2");
  });
});
