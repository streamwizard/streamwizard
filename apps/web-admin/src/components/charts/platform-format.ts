import { formatBytesPerSec } from "@/lib/utils";

/** How a Supabase platform chart prints its values. A string, not a function,
 * so the server page can pass it to the client chart. */
export type PlatformValueFormat = "number" | "bytesPerSec";

/** `compact` drops decimals for axis ticks; tooltips keep one. */
export function formatPlatformValue(
  value: number,
  format: PlatformValueFormat,
  unit = "",
  compact = false,
): string {
  if (format === "bytesPerSec") return compact ? compactBytesPerSec(value) : formatBytesPerSec(value);
  if (compact) return `${Math.round(value).toLocaleString()}${unit}`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
}

/** Axis-tick variant of formatBytesPerSec: whole numbers, so ticks stay short
 * enough not to wrap. */
function compactBytesPerSec(v: number): string {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Math.round(v)} ${units[i]}`;
}
