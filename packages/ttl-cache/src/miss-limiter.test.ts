import { describe, expect, test } from "bun:test";
import { MissLimiter } from "./miss-limiter";

describe("MissLimiter", () => {
  test("blocks a key once it reaches the limit", () => {
    const limiter = new MissLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 2; i++) limiter.recordMiss("ip");
    expect(limiter.isBlocked("ip")).toBe(false);
    limiter.recordMiss("ip");
    expect(limiter.isBlocked("ip")).toBe(true);
    expect(limiter.isBlocked("other")).toBe(false);
  });

  test("forgets misses after the window", () => {
    let now = 0;
    const limiter = new MissLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    limiter.recordMiss("ip");
    expect(limiter.isBlocked("ip")).toBe(true);
    now = 1_000;
    expect(limiter.isBlocked("ip")).toBe(false);
  });
});
