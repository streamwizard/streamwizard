import { describe, expect, it } from "bun:test";
import {
  NODE_INSTANCE_COLUMNS,
  getObsInstanceByIdForNode,
  insertObsInstance,
  listObsInstancesByNode,
  listObsInstancesByUserOnNode,
  listRunningObsInstancesByNode,
  updateObsInstanceByContainerIdForNode,
  updateObsInstanceForNode,
} from "./instances";

// Records every .select() argument. Each chained call returns the same
// builder, and awaiting it (or .single()/.maybeSingle()) resolves to an empty
// result, which is all these queries need to run.
function recordingClient() {
  const selects: unknown[] = [];
  const result = { data: null, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["insert", "update", "delete", "eq", "is", "in", "order"]) {
    builder[method] = () => builder;
  }
  builder.select = (...args: unknown[]) => {
    selects.push(args[0]);
    return builder;
  };
  builder.single = async () => ({ data: {}, error: null });
  builder.maybeSingle = async () => result;
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  const client = { from: () => builder } as never;
  return { client, selects };
}

describe("node-facing instance queries", () => {
  it("the node column list has no password columns and no wildcard", () => {
    expect(NODE_INSTANCE_COLUMNS).not.toContain("password");
    expect(NODE_INSTANCE_COLUMNS).not.toContain("*");
  });

  const cases: [string, (client: never) => Promise<unknown>][] = [
    ["listObsInstancesByNode", (c) => listObsInstancesByNode(c, "node-a")],
    ["getObsInstanceByIdForNode", (c) => getObsInstanceByIdForNode(c, "i1", "node-a")],
    ["insertObsInstance", (c) => insertObsInstance(c, {} as never)],
    ["updateObsInstanceForNode", (c) => updateObsInstanceForNode(c, "i1", "node-a", {})],
    ["updateObsInstanceByContainerIdForNode", (c) => updateObsInstanceByContainerIdForNode(c, "c1", "node-a", {})],
    ["listRunningObsInstancesByNode", (c) => listRunningObsInstancesByNode(c, "node-a")],
    ["listObsInstancesByUserOnNode", (c) => listObsInstancesByUserOnNode(c, "u1", "node-a")],
  ];

  for (const [name, run] of cases) {
    it(`${name} selects only the node column list`, async () => {
      const { client, selects } = recordingClient();
      await run(client);
      expect(selects).toEqual([NODE_INSTANCE_COLUMNS]);
    });
  }
});
