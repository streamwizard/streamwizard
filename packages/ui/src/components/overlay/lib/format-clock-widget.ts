import type { ClockWidgetItemConfig } from "../types";
import { normalizeClockWidgetConfig } from "../types";

function resolvedTimeZone(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: t }).format(new Date());
    return t;
  } catch {
    return undefined;
  }
}

/** Formats current instant for the clock widget (live updates via caller). */
export function formatClockWidgetDisplay(
  config: ClockWidgetItemConfig | Record<string, unknown>,
  at: Date
): string {
  const cfg = normalizeClockWidgetConfig(config);
  const timeZone = resolvedTimeZone(cfg.timeZone);

  if (!cfg.showDate && !cfg.showTime) return "—";

  const timeStyleEff =
    cfg.showTime && cfg.showSeconds ? ("medium" as const) : cfg.timeStyle;

  try {
    if (cfg.layout === "stacked" && cfg.showDate && cfg.showTime) {
      const dFmt = new Intl.DateTimeFormat(undefined, {
        timeZone,
        dateStyle: cfg.dateStyle,
      });
      const tFmt = new Intl.DateTimeFormat(undefined, {
        timeZone,
        timeStyle: timeStyleEff,
        hour12: cfg.hour12,
      });
      return `${dFmt.format(at)}\n${tFmt.format(at)}`;
    }

    const o: Intl.DateTimeFormatOptions = {};
    if (timeZone) o.timeZone = timeZone;
    if (cfg.showDate) o.dateStyle = cfg.dateStyle;
    if (cfg.showTime) {
      o.timeStyle = timeStyleEff;
      o.hour12 = cfg.hour12;
    }

    return new Intl.DateTimeFormat(undefined, o).format(at);
  } catch {
    return new Intl.DateTimeFormat(undefined).format(at);
  }
}
