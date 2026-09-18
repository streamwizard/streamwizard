import { parseClock, WORKING_DAYS, type WorkingDay, type WorkingHours, hasWorkingHours } from "@repo/supabase/queries/ticket-hours";

// Pure time arithmetic on working hours, in the configured zone. No presence
// data, no I/O: "are staff around now" is answered from the clock alone.

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

interface ZonedClock {
  day: WorkingDay;
  /** Minutes since local midnight. */
  minutes: number;
  /** Local calendar date, for building instants. */
  year: number;
  month: number;
  date: number;
}

const WEEKDAY_TO_DAY: Record<string, WorkingDay> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let cached = formatters.get(timeZone);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formatters.set(timeZone, cached);
  }
  return cached;
}

/** The wall clock in `timeZone` at `at`. */
export function zonedClock(timeZone: string, at: Date): ZonedClock {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: WEEKDAY_TO_DAY[parts.weekday ?? ""] ?? "mon",
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    year: Number(parts.year),
    month: Number(parts.month),
    date: Number(parts.day),
  };
}

/** The instant at which the wall clock in `timeZone` reads the given local date and minutes. */
function zonedInstant(timeZone: string, local: { year: number; month: number; date: number }, minutes: number): Date {
  // Guess as if UTC, read back what the zone shows, and shift by the difference. Twice, for a DST edge.
  let guess = Date.UTC(local.year, local.month - 1, local.date) + minutes * MINUTE_MS;
  for (let i = 0; i < 2; i++) {
    const shown = zonedClock(timeZone, new Date(guess));
    const shownUtc = Date.UTC(shown.year, shown.month - 1, shown.date) + shown.minutes * MINUTE_MS;
    const wanted = Date.UTC(local.year, local.month - 1, local.date) + minutes * MINUTE_MS;
    if (shownUtc === wanted) break;
    guess += wanted - shownUtc;
  }
  return new Date(guess);
}

/** True when `at` falls inside one of the day's ranges. Without any ranges anywhere, staff count as always around. */
export function isWithinWorkingHours(hours: WorkingHours, at: Date = new Date()): boolean {
  if (!hasWorkingHours(hours)) return true;
  const clock = zonedClock(hours.timezone, at);
  return hours.days[clock.day].some((range) => {
    const from = parseClock(range.start) ?? 0;
    const to = parseClock(range.end) ?? 0;
    return clock.minutes >= from && clock.minutes < to;
  });
}

/**
 * The next moment working hours begin, strictly after `at`. Null when no
 * hours are set. Looks a week ahead, which covers every configured day.
 */
export function nextOpening(hours: WorkingHours, at: Date = new Date()): Date | null {
  if (!hasWorkingHours(hours)) return null;
  for (let ahead = 0; ahead <= WORKING_DAYS.length; ahead++) {
    const probe = new Date(at.getTime() + ahead * DAY_MS);
    const clock = zonedClock(hours.timezone, probe);
    for (const range of hours.days[clock.day]) {
      const start = parseClock(range.start);
      if (start === null) continue;
      const opening = zonedInstant(hours.timezone, clock, start);
      if (opening.getTime() > at.getTime()) return opening;
    }
  }
  return null;
}

/** Discord's relative timestamp, "in 14 hours", for the notice. */
export const discordRelative = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`;
