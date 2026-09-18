import { describe, expect, test } from "bun:test";
import type { DiscordTicket, DiscordTicketEvent } from "@repo/supabase/queries/tickets";
import type { TranscriptMessage } from "@/components/discord/ticket-transcript";
import { initialTicketState, ticketReducer, unknownMentions } from "./ticket-store";

const message = (id: string, created_at: string, content = ""): TranscriptMessage => ({
  id,
  author_discord_id: "1",
  author_name: "a",
  author_avatar_url: null,
  author_is_bot: false,
  content,
  embeds: [],
  attachments: [],
  created_at,
  edited_at: null,
  deleted_at: null,
  pinned: false,
});

const event = (id: string, type: string, created_at: string): DiscordTicketEvent =>
  ({
    id,
    type,
    created_at,
    ticket_id: "t",
    actor_discord_id: null,
    actor_name: null,
    target_discord_id: null,
    target_name: null,
    detail: null,
  }) as DiscordTicketEvent;

const base = initialTicketState({
  ticket: { id: "t", status: "open" } as DiscordTicket,
  messages: [message("m1", "2026-01-01T00:00:01Z")],
  events: [event("e1", "opened", "2026-01-01T00:00:00Z")],
  members: [],
  names: { "111111111111111111": "Known" },
  profiles: {},
});

describe("ticketReducer", () => {
  test("appends a new message in created_at order", () => {
    const early = message("m0", "2026-01-01T00:00:00Z");
    const next = ticketReducer(base, { type: "message", message: early });
    expect(next.messages.map((m) => m.id)).toEqual(["m0", "m1"]);
  });

  test("replaces an edited message in place", () => {
    const edited = { ...message("m1", "2026-01-01T00:00:01Z", "changed"), edited_at: "2026-01-01T00:01:00Z" };
    const next = ticketReducer(base, { type: "message", message: edited });
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]?.content).toBe("changed");
  });

  test("ignores a repeated event and flags members after a member event", () => {
    const same = ticketReducer(base, { type: "event", event: event("e1", "opened", "2026-01-01T00:00:00Z") });
    expect(same).toBe(base);
    const next = ticketReducer(base, { type: "event", event: event("e2", "member_added", "2026-01-01T00:00:02Z") });
    expect(next.events).toHaveLength(2);
    expect(next.membersStale).toBe(true);
    const settled = ticketReducer(next, { type: "members", members: [{ id: "2", name: "b" }] });
    expect(settled.membersStale).toBe(false);
    expect(settled.members).toEqual([{ id: "2", name: "b" }]);
  });

  test("merges names and replaces everything on a snapshot", () => {
    const named = ticketReducer(base, { type: "names", names: { "222222222222222222": "New" } });
    expect(Object.keys(named.names)).toHaveLength(2);
    const reset = ticketReducer(named, { type: "snapshot", snapshot: { ...base, names: {} } });
    expect(reset.names).toEqual({});
    expect(reset.membersStale).toBe(false);
  });
});

describe("unknownMentions", () => {
  test("returns only ids the page can't label", () => {
    const ids = unknownMentions(
      ["hi <@111111111111111111> and <@!222222222222222222>", null, "<@222222222222222222>"],
      base.names,
    );
    expect(ids).toEqual(["222222222222222222"]);
  });
});
