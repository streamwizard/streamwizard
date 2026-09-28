import type { AdSchedule } from "@repo/twitch-api";
import type { PublicAdSchedule } from "./types";

/**
 * A Twitch time as ISO, or null. Twitch documents RFC3339 but has been seen
 * sending unix seconds (as a number or a string); "" and 0 mean "none".
 */
export function adTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") return null;
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    // Seconds; a value this large is already milliseconds.
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null;
}

function count(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Get Ad Schedule with its mixed formats settled; null when Twitch sent nothing. */
export function toPublicAdSchedule(raw: AdSchedule | null | undefined): PublicAdSchedule | null {
  if (!raw) return null;
  return {
    next_ad_at: adTime(raw.next_ad_at),
    last_ad_at: adTime(raw.last_ad_at),
    duration: count(raw.duration),
    preroll_free_time: count(raw.preroll_free_time),
    snooze_count: count(raw.snooze_count),
    snooze_refresh_at: adTime(raw.snooze_refresh_at),
  };
}
