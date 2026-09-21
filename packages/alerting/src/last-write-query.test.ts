import { describe, expect, it } from "bun:test";
import { buildLastWriteByTagQuery } from "@repo/metrics";

describe("buildLastWriteByTagQuery", () => {
  // Grouping by tag before dropping _value merges float and integer fields into
  // one table, and last() fails with a schema collision (ALERT-WORKER-1).
  it("drops _value before grouping so mixed field types never share a table", () => {
    const query = buildLastWriteByTagQuery("bucket", "obs_node", "node_id", "24h");
    const keepAt = query.indexOf('keep(columns: ["node_id", "_time"])');
    const groupAt = query.indexOf('group(columns: ["node_id"])');
    const lastAt = query.indexOf('last(column: "_time")');
    expect(keepAt).toBeGreaterThan(-1);
    expect(keepAt).toBeLessThan(groupAt);
    expect(groupAt).toBeLessThan(lastAt);
  });
});
