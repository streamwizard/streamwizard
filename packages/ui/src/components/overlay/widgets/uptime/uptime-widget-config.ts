import {
  DEFAULT_GOOGLE_FONT_FAMILY,
  isValidGoogleFontFamilyName,
  type GoogleFontFamily,
} from "../../types";

/**
 * How long the stream has been live, from the stream's own start time on
 * Twitch. Reads the stream at load and every minute, and follows the
 * sys.stream_* user-state pushes for the moment a stream starts or ends.
 */
export const UPTIME_WIDGET_TYPE = "uptime_widget" as const;
export type UptimeWidgetType = typeof UPTIME_WIDGET_TYPE;

export const UPTIME_WIDGET_LAYOUTS = ["inline", "stacked"] as const;
export type UptimeWidgetLayout = (typeof UPTIME_WIDGET_LAYOUTS)[number];

export const UPTIME_WIDGET_LIMITS = {
  label: 40,
  offlineText: 40,
  fontSize: { min: 10, max: 120 },
} as const;

export interface UptimeWidgetItemConfig {
  /** The words before the time ("Live for"). Empty shows the time alone. */
  label: string;
  /** Label beside the time, or above it. */
  layout: UptimeWidgetLayout;
  showSeconds: boolean;
  /** A pulsing dot before the label, the way a live badge has one. */
  showDot: boolean;
  dotColor: string;
  /** Shown instead of the time while offline, unless hidden. */
  offlineText: string;
  /** Off stream the widget shows nothing (the usual choice for an overlay). */
  hideWhenOffline: boolean;
  fontFamily: GoogleFontFamily;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
  align: "left" | "center" | "right";
  textShadow: boolean;
}

export function createDefaultUptimeWidgetConfig(): UptimeWidgetItemConfig {
  return {
    label: "Live for",
    layout: "inline",
    showSeconds: true,
    showDot: true,
    dotColor: "#ff4d4d",
    offlineText: "Offline",
    hideWhenOffline: true,
    fontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    fontSize: 28,
    fontWeight: 600,
    color: "#ffffff",
    align: "center",
    textShadow: true,
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeUptimeWidgetConfig(raw: unknown): UptimeWidgetItemConfig {
  const d = createDefaultUptimeWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof UptimeWidgetItemConfig, unknown>>;
  const size = typeof c.fontSize === "number" && Number.isFinite(c.fontSize) ? c.fontSize : d.fontSize;
  return {
    label: text(c.label, UPTIME_WIDGET_LIMITS.label, d.label),
    layout: oneOf(c.layout, UPTIME_WIDGET_LAYOUTS, d.layout),
    showSeconds: bool(c.showSeconds, d.showSeconds),
    showDot: bool(c.showDot, d.showDot),
    dotColor: color(c.dotColor, d.dotColor),
    offlineText: text(c.offlineText, UPTIME_WIDGET_LIMITS.offlineText, d.offlineText),
    hideWhenOffline: bool(c.hideWhenOffline, d.hideWhenOffline),
    fontFamily:
      typeof c.fontFamily === "string" && isValidGoogleFontFamilyName(c.fontFamily)
        ? c.fontFamily.trim()
        : d.fontFamily,
    fontSize: Math.round(Math.min(UPTIME_WIDGET_LIMITS.fontSize.max, Math.max(UPTIME_WIDGET_LIMITS.fontSize.min, size))),
    fontWeight: ([400, 500, 600, 700] as const).includes(c.fontWeight as 400)
      ? (c.fontWeight as UptimeWidgetItemConfig["fontWeight"])
      : d.fontWeight,
    color: color(c.color, d.color),
    align: oneOf(c.align, ["left", "center", "right"] as const, d.align),
    textShadow: bool(c.textShadow, d.textShadow),
  };
}

/**
 * Elapsed time as H:MM:SS (or H:MM). Hours keep counting past a day, the way
 * Twitch's own uptime does, so a 30-hour subathon reads 30:00:00.
 */
export function formatUptime(ms: number, showSeconds: boolean): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return showSeconds ? `${h}:${pad2(m)}:${pad2(s)}` : `${h}:${pad2(m)}`;
}

/** The stream from GET /api/twitch/stream (PublicStream in @repo/twitch-assets). */
export interface FetchedStream {
  is_live: boolean;
  started_at: string | null;
}

/** Epoch ms the stream started, or null when offline or unparseable. */
export function startedAtFrom(stream: FetchedStream | null | undefined): number | null {
  if (!stream?.is_live || !stream.started_at) return null;
  const t = Date.parse(stream.started_at);
  return Number.isFinite(t) ? t : null;
}

export interface UptimeWidgetFrame {
  type: string;
  payload?: unknown;
}

/**
 * Applies one socket frame. rest-api writes sys.stream_started_at on
 * stream.online and nulls it on stream.offline, and every user-state write
 * is pushed to the room, so this is how the widget hears a stream start or
 * end between two reads. Returns `undefined` for frames that say nothing.
 */
export function startedAtFromFrame(frame: UptimeWidgetFrame): number | null | undefined {
  if (frame?.type !== "streamwizard.user_state") return undefined;
  const p = frame.payload as { key?: unknown; value?: unknown } | null | undefined;
  if (!p || typeof p !== "object") return undefined;
  if (p.key === "sys.stream_started_at") {
    if (typeof p.value !== "string") return null;
    const t = Date.parse(p.value);
    return Number.isFinite(t) ? t : null;
  }
  if (p.key === "sys.is_live" && p.value === false) return null;
  return undefined;
}
