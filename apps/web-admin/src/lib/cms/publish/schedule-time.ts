// The schedule dialog's time field (<input type="datetime-local">) works in
// the admin's own timezone without one: "2026-10-20T09:00". Pure.

const pad = (value: number) => String(value).padStart(2, "0");

/** A Date as a datetime-local value, in the browser's timezone. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The suggestion for a new schedule: the top of the hour after next. */
export function defaultScheduleTime(now: Date): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 2);
  return next;
}

/** A datetime-local value back to a moment, or null when the field is empty or garbled. */
export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
