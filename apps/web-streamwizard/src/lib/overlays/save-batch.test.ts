import { describe, expect, it } from "bun:test";
import { mergeSavedItemRows, overlayItemRowChanged } from "./save-batch";

const stored = {
  id: "a",
  scene_id: "s",
  type: "text_widget",
  x: 10.3,
  y: 0,
  w: 400,
  h: 300,
  z_index: 1,
  label: "Title",
  group_id: null,
  config: { text: "hi", style: { size: 12, color: "#fff" } },
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

/** What the save would write for `stored` unchanged: no timestamps. */
const { created_at: _c, updated_at: _u, ...unchanged } = stored;

describe("overlayItemRowChanged", () => {
  it("skips an item the save would write back as it is", () => {
    expect(overlayItemRowChanged(stored, unchanged)).toBe(false);
  });

  it("ignores config key order", () => {
    const next = { ...unchanged, config: { style: { color: "#fff", size: 12 }, text: "hi" } };
    expect(overlayItemRowChanged(stored, next)).toBe(false);
  });

  it("compares real columns at float precision", () => {
    // What Postgres hands back for a real column holding 10.3.
    const fromDb = { ...stored, x: Math.fround(10.3) };
    expect(overlayItemRowChanged(fromDb, unchanged)).toBe(false);
  });

  it("sees a moved item", () => {
    expect(overlayItemRowChanged(stored, { ...unchanged, x: 11 })).toBe(true);
  });

  it("sees a changed config value", () => {
    const next = { ...unchanged, config: { ...stored.config, text: "hello" } };
    expect(overlayItemRowChanged(stored, next)).toBe(true);
  });

  it("sees a column the stored row lacks or holds as null", () => {
    expect(overlayItemRowChanged(stored, { ...unchanged, flip_h: false })).toBe(true);
    expect(overlayItemRowChanged({ ...stored, label: null }, unchanged)).toBe(true);
  });

  it("sees a regrouped item", () => {
    expect(overlayItemRowChanged(stored, { ...unchanged, group_id: "g1" })).toBe(true);
  });

  it("writes an item it has no stored row for", () => {
    expect(overlayItemRowChanged(undefined, unchanged)).toBe(true);
  });
});

describe("mergeSavedItemRows", () => {
  const row = (id: string, z_index: number, label = id) => ({ id, z_index, label });

  it("drops deleted rows, swaps in written ones and adds inserts, in z order", () => {
    const before = [row("a", 0), row("b", 1), row("c", 2)];
    const written = [row("b", 3, "b moved"), row("d", 1)];

    expect(mergeSavedItemRows(before, ["c"], written)).toEqual([
      row("a", 0),
      row("d", 1),
      row("b", 3, "b moved"),
    ]);
  });

  it("keeps rows the save didn't touch as they were read", () => {
    const before = [row("a", 0), row("b", 1)];
    expect(mergeSavedItemRows(before, [], [])).toEqual(before);
  });
});
