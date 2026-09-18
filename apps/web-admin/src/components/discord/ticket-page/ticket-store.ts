import type { DiscordTicket, DiscordTicketEvent, DiscordTicketMessage } from "@repo/supabase/queries/tickets";
import type { TranscriptMessage } from "@/components/discord/ticket-transcript";
import type { TicketMember, TicketSnapshot } from "@/lib/discord/ticket-snapshot";

// The ticket page's state and the deltas realtime feeds it. Pure, so the
// reducer can be tested without React.

export type TicketAction =
  | { type: "snapshot"; snapshot: TicketSnapshot }
  | { type: "ticket"; ticket: DiscordTicket }
  | { type: "message"; message: TranscriptMessage }
  | { type: "event"; event: DiscordTicketEvent }
  | { type: "members"; members: TicketMember[] }
  | { type: "names"; names: Record<string, string> };

export interface TicketState extends TicketSnapshot {
  /** A member_added/member_removed event arrived; the list needs refetching. */
  membersStale: boolean;
}

const MEMBER_EVENTS = new Set(["member_added", "member_removed", "transferred"]);

function byCreatedAt<T extends { created_at: string }>(a: T, b: T): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/** Insert or replace by id, keeping created_at order. Realtime may repeat or reorder frames. */
function upsert<T extends { id: string; created_at: string }>(list: T[], row: T): T[] {
  const index = list.findIndex((item) => item.id === row.id);
  if (index === -1) return [...list, row].sort(byCreatedAt);
  const next = list.slice();
  next[index] = row;
  return next;
}

export function initialTicketState(snapshot: TicketSnapshot): TicketState {
  return { ...snapshot, membersStale: false };
}

export function ticketReducer(state: TicketState, action: TicketAction): TicketState {
  switch (action.type) {
    case "snapshot":
      return { ...action.snapshot, membersStale: false };
    case "ticket":
      return { ...state, ticket: action.ticket };
    case "message":
      return { ...state, messages: upsert(state.messages, action.message) };
    case "event": {
      if (state.events.some((event) => event.id === action.event.id)) return state;
      return {
        ...state,
        events: upsert(state.events, action.event),
        membersStale: state.membersStale || MEMBER_EVENTS.has(action.event.type),
      };
    }
    case "members":
      return { ...state, members: action.members, membersStale: false };
    case "names":
      return { ...state, names: { ...state.names, ...action.names } };
  }
}

const MENTION = /<@!?(\d{17,20})>/g;

/** User ids mentioned in text the page can't label yet. */
export function unknownMentions(texts: (string | null | undefined)[], names: Record<string, string>): string[] {
  const ids = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(MENTION)) {
      const id = match[1];
      if (id && !(id in names)) ids.add(id);
    }
  }
  return [...ids];
}

export type { DiscordTicketMessage };
