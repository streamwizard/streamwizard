import { describe, expect, it } from "bun:test";
import { createFlagReader, parseFlagOverrides, type FlagSource } from "./flags";

function countingSource(values: Record<string, unknown>) {
  const calls: string[] = [];
  const source: FlagSource = async (distinctId) => {
    calls.push(distinctId);
    return values;
  };
  return { source, calls };
}

describe("parseFlagOverrides", () => {
  it("reads bare keys as on and explicit values", () => {
    const overrides = parseFlagOverrides(" cms-admin, cms-public=false ,cms-comments=1,x=off");
    expect([...overrides]).toEqual([
      ["cms-admin", true],
      ["cms-public", false],
      ["cms-comments", true],
      ["x", false],
    ]);
  });

  it("is empty for an unset or blank value", () => {
    expect(parseFlagOverrides(undefined).size).toBe(0);
    expect(parseFlagOverrides(" , ").size).toBe(0);
  });
});

describe("createFlagReader", () => {
  it("is off for everything when PostHog isn't configured", async () => {
    const isEnabled = createFlagReader({ source: null });
    expect(await isEnabled("cms-public")).toBe(false);
  });

  it("treats true and any variant as on, everything else as off", async () => {
    expect(await createFlagReader({ source: countingSource({ "cms-public": true }).source })("cms-public")).toBe(true);
    expect(await createFlagReader({ source: countingSource({ "cms-public": "test" }).source })("cms-public")).toBe(
      true,
    );
    expect(await createFlagReader({ source: countingSource({ "cms-public": false }).source })("cms-public")).toBe(
      false,
    );
    expect(await createFlagReader({ source: countingSource({ "cms-public": "" }).source })("cms-public")).toBe(false);
    expect(await createFlagReader({ source: countingSource({}).source })("cms-public")).toBe(false);
  });

  it("lets an override win without asking PostHog", async () => {
    const { source, calls } = countingSource({ "cms-public": false });
    const isEnabled = createFlagReader({ source, overrides: () => new Map([["cms-public", true]]) });
    expect(await isEnabled("cms-public")).toBe(true);
    expect(calls).toEqual([]);
  });

  it("asks once per distinct id until the snapshot expires", async () => {
    let time = 0;
    const { source, calls } = countingSource({ "cms-public": true });
    const isEnabled = createFlagReader({ source, ttlMs: 1000, now: () => time });
    await isEnabled("cms-public", "user-1");
    await isEnabled("cms-comments", "user-1");
    await isEnabled("cms-public", "user-2");
    expect(calls).toEqual(["user-1", "user-2"]);
    time = 1001;
    await isEnabled("cms-public", "user-1");
    expect(calls).toEqual(["user-1", "user-2", "user-1"]);
  });

  it("shares one request between concurrent checks", async () => {
    const { source, calls } = countingSource({ "cms-public": true });
    const isEnabled = createFlagReader({ source });
    await Promise.all([isEnabled("cms-public"), isEnabled("cms-comments"), isEnabled("cms-public")]);
    expect(calls).toHaveLength(1);
  });

  it("keeps the last known value when a refresh fails", async () => {
    let time = 0;
    let fail = false;
    const errors: unknown[] = [];
    const source: FlagSource = async () => {
      if (fail) throw new Error("posthog down");
      return { "cms-public": true };
    };
    const isEnabled = createFlagReader({ source, ttlMs: 10, now: () => time, onError: (e) => errors.push(e) });
    expect(await isEnabled("cms-public")).toBe(true);
    fail = true;
    time = 100;
    expect(await isEnabled("cms-public")).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("falls back to off when PostHog is too slow and nothing is known", async () => {
    const errors: unknown[] = [];
    const source: FlagSource = () => new Promise(() => {});
    const isEnabled = createFlagReader({ source, timeoutMs: 5, onError: (e) => errors.push(e) });
    expect(await isEnabled("cms-public")).toBe(false);
    expect(String(errors[0])).toContain("timed out");
  });
});
