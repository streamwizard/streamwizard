import { afterEach, describe, expect, it, mock } from "bun:test";
import type { TwitchApi } from "@repo/twitch-api";
import type { EventSubLifecycleEvent } from "@repo/twitch-eventsub";

// Every test passes its own fake API, so the real client (and the Supabase
// module it pulls in, which eventsub-log.test.ts mocks for the whole run) is
// never needed.
mock.module("@repo/twitch-api", () => ({ TwitchApi: class {} }));
const { TwitchEventSubReceiver, describeBindError } = await import("@repo/twitch-eventsub");

// A local stand-in for Twitch's EventSub socket: every connection gets a
// session_welcome straight away, like the real one.
function startFakeTwitch() {
  let sessions = 0;
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      return srv.upgrade(req) ? undefined : new Response("upgrade required", { status: 400 });
    },
    websocket: {
      open(ws) {
        sessions++;
        ws.send(
          JSON.stringify({
            metadata: { message_id: `m${sessions}`, message_type: "session_welcome", message_timestamp: new Date().toISOString() },
            payload: { session: { id: `session-${sessions}`, keepalive_timeout_seconds: 10 } },
          }),
        );
      },
      message() {},
    },
  });
  return { url: `ws://localhost:${server.port}`, sessions: () => sessions, stop: () => server.stop(true) };
}

function axiosError(status: number, message: string) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error: "Error", status, message } },
    config: { data: "request dump that must not be logged" },
  });
}

type ShardErrors = { id: string; message: string; code: string }[];
type BindFn = (conduitId: string, shardId: string) => Promise<void | ShardErrors>;

// Mirrors the real client: resolves { data, errors } and throws on non-2xx.
// A bind function may return shard errors to fake a 202 that refused a shard.
function fakeApi(bind: BindFn): TwitchApi {
  const updateShardTransport = async (conduitId: string, shardId: string) => ({
    data: [],
    errors: (await bind(conduitId, shardId)) ?? [],
  });
  return { eventsub: { updateShardTransport } } as unknown as TwitchApi;
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

function setup(bind: BindFn, options: { conduitMissingRetryDelay?: number; shardId?: string } = {}) {
  const twitch = startFakeTwitch();
  const events: EventSubLifecycleEvent[] = [];
  const receiver = new TwitchEventSubReceiver(
    { processTwitchEvent: async () => {} },
    {
      conduitId: "conduit-1",
      wsUrl: twitch.url,
      shardId: options.shardId,
      twitchApi: fakeApi(bind),
      baseReconnectDelay: 1,
      bindRetryDelays: [5, 5],
      conduitMissingRetryDelay: options.conduitMissingRetryDelay ?? 1,
      onLifecycleEvent: (e) => events.push(e),
    },
  );
  cleanups.push(() => twitch.stop());
  cleanups.push(() => receiver.disconnect());
  const ofType = <T extends EventSubLifecycleEvent["type"]>(type: T) =>
    events.filter((e): e is Extract<EventSubLifecycleEvent, { type: T }> => e.type === type);
  return { receiver, twitch, ofType };
}

describe("TwitchEventSubReceiver conduit binding", () => {
  it("reports a missing conduit once per outage, without retrying the 404 or claiming to be connected", async () => {
    let calls = 0;
    const { receiver, twitch, ofType } = setup(async () => {
      calls++;
      throw axiosError(404, "conduit does not exist");
    });
    await receiver.connect();
    await waitFor(() => twitch.sessions() >= 3);

    // One bind call per session: a 404 is permanent, so no in-session retries.
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(calls).toBeLessThanOrEqual(twitch.sessions());
    expect(ofType("conduit_update_failed")).toHaveLength(1);
    expect(ofType("conduit_update_failed")[0]?.status).toBe(404);
    expect(ofType("connection_lost")).toHaveLength(1);
    expect(ofType("connected")).toHaveLength(0);
  }, 15_000);

  it("keeps growing the backoff while binds fail instead of resetting on every welcome", async () => {
    const { receiver, twitch, ofType } = setup(async () => {
      throw axiosError(503, "Service Unavailable");
    });
    await receiver.connect();
    await waitFor(() => twitch.sessions() >= 3);

    const attempts = ofType("reconnect_scheduled").map((e) => e.attempt);
    expect(attempts.slice(0, 2)).toEqual([1, 2]);
    expect(ofType("conduit_update_failed")).toHaveLength(1);
    expect(ofType("connected")).toHaveLength(0);
  }, 15_000);

  it("retries a transient failure within the session and connects once bound", async () => {
    let calls = 0;
    const { receiver, ofType } = setup(async () => {
      calls++;
      if (calls === 1) throw axiosError(500, "Internal Server Error");
    });
    await receiver.connect();
    await waitFor(() => ofType("connected").length === 1);

    expect(calls).toBe(2);
    expect(ofType("conduit_update_failed")).toHaveLength(0);
    expect(receiver.getConnectionState()).toBe("connected");
  });
});

describe("TwitchEventSubReceiver shard id", () => {
  it("binds the configured shard instead of shard 0", async () => {
    const bound: string[] = [];
    const { receiver, ofType } = setup(
      async (_conduit, shardId) => {
        bound.push(shardId);
      },
      { shardId: "7" },
    );
    await receiver.connect();
    await waitFor(() => ofType("connected").length === 1);

    expect(bound).toEqual(["7"]);
  });

  it("treats a 202 that lists our shard in errors[] as a failed bind", async () => {
    const { receiver, twitch, ofType } = setup(
      async (_conduit, shardId) => [{ id: shardId, code: "websocket_session_not_found", message: "session not found" }],
      { shardId: "3" },
    );
    await receiver.connect();
    await waitFor(() => twitch.sessions() >= 2);

    expect(ofType("connected")).toHaveLength(0);
    expect(ofType("conduit_update_failed")).toHaveLength(1);
    expect(String(ofType("conduit_update_failed")[0]?.error)).toContain("shard 3 refused");
  }, 15_000);

  it("ignores errors[] entries for other shards", async () => {
    const { receiver, ofType } = setup(
      async () => [{ id: "9", code: "websocket_session_not_found", message: "not ours" }],
      { shardId: "2" },
    );
    await receiver.connect();
    await waitFor(() => ofType("connected").length === 1);

    expect(ofType("conduit_update_failed")).toHaveLength(0);
  });
});

describe("describeBindError", () => {
  it("keeps the status and Twitch's message, not the request dump", () => {
    expect(describeBindError(axiosError(404, "conduit does not exist"))).toEqual({
      status: 404,
      text: "404 conduit does not exist",
    });
    expect(describeBindError(new Error("socket hang up"))).toEqual({ status: null, text: "socket hang up" });
  });
});
