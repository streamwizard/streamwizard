import { describe, expect, it } from "bun:test";
import { blockingMessage, publicContentUrl } from "./publish";

describe("blockingMessage", () => {
  it("is null when only warnings are left", () => {
    expect(blockingMessage([{ severity: "warning", message: "Add a summary." }])).toBeNull();
  });

  it("names the first error and counts the rest", () => {
    expect(
      blockingMessage([
        { severity: "warning", message: "Add a summary." },
        { severity: "error", message: "Pick a cover image." },
        { severity: "error", message: "Add at least one author." },
      ]),
    ).toBe("Pick a cover image. Plus 1 more on the Checks tab.");
  });

  it("says which guide section an error is in", () => {
    expect(blockingMessage([{ severity: "error", message: "Needs a title.", section: 2 }])).toBe(
      "Section 3: Needs a title.",
    );
  });
});

describe("publicContentUrl", () => {
  it("joins the site URL and the post's path", () => {
    expect(publicContentUrl("https://staging.streamwizard.org", "guide", "set-up-alerts")).toBe(
      "https://staging.streamwizard.org/guides/set-up-alerts",
    );
  });

  it("is null without a site URL", () => {
    expect(publicContentUrl(undefined, "blog", "x")).toBeNull();
  });
});
