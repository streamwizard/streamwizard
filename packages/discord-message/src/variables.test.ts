import { describe, expect, test } from "bun:test";
import { createMessage } from "./model";
import { BLANK_EMBED_PRESET } from "./presets";
import { CORE_VARIABLES, findUnknownVariables, replaceVariables, resolveMessage, sampleValues, tokenize } from "./variables";

describe("tokenize", () => {
  test("splits text and placeholders in order", () => {
    expect(tokenize("Hi [member.name], welcome to [server.name]!")).toEqual([
      { type: "text", value: "Hi " },
      { type: "variable", key: "member.name", raw: "[member.name]" },
      { type: "text", value: ", welcome to " },
      { type: "variable", key: "server.name", raw: "[server.name]" },
      { type: "text", value: "!" },
    ]);
  });

  test("leaves markdown links and plain brackets as text", () => {
    const text = "[our site](https://example.com) [twitch.tv](https://twitch.tv) [todo] [Server.Name] [server]";
    expect(tokenize(text)).toEqual([{ type: "text", value: text }]);
  });

  test("handles empty text and back-to-back placeholders", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("[a.b][c.d]").map((s) => s.type)).toEqual(["variable", "variable"]);
  });
});

describe("replaceVariables", () => {
  test("fills every occurrence", () => {
    expect(replaceVariables("[server.name] is [server.name]", { "server.name": "SW" })).toBe("SW is SW");
  });

  test("keeps placeholders without a value as typed", () => {
    expect(replaceVariables("Hi [member.nmae]", { "member.name": "Wumpus" })).toBe("Hi [member.nmae]");
  });

  test("doesn't expand placeholders that arrive inside a value", () => {
    expect(replaceVariables("[server.name]", { "server.name": "[member.mention]", "member.mention": "<@1>" })).toBe(
      "[member.mention]",
    );
  });

  test("an empty value replaces the placeholder", () => {
    expect(replaceVariables("a[x.y]b", { "x.y": "" })).toBe("ab");
  });
});

test("findUnknownVariables lists each unknown key once", () => {
  expect(findUnknownVariables("[server.name] [foo.bar] [foo.bar] [x.y]", ["server.name"])).toEqual(["foo.bar", "x.y"]);
});

test("resolveMessage fills banners, embeds, fields and footers without touching the input", () => {
  const message = createMessage([
    { type: "banner", text: "Welcome to [server.name]", image: null },
    {
      ...BLANK_EMBED_PRESET.draft,
      type: "embed",
      title: "[server.name]",
      description: "Hi [member.mention]",
      footer: "[server.member_count] members",
      color: 1,
      fields: [{ name: "[member.name]", value: "[server.name]", inline: true }],
    },
  ]);
  const resolved = resolveMessage(message, sampleValues(CORE_VARIABLES));
  const [banner, embed] = resolved.elements;
  expect(banner).toMatchObject({ text: "Welcome to StreamWizard" });
  expect(embed).toMatchObject({
    title: "StreamWizard",
    description: "Hi @Wumpus",
    footer: "1,204 members",
    fields: [{ name: "Wumpus", value: "StreamWizard" }],
  });
  expect(message.elements[0]).toMatchObject({ text: "Welcome to [server.name]" });
});

test("the core variables cover server name, member mention, member name and member count", () => {
  expect(CORE_VARIABLES.map((v) => v.key).sort()).toEqual(
    ["member.mention", "member.name", "server.member_count", "server.name"].sort(),
  );
});
