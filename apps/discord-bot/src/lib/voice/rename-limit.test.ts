import { describe, expect, test } from "bun:test";
import { RenameLimiter, RENAME_WINDOW_MS } from "./rename-limit";

function setup() {
  let now = 1_000_000;
  const limiter = new RenameLimiter(2, RENAME_WINDOW_MS, () => now);
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe("RenameLimiter", () => {
  test("allows two renames, then makes the third wait for the first to age out", () => {
    const { limiter, advance } = setup();
    expect(limiter.waitMs("c")).toBe(0);
    limiter.record("c");
    advance(60_000);
    expect(limiter.waitMs("c")).toBe(0);
    limiter.record("c");
    expect(limiter.waitMs("c")).toBe(RENAME_WINDOW_MS - 60_000);
    advance(RENAME_WINDOW_MS - 60_000);
    expect(limiter.waitMs("c")).toBe(0);
  });

  test("counts each channel on its own", () => {
    const { limiter } = setup();
    limiter.record("a");
    limiter.record("a");
    expect(limiter.waitMs("a")).toBeGreaterThan(0);
    expect(limiter.waitMs("b")).toBe(0);
  });

  test("Discord's own wait applies even when the bot counted nothing", () => {
    const { limiter, advance } = setup();
    limiter.block("c", 90_000);
    expect(limiter.waitMs("c")).toBe(90_000);
    advance(90_000);
    expect(limiter.waitMs("c")).toBe(0);
  });

  test("the longer of the two waits wins", () => {
    const { limiter } = setup();
    limiter.record("c");
    limiter.record("c");
    limiter.block("c", 5_000);
    expect(limiter.waitMs("c")).toBe(RENAME_WINDOW_MS);
  });

  test("forget clears a deleted channel", () => {
    const { limiter } = setup();
    limiter.record("c");
    limiter.record("c");
    limiter.block("c", 5_000);
    limiter.forget("c");
    expect(limiter.waitMs("c")).toBe(0);
  });
});
