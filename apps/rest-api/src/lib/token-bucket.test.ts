import { describe, expect, it } from "bun:test";
import { TokenBucketLimiter } from "@/lib/token-bucket";

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const takeN = (limiter: TokenBucketLimiter, key: string, n: number) =>
  Array.from({ length: n }, () => limiter.take(key));

describe("TokenBucketLimiter", () => {
  it("allows a full burst at once, then refuses with Retry-After 1", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({ ratePerSecond: 30, burst: 100, now: clock.now });
    expect(takeN(limiter, "a", 100).every((w) => w === null)).toBe(true);
    expect(limiter.take("a")).toBe(1);
    expect(limiter.take("a")).toBe(1);
  });

  it("refills at the rate, never past the burst", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({ ratePerSecond: 30, burst: 100, now: clock.now });
    takeN(limiter, "a", 100);
    clock.advance(1000);
    expect(takeN(limiter, "a", 30).every((w) => w === null)).toBe(true);
    expect(limiter.take("a")).toBe(1);
    // A third of a second is ten tokens.
    clock.advance(334);
    expect(takeN(limiter, "a", 10).every((w) => w === null)).toBe(true);
    expect(limiter.take("a")).toBe(1);
    // Long idle: full again, but no more than the burst.
    clock.advance(60_000);
    expect(takeN(limiter, "a", 100).every((w) => w === null)).toBe(true);
    expect(limiter.take("a")).toBe(1);
  });

  it("a refused request takes nothing", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({ ratePerSecond: 10, burst: 1, now: clock.now });
    expect(limiter.take("a")).toBeNull();
    for (let i = 0; i < 50; i++) expect(limiter.take("a")).toBe(1);
    clock.advance(100);
    expect(limiter.take("a")).toBeNull();
  });

  it("Retry-After rounds up to the next whole second for slow rates", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({ ratePerSecond: 0.5, burst: 1, now: clock.now });
    expect(limiter.take("a")).toBeNull();
    expect(limiter.take("a")).toBe(2);
    clock.advance(1500);
    expect(limiter.take("a")).toBe(1);
    clock.advance(500);
    expect(limiter.take("a")).toBeNull();
  });

  it("keys don't share a bucket", () => {
    const clock = fakeClock();
    const limiter = new TokenBucketLimiter({ ratePerSecond: 30, burst: 100, now: clock.now });
    takeN(limiter, "a", 100);
    expect(limiter.take("a")).toBe(1);
    expect(limiter.take("b")).toBeNull();
  });
});
