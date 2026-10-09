import { MEDIA_WIDGET_FITS, type MediaWidgetFit } from "../media/media-widget-config";

/**
 * Several pictures taking turns in one spot: sponsors, socials, a schedule.
 * Every picture is a media-library file, shown one at a time.
 */
export const SLIDESHOW_WIDGET_TYPE = "slideshow_widget" as const;
export type SlideshowWidgetType = typeof SLIDESHOW_WIDGET_TYPE;

export const SLIDESHOW_WIDGET_TRANSITIONS = ["fade", "slide", "none"] as const;
export type SlideshowWidgetTransition = (typeof SLIDESHOW_WIDGET_TRANSITIONS)[number];

export const SLIDESHOW_WIDGET_LIMITS = {
  images: 20,
  url: 2000,
  intervalSeconds: { min: 1, max: 120 },
  rounding: { min: 0, max: 100 },
} as const;

/** How long one picture takes to give way to the next. */
export const SLIDESHOW_TRANSITION_MS = 600;

export interface SlideshowWidgetItemConfig {
  /** CDN URLs, in the order they are shown. */
  images: string[];
  /** How long each picture stays up. */
  intervalSeconds: number;
  transition: SlideshowWidgetTransition;
  /** A random picture each time instead of the list order. */
  shuffle: boolean;
  fit: MediaWidgetFit;
  /** Corner rounding in percent. 100 on a square box is a circle. */
  rounding: number;
}

export function createDefaultSlideshowWidgetConfig(): SlideshowWidgetItemConfig {
  return { images: [], intervalSeconds: 5, transition: "fade", shuffle: false, fit: "contain", rounding: 0 };
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function clamped(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;
}

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizeSlideshowWidgetConfig(raw: unknown): SlideshowWidgetItemConfig {
  const d = createDefaultSlideshowWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof SlideshowWidgetItemConfig, unknown>>;
  const L = SLIDESHOW_WIDGET_LIMITS;
  return {
    images: Array.isArray(c.images)
      ? c.images
          .filter((url): url is string => typeof url === "string" && url !== "" && url.length <= L.url)
          .slice(0, L.images)
      : d.images,
    intervalSeconds: clamped(c.intervalSeconds, L.intervalSeconds, d.intervalSeconds),
    transition: oneOf(c.transition, SLIDESHOW_WIDGET_TRANSITIONS, d.transition),
    shuffle: typeof c.shuffle === "boolean" ? c.shuffle : d.shuffle,
    fit: oneOf(c.fit, MEDIA_WIDGET_FITS, d.fit),
    rounding: clamped(c.rounding, L.rounding, d.rounding),
  };
}

/**
 * Which picture comes after `current`. In order it wraps around; shuffled it
 * is any picture but the one on screen, so the same one never shows twice in a
 * row. `random` is 0–1 and injectable for tests.
 */
export function nextSlideIndex(current: number, count: number, shuffle: boolean, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (!shuffle) return (current + 1) % count;
  // Pick among the other count-1 pictures, then step over the current one.
  const pick = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return pick >= current ? pick + 1 : pick;
}
