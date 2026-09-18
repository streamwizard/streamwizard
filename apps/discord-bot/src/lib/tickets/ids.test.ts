import { describe, expect, test } from "bun:test";
import { parseTicketId, TICKET_IDS, ticketId } from "./ids";

describe("ticket customIds", () => {
  test("a bare id has no arg", () => {
    expect(parseTicketId("ticket:create")).toEqual({ action: TICKET_IDS.create, arg: null });
    expect(parseTicketId("ticket:close-confirm")).toEqual({ action: TICKET_IDS.closeConfirm, arg: null });
  });

  test("the arg is everything after the action", () => {
    expect(parseTicketId("ticket:create:bug")).toEqual({ action: TICKET_IDS.create, arg: "bug" });
    expect(parseTicketId("ticket:submit:feature_request")).toEqual({ action: TICKET_IDS.submit, arg: "feature_request" });
    expect(parseTicketId("ticket:feedback:abc:5")).toEqual({ action: "ticket:feedback", arg: "abc:5" });
  });

  test("ticketId round-trips and fits Discord's 100 characters at the longest slug", () => {
    const slug = "a".repeat(32);
    const id = ticketId(TICKET_IDS.submit, slug);
    expect(id.length).toBeLessThanOrEqual(100);
    expect(parseTicketId(id)).toEqual({ action: TICKET_IDS.submit, arg: slug });
    expect(ticketId(TICKET_IDS.create)).toBe("ticket:create");
  });
});
