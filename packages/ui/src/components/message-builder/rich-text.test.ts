import { describe, expect, test } from "bun:test";
import { parseRichText } from "./rich-text";

describe("parseRichText", () => {
  test("plain text stays one node, line breaks included", () => {
    expect(parseRichText("Hello\nthere")).toEqual([{ type: "text", value: "Hello\nthere" }]);
  });

  test("placeholders become their own nodes", () => {
    expect(parseRichText("Hi [member.name]!")).toEqual([
      { type: "text", value: "Hi " },
      { type: "variable", key: "member.name", raw: "[member.name]" },
      { type: "text", value: "!" },
    ]);
  });

  test("bold, italic, underline, strike and code", () => {
    expect(parseRichText("**a** *b* __c__ ~~d~~ `e`").filter((n) => n.type !== "text").map((n) => n.type)).toEqual([
      "bold", "italic", "underline", "strike", "code",
    ]);
  });

  test("masked links keep their label, even one that looks like a placeholder", () => {
    expect(parseRichText("[twitch.tv](https://twitch.tv/x)")).toEqual([
      { type: "link", href: "https://twitch.tv/x", children: [{ type: "text", value: "twitch.tv" }], masked: true },
    ]);
  });

  test("bare links are linked, other schemes are not", () => {
    expect(parseRichText("see https://discord.gg/abc now")[1]).toMatchObject({ type: "link", href: "https://discord.gg/abc" });
    expect(parseRichText("[x](javascript:alert(1))").some((n) => n.type === "link")).toBe(false);
  });

  test("nothing inside code is styled, and snake_case isn't italic", () => {
    expect(parseRichText("`**x**`")).toEqual([{ type: "code", value: "**x**" }]);
    expect(parseRichText("my_var_name")).toEqual([{ type: "text", value: "my_var_name" }]);
  });

  test("a placeholder inside bold text survives", () => {
    expect(parseRichText("**Welcome to [server.name]**")).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", value: "Welcome to " },
          { type: "variable", key: "server.name", raw: "[server.name]" },
        ],
      },
    ]);
  });
});
