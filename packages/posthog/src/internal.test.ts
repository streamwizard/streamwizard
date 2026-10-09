import { describe, expect, it } from "bun:test";
import { isInternalEmail } from "./internal";

describe("isInternalEmail", () => {
  it("matches the internal domain, whatever the case", () => {
    expect(isInternalEmail("someone@amrio.nl")).toBe(true);
    expect(isInternalEmail("Someone@AMRIO.NL")).toBe(true);
  });

  it("does not match look-alike domains or missing addresses", () => {
    expect(isInternalEmail("someone@notamrio.nl")).toBe(false);
    expect(isInternalEmail("someone@amrio.nl.example.com")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
    expect(isInternalEmail(undefined)).toBe(false);
  });
});
