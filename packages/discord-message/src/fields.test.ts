import { describe, expect, test } from "bun:test";
import { dropField, fieldRows } from "./fields";

const f = (id: string, inline = false) => ({ id, inline });
const shape = (fields: { id: string; inline: boolean }[]) =>
  fieldRows(fields)
    .map((row) => row.map((field) => field.id).join(" "))
    .join(" | ");

describe("fieldRows", () => {
  test("inline fields share a row, three at most", () => {
    expect(shape([f("a", true), f("b", true), f("c", true), f("d", true)])).toBe("a b c | d");
  });

  test("a field that isn't inline stands alone and breaks the row", () => {
    expect(shape([f("a", true), f("b"), f("c", true), f("d", true)])).toBe("a | b | c d");
  });
});

describe("dropField", () => {
  const stacked = [f("a"), f("b"), f("c")];

  test("right of a stacked field: the two share a row", () => {
    expect(shape(dropField(stacked, "b", "a", "right"))).toBe("a b | c");
  });

  test("left of it: same row, other order", () => {
    expect(shape(dropField(stacked, "b", "a", "left"))).toBe("b a | c");
    expect(shape(dropField(stacked, "c", "a", "left"))).toBe("c a | b");
  });

  test("a third joins the row", () => {
    const pair = dropField(stacked, "b", "a", "right");
    expect(shape(dropField(pair, "c", "b", "right"))).toBe("a b c");
    expect(shape(dropField(pair, "c", "a", "right"))).toBe("a c b");
  });

  test("below a row: a row of its own, under the whole row", () => {
    const row = [f("a", true), f("b", true), f("c", true)];
    const next = dropField(row, "a", "b", "below");
    expect(shape(next)).toBe("b c | a");
    expect(next.at(-1)).toEqual({ id: "a", inline: false });
  });

  test("above a row: over the whole row, whichever field was the target", () => {
    const fields = [f("a", true), f("b", true), f("c")];
    expect(shape(dropField(fields, "c", "b", "above"))).toBe("c | a b");
  });

  test("pulling one out of a pair leaves the other on a full row", () => {
    const pair = [f("a", true), f("b", true), f("c")];
    expect(shape(dropField(pair, "b", "c", "below"))).toBe("a | c | b");
  });

  test("reorders stacked fields", () => {
    expect(shape(dropField(stacked, "a", "c", "below"))).toBe("b | c | a");
    expect(shape(dropField(stacked, "c", "a", "above"))).toBe("c | a | b");
  });

  test("keeps the rest of each field", () => {
    const fields = [{ id: "a", inline: false, name: "A" }, { id: "b", inline: false, name: "B" }];
    expect(dropField(fields, "b", "a", "left")).toEqual([
      { id: "b", inline: true, name: "B" },
      { id: "a", inline: true, name: "A" },
    ]);
  });

  test("dropping on itself or on nothing changes nothing", () => {
    expect(dropField(stacked, "a", "a", "right")).toEqual(stacked);
    expect(dropField(stacked, "a", "zzz", "right")).toEqual(stacked);
    expect(dropField(stacked, "zzz", "a", "right")).toEqual(stacked);
  });
});
