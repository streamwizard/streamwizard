import type { DiscordActionResult } from "@/lib/discord/action";

// Results the Discord dashboard's actions hand to its components.

/** A server member from the member search, for adding someone to a ticket or handing it over. */
export interface MemberSearchResult {
  id: string;
  name: string;
  username: string;
}

/** Removing a ticket category or product. */
export interface TicketOptionRemoveResult extends DiscordActionResult {
  /** "archived" when tickets still use it, so it was hidden instead of deleted. */
  outcome?: "deleted" | "archived";
}
