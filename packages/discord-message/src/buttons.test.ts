import { describe, expect, test } from "bun:test";
import { BUTTON_ACTIONS, buttonCustomId, parseButtonCustomId } from "./buttons";
import { validateMessage } from "./limits";
import { createMessage } from "./model";
import { planDiscordMessages } from "./plan";
import { builtMessageSchema, type ButtonDraft, type ElementDraft } from "./schema";
import { resolveMessage } from "./variables";

const embed = (title: string): ElementDraft => ({ type: "embed", title, description: "", color: 0, fields: [], footer: "" });
const banner: ElementDraft = { type: "banner", text: "Hi", image: null };
const link: ButtonDraft = { kind: "link", label: "Site", url: "https://streamwizard.org" };
const action: ButtonDraft = { kind: "action", label: "Link", action: "link_account", style: "primary" };
const row = (...buttons: ButtonDraft[]): ElementDraft => ({ type: "buttons", buttons });

const shape = (drafts: ElementDraft[]) =>
  planDiscordMessages(createMessage(drafts)).map((m) => (m.kind === "banner" ? "banner" : `${m.embeds.length}e+${m.components.length}r`));

describe("custom ids", () => {
  test("round trip, and other ids are left alone", () => {
    expect(parseButtonCustomId(buttonCustomId("link_account", "abc"))).toEqual({ action: "link_account" });
    expect(parseButtonCustomId("ticket:open")).toBeNull();
    expect(parseButtonCustomId("built")).toBeNull();
  });

  test("fit Discord's 100 characters with a uuid button id", () => {
    for (const { key } of BUTTON_ACTIONS) expect(buttonCustomId(key, crypto.randomUUID()).length).toBeLessThanOrEqual(100);
  });
});

describe("planning buttons", () => {
  test("a row goes under the embeds before it, in the same message", () => {
    expect(shape([embed("a"), embed("b"), row(link)])).toEqual(["2e+1r"]);
  });

  test("with no embeds before it, a row is a message of its own", () => {
    expect(shape([row(link)])).toEqual(["0e+1r"]);
    expect(shape([embed("a"), banner, row(link)])).toEqual(["1e+0r", "banner", "0e+1r"]);
  });

  test("an embed after buttons starts a new message", () => {
    expect(shape([embed("a"), row(link), embed("b")])).toEqual(["1e+1r", "1e+0r"]);
  });

  test("rows stack up to five, then spill into the next message", () => {
    expect(shape([embed("a"), ...Array.from({ length: 6 }, () => row(link))])).toEqual(["1e+5r", "0e+1r"]);
  });

  test("link buttons carry a url, action buttons a custom id and a style", () => {
    const message = createMessage([row(link, action)]);
    const [planned] = planDiscordMessages(message);
    if (planned?.kind !== "embeds") throw new Error("expected a components message");
    const actionId = message.elements[0]!.type === "buttons" ? message.elements[0]!.buttons[1]!.id : "";
    expect(planned.components).toEqual([
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: "Site", url: "https://streamwizard.org" },
          { type: 2, style: 1, label: "Link", custom_id: `built:link_account:${actionId}` },
        ],
      },
    ]);
  });
});

describe("button rules", () => {
  const issuesOf = (...buttons: ButtonDraft[]) => validateMessage(createMessage([row(...buttons)])).map((issue) => issue.code);

  test("a good row passes, and buttons alone are a message", () => {
    expect(issuesOf(link, action)).toEqual([]);
  });

  test("empty rows, missing labels, bad addresses and unknown actions are flagged", () => {
    expect(issuesOf()).toEqual(["buttons_empty"]);
    expect(issuesOf({ ...link, label: " " })).toEqual(["button_incomplete"]);
    expect(issuesOf({ ...link, url: "streamwizard.org" })).toEqual(["button_incomplete"]);
    expect(issuesOf({ ...link, url: "javascript:alert(1)" })).toEqual(["button_incomplete"]);
    expect(issuesOf({ ...action, action: "launch_rocket" })).toEqual(["button_incomplete"]);
  });

  test("six buttons in a row, or a label over 80 characters", () => {
    expect(issuesOf(link, link, link, link, link, link)).toEqual(["too_many_buttons"]);
    expect(issuesOf({ ...link, label: "x".repeat(81) })).toEqual(["too_long"]);
  });

  test("labels take placeholders, and the stored shape parses", () => {
    const message = createMessage([row({ ...link, label: "Join [server.name]" })]);
    expect(builtMessageSchema.safeParse(message).success).toBe(true);
    expect(validateMessage(message, { allowedVariables: [] }).map((i) => i.code)).toEqual(["unknown_variable"]);
    const resolved = resolveMessage(message, { "server.name": "Wizards" });
    expect(resolved.elements[0]).toMatchObject({ buttons: [{ label: "Join Wizards" }] });
  });
});
