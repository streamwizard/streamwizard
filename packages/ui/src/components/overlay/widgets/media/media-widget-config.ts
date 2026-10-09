/**
 * A picture or a video from the media library, placed on the scene as is.
 * The two share everything but playback, so they share this file.
 */
export const IMAGE_WIDGET_TYPE = "image_widget" as const;
export const VIDEO_WIDGET_TYPE = "video_widget" as const;
export type ImageWidgetType = typeof IMAGE_WIDGET_TYPE;
export type VideoWidgetType = typeof VIDEO_WIDGET_TYPE;
export type MediaWidgetType = ImageWidgetType | VideoWidgetType;

/** How the file fills its box: all of it, edge to edge, or stretched to match. */
export const MEDIA_WIDGET_FITS = ["contain", "cover", "fill"] as const;
export type MediaWidgetFit = (typeof MEDIA_WIDGET_FITS)[number];

export const MEDIA_WIDGET_LIMITS = {
  url: 2000,
  rounding: { min: 0, max: 100 },
} as const;

export interface ImageWidgetItemConfig {
  /** CDN URL of the file. Empty = nothing chosen yet. */
  url: string;
  fit: MediaWidgetFit;
  /** Corner rounding in percent. 100 on a square box is a circle. */
  rounding: number;
}

export interface VideoWidgetItemConfig extends ImageWidgetItemConfig {
  loop: boolean;
  /** 0–1. Zero plays the video muted. */
  volume: number;
}

export function createDefaultImageWidgetConfig(): ImageWidgetItemConfig {
  return { url: "", fit: "contain", rounding: 0 };
}

export function createDefaultVideoWidgetConfig(): VideoWidgetItemConfig {
  return { url: "", fit: "contain", rounding: 0, loop: true, volume: 0 };
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function clamped(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeImageWidgetConfig(raw: unknown): ImageWidgetItemConfig {
  const d = createDefaultImageWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ImageWidgetItemConfig, unknown>>;
  return {
    url: typeof c.url === "string" ? c.url.slice(0, MEDIA_WIDGET_LIMITS.url) : d.url,
    fit: oneOf(c.fit, MEDIA_WIDGET_FITS, d.fit),
    rounding: clamped(c.rounding, MEDIA_WIDGET_LIMITS.rounding.min, MEDIA_WIDGET_LIMITS.rounding.max, d.rounding),
  };
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeVideoWidgetConfig(raw: unknown): VideoWidgetItemConfig {
  const d = createDefaultVideoWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VideoWidgetItemConfig, unknown>>;
  return {
    ...normalizeImageWidgetConfig(raw),
    loop: typeof c.loop === "boolean" ? c.loop : d.loop,
    volume: clamped(c.volume, 0, 1, d.volume),
  };
}

/**
 * Rounding percent as a radius in px for a box of this size. 100 is half the
 * short side, which is as round as a corner gets: a circle on a square, a
 * pill on anything wider.
 */
export function roundingRadiusPx(rounding: number, box: { w: number; h: number }): number {
  const half = Math.max(0, Math.min(box.w, box.h)) / 2;
  return (Math.min(100, Math.max(0, rounding)) / 100) * half;
}
