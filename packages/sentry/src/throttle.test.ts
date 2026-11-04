import { describe, expect, it } from "bun:test";
import { createReportThrottle, errorFingerprint } from "./throttle";

const HOUR = 60 * 60_000;

describe("createReportThrottle", () => {
  it("allows the first report per key, then one per interval", () => {
    let t = 0;
    const allow = createReportThrottle({ intervalMs: HOUR, now: () => t });

    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
    t = HOUR - 1;
    expect(allow("a")).toBe(false);
    t = HOUR;
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
  });

  it("tracks keys separately", () => {
    const allow = createReportThrottle({ intervalMs: HOUR, now: () => 0 });
    expect(allow("a")).toBe(true);
    expect(allow("b")).toBe(true);
    expect(allow("a")).toBe(false);
    expect(allow("b")).toBe(false);
  });

  it("with an infinite interval, reports each key once per process", () => {
    let t = 0;
    const allow = createReportThrottle({ intervalMs: Number.POSITIVE_INFINITY, now: () => t });
    expect(allow("a")).toBe(true);
    t = 365 * 24 * HOUR;
    expect(allow("a")).toBe(false);
  });

  it("starts over instead of growing past maxKeys", () => {
    const allow = createReportThrottle({ intervalMs: HOUR, maxKeys: 2, now: () => 0 });
    expect(allow("a")).toBe(true);
    expect(allow("b")).toBe(true);
    expect(allow("c")).toBe(true); // clears the map
    expect(allow("a")).toBe(true);
    expect(allow("c")).toBe(false);
  });
});

describe("errorFingerprint", () => {
  it("blanks ids and numbers so the same failure shares a key", () => {
    expect(errorFingerprint(new Error("clip 123 failed"))).toBe(errorFingerprint(new Error("clip 456 failed")));
    expect(errorFingerprint(new Error("row 3f2b8c1e-0000-4000-8000-000000000000 missing"))).toBe(
      "Error: row <id> missing",
    );
  });

  it("keeps different failures apart", () => {
    expect(errorFingerprint(new TypeError("x is undefined"))).not.toBe(errorFingerprint(new Error("x is undefined")));
  });
});
