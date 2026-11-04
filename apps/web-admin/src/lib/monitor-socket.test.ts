import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createServiceTokenVerifier, resetSigningKey, type ServiceJwk, type ServiceTokenVerifier } from "@repo/service-token";

let isAdmin = true;
mock.module("@/lib/assert-admin", () => ({
  assertAdmin: async () => {
    if (!isAdmin) throw new Error("Not authorized");
    return "admin-user";
  },
}));

const { runMonitorSocket } = await import("./monitor-socket");

class FakeSocket {
  static opened: FakeSocket[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

const realWebSocket = globalThis.WebSocket;
let verify: ServiceTokenVerifier;

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const kid = "test-web-admin";
  process.env.WS_SERVICE_SIGNING_JWK = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid, alg: "EdDSA", svc: "web-admin" });
  resetSigningKey();
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  verify = createServiceTokenVerifier({ keys: [{ ...pub, kid, alg: "EdDSA", svc: "web-admin" } as ServiceJwk] });
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
});

afterAll(() => {
  globalThis.WebSocket = realWebSocket;
  delete process.env.WS_SERVICE_SIGNING_JWK;
  resetSigningKey();
});

beforeEach(() => {
  isAdmin = true;
  FakeSocket.opened = [];
});

const settle = () => new Promise((r) => setTimeout(r, 20));

describe("runMonitorSocket", () => {
  test("dials role=monitor with a freshly minted monitor token", async () => {
    const statuses: string[] = [];
    const messages: unknown[] = [];
    const stop = runMonitorSocket("ws://ws.test", { onStatus: (s) => statuses.push(s), onMessage: (m) => messages.push(m) });
    await settle();

    const [socket] = FakeSocket.opened;
    const url = new URL(socket!.url);
    expect(url.origin + url.pathname).toBe("ws://ws.test/ws");
    expect(url.searchParams.get("role")).toBe("monitor");
    expect((await verify(url.searchParams.get("token")!, "monitor")).service).toBe("web-admin");

    socket!.onopen?.();
    socket!.onmessage?.({ data: '{"kind":"snapshot"}' });
    socket!.onmessage?.({ data: "not json" });
    expect(statuses).toEqual(["connecting", "connected"]);
    expect(messages).toEqual([{ kind: "snapshot" }]);
    stop();
  });

  test("no socket when the token is refused; it retries instead", async () => {
    isAdmin = false;
    const statuses: string[] = [];
    const stop = runMonitorSocket("ws://ws.test", { onStatus: (s) => statuses.push(s), onMessage: () => {} });
    await settle();
    expect(FakeSocket.opened).toHaveLength(0);
    expect(statuses).toEqual(["connecting", "disconnected"]);
    stop();
  });

  test("teardown while the token is minting opens nothing, and teardown after closes quietly", async () => {
    runMonitorSocket("ws://ws.test", { onStatus: () => {}, onMessage: () => {} })();
    await settle();
    expect(FakeSocket.opened).toHaveLength(0);

    const statuses: string[] = [];
    const stop = runMonitorSocket("ws://ws.test", { onStatus: (s) => statuses.push(s), onMessage: () => {} });
    await settle();
    stop();
    expect(FakeSocket.opened[0]!.closed).toBe(true);
    expect(statuses).toEqual(["connecting"]);
  });
});
