import { describe, expect, it } from "bun:test";
import { INGEST_NODE_COLUMNS, INGEST_NODE_REGISTRY_COLUMNS } from "../ingest/nodes";
import { OBS_NODE_COLUMNS, OBS_NODE_REGISTRY_COLUMNS } from "./nodes";

// The node registry rows go to admin pages, the fleet poll and (GET /me, the
// claim routes) the node itself, so their column lists must never pick up the
// claim-token hash or the encrypted control secret.
describe("node registry column lists", () => {
  const lists = { OBS_NODE_COLUMNS, OBS_NODE_REGISTRY_COLUMNS, INGEST_NODE_COLUMNS, INGEST_NODE_REGISTRY_COLUMNS };

  for (const [name, columns] of Object.entries(lists)) {
    it(`${name} has no secret columns and no wildcard`, () => {
      const names = columns.split(",").map((c) => c.trim());
      expect(names).not.toContain("*");
      expect(names).not.toContain("claim_token_hash");
      expect(names.filter((c) => c.startsWith("control_secret"))).toEqual([]);
    });
  }
});
