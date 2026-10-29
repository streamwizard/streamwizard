import { describe, expect, it } from "bun:test";
import { TEXT_STYLES, activeTextStyle, textStyleLabel } from "./text-styles";

describe("activeTextStyle", () => {
  it("reads the heading the cursor is in", () => {
    expect(activeTextStyle({ h2: true, h3: false, h4: false })).toBe("h2");
    expect(activeTextStyle({ h2: false, h3: true, h4: false })).toBe("h3");
    expect(activeTextStyle({ h2: false, h3: false, h4: true })).toBe("h4");
  });

  it("calls everything else normal text", () => {
    expect(activeTextStyle({ h2: false, h3: false, h4: false })).toBe("paragraph");
  });
});

describe("textStyleLabel", () => {
  it("never shows the writer a level number", () => {
    expect(TEXT_STYLES.map((style) => style.label)).toEqual(["Normal text", "Heading", "Subheading", "Small heading"]);
    expect(textStyleLabel("h2")).toBe("Heading");
  });
});
