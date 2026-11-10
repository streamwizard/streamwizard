import { describe, expect, test } from "bun:test";
import { readBearerToken } from "./bearer";

describe("readBearerToken", () => {
  test("returns the token after the Bearer scheme", () => {
    expect(readBearerToken("Bearer abc.def")).toBe("abc.def");
  });

  test("returns null for a missing header or another scheme", () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("")).toBeNull();
    expect(readBearerToken("Basic abc")).toBeNull();
    expect(readBearerToken("bearer abc")).toBeNull();
    expect(readBearerToken("Bearer")).toBeNull();
  });

  test("keeps the token as sent, without trimming", () => {
    expect(readBearerToken("Bearer ")).toBe("");
    expect(readBearerToken("Bearer  padded ")).toBe(" padded ");
  });
});
