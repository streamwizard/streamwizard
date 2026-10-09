import { describe, expect, it } from "bun:test";
import { insertToken } from "./alert-token-insert";

describe("insertToken", () => {
  it("drops the token at the caret and leaves the caret after it", () => {
    expect(insertToken("Hi !", "name", 3, 3, 200)).toEqual({ text: "Hi {name}!", caret: 9 });
  });

  it("replaces a selection, whichever way it was dragged", () => {
    expect(insertToken("Hi someone!", "name", 3, 10, 200).text).toBe("Hi {name}!");
    expect(insertToken("Hi someone!", "name", 10, 3, 200).text).toBe("Hi {name}!");
  });

  it("appends when the caret sits past the end", () => {
    expect(insertToken("Hi ", "name", 99, 99, 200)).toEqual({ text: "Hi {name}", caret: 9 });
  });

  it("refuses instead of cutting off what was typed", () => {
    const full = "x".repeat(198);
    expect(insertToken(full, "name", 198, 198, 200)).toEqual({ text: full, caret: 198 });
  });
});
