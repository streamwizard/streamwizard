import { afterEach, describe, expect, it, mock } from "bun:test";
import type { TwitchApi } from "@repo/twitch-api";
import type { EventSubLifecycleEvent, EventSubReceiverStats } from "@repo/twitch-eventsub";

// Every test passes its own fake API, so the real client is never needed.
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));
const { ConduitShardManager, parseShardIds } = await import("@repo/twitch-eventsub");

type FakeSocket = { send(data: string): void; close(): void };

// Local stand-in for Twitch's EventSub socket: welcomes every connection and
// lets a test push frames to all open sockets.
function startFakeTwitch() {
  let sessions = 0;
  const sockets: FakeSocket[] = [];
  const openedAt: number[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      return srv.upgrade(req) ? undefined : new Response("upgrade required", { status: 400 });
    },
    websocket: {
      open(ws) {
        sessions++;
        sockets.push(ws);
        openedAt.push(Date.now());
        ws.send(frame("session_welcome", { session: { id: `session-${sessions}`, keepalive_timeout_seconds: 10 } }));
      },
      close(ws) {
        const i = sockets.indexOf(ws);
        if (i >= 0) sockets.splice(i, 1);
      },
      message() {},
    },
  });
  return {
    url: `ws://localhost:${server.port}`,
    openedAt,
    broadcast: (data: string) => sockets.forEach((ws) => ws.send(data)),
    dropAll: () => [...sockets].forEach((ws) => ws.close()),
    // Not awaited: after the server closes a socket itself, Bun's stop(true)
    // promise can hang past the hook timeout.
    stop: () => {
      void server.stop(true);
    },
  };
}

let messageSeq = 0;
function frame(type: string, payload: unknown, subscriptionType?: string) {
  return JSON.stringify({
    metadata: {
      message_id: `m${++messageSeq}`,
      message_type: type,
      message_timestamp: new Date().toISOString(),
      subscription_type: subscriptionType,
    },
    payload,
  });
}

function fakeApi(initialShardCount: number | null) {
  const conduit = initialShardCount === null ? null : { id: "conduit-1", shard_count: initialShardCount, shards: [] };
  const bound: string[] = [];
  const resizes: number[] = [];
  const api = {
    eventsub: {
      getConduits: async () => ({ data: conduit ? [conduit] : [] }),
      updateConduit: async (_id: string, count: number) => {
        resizes.push(count);
        if (conduit) conduit.shard_count = count;
        return { data: conduit ? [conduit] : [] };
      },
      updateShardTransport: async (_conduit: string, shardId: string) => {
        bound.push(shardId);
        return { data: [], errors: [] };
      },
    },
  } as unknown as TwitchApi;
  return { api, bound, resizes };
}

async function waitFor(check: () => boolean, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await Bun.sleep(10);
  }
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

function setup(
  opts: { shardCount: number; shardIds?: string[]; conduitShards?: number | null; staggerMs?: number; heartbeatIntervalMs?: number },
) {
  const twitch = startFakeTwitch();
  const { api, bound, resizes } = fakeApi(opts.conduitShards === undefined ? opts.shardCount : opts.conduitShards);
  const events: { shardId: string; event: EventSubLifecycleEvent }[] = [];
  const beats: EventSubReceiverStats[][] = [];
  const manager = new ConduitShardManager(
    { processTwitchEvent: async () => {} },
    {
      conduitId: "conduit-1",
      shardCount: opts.shardCount,
      shardIds: opts.shardIds,
      wsUrl: twitch.url,
      twitchApi: api,
      staggerMs: opts.staggerMs ?? 0,
      heartbeatIntervalMs: opts.heartbeatIntervalMs,
      onLifecycleEvent: (shardId, event) => events.push({ shardId, event }),
      onHeartbeat: (snapshot) => beats.push(snapshot),
      receiverOptions: { baseReconnectDelay: 1, bindRetryDelays: [5] },
    },
  );
  cleanups.push(() => twitch.stop());
  cleanups.push(() => manager.stop());
  const connected = () => events.filter((e) => e.event.type === "connected");
  return { manager, twitch, bound, resizes, events, beats, connected };
}

describe("parseShardIds", () => {
  it("reads ranges, lists and mixes, sorted and deduplicated", () => {
    expect(parseShardIds("0-3")).toEqual(["0", "1", "2", "3"]);
    expect(parseShardIds("4,0,2")).toEqual(["0", "2", "4"]);
    expect(parseShardIds("0-2, 8, 1")).toEqual(["0", "1", "2", "8"]);
  });

  it("rejects typos instead of guessing", () => {
    expect(() => parseShardIds("0-x")).toThrow();
    expect(() => parseShardIds("3-1")).toThrow();
    expect(() => parseShardIds(" , ")).toThrow();
  });
});

describe("ConduitShardManager", () => {
  it("runs one receiver per shard, each binding its own id", async () => {
    const { manager, bound, connected } = setup({ shardCount: 3 });
    await manager.start();
    await waitFor(() => connected().length === 3);

    expect([...bound].sort()).toEqual(["0", "1", "2"]);
    expect(connected().map((e) => e.shardId).sort()).toEqual(["0", "1", "2"]);
    const sessions = manager.snapshot().map((s) => s.sessionId);
    expect(new Set(sessions).size).toBe(3);
  });

  it("only runs the shard ids it was given", async () => {
    const { manager, bound, connected } = setup({ shardCount: 6, shardIds: ["1", "4"] });
    await manager.start();
    await waitFor(() => connected().length === 2);

    expect([...bound].sort()).toEqual(["1", "4"]);
  });

  it("grows a conduit that is too small", async () => {
    const { manager, resizes, connected } = setup({ shardCount: 4, conduitShards: 1 });
    await manager.start();
    await waitFor(() => connected().length === 4);

    expect(resizes).toEqual([4]);
  });

  it("grows the conduit to fit the highest shard id it runs", async () => {
    const { manager, resizes } = setup({ shardCount: 2, shardIds: ["5"], conduitShards: 2 });
    await manager.start();

    expect(resizes).toEqual([6]);
  });

  it("never shrinks a conduit that is bigger than needed", async () => {
    const { manager, resizes, connected } = setup({ shardCount: 2, conduitShards: 10 });
    await manager.start();
    await waitFor(() => connected().length === 2);

    expect(resizes).toEqual([]);
  });

  it("still starts the receivers when the conduit is missing", async () => {
    const { manager, resizes, bound } = setup({ shardCount: 2, conduitShards: null });
    await manager.start();
    await waitFor(() => bound.length >= 2);

    expect(resizes).toEqual([]);
  });

  it("staggers connects", async () => {
    const { manager, twitch, connected } = setup({ shardCount: 3, staggerMs: 60 });
    await manager.start();
    await waitFor(() => connected().length === 3);

    const [a, b, c] = twitch.openedAt;
    expect(b! - a!).toBeGreaterThanOrEqual(50);
    expect(c! - b!).toBeGreaterThanOrEqual(50);
  });

  it("counts messages, notifications, keepalives, revocations and lost connections per shard", async () => {
    const { manager, twitch, connected, events } = setup({ shardCount: 2 });
    await manager.start();
    await waitFor(() => connected().length === 2);

    twitch.broadcast(frame("session_keepalive", {}));
    twitch.broadcast(frame("notification", { event: { broadcaster_user_id: "1" } }, "channel.follow"));
    twitch.broadcast(frame("revocation", { subscription: { type: "channel.follow", status: "authorization_revoked" } }));
    await waitFor(() => manager.snapshot().every((s) => s.counters.revocations === 1));

    for (const stats of manager.snapshot()) {
      expect(stats.state).toBe("connected");
      expect(stats.sessionStartedAt).not.toBeNull();
      // welcome + keepalive + notification + revocation
      expect(stats.counters.messages).toBe(4);
      expect(stats.counters.keepalives).toBe(1);
      expect(stats.counters.notifications).toBe(1);
      expect(stats.counters.connectionsLost).toBe(0);
    }

    twitch.dropAll();
    await waitFor(() => events.filter((e) => e.event.type === "connected").length === 4);
    for (const stats of manager.snapshot()) {
      expect(stats.counters.connectionsLost).toBe(1);
    }
    const lost = events.filter((e) => e.event.type === "connection_lost").map((e) => e.shardId).sort();
    expect(lost).toEqual(["0", "1"]);
  }, 15_000);

  it("sends a heartbeat with one entry per shard", async () => {
    const { manager, beats, connected } = setup({ shardCount: 2, heartbeatIntervalMs: 30 });
    await manager.start();
    await waitFor(() => connected().length === 2);
    await waitFor(() => beats.length >= 2);

    expect(beats.at(-1)!.map((s) => s.shardId)).toEqual(["0", "1"]);
  });

  it("stop() disconnects every shard and stops the heartbeat", async () => {
    const { manager, beats, connected } = setup({ shardCount: 2, heartbeatIntervalMs: 20 });
    await manager.start();
    await waitFor(() => connected().length === 2);
    await manager.stop();
    const count = beats.length;
    await Bun.sleep(60);

    expect(beats.length).toBe(count);
    expect(manager.snapshot()).toEqual([]);
  });
});
