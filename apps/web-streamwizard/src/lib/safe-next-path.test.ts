import { describe, expect, it } from "bun:test";
import { safeNextPath } from "./safe-next-path";

const SITE = "https://streamwizard.org";

describe("safeNextPath", () => {
  it("keeps paths on this site untouched", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/clips?onboarding=discord-join-step")).toBe(
      "/dashboard/clips?onboarding=discord-join-step",
    );
    expect(safeNextPath("/dashboard/overlays/abc#layers")).toBe("/dashboard/overlays/abc#layers");
  });

  it("keeps a path that only mentions another site", () => {
    expect(safeNextPath("/@evil.example")).toBe("/@evil.example");
    expect(safeNextPath("/dashboard?from=https://evil.example")).toBe("/dashboard?from=https://evil.example");
  });

  it("rejects missing values", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("dashboard")).toBeNull();
    expect(safeNextPath(" /dashboard")).toBeNull();
  });

  it("rejects backslashes, which browsers read as slashes", () => {
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath("/\\/evil.example")).toBeNull();
    expect(safeNextPath("/dashboard\\..\\evil")).toBeNull();
  });

  it("rejects control characters, which browsers drop while parsing", () => {
    expect(safeNextPath("/\t/evil.example")).toBeNull();
    expect(safeNextPath("/\n/evil.example")).toBeNull();
    expect(safeNextPath("/\r/evil.example")).toBeNull();
    expect(safeNextPath("/\u0000/evil.example")).toBeNull();
    expect(safeNextPath("/dashboard\u007f")).toBeNull();
  });

  it("never lets a value through that a browser would resolve to another host", () => {
    const candidates = [
      "/dashboard",
      "/@evil.example",
      "/dashboard?from=https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r\n/evil.example",
      "/\\\\evil.example",
      "/%5Cevil.example",
      "/%2F%2Fevil.example",
      "/.//evil.example",
      "/..//evil.example",
    ];
    for (const candidate of candidates) {
      const safe = safeNextPath(candidate);
      if (safe === null) continue;
      expect(new URL(safe, `${SITE}/login`).origin).toBe(SITE);
      expect(new URL(`${SITE}${safe}`).origin).toBe(SITE);
    }
  });
});
