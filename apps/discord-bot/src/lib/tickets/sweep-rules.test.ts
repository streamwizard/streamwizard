import { describe, expect, test } from "bun:test";
import { selectDueTickets, type SweepCandidate } from "./sweep-rules";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

const ticket = (id: string, overrides: Partial<SweepCandidate> = {}): SweepCandidate => ({
  id,
  created_at: hoursAgo(100),
  last_message_at: null,
  stale_warned_at: null,
  ...overrides,
});

const ids = (tickets: SweepCandidate[]) => tickets.map((t) => t.id);

describe("selectDueTickets", () => {
  test("both timers off: nothing happens, however old the tickets", () => {
    const plan = selectDueTickets({ staleAfterHours: null, autoCloseAfterHours: 24 }, [ticket("a")], NOW);
    expect(plan).toEqual({ warn: [], close: [] });
  });

  test("warns tickets quiet for the stale hours, counting from the last person's message or the opening", () => {
    const plan = selectDueTickets(
      { staleAfterHours: 48, autoCloseAfterHours: null },
      [
        ticket("fresh", { last_message_at: hoursAgo(1) }),
        ticket("quiet", { last_message_at: hoursAgo(49) }),
        ticket("never-answered", { created_at: hoursAgo(50) }),
        ticket("new", { created_at: hoursAgo(2) }),
        ticket("exactly", { last_message_at: hoursAgo(48) }),
      ],
      NOW,
    );
    expect(ids(plan.warn)).toEqual(["quiet", "never-answered", "exactly"]);
    expect(plan.close).toEqual([]);
  });

  test("a warned ticket is never warned again", () => {
    const plan = selectDueTickets(
      { staleAfterHours: 1, autoCloseAfterHours: null },
      [ticket("warned", { last_message_at: hoursAgo(80), stale_warned_at: hoursAgo(30) })],
      NOW,
    );
    expect(plan).toEqual({ warn: [], close: [] });
  });

  test("closes only after the reminder has stood unanswered for the auto-close hours", () => {
    const plan = selectDueTickets(
      { staleAfterHours: 48, autoCloseAfterHours: 24 },
      [
        ticket("due", { last_message_at: hoursAgo(80), stale_warned_at: hoursAgo(25) }),
        ticket("not-yet", { last_message_at: hoursAgo(80), stale_warned_at: hoursAgo(23) }),
        // Someone wrote after the reminder but the archive missed clearing it: still alive.
        ticket("replied", { last_message_at: hoursAgo(10), stale_warned_at: hoursAgo(30) }),
        ticket("unwarned", { last_message_at: hoursAgo(80) }),
      ],
      NOW,
    );
    expect(ids(plan.close)).toEqual(["due"]);
    expect(ids(plan.warn)).toEqual(["unwarned"]);
  });

  test("auto-close counts from the reminder, not from the last message", () => {
    // Quiet for a week, but warned only an hour ago: the member gets their full 24 hours.
    const plan = selectDueTickets(
      { staleAfterHours: 48, autoCloseAfterHours: 24 },
      [ticket("just-warned", { last_message_at: hoursAgo(168), stale_warned_at: hoursAgo(1) })],
      NOW,
    );
    expect(plan.close).toEqual([]);
  });

  test("auto-close off leaves warned tickets open forever", () => {
    const plan = selectDueTickets(
      { staleAfterHours: 48, autoCloseAfterHours: null },
      [ticket("warned", { last_message_at: hoursAgo(500), stale_warned_at: hoursAgo(400) })],
      NOW,
    );
    expect(plan.close).toEqual([]);
  });
});
