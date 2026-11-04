import { describe, expect, it } from "bun:test";
import { createClipSyncStarter, type ClipSyncSkipped } from "./clip-sync-start";

/** A promise the test settles by hand, standing in for a sync still paging Helix. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(claimResult: { claimed: true; userId: string } | ClipSyncSkipped) {
  const run = deferred<number>();
  const runCalls: string[] = [];
  const reported: { context: string; extra?: Record<string, unknown> }[] = [];
  const start = createClipSyncStarter({
    claim: async () => claimResult,
    run: (userId) => {
      runCalls.push(userId);
      return run.promise;
    },
    reportError: (_error, context, extra) => {
      reported.push({ context, extra });
    },
  });
  return { start, run, runCalls, reported };
}

describe("createClipSyncStarter", () => {
  it("answers once the sync is claimed, without waiting for it to finish", async () => {
    const { start, run, runCalls, reported } = setup({ claimed: true, userId: "u1" });

    // The run promise is never settled before this resolves, so an awaited
    // sync would hang the test here.
    expect(await start("b1")).toEqual({ started: true });
    expect(runCalls).toEqual(["u1"]);

    run.resolve(120);
    await run.promise;
    expect(reported).toEqual([]);
  });

  it("passes the cooldown answer through and starts nothing", async () => {
    const skipped: ClipSyncSkipped = { skipped: true, running: false, lastSync: "2026-11-04T10:00:00.000Z" };
    const { start, runCalls } = setup(skipped);

    expect(await start("b1")).toEqual(skipped);
    expect(runCalls).toEqual([]);
  });

  it("passes the already-running answer through", async () => {
    const skipped: ClipSyncSkipped = { skipped: true, running: true, lastSync: "2026-11-04T10:00:00.000Z" };
    const { start, runCalls } = setup(skipped);

    expect(await start("b1")).toEqual(skipped);
    expect(runCalls).toEqual([]);
  });

  it("reports a background failure instead of leaving it unhandled", async () => {
    const { start, run, reported } = setup({ claimed: true, userId: "u1" });

    expect(await start("b1")).toEqual({ started: true });
    run.reject(new Error("helix down"));
    // Let the catch handler run.
    await run.promise.catch(() => {});
    await Promise.resolve();

    expect(reported).toEqual([{ context: "clips-sync.run", extra: { userId: "u1" } }]);
  });

  it("lets a failed claim reach the caller", async () => {
    const start = createClipSyncStarter({
      claim: async () => {
        throw new Error("no integration");
      },
      run: async () => 0,
      reportError: () => {},
    });

    await expect(start("b1")).rejects.toThrow("no integration");
  });
});
