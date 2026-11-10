import { expect, test } from "bun:test";
import { createReconnectGuard } from "./reconnect-guard";

function guardAt(start = 1_000_000) {
  const clock = { now: start };
  const guard = createReconnectGuard({ minIntervalMs: 5_000, maxAttempts: 3, windowMs: 120_000, now: () => clock.now });
  return { guard, clock };
}

test("the first expiry reconnects at once", () => {
  const { guard } = guardAt();
  expect(guard.next()).toEqual({ action: "now" });
});

test("reconnects are spaced by the minimum interval", () => {
  const { guard, clock } = guardAt();
  guard.next();
  clock.now += 1_000;
  expect(guard.next()).toEqual({ action: "wait", ms: 4_000 });
});

test("stops after too many expiries inside the window", () => {
  const { guard, clock } = guardAt();
  expect(guard.next().action).toBe("now");
  clock.now += 10_000;
  expect(guard.next().action).toBe("now");
  clock.now += 10_000;
  expect(guard.next().action).toBe("now");
  clock.now += 10_000;
  expect(guard.next()).toEqual({ action: "stop" });
  expect(guard.next()).toEqual({ action: "stop" });
});

test("expiries outside the window are forgotten", () => {
  const { guard, clock } = guardAt();
  guard.next();
  guard.next();
  guard.next();
  clock.now += 130_000;
  expect(guard.next()).toEqual({ action: "now" });
});

test("a 12-hour viewer that expires once a day never stops", () => {
  const { guard, clock } = guardAt();
  for (let day = 0; day < 10; day++) {
    expect(guard.next().action).toBe("now");
    clock.now += 12 * 60 * 60_000;
  }
});

test("reset gives a manual reconnect a fresh budget", () => {
  const { guard } = guardAt();
  guard.next();
  guard.next();
  guard.next();
  expect(guard.next()).toEqual({ action: "stop" });
  guard.reset();
  expect(guard.next()).toEqual({ action: "now" });
});
