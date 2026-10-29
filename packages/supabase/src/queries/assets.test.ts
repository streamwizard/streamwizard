import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import { selectAllAssetKeys } from "./assets";

/**
 * The R2 orphan sweep deletes every object whose key this snapshot lacks. It
 * used to page with OFFSET, so a user deleting rows mid-scan shifted other
 * users' rows back past the cursor: their keys went missing and their files
 * were deleted. Keyset paging (id > last id) can't skip a row that still
 * exists.
 */

type Row = { id: string; key: string };

/** Minimal user_assets table: order("id").limit(n), optional gt("id", x). */
function fakeTable(rows: Row[], onPage: (page: number) => void) {
  let page = 0;
  const client = {
    from: () => {
      let after: string | null = null;
      let limit = Infinity;
      const query = {
        select: () => query,
        order: () => query,
        limit: (n: number) => {
          limit = n;
          return query;
        },
        gt: (_column: string, value: string) => {
          after = value;
          return query;
        },
        then: (resolve: (value: { data: Row[]; error: null }) => void) => {
          const data = rows
            .filter((row) => after === null || row.id > after)
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, limit);
          onPage(page++);
          resolve({ data, error: null });
        },
      };
      return query;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

describe("selectAllAssetKeys", () => {
  test("rows deleted between pages don't hide rows that still exist", async () => {
    const rows: Row[] = Array.from({ length: 2500 }, (_, i) => ({
      id: String(i).padStart(5, "0"),
      key: `assets/u/${i}.png`,
    }));
    const deletedMidScan = new Set(rows.slice(0, 500).map((row) => row.key));

    const client = fakeTable(rows, (page) => {
      // After the first page, another user deletes 500 rows already seen.
      if (page === 1) rows.splice(0, 500);
    });

    const keys = new Set(await selectAllAssetKeys(client));
    for (const row of rows) expect(keys.has(row.key)).toBe(true);
    expect(keys.size).toBe(2000 + deletedMidScan.size);
  });
});
