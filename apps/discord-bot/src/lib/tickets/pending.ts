import { TtlCache } from "@repo/ttl-cache";

// What a ticket started from, kept between the click that opened the form
// and the submit that creates the ticket: the message a "Create ticket from
// message" was run on, or the member a staff "Create ticket for user" is
// about. A modal's customId can't carry a message link (100 characters), so
// this sits in memory for a few minutes, keyed by who is filling the form.

const PENDING_TTL_MS = 15 * 60 * 1000;

export interface PendingOpen {
  /** Link to the message the ticket is about. Stored on the ticket. */
  referencesMessageUrl?: string;
  /** The form's description starts with this. */
  description?: string;
  /** Whose ticket it becomes, when staff open it for someone. */
  onBehalfOfId?: string;
}

const pending = new TtlCache<PendingOpen>({ ttlMs: PENDING_TTL_MS });

const key = (guildId: string, userId: string) => `${guildId}:${userId}`;

export function setPendingOpen(guildId: string, userId: string, value: PendingOpen): void {
  pending.set(key(guildId, userId), value);
}

/** Reads without clearing: the form is shown, the ticket isn't made yet. */
export function peekPendingOpen(guildId: string, userId: string): PendingOpen | null {
  return pending.get(key(guildId, userId)) ?? null;
}

/** Reads and clears: the ticket is being made. */
export function takePendingOpen(guildId: string, userId: string): PendingOpen | null {
  const value = pending.get(key(guildId, userId)) ?? null;
  pending.delete(key(guildId, userId));
  return value;
}
