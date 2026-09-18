// When staff are around. Stored on discord_ticket_settings.working_hours as
// jsonb; this file is the one reader and validator of that shape, shared by
// the bot (the notice on a ticket opened outside hours) and web-admin (the
// editor). No zod here: the package doesn't carry it and the shape is small.

export const WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WorkingDay = (typeof WORKING_DAYS)[number];

/** "09:00" to "17:00". End may be "24:00" for "until midnight". */
export interface WorkingRange {
  start: string;
  end: string;
}

export interface WorkingHours {
  /** IANA zone the ranges are written in. */
  timezone: string;
  days: Record<WorkingDay, WorkingRange[]>;
}

export const WORKING_RANGES_PER_DAY = 2;

const TIME = /^([01]\d|2[0-4]):([0-5]\d)$/;

/** Minutes since midnight for "HH:mm", or null when it isn't one. "24:00" is 1440. */
export function parseClock(value: string): number | null {
  const match = TIME.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes > 24 * 60 ? null : minutes;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const emptyWorkingHours = (timezone = "UTC"): WorkingHours => ({
  timezone,
  days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
});

/** Whether any day has a range: with none, there are no working hours and the notice never sends. */
export const hasWorkingHours = (hours: WorkingHours): boolean => WORKING_DAYS.some((day) => hours.days[day].length > 0);

function readRange(value: unknown): WorkingRange | null {
  if (!value || typeof value !== "object") return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  if (typeof start !== "string" || typeof end !== "string") return null;
  const from = parseClock(start);
  const to = parseClock(end);
  if (from === null || to === null || to <= from) return null;
  return { start, end };
}

/**
 * The stored value made whole: a valid zone (else UTC), every day present,
 * bad ranges dropped, ranges in order and capped per day. Null in, empty out.
 */
export function parseWorkingHours(value: unknown): WorkingHours {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const zone = typeof record.timezone === "string" && isValidTimeZone(record.timezone) ? record.timezone : "UTC";
  const hours = emptyWorkingHours(zone);
  const days = record.days && typeof record.days === "object" ? (record.days as Record<string, unknown>) : {};
  for (const day of WORKING_DAYS) {
    const list = Array.isArray(days[day]) ? (days[day] as unknown[]) : [];
    hours.days[day] = list
      .map(readRange)
      .filter((range): range is WorkingRange => range !== null)
      .sort((a, b) => parseClock(a.start)! - parseClock(b.start)!)
      .slice(0, WORKING_RANGES_PER_DAY);
  }
  return hours;
}

/** Problems an editor should show before saving. Empty when the value is good. */
export function workingHoursIssues(hours: WorkingHours): string[] {
  const issues: string[] = [];
  if (!isValidTimeZone(hours.timezone)) issues.push("Pick a time zone.");
  for (const day of WORKING_DAYS) {
    const ranges = hours.days[day];
    if (ranges.length > WORKING_RANGES_PER_DAY) issues.push(`${day}: at most ${WORKING_RANGES_PER_DAY} ranges.`);
    let lastEnd = -1;
    for (const range of ranges) {
      const from = parseClock(range.start);
      const to = parseClock(range.end);
      if (from === null || to === null) {
        issues.push(`${day}: times must look like 09:00.`);
        continue;
      }
      if (to <= from) {
        issues.push(`${day}: ${range.start}–${range.end} ends before it starts.`);
        continue;
      }
      if (from < lastEnd) issues.push(`${day}: ranges overlap.`);
      lastEnd = Math.max(lastEnd, to);
    }
  }
  return issues;
}
