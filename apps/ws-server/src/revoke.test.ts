import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ConnectionData, ServerWebSocket } from "./types";

/**
 * Sockets used to be checked only at upgrade: resetting an overlay key or
 * deleting a scene left sockets opened with the old subscriber_token in the
 * room, still receiving events. revoke.ts tracks them and closes the ones
 * whose credential no longer maps to the same user.
 */

const USER = "user-1";
let liveTokens: Map<string, string>;
let queries: string[][];

mock.module("@repo/supabase", () => ({ supabase: {} }));
mock.module("@repo/sentry", () => ({ reportError: () => {} }));
mock.module("@repo/supabase/queries/overlays", () => ({
  selectSceneOwnersByTokens: async (_client: unknown, tokens: string[]) => {
    queries.push(tokens);
    return {
      data: tokens.filter((t) => liveTokens.has(t)).map((t) => ({ subscriber_token: t, user_id: liveTokens.get(t)! })),
      error: null,
    };
  },
}));

const { revokeUser, sweepSceneCredentials, trackCredentialSocket, untrackCredentialSocket, REVOKED_CLOSE_CODE } =
  await import("./revoke");

type FakeSocket = ServerWebSocket<ConnectionData> & { closedWith: number | null };

function socket(kind: "scene" | "session", token: string, userId = USER): FakeSocket {
  const ws = {
    data: { role: "subscriber", userId, channels: new Set(), connectedAt: 0, connId: token, credential: { kind, token } },
    closedWith: null as number | null,
    close(code: number) {
      ws.closedWith = code;
    },
  };
  return ws as unknown as FakeSocket;
}

const opened: FakeSocket[] = [];
function open(ws: FakeSocket): FakeSocket {
  trackCredentialSocket(ws);
  opened.push(ws);
  return ws;
}

describe("ws credential revocation", () => {
  beforeEach(() => {
    for (const ws of opened.splice(0)) untrackCredentialSocket(ws);
    liveTokens = new Map();
    queries = [];
  });

  test("after a key reset, only sockets on the old key are closed", async () => {
    liveTokens.set("new-key", USER).set("other-scene", USER);
    const oldKey = open(socket("scene", "old-key"));
    const otherScene = open(socket("scene", "other-scene"));
    const dashboard = open(socket("session", "jwt"));

    expect(await revokeUser(USER, "scene")).toBe(1);
    expect(oldKey.closedWith).toBe(REVOKED_CLOSE_CODE);
    expect(otherScene.closedWith).toBeNull();
    expect(dashboard.closedWith).toBeNull();
  });

  test("a token that now belongs to someone else is closed too", async () => {
    liveTokens.set("key", "someone-else");
    const ws = open(socket("scene", "key"));
    expect(await revokeUser(USER, "scene")).toBe(1);
    expect(ws.closedWith).toBe(REVOKED_CLOSE_CODE);
  });

  test("session closes dashboard sockets only; all closes everything", async () => {
    liveTokens.set("key", USER);
    const overlay = open(socket("scene", "key"));
    const dashboard = open(socket("session", "jwt"));
    expect(await revokeUser(USER, "session")).toBe(1);
    expect(dashboard.closedWith).toBe(REVOKED_CLOSE_CODE);
    expect(overlay.closedWith).toBeNull();

    expect(await revokeUser(USER, "all")).toBe(1);
    expect(overlay.closedWith).toBe(REVOKED_CLOSE_CODE);
  });

  test("the sweep re-checks every user's overlay sockets in one query and leaves others alone", async () => {
    liveTokens.set("a-live", "user-a");
    const live = open(socket("scene", "a-live", "user-a"));
    const deleted = open(socket("scene", "b-deleted-scene", "user-b"));
    const other = open(socket("session", "jwt", "user-c"));

    expect(await sweepSceneCredentials()).toBe(1);
    expect(queries).toHaveLength(1);
    expect(deleted.closedWith).toBe(REVOKED_CLOSE_CODE);
    expect(live.closedWith).toBeNull();
    expect(other.closedWith).toBeNull();
  });

  test("a failed lookup closes nothing", async () => {
    const ws = open(socket("scene", "key"));
    mock.module("@repo/supabase/queries/overlays", () => ({
      selectSceneOwnersByTokens: async () => ({ data: null, error: new Error("db down") }),
    }));
    expect(await sweepSceneCredentials()).toBe(0);
    expect(ws.closedWith).toBeNull();
  });
});
