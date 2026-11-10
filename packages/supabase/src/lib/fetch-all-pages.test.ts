import { describe, expect, it } from "bun:test";
import { fetchAllPages, POSTGREST_MAX_ROWS } from "./fetch-all-pages";

/** A fake table of `total` rows that answers `.range()` like PostgREST, capped at `maxRows`. */
function fakeTable(total: number, maxRows = POSTGREST_MAX_ROWS) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + maxRows)), error: null };
  };
  return { page, calls };
}

describe("fetchAllPages", () => {
  it("reads past max_rows instead of stopping at the first page", async () => {
    const { page, calls } = fakeTable(2500);
    const rows = await fetchAllPages(page);

    expect(rows).toHaveLength(2500);
    expect(rows.at(-1)).toEqual({ id: 2499 });
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops after one request when the first page is short", async () => {
    const { page, calls } = fakeTable(3);
    expect(await fetchAllPages(page)).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it("asks once more after an exactly full last page, then stops on the empty one", async () => {
    const { page, calls } = fakeTable(4, 2);
    expect(await fetchAllPages(page, 2)).toHaveLength(4);
    expect(calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it("returns an empty list for an empty table or a null page", async () => {
    expect(await fetchAllPages(fakeTable(0).page)).toEqual([]);
    expect(await fetchAllPages(async () => ({ data: null, error: null }))).toEqual([]);
  });

  it("throws on a failed page rather than returning what it had so far", async () => {
    let call = 0;
    const page = async () => {
      call++;
      if (call === 2) return { data: null, error: new Error("timeout") };
      return { data: Array.from({ length: 2 }, (_, i) => i), error: null };
    };
    await expect(fetchAllPages(page, 2)).rejects.toThrow("timeout");
  });
});
