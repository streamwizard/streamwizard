import { describe, expect, test } from "bun:test";
import { createMessage } from "./model";
import { validateMessage } from "./limits";
import {
  DEFAULT_TICKET_MESSAGES,
  defaultTicketPanel,
  parseTicketMessages,
  parseTicketOpening,
  parseTicketPanel,
  TICKET_CLOSE_VARIABLES,
  TICKET_PANEL_VARIABLES,
} from "./tickets";
import { findUnknownVariables } from "./variables";

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

describe("parseTicketMessages", () => {
  test("empty and null give the defaults", () => {
    expect(parseTicketMessages(null)).toEqual(DEFAULT_TICKET_MESSAGES);
    expect(parseTicketMessages({})).toEqual(DEFAULT_TICKET_MESSAGES);
  });

  test("a stored text wins, a broken one falls back on its own", () => {
    expect(parseTicketMessages({ closeDm: "Bye [ticket.number]" }).closeDm).toBe("Bye [ticket.number]");
    expect(parseTicketMessages({ closeDm: "   " }).closeDm).toBe(DEFAULT_TICKET_MESSAGES.closeDm);
    expect(parseTicketMessages({ closeDm: 42 }).closeDm).toBe(DEFAULT_TICKET_MESSAGES.closeDm);
  });

  test("every default only uses close variables", () => {
    const allowed = TICKET_CLOSE_VARIABLES.map((v) => v.key);
    for (const text of Object.values(DEFAULT_TICKET_MESSAGES)) expect(findUnknownVariables(text, allowed)).toEqual([]);
  });
});
