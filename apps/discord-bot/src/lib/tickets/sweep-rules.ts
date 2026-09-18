// The stale sweeper's decisions, with no I/O: given the server's two timers
// and the open tickets, which ones get the reminder now and which ones close.
// Everything about time lives here so it can be tested against a fixed clock.

export interface SweepSettings {
  /** Hours without a person's message before the reminder. Null: never. */
  staleAfterHours: number | null;
  /** Hours after the reminder, still with nobody writing, before the ticket closes. Null: never. */
  autoCloseAfterHours: number | null;
}

export interface SweepCandidate {
  id: string;
  created_at: string;
  last_message_at: string | null;
  stale_warned_at: string | null;
}

export interface SweepPlan<T extends SweepCandidate> {
  /** Quiet for long enough and not warned yet. */
  warn: T[];
  /** Warned long enough ago and still nobody wrote: close as inactivity. */
  close: T[];
}

const HOUR_MS = 60 * 60 * 1000;

/** When the ticket was last alive: the last person's message, or its opening. */
export const lastActivityAt = (ticket: SweepCandidate): number =>
  new Date(ticket.last_message_at ?? ticket.created_at).getTime();

export function selectDueTickets<T extends SweepCandidate>(
  settings: SweepSettings,
  tickets: readonly T[],
  now: Date = new Date(),
): SweepPlan<T> {
  const plan: SweepPlan<T> = { warn: [], close: [] };
  if (!settings.staleAfterHours || settings.staleAfterHours <= 0) return plan;

  const staleBefore = now.getTime() - settings.staleAfterHours * HOUR_MS;
  const closeBefore =
    settings.autoCloseAfterHours && settings.autoCloseAfterHours > 0
      ? now.getTime() - settings.autoCloseAfterHours * HOUR_MS
      : null;

  for (const ticket of tickets) {
    const activity = lastActivityAt(ticket);
    if (ticket.stale_warned_at === null) {
      if (activity <= staleBefore) plan.warn.push(ticket);
      continue;
    }
    if (closeBefore === null) continue;
    const warnedAt = new Date(ticket.stale_warned_at).getTime();
    // The archive clears the warning on a reply, so activity after it is only
    // seen here when that write was missed; it still means the ticket is alive.
    if (warnedAt <= closeBefore && activity <= warnedAt) plan.close.push(ticket);
  }
  return plan;
}
