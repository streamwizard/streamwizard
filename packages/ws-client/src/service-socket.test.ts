import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import { ServiceSocket, type ServiceSocketOptions } from "./service-socket";

class FakeSocket {
  readyState: number = WebSocket.CONNECTING;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {}
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
  open() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }
}

/** Lets the async dial (await authHeader) finish. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setup(overrides: Partial<ServiceSocketOptions> = {}) {
  const sockets: FakeSocket[] = [];
  let tokens = 0;
  const socket = new ServiceSocket({
    url: "ws://ws.test",
    query: { role: "consumer", types: "a.b,c_d" },
    authHeader: async () => `Bearer token-${++tokens}`,
    name: "test-socket",
    noCredentialMessage: "no credential; off",
    createSocket: (url, headers) => {
      const s = new FakeSocket(url, headers);
      sockets.push(s);
      return s as unknown as WebSocket;
    },
    ...overrides,
  });
  return { socket, sockets };
}

beforeEach(() => {
  jest.useFakeTimers();
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("ServiceSocket", () => {
  test("dials /ws with the encoded query and a fresh Authorization header", async () => {
    const { socket, sockets } = setup();
    socket.connect();
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.url).toBe(`ws://ws.test/ws?role=consumer&types=${encodeURIComponent("a.b,c_d")}`);
    expect(sockets[0]!.headers).toEqual({ Authorization: "Bearer token-1" });
  });

  test("sends JSON only while open", async () => {
    const { socket, sockets } = setup();
    socket.connect();
    await flush();
    expect(socket.send({ a: 1 })).toBe(false);
    sockets[0]!.open();
    expect(socket.send({ a: 1 })).toBe(true);
    expect(sockets[0]!.sent).toEqual(['{"a":1}']);
  });

  test("passes raw message data to onMessage", async () => {
    const seen: unknown[] = [];
    const { socket, sockets } = setup({ onMessage: (data) => seen.push(data) });
    socket.connect();
    await flush();
    sockets[0]!.onmessage?.({ data: "hello" });
    expect(seen).toEqual(["hello"]);
  });

  test("reconnects with doubling backoff capped at 30 s, signing a new token each dial", async () => {
    let reconnects = 0;
    const { socket, sockets } = setup({ onReconnect: () => reconnects++ });
    socket.connect();
    await flush();

    const expected = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    for (const [i, delay] of expected.entries()) {
      sockets[i]!.close();
      jest.advanceTimersByTime(delay - 1);
      await flush();
      expect(sockets).toHaveLength(i + 1);
      jest.advanceTimersByTime(1);
      await flush();
      expect(sockets).toHaveLength(i + 2);
    }
    expect(reconnects).toBe(expected.length);
    expect(sockets.at(-1)!.headers.Authorization).toBe(`Bearer token-${expected.length + 1}`);
  });

  test("an error closes the socket and schedules a reconnect", async () => {
    const { socket, sockets } = setup();
    socket.connect();
    await flush();
    sockets[0]!.onerror?.();
    expect(sockets[0]!.closed).toBe(true);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(sockets).toHaveLength(2);
  });

  test("a successful open resets the backoff", async () => {
    const { socket, sockets } = setup();
    socket.connect();
    await flush();
    sockets[0]!.close();
    jest.advanceTimersByTime(1000);
    await flush();
    sockets[1]!.close();
    jest.advanceTimersByTime(2000);
    await flush();
    sockets[2]!.open();
    sockets[2]!.close();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(sockets).toHaveLength(4);
  });

  test("disconnect stops reconnecting, including a pending retry", async () => {
    const { socket, sockets } = setup();
    socket.connect();
    await flush();
    sockets[0]!.close();
    socket.disconnect();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(sockets).toHaveLength(1);

    socket.connect();
    await flush();
    expect(sockets).toHaveLength(2);
    socket.disconnect();
    expect(sockets[1]!.closed).toBe(true);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(sockets).toHaveLength(2);
  });

  test("a signing failure retries with backoff", async () => {
    let calls = 0;
    const { socket, sockets } = setup({
      authHeader: async () => {
        if (++calls === 1) throw new Error("sign failed");
        return "Bearer ok";
      },
    });
    socket.connect();
    await flush();
    expect(sockets).toHaveLength(0);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.headers.Authorization).toBe("Bearer ok");
  });

  test("no credential logs once and stays off", async () => {
    const { socket, sockets } = setup({ authHeader: async () => null });
    socket.connect();
    await flush();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(sockets).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith("[test-socket] no credential; off");
  });
});
