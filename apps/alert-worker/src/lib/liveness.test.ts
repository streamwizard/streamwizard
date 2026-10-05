import { describe, expect, test } from "bun:test";
import { isLoopAlive, staleAfterMs } from "./liveness";

describe("staleAfterMs", () => {
  test("never drops below five minutes", () => {
    expect(staleAfterMs(15)).toBe(5 * 60_000);
    expect(staleAfterMs(60)).toBe(5 * 60_000);
  });

  test("scales with a slow tick", () => {
    expect(staleAfterMs(120)).toBe(10 * 60_000);
  });
});

describe("isLoopAlive", () => {
  const now = 1_000_000_000;

  test("alive right after boot, before the first pass finished", () => {
    expect(isLoopAlive(now, now, 60)).toBe(true);
  });

  test("alive while passes keep finishing", () => {
    expect(isLoopAlive(now - 90_000, now, 60)).toBe(true);
  });

  test("stuck once no pass finished for the whole window", () => {
    expect(isLoopAlive(now - 5 * 60_000, now, 60)).toBe(false);
    expect(isLoopAlive(now - 6 * 60_000, now, 60)).toBe(false);
  });
});
