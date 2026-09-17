import { describe, expect, test } from "bun:test";
import { createMessage } from "./model";
import { validateMessage } from "./limits";
import { defaultTicketPanel, parseTicketOpening, parseTicketPanel, TICKET_PANEL_VARIABLES } from "./tickets";

describe("ticket panel", () => {
  test("the default passes the same limits a designed panel has to", () => {
    const panel = defaultTicketPanel();
    expect(
      validateMessage(panel.message, { allowedVariables: TICKET_PANEL_VARIABLES.map((v) => v.key) }),
    ).toEqual([]);
  });

  test("anything unreadable falls back to the default instead of throwing", () => {
    expect(parseTicketPanel(null).buttonLabel).toBe("Create Ticket");
    expect(parseTicketPanel({ layout: "carousel" }).layout).toBe("button");
  });

  test("a stored panel comes back as stored", () => {
    const stored = { ...defaultTicketPanel(), layout: "menu" as const, buttonLabel: "Help me" };
    expect(parseTicketPanel(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
  });
});

describe("ticket opening message", () => {
  const embed = { type: "embed" as const, title: "Hi", description: "", color: 0, fields: [], footer: "" };

  test("embeds are kept", () => {
    const message = createMessage([embed]);
    expect(parseTicketOpening(JSON.parse(JSON.stringify(message)))).toEqual(message);
  });

  test("empty, unreadable, or carrying a banner or buttons means no opening message", () => {
    expect(parseTicketOpening(null)).toBeNull();
    expect(parseTicketOpening(createMessage([]))).toBeNull();
    expect(parseTicketOpening(createMessage([embed, { type: "banner", text: "x", image: null }]))).toBeNull();
  });
});
