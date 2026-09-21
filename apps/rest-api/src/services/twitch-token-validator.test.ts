import { beforeEach, describe, expect, it, mock } from "bun:test";

// Only @repo/sentry is mocked, and with every export the other rest-api tests
// use, since bun's mock.module is process-wide.
let reported: string[] = [];
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));

const { createTwitchTokenValidator } = await import("./twitch-token-validator");

describe("twitch token validator sweep", () => {
  let saved: [string, string[]][];
  let failures: string[];

  beforeEach(() => {
    saved = [];
    failures = [];
    reported = [];
  });

  it("writes the scopes Twitch reports for every token", async () => {
    const validator = createTwitchTokenValidator({
      listBroadcasters: async () => ["a", "b"],
      validate: async (id) => ({ scopes: [`scope:${id}`] }),
      saveScopes: async (id, scopes) => {
        saved.push([id, scopes]);
      },
    });

    const result = await validator.sweep();

    expect(result).toEqual({ checked: 2, synced: 2, failed: 0 });
    expect(saved.sort()).toEqual([
      ["a", ["scope:a"]],
      ["b", ["scope:b"]],
    ]);
  });

  it("counts a dead token and carries on with the rest", async () => {
    const validator = createTwitchTokenValidator({
      listBroadcasters: async () => ["dead", "live"],
      validate: async (id) => {
        if (id === "dead") throw new Error("invalid access token");
        return { scopes: [] };
      },
      saveScopes: async (id, scopes) => {
        saved.push([id, scopes]);
      },
      onError: (id) => {
        failures.push(id);
      },
    });

    const result = await validator.sweep();

    expect(result).toEqual({ checked: 2, synced: 1, failed: 1 });
    expect(saved).toEqual([["live", []]]);
    expect(failures).toEqual(["dead"]);
    expect(reported).toEqual([]);
  });

  it("treats a save failure like a validation failure", async () => {
    const validator = createTwitchTokenValidator({
      listBroadcasters: async () => ["a"],
      validate: async () => ({ scopes: [] }),
      saveScopes: async () => {
        throw new Error("db down");
      },
      onError: (id) => {
        failures.push(id);
      },
    });

    expect(await validator.sweep()).toEqual({ checked: 1, synced: 0, failed: 1 });
    expect(failures).toEqual(["a"]);
  });

  it("reports and returns empty when the integration list cannot be read", async () => {
    const validator = createTwitchTokenValidator({
      listBroadcasters: async () => {
        throw new Error("db down");
      },
      validate: async () => ({ scopes: [] }),
      saveScopes: async () => {},
    });

    expect(await validator.sweep()).toEqual({ checked: 0, synced: 0, failed: 0 });
    expect(reported).toEqual(["twitch-token-validator: list"]);
  });

  it("shares one pass between overlapping calls", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const validator = createTwitchTokenValidator({
      listBroadcasters: async () => {
        calls++;
        await gate;
        return [];
      },
      validate: async () => ({ scopes: [] }),
      saveScopes: async () => {},
    });

    const first = validator.sweep();
    const second = validator.sweep();
    release();
    await Promise.all([first, second]);

    expect(calls).toBe(1);
  });
});
