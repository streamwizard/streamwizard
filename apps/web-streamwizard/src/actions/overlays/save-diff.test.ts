import { describe, expect, it } from "bun:test";
import { diffOverlaySave } from "./save-diff";

const text = (id: string, config: unknown = { text: "hi", size: 24 }) => ({ id, type: "text_widget", config });

describe("diffOverlaySave", () => {
  it("reports nothing for a save that changed nothing", () => {
    const stored = [text("a"), text("b")];
    expect(diffOverlaySave({ stored, deletedIds: [], updated: stored, inserted: [] })).toEqual({
      added: [],
      removed: [],
      reconfiguredTypes: [],
      reconfiguredCount: 0,
      itemCount: 2,
    });
  });

  it("does not call a widget changed because Postgres reordered its keys", () => {
    const stored = [text("a", { size: 24, text: "hi", shadow: { blur: 2, x: 1 } })];
    const updated = [text("a", { text: "hi", shadow: { x: 1, blur: 2 }, size: 24, colour: undefined })];
    const diff = diffOverlaySave({ stored, deletedIds: [], updated, inserted: [] });
    expect(diff.reconfiguredCount).toBe(0);
  });

  it("reports a changed setting, once per type however many widgets changed", () => {
    const stored = [text("a"), text("b"), { id: "c", type: "clock_widget", config: { format: "24h" } }];
    const updated = [
      text("a", { text: "bye", size: 24 }),
      text("b", { text: "hi", size: 30 }),
      { id: "c", type: "clock_widget", config: { format: "24h" } },
    ];
    const diff = diffOverlaySave({ stored, deletedIds: [], updated, inserted: [] });
    expect(diff.reconfiguredTypes).toEqual(["text_widget"]);
    expect(diff.reconfiguredCount).toBe(2);
  });

  it("notices a change inside an array", () => {
    const stored = [{ id: "a", type: "slideshow_widget", config: { slides: [{ url: "1" }, { url: "2" }] } }];
    const updated = [{ id: "a", type: "slideshow_widget", config: { slides: [{ url: "2" }, { url: "1" }] } }];
    expect(diffOverlaySave({ stored, deletedIds: [], updated, inserted: [] }).reconfiguredCount).toBe(1);
  });

  it("reports added and removed widgets by type, and which custom widget", () => {
    const stored = [text("a"), { id: "b", type: "custom_widget", config: { widget_id: "w-1", html: "<b>secret</b>" } }];
    const diff = diffOverlaySave({
      stored,
      deletedIds: ["b"],
      updated: [text("a")],
      inserted: [
        { type: "alert_widget", config: {} },
        { type: "custom_widget", config: { widget_id: "w-2", html: "<i>also secret</i>" } },
      ],
    });
    expect(diff.added).toEqual([{ type: "alert_widget" }, { type: "custom_widget", customWidgetId: "w-2" }]);
    expect(diff.removed).toEqual([{ type: "custom_widget", customWidgetId: "w-1" }]);
    expect(diff.itemCount).toBe(3);
    expect(JSON.stringify(diff)).not.toContain("secret");
  });

  it("leaves clip fields out: they are parts of a clips widget, not widgets", () => {
    const stored = [
      { id: "clips", type: "clips_widget", config: {} },
      { id: "field", type: "clip_display_field", config: { field: "title" } },
    ];
    const diff = diffOverlaySave({
      stored,
      deletedIds: ["field"],
      updated: [{ id: "clips", type: "clips_widget", config: {} }],
      inserted: [{ type: "clip_display_field", config: { field: "game" } }],
    });
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.itemCount).toBe(1);
  });

  it("ignores a deleted id it has no row for", () => {
    const diff = diffOverlaySave({ stored: [text("a")], deletedIds: ["ghost"], updated: [text("a")], inserted: [] });
    expect(diff.removed).toEqual([]);
  });
});
