import { describe, expect, test } from "bun:test";
import { applyLink, findLinkAt, formatLink, normalizeUrl, pasteAsLink, removeLink, splitLinks } from "./links";

describe("normalizeUrl", () => {
  test("adds https when the scheme is left out", () => {
    expect(normalizeUrl("twitch.tv/streamwizard")).toBe("https://twitch.tv/streamwizard");
    expect(normalizeUrl("  https://x.com/a  ")).toBe("https://x.com/a");
  });

  test("refuses what Discord won't link", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("not a link")).toBeNull();
    expect(normalizeUrl("twitch")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("mailto:hi@example.com")).toBeNull();
  });

  test("escapes brackets that would end the link early", () => {
    expect(normalizeUrl("https://en.wikipedia.org/wiki/Twitch_(service)")).toBe("https://en.wikipedia.org/wiki/Twitch_%28service%29");
  });
});

describe("formatLink", () => {
  test("falls back to the address when there is no text", () => {
    expect(formatLink("  ", "https://twitch.tv/a")).toBe("[https://twitch.tv/a](https://twitch.tv/a)");
  });

  test("drops square brackets from the text", () => {
    expect(formatLink("[Live] now", "https://twitch.tv/a")).toBe("[Live now](https://twitch.tv/a)");
  });
});

describe("applyLink", () => {
  test("replaces the selected words", () => {
    const result = applyLink("Watch on Twitch today", { start: 9, end: 15 }, "Twitch", "https://twitch.tv/a");
    expect(result.text).toBe("Watch on [Twitch](https://twitch.tv/a) today");
    expect(result.caret).toBe("Watch on [Twitch](https://twitch.tv/a)".length);
  });

  test("inserts at a bare caret", () => {
    expect(applyLink("ab", { start: 1, end: 1 }, "X", "https://x.com").text).toBe("a[X](https://x.com)b");
  });
});

describe("findLinkAt", () => {
  const text = "See [Twitch](https://twitch.tv/a) and [X](https://x.com/b).";

  test("finds the link the caret is in", () => {
    expect(findLinkAt(text, { start: 8, end: 8 })).toEqual({ start: 4, end: 33, label: "Twitch", url: "https://twitch.tv/a" });
    expect(findLinkAt(text, { start: 40, end: 40 })?.label).toBe("X");
  });

  test("nothing outside a link, or across two", () => {
    expect(findLinkAt(text, { start: 1, end: 1 })).toBeNull();
    expect(findLinkAt(text, { start: 8, end: 40 })).toBeNull();
  });

  test("a placeholder is not a link", () => {
    expect(findLinkAt("Hi [server.name]", { start: 6, end: 6 })).toBeNull();
  });
});

describe("removeLink", () => {
  test("leaves the text behind", () => {
    const text = "See [Twitch](https://twitch.tv/a).";
    const link = findLinkAt(text, { start: 6, end: 6 });
    expect(link).not.toBeNull();
    expect(removeLink(text, link!).text).toBe("See Twitch.");
  });
});

describe("pasteAsLink", () => {
  test("an address pasted over words links them", () => {
    expect(pasteAsLink("Follow on X", { start: 10, end: 11 }, "https://x.com/a")?.text).toBe("Follow on [X](https://x.com/a)");
  });

  test("leaves ordinary pastes alone", () => {
    expect(pasteAsLink("Follow on X", { start: 11, end: 11 }, "https://x.com/a")).toBeNull();
    expect(pasteAsLink("Follow on X", { start: 10, end: 11 }, "some words")).toBeNull();
    expect(pasteAsLink("Go https://old.com", { start: 3, end: 18 }, "https://new.com")).toBeNull();
    expect(pasteAsLink("See [X](https://x.com/a)", { start: 5, end: 6 }, "https://new.com")).toBeNull();
  });
});

describe("splitLinks", () => {
  test("cuts text into runs and links, offsets kept", () => {
    expect(splitLinks("[Twitch](https://twitch.tv/a)\n[YouTube](https://youtube.com/@a) more")).toEqual([
      { type: "link", start: 0, end: 29, label: "Twitch", url: "https://twitch.tv/a" },
      { type: "text", value: "\n" },
      { type: "link", start: 30, end: 63, label: "YouTube", url: "https://youtube.com/@a" },
      { type: "text", value: " more" },
    ]);
    expect(splitLinks("plain [server.name]")).toEqual([{ type: "text", value: "plain [server.name]" }]);
  });
});
