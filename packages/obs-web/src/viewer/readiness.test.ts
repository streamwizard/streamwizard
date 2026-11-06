import { expect, test } from "bun:test";
import { probeDelay, waitForViewer } from "./readiness";

const ROOT = "https://node-1.streamwizard.org/instances/abc/selkies/";

function fakeNode(statuses: (number | "down")[]) {
  const clock = { now: 0 };
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (status === "down") throw new TypeError("Failed to fetch");
    return new Response(null, { status });
  };
  const sleep = async (ms: number) => {
    clock.now += ms;
  };
  return { fetch, sleep, now: () => clock.now, calls, clock };
}

test("resolves once the node answers 200, probing with HEAD and no credentials", async () => {
  const node = fakeNode([503, "down", 503, 200]);
  expect(await waitForViewer(ROOT, { signal: new AbortController().signal, ...node })).toBe(true);
  expect(node.calls).toHaveLength(4);
  expect(node.calls[0]?.url).toBe(ROOT);
  expect(node.calls[0]?.init).toMatchObject({ method: "HEAD", credentials: "omit", cache: "no-store" });
});

test("gives up after the timeout", async () => {
  const node = fakeNode([503]);
  expect(await waitForViewer(ROOT, { signal: new AbortController().signal, timeoutMs: 30_000, ...node })).toBe(false);
  expect(node.clock.now).toBeGreaterThanOrEqual(30_000);
});

test("stops when aborted", async () => {
  const node = fakeNode([503]);
  const controller = new AbortController();
  const sleep = async () => controller.abort();
  expect(await waitForViewer(ROOT, { signal: controller.signal, ...node, sleep })).toBe(false);
  expect(node.calls).toHaveLength(1);
});

test("backs off from 1 s to at most 5 s", () => {
  expect(probeDelay(0)).toBe(1_000);
  expect(probeDelay(1)).toBe(1_500);
  expect(probeDelay(3)).toBe(3_375);
  expect(probeDelay(10)).toBe(5_000);
});
